const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');
// const htmlPdf = require('html-pdf-node'); // COMMENTED OUT - will add Railway-compatible PDF solution
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Import database functions - RESTORED
const db = require('./database/db');

// Import webhook routes - RESTORED
const webhookRoutes = require('./routes/webhooks');

// Store configuration
const storeConfigs = {
    [process.env.STORE1_DOMAIN]: {
        name: process.env.STORE1_NAME,
        accessToken: process.env.STORE1_ACCESS_TOKEN,
        webhookSecret: process.env.STORE1_WEBHOOK_SECRET
    },
    [process.env.STORE2_DOMAIN]: {
        name: process.env.STORE2_NAME,
        accessToken: process.env.STORE2_ACCESS_TOKEN,
        webhookSecret: process.env.STORE2_WEBHOOK_SECRET
    },
    [process.env.STORE3_DOMAIN]: {
        name: process.env.STORE3_NAME,
        accessToken: process.env.STORE3_ACCESS_TOKEN,
        webhookSecret: process.env.STORE3_WEBHOOK_SECRET
    }
};

// Make store configs available to routes
app.locals.storeConfigs = storeConfigs;

// Webhook routes (before JSON middleware) - RESTORED
app.use('/webhook', webhookRoutes);

// Middleware for other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve React static files
app.use(express.static(path.join(__dirname, 'client/build')));

// Serve legacy public folder
app.use(express.static(path.join(__dirname, 'public')));

// Logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// API Routes for React frontend - RESTORED WITH REAL DATABASE
app.get('/api/orders', async (req, res) => {
    try {
        console.log('API: Fetching orders...');
        const { search, limit = 20 } = req.query;
        let orders;

        if (search) {
            orders = await db.orders.searchOrders(search, parseInt(limit));
        } else {
            orders = await db.orders.getAllOrders(parseInt(limit));
        }

        console.log(`API: Found ${orders.length} orders`);
        if (orders.length > 0) {
            console.log('First order sample:', {
                id: orders[0].id,
                order_number: orders[0].order_number,
                customer_name: orders[0].customer_name
            });
        }
        
        res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
    }
});

app.get('/api/orders/:id', async (req, res) => {
    try {
        const order = await db.orders.getOrderById(req.params.id);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json(order);
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});

app.put('/api/orders/:id', async (req, res) => {
    try {
        const updatedOrder = await db.orders.updateOrder(req.params.id, req.body);
        if (!updatedOrder) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json(updatedOrder);
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ error: 'Failed to update order' });
    }
});

