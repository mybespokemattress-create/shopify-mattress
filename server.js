require('dotenv').config();
console.log('✓ Environment variables loaded');
const express = require('express');
console.log('✓ Express loaded');
const path = require('path');
console.log('✓ Path loaded');
const crypto = require('crypto');
console.log('✓ Crypto loaded');
const { Pool } = require('pg');
console.log('✓ PostgreSQL Pool loaded');
const axios = require('axios');
console.log('✓ Axios loaded');

// Import PDF routes
console.log('Attempting to load PDF routes...');
const pdfRoutes = require('./routes/pdf');
console.log('✓ PDF routes loaded successfully');
const zohoAuthRoutes = require('./routes/zoho-auth');
console.log('✓ Zoho auth routes loaded successfully');
const emailRoutes = require('./routes/email');
console.log('✓ Email routes loaded successfully');
console.log('Loading diagram routes...');
const diagramRoutes = require('./routes/diagrams');
console.log('✓ Diagram routes loaded successfully');
console.log('Loading product mapping routes...');
const productMappingRoutes = require('./routes/product-mapping');
console.log('✓ Product mapping routes loaded successfully');

const app = express();
console.log('✓ Express app created');
const port = process.env.PORT || 8080;
console.log('✓ Port configured:', port);

// Database configuration
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

const pool = new Pool(dbConfig);

// Make database available to routes
app.locals.db = pool;

// FIXED: Configure store settings to match actual Railway variable assignments
app.locals.storeConfigs = {
  'uxyxaq-pu.myshopify.com': {
    name: 'Motorhome Mattresses', 
    webhookSecret: process.env.STORE1_WEBHOOK_SECRET || 'default-secret'
  },
  'mattressmade.myshopify.com': {
    name: 'My Bespoke Mattresses',
    webhookSecret: process.env.STORE2_WEBHOOK_SECRET || 'default-secret'
  },
  'd587eb.myshopify.com': {
    name: 'Caravan Mattresses',
    webhookSecret: process.env.STORE3_WEBHOOK_SECRET || 'default-secret'
  }
};

// IMPORTANT: Webhook routes BEFORE JSON middleware
app.use('/webhook', require('./routes/webhooks'));

