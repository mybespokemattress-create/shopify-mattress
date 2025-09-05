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

// PDF generation functions
function generatePurchaseOrderPDF(order) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: 50, bottom: 50, left: 50, right: 50 }
            });

            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Company colours
            const primaryColor = '#2c3e50';
            const accentColor = '#3498db';

            // Header
            doc.font('Helvetica-Bold').fontSize(24).fillColor(primaryColor)
               .text('Bespoke Mattress Company', 50, 60);
            doc.font('Helvetica').fontSize(16).fillColor(accentColor)
               .text('Purchase Order', 50, 90);
            doc.font('Helvetica-Bold').fontSize(14).fillColor(primaryColor)
               .text(`Order: ${order.order_number || 'N/A'}`, 50, 115);

            // Order info section
            doc.rect(50, 150, 240, 100).fillColor('#f8f9fa').fill();
            doc.font('Helvetica-Bold').fontSize(12).fillColor(primaryColor)
               .text('Order Information', 60, 165);
            doc.font('Helvetica').fontSize(10).fillColor('#333333')
               .text(`Order Number: ${order.order_number || 'N/A'}`, 60, 185)
               .text(`Date: ${order.created_date ? new Date(order.created_date).toLocaleDateString('en-GB') : 'N/A'}`, 60, 200)
               .text(`Store: ${order.store_domain || 'N/A'}`, 60, 215);

            // Customer info section  
            doc.rect(305, 150, 240, 100).fillColor('#f8f9fa').fill();
            doc.font('Helvetica-Bold').fontSize(12).fillColor(primaryColor)
               .text('Customer Information', 315, 165);
            doc.font('Helvetica').fontSize(10).fillColor('#333333')
               .text(`Name: ${order.customer_name || 'N/A'}`, 315, 185)
               .text(`Email: ${order.customer_email || 'N/A'}`, 315, 200)
               .text(`Total: £${order.total_price || '0.00'}`, 315, 215);

            // Items table header
            doc.font('Helvetica-Bold').fontSize(12).fillColor(primaryColor)
               .text('Order Items', 50, 280);
            doc.rect(50, 300, 495, 25).fillColor(accentColor).fill();
            doc.font('Helvetica-Bold').fontSize(10).fillColor('white')
               .text('Product', 55, 308)
               .text('SKU', 255, 308)
               .text('Qty', 335, 308)
               .text('Price', 375, 308)
               .text('Total', 435, 308);

            // Items
            const lineItems = order.order_data?.line_items || [];
            let yPos = 325;
            if (lineItems.length === 0) {
                doc.font('Helvetica').fontSize(10).fillColor('#666666')
                   .text('No items found', 60, yPos);
            } else {
                lineItems.forEach((item, index) => {
                    if (index % 2 === 0) {
                        doc.rect(50, yPos, 495, 20).fillColor('#f8f9fa').fill();
                    }
                    doc.font('Helvetica').fontSize(9).fillColor('#333333')
                       .text(item.title || 'Product', 55, yPos + 5, { width: 190, ellipsis: true })
                       .text(item.sku || 'N/A', 255, yPos + 5)
                       .text(item.quantity || '1', 335, yPos + 5)
                       .text(`£${item.price || '0.00'}`, 375, yPos + 5)
                       .text(`£${((item.quantity || 1) * (parseFloat(item.price) || 0)).toFixed(2)}`, 435, yPos + 5);
                    yPos += 20;
                });
            }

            // Total
            doc.rect(350, yPos + 20, 195, 40).fillColor('#e8f5e8').fill();
            doc.font('Helvetica-Bold').fontSize(14).fillColor('#27ae60')
               .text('Total Amount:', 360, yPos + 32)
               .text(`£${order.total_price || '0.00'}`, 470, yPos + 32);

            // Footer
            doc.font('Helvetica').fontSize(8).fillColor('#999999')
               .text(`Generated: ${new Date().toLocaleString('en-GB')}`, 50, 720)
               .text('Bespoke Mattress Company | Professional Order Processing', 50, 732);

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
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
            pdfGeneration: 'printable HTML (Railway compatible)',
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
            pdfGeneration: 'printable HTML (Railway compatible)',
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