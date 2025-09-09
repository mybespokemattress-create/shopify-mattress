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

// Step 2: Handle OAuth callback and get access token
router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: 'No authorization code received' });
    }

    console.log('Received code:', code);
    console.log('Environment vars check:', {
      client_id: process.env.ZOHO_CLIENT_ID ? 'SET' : 'MISSING',
      client_secret: process.env.ZOHO_CLIENT_SECRET ? 'SET' : 'MISSING',
      redirect_uri: process.env.ZOHO_REDIRECT_URI
    });
    
    // According to Zoho docs, token exchange should be a GET request with query parameters
    const tokenUrl = `https://accounts.zoho.com/oauth/v2/token?` +
      `client_id=${process.env.ZOHO_CLIENT_ID}&` +
      `client_secret=${process.env.ZOHO_CLIENT_SECRET}&` +
      `grant_type=authorization_code&` +
      `redirect_uri=${encodeURIComponent(process.env.ZOHO_REDIRECT_URI)}&` +
      `code=${code}`;
    
    console.log('Making token request to:', tokenUrl);
    
    const tokenResponse = await axios.get(tokenUrl);
    
    console.log('Token response:', tokenResponse.data);
    
    // Store tokens (you'll need to save these to database)
    const { access_token, refresh_token } = tokenResponse.data;
    
    res.json({ 
      success: true, 
      message: 'OAuth setup complete!',
      tokens: { access_token, refresh_token }
    });
    
  } catch (error) {
    console.error('OAuth error details:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'OAuth failed', 
      details: error.response?.data || error.message 
    });
  }
});

module.exports = router;