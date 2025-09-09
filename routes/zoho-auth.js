const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const router = express.Router();

// Database pool (reuse your existing connection)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

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

// Function to get correct Mail API domain from user location
function getMailApiDomain(userLocation) {
    switch(userLocation) {
        case 'us': return 'https://mail.zoho.com';
        case 'eu': return 'https://mail.zoho.eu';
        case 'in': return 'https://mail.zoho.in';
        case 'au': return 'https://mail.zoho.com.au';
        case 'jp': return 'https://mail.zoho.jp';
        case 'ca': return 'https://mail.zohocloud.ca';
        default: return 'https://mail.zoho.com';
    }
}

// Function to store OAuth tokens in database
async function storeOAuthTokens(tokenData, userLocation) {
    try {
        // Calculate expires_at timestamp (1 hour from now)
        const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
        
        // Get the correct Mail API domain (override what Zoho returns)
        const correctMailDomain = getMailApiDomain(userLocation || 'us');
        
        // First, mark any existing active tokens as inactive
        await pool.query(`
            UPDATE oauth_tokens 
            SET is_active = false, updated_at = CURRENT_TIMESTAMP 
            WHERE provider = 'zoho' AND is_active = true
        `);
        
        // Insert new token with corrected Mail API domain
        const result = await pool.query(`
            INSERT INTO oauth_tokens (
                provider, 
                access_token, 
                refresh_token, 
                token_type,
                expires_at,
                api_domain,
                user_location,
                scope,
                is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
        `, [
            'zoho',
            tokenData.access_token,
            tokenData.refresh_token,
            tokenData.token_type || 'Bearer',
            expiresAt,
            correctMailDomain,  // Use correct Mail domain, not what Zoho returns
            userLocation || 'us',
            'ZohoMail.messages.CREATE',
            true
        ]);
        
        console.log('✅ OAuth tokens stored with correct Mail API domain:', correctMailDomain);
        return result.rows[0].id;
    } catch (error) {
        console.error('❌ Error storing OAuth tokens:', error);
        throw error;
    }
}

// Function to get active OAuth token
async function getActiveOAuthToken() {
    try {
        const result = await pool.query(`
            SELECT * FROM oauth_tokens 
            WHERE provider = 'zoho' 
            AND is_active = true 
            AND expires_at > CURRENT_TIMESTAMP
            ORDER BY created_at DESC 
            LIMIT 1
        `);
        
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ Error retrieving OAuth token:', error);
        throw error;
    }
}

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
    
    console.log('Token response received');
    
    // Store tokens with correct Mail API domain
    const tokenId = await storeOAuthTokens(tokenResponse.data, location);
    
    // Get the correct Mail API domain for response
    const correctMailDomain = getMailApiDomain(location || 'us');
    
    res.json({ 
      success: true, 
      message: 'OAuth setup complete and tokens stored in database!',
      token_id: tokenId,
      api_domain: correctMailDomain,  // Return correct Mail domain
      user_location: location || 'us',
      expires_in: tokenResponse.data.expires_in
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

// Route to check current token status
router.get('/token/status', async (req, res) => {
    try {
        const token = await getActiveOAuthToken();
        
        if (!token) {
            return res.json({
                status: 'no_token',
                message: 'No active OAuth token found. Please authorize first.',
                needs_auth: true
            });
        }
        
        const now = new Date();
        const expiresAt = new Date(token.expires_at);
        const timeUntilExpiry = expiresAt - now;
        const minutesUntilExpiry = Math.floor(timeUntilExpiry / 1000 / 60);
        
        res.json({
            status: 'active',
            token_id: token.id,
            expires_in_minutes: minutesUntilExpiry,
            api_domain: token.api_domain,
            user_location: token.user_location,
            created_at: token.created_at,
            needs_auth: minutesUntilExpiry < 5 // Warn if expires in less than 5 minutes
        });
        
    } catch (error) {
        console.error('Error checking token status:', error);
        res.status(500).json({ 
            error: 'Failed to check token status',
            details: error.message 
        });
    }
});

// Export the function so other parts of your app can use it
module.exports = router;