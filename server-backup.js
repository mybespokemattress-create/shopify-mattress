const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Import database functions
const db = require('./database/db');

// Import routes
const adminRoutes = require('./routes/admin');
const webhookRoutes = require('./routes/webhooks');

// Store configuration (before routes need it)
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

// Webhook routes FIRST (before JSON parsing middleware)
app.use('/webhook', webhookRoutes);

// Middleware for other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve React static files
app.use(express.static(path.join(__dirname, 'client/build')));

// Legacy public folder (keep for any existing assets)
app.use(express.static(path.join(__dirname, 'public')));

// Set view engine (for existing admin routes)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// API Routes for React frontend
app.get('/api/orders', async (req, res) => {
    try {
        const { search, limit = 20 } = req.query;
        let orders;
        
        if (search) {
            orders = await db.orders.searchOrders(search, parseInt(limit));
        } else {
            orders = await db.orders.getAllOrders(parseInt(limit));
        }
        
        res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
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

// PDF generation endpoint (placeholder for now)
app.get('/api/orders/:id/pdf', async (req, res) => {
    try {
        // TODO: Implement PDF generation with Puppeteer
        res.json({ message: 'PDF generation coming soon', orderId: req.params.id });
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

// Email sending endpoint (placeholder for now)
app.post('/api/orders/:id/email', async (req, res) => {
    try {
        // TODO: Implement Zoho email integration
        res.json({ message: 'Email sending coming soon', orderId: req.params.id });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ error: 'Failed to send email' });
    }
});

// Admin routes (keep existing)
app.use('/admin', adminRoutes);

// Health check (updated to include React build status)
app.get('/health', (req, res) => {
    const reactBuildExists = require('fs').existsSync(path.join(__dirname, 'client/build/index.html'));
    
    res.json({
        status: 'healthy',
        database: db.isHealthy() ? 'connected' : 'disconnected',
        stores: Object.keys(storeConfigs),
        reactBuild: reactBuildExists ? 'available' : 'missing',
        timestamp: new Date().toISOString()
    });
});

// Serve React app for all other routes (must be after API routes)
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

// Initialize database and start server
async function startServer() {
    try {
        await db.initialize();
        console.log('✅ Database initialised successfully');
        
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`🎨 React App: http://localhost:${PORT}/`);
            console.log(`📊 Admin interface: http://localhost:${PORT}/admin`);
            console.log(`🔗 Webhook endpoint: http://localhost:${PORT}/webhook/orders/create`);
            console.log(`🏪 Configured stores: ${Object.keys(storeConfigs).length}`);
            Object.keys(storeConfigs).forEach((domain, index) => {
                console.log(`   ${index + 1}. ${storeConfigs[domain].name} (${domain})`);
            });
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
}

startServer();