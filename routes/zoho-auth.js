const express = require('express');
const axios = require('axios');
const router = express.Router();

// Test route to verify router works
router.get('/test', (req, res) => {
  res.json({ message: 'Zoho router works!' });
});

// Step 1: Redirect user to Zoho authorization
router.get('/auth', (req, res) => {
  const authUrl = `https://accounts.zoho.com/oauth/v2/auth?` +
    `response_type=code&` +
    `client_id=${process.env.ZOHO_CLIENT_ID}&` +
    `scope=ZohoMail.messages.CREATE&` +
    `redirect_uri=${encodeURIComponent(process.env.ZOHO_REDIRECT_URI)}&` +
    `access_type=offline&` +
    `prompt=consent`;
  
  res.redirect(authUrl);
});

// Step 2: Handle OAuth callback and get access token (DEBUG VERSION)
router.get('/callback', async (req, res) => {
  // Log everything we receive
  console.log('Full query parameters:', req.query);
  console.log('Full URL:', req.url);
  console.log('Headers:', req.headers);
  
  // Return debug info
  res.json({
    received_params: req.query,
    full_url: req.url,
    has_code: !!req.query.code,
    code_value: req.query.code || 'NOT_PRESENT'
  });
});

module.exports = router;