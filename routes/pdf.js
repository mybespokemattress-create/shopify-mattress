const express = require('express');
const router = express.Router();

// Simple test without any dependencies
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'PDF routes are working!',
        timestamp: new Date().toISOString()
    });
});

router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        message: 'PDF service is operational (basic)',
        timestamp: new Date().toISOString()
    });
});

router.get('/status', (req, res) => {
    res.json({
        status: 'operational',
        service: 'PDF Generator Service (Simplified)',
        version: '1.0.0-debug',
        endpoints: [
            'GET /api/pdf/health - Health check',
            'GET /api/pdf/test - Test endpoint',
            'GET /api/pdf/status - This endpoint'
        ],
        timestamp: new Date().toISOString()
    });
});

module.exports = router;