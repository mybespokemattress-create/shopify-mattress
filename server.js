const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');
const fs = require('fs');
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

// PDF generation function with image embedding
function addEnhancedMeasurements(doc, order, yPos) {
    // Always show this section title - FULL WIDTH
    doc.font('Helvetica-Bold').fontSize(12).fillColor('black')
       .text('Measurements & Shape Diagram', 40, yPos);
    
    const extractedMeasurements = order.order_data?.extracted_measurements || [];
    const measurements = extractedMeasurements.length > 0 ? extractedMeasurements[0] : null;
    
    // Measurements table - PROPER HEIGHT that fits page
    doc.rect(40, yPos + 20, 140, 280).fillColor('white').fill();
    doc.rect(40, yPos + 20, 140, 280).strokeColor('black').lineWidth(1).stroke();
    doc.font('Helvetica-Bold').fontSize(10).fillColor('black')
       .text('Dimensions', 45, yPos + 30);
    
    // Simple table headers
    doc.font('Helvetica-Bold').fontSize(8).fillColor('black')
       .text('Dim', 45, yPos + 45)
       .text('Value', 120, yPos + 45);
    
    // Header line
    doc.strokeColor('black').lineWidth(1)
       .moveTo(45, yPos + 57).lineTo(175, yPos + 57).stroke();
    
    // All dimensions A-G
    const dimensions = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    let rowY = yPos + 65;
    
    dimensions.forEach((dim) => {
        let value = '-';
        
        if (measurements && measurements.measurements && measurements.measurements[dim]) {
            const measurement = measurements.measurements[dim];
            value = `${measurement.value}${measurement.unit || 'mm'}`;
        }
        
        doc.font('Helvetica').fontSize(9).fillColor('black')
           .text(dim, 48, rowY)
           .text(value, 100, rowY);
        
        rowY += 12;
    });
    
    // Status at bottom 
    let verificationStatus = 'Not verified';
    if (measurements) {
        verificationStatus = measurements.property_Measurements_Verified || 
                           measurements['property_Measurements Verified'] || 'Not verified';
    }
    doc.font('Helvetica-Bold').fontSize(7).fillColor('black')
       .text(`Status: ${verificationStatus}`, 45, yPos + 285);
    
    // Diagram container - SAME HEIGHT as measurements
    doc.rect(195, yPos + 20, 360, 280).fillColor('white').fill();
    doc.rect(195, yPos + 20, 360, 280).strokeColor('black').lineWidth(1).stroke();
    
    doc.font('Helvetica-Bold').fontSize(10).fillColor('black')
       .text('Shape Diagram', 200, yPos + 30);
    
    // Get diagram number
    const diagramNumber = measurements?.property_Diagram_Number || 
                         measurements?.['property_Diagram Number'] || 
                         extractDiagramFromProperties(order);
    
    if (diagramNumber) {
        doc.font('Helvetica').fontSize(9).fillColor('black')
           .text(`Diagram: ${diagramNumber}`, 200, yPos + 45);
        
        const imagePaths = [
            path.join(__dirname, 'public', 'images', 'diagrams', `Shape_${diagramNumber}_Caravan_Mattress_Measuring_Diagram.jpg`),
            path.join(__dirname, 'public', 'images', 'diagrams', `Shape_${diagramNumber}.jpg`),
            path.join(__dirname, 'public', 'images', 'diagrams', `shape_${diagramNumber}.jpg`)
        ];
        
        let imageLoaded = false;
        
        for (const imagePath of imagePaths) {
            try {
                if (fs.existsSync(imagePath)) {
                    // LARGE IMAGE that fits within container
                    doc.image(imagePath, 205, yPos + 60, {
                        width: 340,
                        height: 230,
                        fit: [340, 230],
                        align: 'center'
                    });
                    imageLoaded = true;
                    break;
                }
            } catch (error) {
                console.error(`Error loading ${imagePath}: ${error.message}`);
            }
        }
        
        if (!imageLoaded) {
            drawBasicCaravanShape(doc, 320, yPos + 180, 160, 60, diagramNumber);
        }
    }
    
    return yPos + 320;
}

// Helper function to extract diagram number from various property formats
function extractDiagramFromProperties(order) {
    const lineItems = order.order_data?.order_data?.line_items || [];
    
    if (lineItems.length > 0 && lineItems[0].properties) {
        const properties = lineItems[0].properties;
        
        // Look for diagram number in different formats
        for (const prop of properties) {
            if (prop.name && prop.value) {
                if (prop.name.toLowerCase().includes('diagram') && prop.value) {
                    return prop.value;
                }
            }
        }
    }
    
    return null;
}

// Fallback function for basic shape drawing when image isn't available
function drawBasicCaravanShape(doc, x, y, width, height, diagramNumber) {
    doc.strokeColor('black').lineWidth(1);
    
    switch(diagramNumber) {
        case '3':
            // Curved foot end bolster shape
            doc.rect(x, y, width, height).stroke();
            doc.moveTo(x, y + height * 0.7)
               .quadraticCurveTo(x - 15, y + height, x, y + height)
               .stroke();
            doc.font('Helvetica').fontSize(7).fillColor('black')
               .text('Curved Foot End', x + 10, y + height + 5);
            break;
        default:
            // Generic rectangle with measurements labels
            doc.rect(x, y, width, height).stroke();
            doc.font('Helvetica').fontSize(7).fillColor('black')
               .text('A', x + width/2, y - 10)
               .text('B', x - 15, y + height/2);
    }
}

function addPDFFooter(doc) {
    const footerY = 750;
    
    // Footer line
    doc.moveTo(40, footerY).lineTo(555, footerY)
       .strokeColor('black').lineWidth(1).stroke();
    
    // Footer text
    doc.font('Helvetica').fontSize(7).fillColor('black')
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
            console.log(`PDF Generation: PDFKit (styled PDF files)`);
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