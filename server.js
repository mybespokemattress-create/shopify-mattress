const express = require('express');
const path = require('path');
// const htmlPdf = require('html-pdf-node'); // COMMENTED OUT - will fix PDF generation later
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Import database functions
const db = require('./database/db');

// Import webhook routes
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

// Webhook routes (before JSON middleware)
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

// API Routes for React frontend
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

// Order statistics endpoint
app.get('/api/stats', async (req, res) => {
    try {
        const stats = await db.orders.getOrderStats();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Debug endpoint to check database contents
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

// Test endpoint to manually create an order
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

// Debug endpoint to clear all orders
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

// Debug endpoint to count orders (useful for verification)
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

// PDF generation endpoint - TEMPORARILY DISABLED
app.get('/api/orders/:id/pdf', async (req, res) => {
    try {
        const orderId = req.params.id;
        console.log(`PDF generation requested for order ${orderId}...`);
        
        // Get order data from database
        const order = await db.orders.getOrderById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        // TEMPORARILY RETURN HTML INSTEAD OF PDF
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Purchase Order - ${order.order_number}</title>
            <style>
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                }
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 20px;
                    line-height: 1.4;
                }
                .header {
                    border-bottom: 3px solid #333;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .company-name {
                    font-size: 24px;
                    font-weight: bold;
                    color: #333;
                }
                .document-title {
                    font-size: 20px;
                    color: #666;
                    margin-top: 10px;
                }
                .order-info {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 30px;
                    margin-bottom: 30px;
                }
                .info-section h3 {
                    color: #333;
                    border-bottom: 1px solid #ddd;
                    padding-bottom: 5px;
                    margin-bottom: 15px;
                }
                .field {
                    margin-bottom: 8px;
                }
                .label {
                    font-weight: bold;
                    color: #555;
                }
                .value {
                    color: #333;
                }
                .print-btn {
                    background: #007cba;
                    color: white;
                    padding: 10px 20px;
                    border: none;
                    cursor: pointer;
                    border-radius: 5px;
                    margin-bottom: 20px;
                }
                .status-badge {
                    background: #ffc107;
                    color: #212529;
                    padding: 10px 15px;
                    border-radius: 5px;
                    display: inline-block;
                    margin-bottom: 20px;
                }
            </style>
        </head>
        <body>
            <div class="no-print">
                <button class="print-btn" onclick="window.print()">Print as PDF</button>
            </div>
            
            <div class="status-badge">
                PDF Generation Temporarily Disabled - Use Print Function
            </div>
            
            <div class="header">
                <div class="company-name">Mattress Company Ltd</div>
                <div class="document-title">Purchase Order</div>
            </div>
            
            <div class="order-info">
                <div class="info-section">
                    <h3>Order Details</h3>
                    <div class="field">
                        <span class="label">Order Number:</span>
                        <span class="value">${order.order_number || 'N/A'}</span>
                    </div>
                    <div class="field">
                        <span class="label">Order ID:</span>
                        <span class="value">${order.id}</span>
                    </div>
                    <div class="field">
                        <span class="label">Store:</span>
                        <span class="value">${order.store_domain || 'N/A'}</span>
                    </div>
                    <div class="field">
                        <span class="label">Date Created:</span>
                        <span class="value">${order.created_date ? new Date(order.created_date).toLocaleDateString('en-GB') : 'N/A'}</span>
                    </div>
                </div>
                
                <div class="info-section">
                    <h3>Customer Information</h3>
                    <div class="field">
                        <span class="label">Name:</span>
                        <span class="value">${order.customer_name || 'N/A'}</span>
                    </div>
                    <div class="field">
                        <span class="label">Email:</span>
                        <span class="value">${order.customer_email || 'N/A'}</span>
                    </div>
                    <div class="field">
                        <span class="label">Total Price:</span>
                        <span class="value">£${order.total_price || '0.00'}</span>
                    </div>
                </div>
            </div>
            
            <div class="footer">
                <p>Generated: ${new Date().toLocaleString('en-GB')}</p>
                <p>System: Railway Deployment (PDF generation being implemented)</p>
            </div>
        </body>
        </html>
        `;
        
        res.setHeader('Content-Type', 'text/html');
        res.send(htmlContent);
        
    } catch (error) {
        console.error('Order display failed:', error);
        res.status(500).json({ 
            error: 'Failed to display order', 
            details: error.message,
            orderId: req.params.id
        });
    }
});

// Test PDF endpoint - TEMPORARILY DISABLED
app.get('/api/test-pdf', async (req, res) => {
    try {
        console.log('PDF generation temporarily disabled...');
        
        res.json({
            success: false,
            message: 'PDF generation temporarily disabled during Railway deployment fix',
            note: 'Will be re-enabled with Railway-compatible solution'
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

// Health check endpoint
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
            pdfGeneration: 'temporarily disabled',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.json({
            status: 'partial',
            database: false,
            error: error.message,
            stores: Object.keys(storeConfigs),
            reactBuild: reactBuildExists ? 'available' : 'missing',
            pdfGeneration: 'temporarily disabled',
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

// Initialise database and start server
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
            console.log(`PDF Generation: TEMPORARILY DISABLED`);
            console.log(`Configured stores: ${Object.keys(storeConfigs).length}`);
            Object.keys(storeConfigs).forEach((domain, index) => {
                console.log(`   ${index + 1}. ${storeConfigs[domain].name} (${domain})`);
            });
        });
    } catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }
}

startServer();