// Order statistics endpoint - RESTORED
app.get('/api/stats', async (req, res) => {
    try {
        const stats = await db.orders.getOrderStats();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Debug endpoint to check database contents - RESTORED
app.get('/api/debug/check', async (req, res) => {
    try {
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        // Check what tables exist
        const tables = await pool.query(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public'
        `);
        
        // Check processed_orders count
        const orderCount = await pool.query(`
            SELECT COUNT(*) as count FROM processed_orders
        `);
        
        // Get first 5 orders
        const orders = await pool.query(`
            SELECT id, order_number, customer_name, created_date 
            FROM processed_orders 
            ORDER BY created_date DESC 
            LIMIT 5
        `);
        
        res.json({
            tables: tables.rows.map(t => t.tablename),
            orderCount: orderCount.rows[0].count,
            sampleOrders: orders.rows
        });
    } catch (error) {
        res.json({ error: error.message, stack: error.stack });
    }
});

// Test endpoint to manually create an order - RESTORED
app.post('/api/test/create-order', async (req, res) => {
    try {
        const timestamp = Date.now().toString();
        const testOrderData = {
            orderId: timestamp,
            order_number: `#TEST-${timestamp}`,
            store_domain: 'test-store.myshopify.com',
            customerName: 'Test Customer',
            customerEmail: 'test@example.com',
            totalPrice: 99.99,
            order_data: { 
                id: timestamp,
                test: true,
                line_items: [{
                    sku: 'TEST-SKU',
                    title: 'Test Product',
                    quantity: 1,
                    price: 99.99
                }],
                customer: {
                    email: 'test@example.com',
                    first_name: 'Test',
                    last_name: 'Customer'
                }
            }
        };
        
        console.log('Creating test order with data:', testOrderData);
        const testOrder = await db.orders.create(testOrderData);
        
        res.json({ 
            success: true, 
            order: testOrder,
            message: 'Test order created successfully'
        });
    } catch (error) {
        console.error('Test order creation failed:', error);
        res.status(500).json({ 
            error: error.message, 
            stack: error.stack,
            details: 'Check server logs for more information'
        });
    }
});

// Debug endpoint to clear all orders - RESTORED
app.get('/debug/clear-orders', async (req, res) => {
    try {
        console.log('🗑️ Clearing all orders from database...');
        
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        // Direct SQL query to delete all orders
        const result = await pool.query('DELETE FROM processed_orders');
        
        console.log(`✅ Deleted ${result.rowCount || 0} orders from database`);
        
        res.json({ 
            success: true,
            message: `Successfully deleted ${result.rowCount || 0} orders from database`,
            deletedCount: result.rowCount || 0,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error clearing orders:', error);
        res.status(500).json({ 
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Debug endpoint to count orders - RESTORED
app.get('/debug/count-orders', async (req, res) => {
    try {
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        const result = await pool.query('SELECT COUNT(*) as count FROM processed_orders');
        const count = result.rows[0].count;
        
        res.json({
            success: true,
            orderCount: parseInt(count),
            message: `Database contains ${count} orders`,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error counting orders:', error);
        res.status(500).json({ 
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Enhanced PDF generation with full order details
function generatePurchaseOrderPDF(order) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: 40, bottom: 40, left: 40, right: 40 }
            });

            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Company colours
            const primaryColor = '#2c3e50';
            const accentColor = '#3498db';
            const successColor = '#27ae60';

            let yPosition = 50;

            // Header
            yPosition = addPDFHeader(doc, order, primaryColor, accentColor, successColor, yPosition);
            
            // Order & Customer Info (side by side)
            yPosition = addOrderAndCustomerInfo(doc, order, primaryColor, yPosition);
            
            // Product Information Section
            yPosition = addProductInformation(doc, order, primaryColor, accentColor, yPosition);
            
            // Measurements & Specifications
            yPosition = addMeasurementsSection(doc, order, primaryColor, yPosition);
            
            // Line Items Table
            yPosition = addDetailedLineItems(doc, order, primaryColor, accentColor, yPosition);
            
            // Total Section
            yPosition = addTotalSection(doc, order, successColor, yPosition);
            
            // Footer
            addPDFFooter(doc, primaryColor);

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

function addPDFHeader(doc, order, primaryColor, accentColor, successColor, yPos) {
    // Company Name
    doc.font('Helvetica-Bold').fontSize(22).fillColor(primaryColor)
       .text('Bespoke Mattress Company', 40, yPos);
    
    // Document Title
    doc.font('Helvetica').fontSize(14).fillColor(accentColor)
       .text('Purchase Order & Manufacturing Specification', 40, yPos + 25);
    
    // Order Number (prominent)
    doc.font('Helvetica-Bold').fontSize(12).fillColor(primaryColor)
       .text(`Order: ${order.order_number || 'N/A'}`, 40, yPos + 45);
    
    // Status Badge
    doc.rect(450, yPos + 20, 80, 20).fill(successColor);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('white')
       .text('CONFIRMED', 470, yPos + 27);
    
    // Divider line
    doc.moveTo(40, yPos + 70).lineTo(555, yPos + 70)
       .strokeColor(primaryColor).lineWidth(2).stroke();
    
    return yPos + 90;
}

function addOrderAndCustomerInfo(doc, order, primaryColor, yPos) {
    // Order Information Box
    doc.rect(40, yPos, 250, 80).fillColor('#f8f9fa').fill();
    doc.font('Helvetica-Bold').fontSize(11).fillColor(primaryColor)
       .text('Order Information', 50, yPos + 10);
    
    doc.font('Helvetica').fontSize(9).fillColor('#333333')
       .text(`Order Number: ${order.order_number || 'N/A'}`, 50, yPos + 25)
       .text(`Date: ${order.created_date ? new Date(order.created_date).toLocaleDateString('en-GB') : 'N/A'}`, 50, yPos + 38)
       .text(`Store: ${order.store_domain || 'N/A'}`, 50, yPos + 51)
       .text(`Status: ${order.processing_status || 'Received'}`, 50, yPos + 64);

    // Customer Information Box
    doc.rect(305, yPos, 250, 80).fillColor('#f8f9fa').fill();
    doc.font('Helvetica-Bold').fontSize(11).fillColor(primaryColor)
       .text('Customer Information', 315, yPos + 10);
    
    doc.font('Helvetica').fontSize(9).fillColor('#333333')
       .text(`Name: ${order.customer_name || 'N/A'}`, 315, yPos + 25)
       .text(`Email: ${order.customer_email || 'N/A'}`, 315, yPos + 38)
       .text(`Phone: ${order.order_data?.order_data?.customer?.phone || 'N/A'}`, 315, yPos + 51)
       .text(`Total: £${order.total_price || '0.00'}`, 315, yPos + 64);

    return yPos + 100;
}

function addProductInformation(doc, order, primaryColor, accentColor, yPos) {
    // Get line items with proper nesting
    const lineItems = order.order_data?.order_data?.line_items || [];
    
    if (lineItems.length === 0) {
        return yPos;
    }

    const item = lineItems[0]; // First item for detailed display
    
    doc.font('Helvetica-Bold').fontSize(12).fillColor(primaryColor)
       .text('Product Specification', 40, yPos);
    
    // Product details box
    doc.rect(40, yPos + 20, 515, 100).fillColor('#f0f8ff').fill();
    
    // Product name (main title)
    doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryColor)
       .text(`Product: ${item.title || 'N/A'}`, 50, yPos + 30, { width: 495 });
    
    // SKU and variant
    doc.font('Helvetica').fontSize(9).fillColor('#333333')
       .text(`SKU: ${item.sku || 'N/A'}`, 50, yPos + 50)
       .text(`Variant: ${item.variant_title || 'N/A'}`, 50, yPos + 63)
       .text(`Quantity: ${item.quantity || 1}`, 50, yPos + 76)
       .text(`Unit Price: £${item.price || '0.00'}`, 200, yPos + 76);

    // Properties (firmness, etc.)
    if (item.properties && item.properties.length > 0) {
        let propY = yPos + 89;
        const relevantProps = item.properties.filter(prop => prop.value && prop.value !== '');
        
        if (relevantProps.length > 0) {
            doc.font('Helvetica-Bold').fontSize(8).fillColor('#666666')
               .text('Specifications: ', 50, propY);
            
            let propText = relevantProps.map(prop => `${prop.name}: ${prop.value}`).join(' | ');
            doc.font('Helvetica').fontSize(8).fillColor('#333333')
               .text(propText, 120, propY, { width: 425 });
        }
    }
    
    return yPos + 140;
}

function addMeasurementsSection(doc, order, primaryColor, yPos) {
    // Extract measurements from the order data
    const extractedMeasurements = order.order_data?.extracted_measurements || [];
    
    if (extractedMeasurements.length === 0) {
        return yPos;
    }
    
    const measurements = extractedMeasurements[0];
    
    doc.font('Helvetica-Bold').fontSize(12).fillColor(primaryColor)
       .text('Measurements & Shape Diagram', 40, yPos);
    
    // Measurements table
    doc.rect(40, yPos + 20, 250, 120).fillColor('#f8f9fa').fill();
    doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryColor)
       .text('Dimensions', 50, yPos + 30);
    
    // Table headers
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#666666')
       .text('Dimension', 50, yPos + 45)
       .text('Value (cm)', 150, yPos + 45)
       .text('Status', 220, yPos + 45);
    
    // Draw measurement rows
    const dimensions = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    let rowY = yPos + 58;
    
    dimensions.forEach((dim, index) => {
        const measurement = measurements.measurements?.[dim];
        const value = measurement ? measurement.value : 'Not provided';
        const status = measurements.provided?.includes(dim) ? '✓' : measurements.missing?.includes(dim) ? '✗' : '-';
        
        doc.font('Helvetica').fontSize(8).fillColor('#333333')
           .text(dim, 50, rowY)
           .text(value, 150, rowY)
           .text(status, 230, rowY);
        
        rowY += 12;
    });
    
    // Shape diagram placeholder (right side)
    doc.rect(305, yPos + 20, 250, 120).fillColor('#ffffff').fill();
    doc.rect(305, yPos + 20, 250, 120).strokeColor('#cccccc').stroke();
    
    doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryColor)
       .text('Shape Diagram', 315, yPos + 30);
    
    // Get diagram number if available
    const diagramNumber = measurements.property_Diagram_Number || measurements['property_Diagram Number'] || 'N/A';
    doc.font('Helvetica').fontSize(9).fillColor('#666666')
       .text(`Diagram: ${diagramNumber}`, 315, yPos + 45);
    
    // Simple diagram representation
    if (diagramNumber === '3') {
        // Draw a basic caravan shape for diagram 3
        drawCaravanShape(doc, 350, yPos + 65, 160, 60);
    } else {
        doc.font('Helvetica').fontSize(9).fillColor('#999999')
           .text('Diagram will be referenced\nduring manufacturing', 315, yPos + 80);
    }
    
    return yPos + 160;
}

function drawCaravanShape(doc, x, y, width, height) {
    // Simple caravan mattress shape representation
    doc.strokeColor('#3498db').lineWidth(1);
    
    // Main rectangle
    doc.rect(x, y, width, height).stroke();
    
    // Curved foot end (simple representation)
    doc.moveTo(x, y + height * 0.7)
       .quadraticCurveTo(x - 15, y + height, x, y + height)
       .stroke();
    
    // Labels
    doc.font('Helvetica').fontSize(7).fillColor('#666666')
       .text('A', x + width/2, y - 10)
       .text('B', x - 15, y + height/2)
       .text('Foot-End Bolster', x + 10, y + height + 5);
}

function addDetailedLineItems(doc, order, primaryColor, accentColor, yPos) {
    doc.font('Helvetica-Bold').fontSize(12).fillColor(primaryColor)
       .text('Order Items Detail', 40, yPos);
    
    // Table header
    const tableTop = yPos + 20;
    doc.rect(40, tableTop, 515, 20).fillColor(accentColor).fill();
    
    doc.font('Helvetica-Bold').fontSize(9).fillColor('white')
       .text('Product', 45, tableTop + 6)
       .text('SKU', 300, tableTop + 6)
       .text('Qty', 380, tableTop + 6)
       .text('Price', 420, tableTop + 6)
       .text('Total', 480, tableTop + 6);
    
    // Line items
    const lineItems = order.order_data?.order_data?.line_items || [];
    let rowY = tableTop + 20;
    
    if (lineItems.length === 0) {
        doc.font('Helvetica').fontSize(9).fillColor('#666666')
           .text('No items found in order data', 50, rowY + 5);
        return yPos + 60;
    }
    
    lineItems.forEach((item, index) => {
        // Alternate row colours
        if (index % 2 === 0) {
            doc.rect(40, rowY, 515, 25).fillColor('#f8f9fa').fill();
        }
        
        // Product name (truncated if too long)
        const productName = item.title || item.name || 'Product';
        doc.font('Helvetica').fontSize(8).fillColor('#333333')
           .text(productName, 45, rowY + 5, { width: 245, ellipsis: true })
           .text(item.sku || 'N/A', 300, rowY + 5)
           .text((item.quantity || 1).toString(), 385, rowY + 5)
           .text(`£${item.price || '0.00'}`, 420, rowY + 5)
           .text(`£${((item.quantity || 1) * (parseFloat(item.price) || 0)).toFixed(2)}`, 480, rowY + 5);
        
        // Additional product details on second line
        if (item.variant_title) {
            doc.font('Helvetica').fontSize(7).fillColor('#666666')
               .text(item.variant_title, 45, rowY + 15, { width: 245, ellipsis: true });
        }
        
        rowY += 25;
    });
    
    return rowY + 10;
}

function addTotalSection(doc, order, successColor, yPos) {
    // Total background
    doc.rect(400, yPos, 155, 35).fillColor('#e8f5e8').fill();
    doc.rect(400, yPos, 155, 35).strokeColor(successColor).lineWidth(2).stroke();
    
    // Total label and value
    doc.font('Helvetica-Bold').fontSize(12).fillColor(successColor)
       .text('Total Amount:', 410, yPos + 10);
    
    doc.font('Helvetica-Bold').fontSize(14).fillColor(successColor)
       .text(`£${order.total_price || '0.00'}`, 490, yPos + 10);
    
    return yPos + 55;
}

function addPDFFooter(doc, primaryColor) {
    const footerY = 750;
    
    // Footer line
    doc.moveTo(40, footerY).lineTo(555, footerY)
       .strokeColor('#dddddd').lineWidth(1).stroke();
    
    // Footer text
    doc.font('Helvetica').fontSize(7).fillColor('#999999')
       .text(`Generated: ${new Date().toLocaleString('en-GB')}`, 40, footerY + 8)
       .text('Bespoke Mattress Company | Professional Manufacturing Specification', 40, footerY + 18)
       .text('This document contains all specifications required for manufacturing', 40, footerY + 28);
}

// PDF download endpoint
app.get('/api/orders/:id/pdf', async (req, res) => {
    try {
        const orderId = req.params.id;
        console.log(`PDF generation requested for order ${orderId}...`);
        
        const order = await db.orders.getOrderById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        console.log('Generating styled PDF with PDFKit...');
        const pdfBuffer = await generatePurchaseOrderPDF(order);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="purchase-order-${order.order_number || orderId}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);
        
        console.log(`PDF generated and sent for order ${orderId}`);
        
    } catch (error) {
        console.error('PDF generation failed:', error);
        res.status(500).json({ 
            error: 'PDF generation failed', 
            details: error.message,
            orderId: req.params.id
        });
    }
});

// Test PDF endpoint (returns status instead of generating PDF)
app.get('/api/test-pdf', async (req, res) => {
    try {
        console.log('PDF test endpoint called...');
        
        res.json({
            success: true,
            message: 'PDF generation working via print function',
            note: 'Use /api/orders/:id/pdf for printable order documents',
            timestamp: new Date().toLocaleString('en-GB')
        });
        
    } catch (error) {
        console.error('PDF test failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Email sending endpoint (placeholder)
app.post('/api/orders/:id/email', async (req, res) => {
    try {
        res.json({ message: 'Email sending coming soon', orderId: req.params.id });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ error: 'Failed to send email' });
    }
});

// Health check endpoint - RESTORED WITH DATABASE
app.get('/health', async (req, res) => {
    const reactBuildExists = require('fs').existsSync(path.join(__dirname, 'client/build/index.html'));
    
    try {
        const dbHealthy = await db.isHealthy();
        const orderCount = await db.orders.getAllOrders(1);
        
        res.json({
            status: 'healthy',
            database: dbHealthy,
            orderCount: orderCount.length,
            stores: Object.keys(storeConfigs),
            reactBuild: reactBuildExists ? 'available' : 'missing',
            pdfGeneration: 'PDFKit (styled PDF files)',
            webhooks: 'enabled',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.json({
            status: 'partial',
            database: false,
            error: error.message,
            stores: Object.keys(storeConfigs),
            reactBuild: reactBuildExists ? 'available' : 'missing',
            pdfGeneration: 'PDFKit (styled PDF files)',
            webhooks: 'enabled',
            timestamp: new Date().toISOString()
        });
    }
});

// Catch-all route for React app
app.use((req, res, next) => {
    // Skip if this is an API route or already handled
    if (req.path.startsWith('/api/') || req.path.startsWith('/webhook/') || req.path === '/health') {
        return next();
    }
    
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

// Initialise database and start server - RESTORED
async function startServer() {
    try {
        await db.initialize();
        console.log('Database initialised successfully');

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`React App: http://localhost:${PORT}/`);
            console.log(`API Orders: http://localhost:${PORT}/api/orders`);
            console.log(`Health Check: http://localhost:${PORT}/health`);
            console.log(`Webhook endpoint: http://localhost:${PORT}/webhook/orders/create`);
            console.log(`PDF Generation: Printable HTML (Railway compatible)`);
            console.log(`Configured stores: ${Object.keys(storeConfigs).length}`);
            Object.keys(storeConfigs).forEach((domain, index) => {
                if (domain && domain !== 'undefined') {
                    console.log(`   ${index + 1}. ${storeConfigs[domain].name} (${domain})`);
                }
            });
        });
    } catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }
}

startServer();