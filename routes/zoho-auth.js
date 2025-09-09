const express = require('express');
const axios = require('axios');
const router = express.Router();

// Test route
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
    console.log('Received authorization code:', code ? 'YES' : 'NO');
    
    const tokenResponse = await axios.post('https://accounts.zoho.com/oauth/v2/token', {
      grant_type: 'authorization_code',
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      redirect_uri: process.env.ZOHO_REDIRECT_URI,
      code: code
    });
    
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