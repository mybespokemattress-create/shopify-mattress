const express = require('express');
const path = require('path');
// const htmlPdf = require('html-pdf-node'); // COMMENTED OUT - will fix PDF generation later
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Import database functions - TEMPORARILY COMMENTED OUT
const db = require('./database/db');

// Import webhook routes - TEMPORARILY COMMENTED OUT
// const webhookRoutes = require('./routes/webhooks');

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

// Webhook routes (before JSON middleware) - TEMPORARILY COMMENTED OUT
// app.use('/webhook', webhookRoutes);

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

// SIMPLIFIED API Routes for testing (database functions commented out)
app.get('/api/orders', async (req, res) => {
    try {
        console.log('API: Orders endpoint called (database temporarily disabled)');
        
        // Return sample data while database is disabled
        const sampleOrders = [
            {
                id: 1,
                order_number: '#SAMPLE-001',
                customer_name: 'Test Customer',
                customer_email: 'test@example.com',
                total_price: '99.99',
                created_date: new Date().toISOString(),
                store_domain: 'sample-store.myshopify.com',
                order_data: { sample: true }
            }
        ];
        
        res.json(sampleOrders);
    } catch (error) {
        console.error('Error in orders endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
    }
});

app.get('/api/orders/:id', async (req, res) => {
    try {
        // Return sample order data
        const sampleOrder = {
            id: req.params.id,
            order_number: `#SAMPLE-${req.params.id}`,
            customer_name: 'Test Customer',
            customer_email: 'test@example.com',
            total_price: '99.99',
            created_date: new Date().toISOString(),
            store_domain: 'sample-store.myshopify.com',
            order_data: { sample: true, orderId: req.params.id }
        };
        
        res.json(sampleOrder);
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});

// Order statistics endpoint - SIMPLIFIED
app.get('/api/stats', async (req, res) => {
    try {
        const stats = {
            totalOrders: 0,
            todayOrders: 0,
            weekOrders: 0,
            monthOrders: 0,
            message: 'Database temporarily disabled - showing sample stats'
        };
        res.json(stats);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Test endpoint to manually create an order - SIMPLIFIED
app.post('/api/test/create-order', async (req, res) => {
    try {
        const timestamp = Date.now().toString();
        const testOrder = {
            id: timestamp,
            order_number: `#TEST-${timestamp}`,
            customer_name: 'Test Customer',
            customer_email: 'test@example.com',
            total_price: '99.99',
            created_date: new Date().toISOString(),
            message: 'Database temporarily disabled - this is sample data'
        };
        
        res.json({ 
            success: true, 
            order: testOrder,
            message: 'Test order created (sample data - database disabled)'
        });
    } catch (error) {
        console.error('Test order creation failed:', error);
        res.status(500).json({ 
            error: error.message, 
            details: 'Database temporarily disabled'
        });
    }
});

// PDF generation endpoint - TEMPORARILY RETURNS HTML
app.get('/api/orders/:id/pdf', async (req, res) => {
    try {
        const orderId = req.params.id;
        console.log(`PDF generation requested for order ${orderId}...`);
        
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Purchase Order - Sample Order ${orderId}</title>
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
                    background: #28a745;
                    color: white;
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
                Railway Deployment Working! Database integration coming next.
            </div>
            
            <div class="header">
                <div class="company-name">Mattress Company Ltd</div>
                <div class="document-title">Purchase Order - Sample ${orderId}</div>
            </div>
            
            <p><strong>Order ID:</strong> ${orderId}</p>
            <p><strong>Status:</strong> Railway deployment successful</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString('en-GB')}</p>
            
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

// Health check endpoint - SIMPLIFIED
app.get('/health', async (req, res) => {
    const reactBuildExists = require('fs').existsSync(path.join(__dirname, 'client/build/index.html'));
    
    try {
        res.json({
            status: 'healthy',
            database: 'temporarily disabled',
            stores: Object.keys(storeConfigs),
            reactBuild: reactBuildExists ? 'available' : 'missing',
            pdfGeneration: 'temporarily disabled',
            message: 'Basic server running - database integration coming next',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.json({
            status: 'partial',
            database: 'temporarily disabled',
            error: error.message,
            stores: Object.keys(storeConfigs),
            reactBuild: reactBuildExists ? 'available' : 'missing',
            pdfGeneration: 'temporarily disabled',
            timestamp: new Date().toISOString()
        });
    }
});

// Simple root endpoint
app.get('/', (req, res) => {
    const reactBuildPath = path.join(__dirname, 'client/build/index.html');
    
    if (require('fs').existsSync(reactBuildPath)) {
        res.sendFile(reactBuildPath);
    } else {
        res.send(`
            <h1>Shopify Mattress Processor</h1>
            <p>Railway deployment successful!</p>
            <p>Database integration coming next.</p>
            <ul>
                <li><a href="/api/orders">View Orders API</a></li>
                <li><a href="/api/stats">View Stats</a></li>
                <li><a href="/health">Health Check</a></li>
            </ul>
        `);
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

// Start server
async function startServer() {
    try {
        console.log('Starting server (database integration temporarily disabled)...');

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Health Check: http://localhost:${PORT}/health`);
            console.log(`API Orders: http://localhost:${PORT}/api/orders`);
            console.log(`Database: TEMPORARILY DISABLED`);
            console.log(`PDF Generation: TEMPORARILY DISABLED`);
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