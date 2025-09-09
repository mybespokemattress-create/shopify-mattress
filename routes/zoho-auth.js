const express = require('express');
const axios = require('axios');
const router = express.Router();

// Step 1: Redirect user to Zoho authorization
router.get('/auth', (req, res) => {
  const authUrl = `https://accounts.zoho.eu/oauth/v2/auth?` +
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
    
    const tokenResponse = await axios.post('https://accounts.zoho.eu/oauth/v2/token', {
      grant_type: 'authorization_code',
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      redirect_uri: process.env.ZOHO_REDIRECT_URI,
      code: code
    });
    
    // Store tokens (you'll need to save these to database)
    const { access_token, refresh_token } = tokenResponse.data;
    
    res.json({ 
      success: true, 
      message: 'OAuth setup complete!',
      tokens: { access_token, refresh_token }
    });
    
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).json({ error: 'OAuth failed' });
  }
});

module.exports = router;