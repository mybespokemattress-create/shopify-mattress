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
    const { code, location, 'accounts-server': accountsServer } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: 'No authorization code received' });
    }

    console.log('OAuth callback received:', {
      code: code,
      location: location,
      accountsServer: accountsServer
    });

    // Use the accounts-server from the callback URL for token exchange
    const tokenEndpoint = accountsServer ? 
      `${accountsServer}/oauth/v2/token` : 
      'https://accounts.zoho.com/oauth/v2/token';

    console.log('Using token endpoint:', tokenEndpoint);
    
    // Use form data as per Zoho documentation
    const formData = new URLSearchParams();
    formData.append('grant_type', 'authorization_code');
    formData.append('client_id', process.env.ZOHO_CLIENT_ID);
    formData.append('client_secret', process.env.ZOHO_CLIENT_SECRET);
    formData.append('redirect_uri', process.env.ZOHO_REDIRECT_URI);
    formData.append('code', code);
    
    console.log('Making POST request to:', tokenEndpoint);
    
    const tokenResponse = await axios.post(tokenEndpoint, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('Token response:', tokenResponse.data);
    
    // Store tokens (you'll need to save these to database)
    const { access_token, refresh_token, api_domain } = tokenResponse.data;
    
    res.json({ 
      success: true, 
      message: 'OAuth setup complete!',
      tokens: { access_token, refresh_token },
      api_domain: api_domain,
      user_location: location
    });
    
  } catch (error) {
    console.error('OAuth error details:', {
      message: error.message,
      response_data: error.response?.data,
      response_status: error.response?.status,
      url: error.config?.url
    });
    res.status(500).json({ 
      error: 'OAuth failed', 
      details: error.response?.data || error.message 
    });
  }
});

module.exports = router;