const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const router = express.Router();

// Database pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

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
        console.error('Error retrieving OAuth token:', error);
        throw error;
    }
}

// Function to get Zoho account ID
async function getZohoAccountId(accessToken, apiDomain) {
    try {
        const response = await axios.get(`${apiDomain}/api/accounts`, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        // Return the first account ID (primary account)
        if (response.data && response.data.data && response.data.data.length > 0) {
            return response.data.data[0].accountId;
        }
        
        throw new Error('No Zoho Mail accounts found');
    } catch (error) {
        console.error('Error getting Zoho account ID:', error);
        throw error;
    }
}

// Function to refresh OAuth token if needed
async function refreshOAuthToken(refreshToken, apiDomain) {
    try {
        const formData = new URLSearchParams();
        formData.append('grant_type', 'refresh_token');
        formData.append('client_id', process.env.ZOHO_CLIENT_ID);
        formData.append('client_secret', process.env.ZOHO_CLIENT_SECRET);
        formData.append('refresh_token', refreshToken);

        const response = await axios.post(`${apiDomain}/oauth/v2/token`, formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        // Update database with new access token
        const expiresAt = new Date(Date.now() + (response.data.expires_in * 1000));
        
        await pool.query(`
            UPDATE oauth_tokens 
            SET access_token = $1, expires_at = $2, updated_at = CURRENT_TIMESTAMP
            WHERE refresh_token = $3 AND is_active = true
        `, [response.data.access_token, expiresAt, refreshToken]);

        return response.data.access_token;
    } catch (error) {
        console.error('Error refreshing OAuth token:', error);
        throw error;
    }
}

// Send email endpoint
router.post('/send', async (req, res) => {
    try {
        const { 
            to, 
            subject, 
            body, 
            attachments = [],
            orderId 
        } = req.body;

        // Validate required fields
        if (!to || !subject || !body) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['to', 'subject', 'body']
            });
        }

        console.log(`Sending email for order ${orderId} to ${to}`);

        // Get active OAuth token
        let token = await getActiveOAuthToken();
        
        if (!token) {
            return res.status(401).json({
                error: 'No active OAuth token found',
                message: 'Please authorise with Zoho first',
                auth_url: '/auth/zoho/auth'
            });
        }

        // Check if token is expiring soon (within 5 minutes)
        const now = new Date();
        const expiresAt = new Date(token.expires_at);
        const timeUntilExpiry = expiresAt - now;
        
        if (timeUntilExpiry < 5 * 60 * 1000) { // Less than 5 minutes
            console.log('Token expiring soon, refreshing...');
            token.access_token = await refreshOAuthToken(
                token.refresh_token, 
                'https://accounts.zoho.com'
            );
        }

        // Get the correct Mail API domain for user's location
        const mailDomain = getMailApiDomain(token.user_location || 'us');
        
        // Get account ID
        const accountId = await getZohoAccountId(token.access_token, token.user_location || 'us');

        // Prepare email data for Zoho Mail API (correct format)
        const emailData = {
            fromAddress: process.env.ZOHO_FROM_EMAIL || 'orders@yourdomain.com',
            toAddress: to,
            subject: subject,
            content: body,
            mailFormat: 'html'  // Changed from contentType to mailFormat
        };

        // Add attachments if provided
        if (attachments && attachments.length > 0) {
            emailData.attachments = attachments;
        }

        // Send email via Zoho Mail API (correct endpoint)
        const emailResponse = await axios.post(
            `${mailDomain}/api/accounts/${accountId}/messages`,  // Correct endpoint
            emailData,
            {
                headers: {
                    'Authorization': `Zoho-oauthtoken ${token.access_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Email sent successfully');

        // Update order status in database if orderId provided
        if (orderId) {
            await pool.query(`
                UPDATE processed_orders 
                SET email_sent = true, updated_date = CURRENT_TIMESTAMP 
                WHERE id = $1
            `, [orderId]);
            
            console.log(`Updated order ${orderId} email status`);
        }

        res.json({
            success: true,
            message: 'Email sent successfully',
            messageId: emailResponse.data.messageId || emailResponse.data.id,
            orderId: orderId
        });

    } catch (error) {
        console.error('Email sending error:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });

        // Handle specific Zoho API errors
        if (error.response?.status === 401) {
            return res.status(401).json({
                error: 'OAuth token invalid or expired',
                message: 'Please re-authorise with Zoho',
                auth_url: '/auth/zoho/auth'
            });
        }

        res.status(500).json({
            error: 'Failed to send email',
            details: error.response?.data || error.message,
            orderId: orderId
        });
    }
});

// Test email endpoint
router.post('/test', async (req, res) => {
    try {
        const token = await getActiveOAuthToken();
        
        if (!token) {
            return res.status(401).json({
                error: 'No active OAuth token found',
                auth_url: '/auth/zoho/auth'
            });
        }

        // Get the Zoho Mail domain (default to .com if not specified)
        const mailDomain = token.api_domain || 'https://mail.zoho.com';
        
        // Get account ID
        const accountId = await getZohoAccountId(token.access_token, mailDomain);

        // Send a simple test email (correct format)
        const testEmailData = {
            fromAddress: process.env.ZOHO_FROM_EMAIL || 'test@yourdomain.com',
            toAddress: process.env.TEST_EMAIL || 'test@example.com',
            subject: 'Test Email from Shopify Order Processor',
            content: `
                <h2>Test Email</h2>
                <p>This is a test email sent at ${new Date().toISOString()}</p>
                <p>If you receive this, your email automation is working!</p>
            `,
            mailFormat: 'html'  // Changed from contentType to mailFormat
        };

        const emailResponse = await axios.post(
            `${mailDomain}/api/accounts/${accountId}/messages`,  // Correct endpoint
            testEmailData,
            {
                headers: {
                    'Authorization': `Zoho-oauthtoken ${token.access_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({
            success: true,
            message: 'Test email sent successfully',
            messageId: emailResponse.data.messageId || emailResponse.data.id,
            sentTo: testEmailData.toAddress
        });

    } catch (error) {
        console.error('Test email error:', error.response?.data || error.message);
        
        res.status(500).json({
            error: 'Test email failed',
            details: error.response?.data || error.message
        });
    }
});

module.exports = router;