// Middleware (after webhook routes)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// IMPORTANT: Mount API routes BEFORE static files
app.use('/api/pdf', pdfRoutes);
app.use('/auth/zoho', zohoAuthRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/diagrams', diagramRoutes);
app.use('/api/mapping', productMappingRoutes.router);

// ADD THIS DEBUG ROUTE HERE:
app.get('/debug-test', (req, res) => {
  res.json({ 
    message: 'Debug route works!',
    timestamp: new Date(),
    routes_loaded: 'yes'
  });
});

// Serve static files from React build - FIXED PATH
app.use(express.static(path.join(__dirname, 'client/build')));
// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// CORS headers for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const dbResult = await pool.query('SELECT NOW()');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      server: 'operational'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// Helper function to extract customer notes from Shopify order
function extractCustomerNotes(order) {
  // Check multiple possible locations for customer notes
  const noteLocations = [
    order.note,
    order.notes,
    order.customer_note,
    order.buyer_accepts_marketing && order.note_attributes?.find(attr => attr.name === 'note')?.value,
    order.line_items?.[0]?.properties?.find(prop => prop.name === 'note' || prop.name === 'Notes')?.value
  ];

  // Return the first non-empty note found
  for (const note of noteLocations) {
    if (note && typeof note === 'string' && note.trim().length > 0) {
      return note.trim();
    }
  }

  return '';
}

// Helper function to determine mattress label from store domain
function getMattressLabelFromStore(order) {
  try {
    // Extract shop domain from order data
    const shopDomain = order.shop_domain || order.gateway || '';
    
    if (shopDomain.includes('caravan')) {
      return 'CaravanMattresses';
    } else if (shopDomain.includes('motorhome')) {
      return 'MotorhomeMattresses';
    } else if (shopDomain.includes('bespoke')) {
      return 'MyBespokeMattresses';
    }

    // Default fallback
    return 'CaravanMattresses';
  } catch (error) {
    console.error('Error determining mattress label:', error);
    return 'CaravanMattresses';
  }
}

// Enhanced Process Shopify order function with product mapping
async function processShopifyOrder(order) {
  try {
    console.log(`Processing order: ${order.order_number}`);
    
    // Extract customer notes and mattress label
    const customerNotes = extractCustomerNotes(order);
    const mattressLabel = getMattressLabelFromStore(order);
    
    console.log(`Extracted notes: ${customerNotes ? 'Yes' : 'None'}`);
    console.log(`Mattress label: ${mattressLabel}`);
    
    // Process each line item with product mapping
    const processedItems = [];
    
    for (const item of order.line_items) {
      console.log(`\nProcessing item: ${item.title}`);
      
      // Use the mapping system to get supplier specification
      let supplierSpec = 'Mapping required';
      let mappingConfidence = 0;
      
      try {
        // Call the product mapping system
        const { mapProduct } = require('./routes/product-mapping');
        
        const mappingResult = mapProduct(
          item.title,
          item.variant_title ? { title: item.variant_title } : null,
          item.properties || null,
          item.sku || null
        );
        
        if (mappingResult.success && mappingResult.specification) {
          supplierSpec = mappingResult.specification.fullSpecification;
          mappingConfidence = mappingResult.confidence;
          console.log(`✓ Mapped: ${supplierSpec}`);
        } else {
          console.log(`✗ Mapping failed: ${mappingResult.error}`);
        }
        
      } catch (mappingError) {
        console.error('Mapping system error:', mappingError);
      }
      
      processedItems.push({
        title: item.title,
        sku: item.sku || 'N/A',
        quantity: item.quantity,
        price: item.price,
        supplier_specification: supplierSpec,
        mapping_confidence: mappingConfidence
      });
    }
    
    // Extract measurements from order
    const extractedMeasurements = extractMeasurementsFromOrder(order);
    
    // Store order in database with processed items
    const insertQuery = `
      INSERT INTO processed_orders (
        shopify_order_id,
        order_number,
        customer_name,
        customer_email,
        total_price,
        order_data,
        extracted_measurements,
        line_items,
        processing_status,
        notes,
        mattress_label,
        created_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (shopify_order_id) 
      DO UPDATE SET
        order_data = EXCLUDED.order_data,
        extracted_measurements = EXCLUDED.extracted_measurements,
        line_items = EXCLUDED.line_items,
        notes = EXCLUDED.notes,
        mattress_label = EXCLUDED.mattress_label,
        updated_date = NOW()
    `;
    
    const customerName = order.customer ? 
      `${order.customer.first_name} ${order.customer.last_name}` : 
      order.billing_address?.name || 'Unknown';
    
    await pool.query(insertQuery, [
      order.id,
      order.order_number,
      customerName,
      order.customer?.email || order.email,
      order.total_price,
      JSON.stringify(order),
      JSON.stringify(extractedMeasurements),
      JSON.stringify(processedItems), // Store the processed items with specifications
      'received',
      customerNotes,
      mattressLabel,
      new Date(order.created_at)
    ]);
    
    console.log(`Order ${order.order_number} stored successfully with ${processedItems.length} mapped items`);
    
  } catch (error) {
    console.error('Error processing order:', error);
    throw error;
  }
}

// Extract measurements from order (implement your logic)
function extractMeasurementsFromOrder(order) {
  // This is a placeholder - implement your actual measurement extraction logic
  const measurements = {};
  
  // Look for measurements in order notes, line items, or custom attributes
  if (order.note) {
    // Extract measurements from notes using regex or other methods
    // Example: Look for patterns like "A: 200cm", "B: 150cm", etc.
  }
  
  // Look in line item properties
  if (order.line_items) {
    order.line_items.forEach(item => {
      if (item.properties) {
        item.properties.forEach(prop => {
          // Extract measurements from properties
        });
      }
    });
  }
  
  return measurements;
}

// Get all orders endpoint - FIXED COLUMN NAMES
app.get('/api/orders', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    const query = `
      SELECT 
        id,
        order_number,
        customer_name,
        customer_email,
        total_price,
        processing_status,
        notes,
        mattress_label,
        order_data,
        extracted_measurements,
        line_items,
        created_date,
        updated_date,
        email_sent,
        has_custom_diagram,
        custom_diagram_url,
        diagram_upload_date
      FROM processed_orders 
      ORDER BY created_date DESC 
      LIMIT $1 OFFSET $2
      `;
    
    const countQuery = 'SELECT COUNT(*) FROM processed_orders';
    
    const [ordersResult, countResult] = await Promise.all([
      pool.query(query, [limit, offset]),
      pool.query(countQuery)
    ]);
    
    const totalOrders = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalOrders / limit);
    
    res.json({
      orders: ordersResult.rows,
      pagination: {
        page,
        limit,
        totalOrders,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get single order endpoint
app.get('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        *,
        order_data::json as order_data,
        extracted_measurements::json as extracted_measurements
      FROM processed_orders 
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Update order endpoint - handles both status and other fields - FIXED COLUMN NAMES
app.put('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      processing_status, notes, mattress_label, email_sent,
      order_number, customer_name, customer_email, order_date,
      supplier_code, product_sku, quantity,
      dimension_a, dimension_b, dimension_c, dimension_d, dimension_e, dimension_f, dimension_g,
      radius_top_corner, radius_bottom_corner, finished_size_max,
      link_attachment, delivery_option, measurements
    } = req.body;
    
    const updateFields = [];
    const values = [];
    let valueIndex = 1;
    
    if (processing_status !== undefined) {
      updateFields.push(`processing_status = $${valueIndex++}`);
      values.push(processing_status);
    }
    
    if (notes !== undefined) {
      updateFields.push(`notes = $${valueIndex++}`);
      values.push(notes);
    }
    
    if (mattress_label !== undefined) {
      updateFields.push(`mattress_label = $${valueIndex++}`);
      values.push(mattress_label);
    }

    if (email_sent !== undefined) {
      updateFields.push(`email_sent = $${valueIndex++}`);
      values.push(email_sent);
    }

    if (order_number !== undefined) {
      updateFields.push(`order_number = $${valueIndex++}`);
      values.push(order_number);
    }

    if (customer_name !== undefined) {
      updateFields.push(`customer_name = $${valueIndex++}`);
      values.push(customer_name);
    }

    if (customer_email !== undefined) {
      updateFields.push(`customer_email = $${valueIndex++}`);
      values.push(customer_email);
    }

    if (order_date !== undefined) {
      updateFields.push(`order_date = $${valueIndex++}`);
      values.push(order_date);
    }

    if (supplier_code !== undefined) {
      updateFields.push(`supplier_code = $${valueIndex++}`);
      values.push(supplier_code);
    }

    if (product_sku !== undefined) {
      updateFields.push(`product_sku = $${valueIndex++}`);
      values.push(product_sku);
    }

    if (quantity !== undefined) {
      updateFields.push(`quantity = $${valueIndex++}`);
      values.push(quantity);
    }

    if (dimension_a !== undefined) {
      updateFields.push(`dimension_a = $${valueIndex++}`);
      values.push(dimension_a);
    }

    if (dimension_b !== undefined) {
      updateFields.push(`dimension_b = $${valueIndex++}`);
      values.push(dimension_b);
    }

    if (dimension_c !== undefined) {
      updateFields.push(`dimension_c = $${valueIndex++}`);
      values.push(dimension_c);
    }

    if (dimension_d !== undefined) {
      updateFields.push(`dimension_d = $${valueIndex++}`);
      values.push(dimension_d);
    }

    if (dimension_e !== undefined) {
      updateFields.push(`dimension_e = $${valueIndex++}`);
      values.push(dimension_e);
    }

    if (dimension_f !== undefined) {
      updateFields.push(`dimension_f = $${valueIndex++}`);
      values.push(dimension_f);
    }

    if (dimension_g !== undefined) {
      updateFields.push(`dimension_g = $${valueIndex++}`);
      values.push(dimension_g);
    }

    if (radius_top_corner !== undefined) {
      updateFields.push(`radius_top_corner = $${valueIndex++}`);
      values.push(radius_top_corner);
    }

    if (radius_bottom_corner !== undefined) {
      updateFields.push(`radius_bottom_corner = $${valueIndex++}`);
      values.push(radius_bottom_corner);
    }

    if (finished_size_max !== undefined) {
      updateFields.push(`finished_size_max = $${valueIndex++}`);
      values.push(finished_size_max);
    }

    if (link_attachment !== undefined) {
      updateFields.push(`link_attachment = $${valueIndex++}`);
      values.push(link_attachment);
    }

    if (delivery_option !== undefined) {
      updateFields.push(`delivery_option = $${valueIndex++}`);
      values.push(delivery_option);
    }

    if (measurements !== undefined) {
      updateFields.push(`order_data = $${valueIndex++}`);
      const existingOrder = await pool.query('SELECT order_data FROM processed_orders WHERE id = $1', [id]);
      let orderData = existingOrder.rows[0]?.order_data || {};
      orderData.measurements = measurements;
      values.push(JSON.stringify(orderData));
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updateFields.push('updated_date = NOW()');
    values.push(id);
    
    const query = `
      UPDATE processed_orders 
      SET ${updateFields.join(', ')} 
      WHERE id = $${valueIndex} 
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// Legacy status update endpoint for backwards compatibility - FIXED COLUMN NAMES
app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const query = `
      UPDATE processed_orders 
      SET processing_status = $1, updated_date = NOW() 
      WHERE id = $2 
      RETURNING *
    `;
    
    const result = await pool.query(query, [status, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Search orders endpoint - FIXED COLUMN NAMES
app.get('/api/orders/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    
    const searchQuery = `
      SELECT 
        id,
        order_number,
        customer_name,
        customer_email,
        total_price,
        processing_status,
        notes,
        mattress_label,
        created_date
      FROM processed_orders 
      WHERE 
        order_number ILIKE $1 OR
        customer_name ILIKE $1 OR
        customer_email ILIKE $1 OR
        notes ILIKE $1
      ORDER BY created_date DESC 
      LIMIT 50
    `;
    
    const result = await pool.query(searchQuery, [`%${query}%`]);
    
    res.json({
      orders: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error searching orders:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] Error:`, err.message);
    console.error(err.stack);

    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        timestamp
    });
});

// Catch-all route for React app - MUST BE LAST
app.get('*', (req, res) => {
    const reactBuildPath = path.join(__dirname, 'client/build/index.html');
    
    if (require('fs').existsSync(reactBuildPath)) {
        res.sendFile(reactBuildPath);
    } else {
        res.status(503).json({
            error: 'React app not built',
            message: 'Please run "npm run build" in the client directory',
            timestamp: new Date().toISOString()
        });
    }
});

// Start server - using Pool connection
async function startServer() {
    try {
        console.log('Starting server...');
        
        // Test database connection
        console.log('Testing database connection...');
        await pool.query('SELECT NOW()');
        console.log('Database connection established successfully');

        // Log configured webhook secrets for debugging
        console.log('Webhook secrets configured:');
        Object.entries(app.locals.storeConfigs).forEach(([domain, config]) => {
            const secretType = config.webhookSecret === 'default-secret' ? 'DEFAULT' : 'CONFIGURED';
            console.log(`  ${config.name} (${domain}): ${secretType}`);
        });

        console.log('Starting Express server...');
        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
            console.log(`React App: http://localhost:${port}/`);
            console.log(`API Orders: http://localhost:${port}/api/orders`);
            console.log(`Health Check: http://localhost:${port}/api/health`);
            console.log(`PDF Generation: http://localhost:${port}/api/pdf/`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log('✓ Customer notes and mattress label functionality enabled');
            console.log('✓ All database column names fixed');
            console.log('✓ Per-store webhook secrets configured');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        process.exit(1);
    }
}

console.log('Calling startServer...');
startServer();
console.log('startServer called');

module.exports = {
  processShopifyOrder
};