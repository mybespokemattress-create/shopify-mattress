const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const FormData = require('form-data');
const router = express.Router();

// Import functions from other modules
const { generatePurchaseOrderPDF } = require('../routes/pdf');
const { getActiveOAuthToken, refreshOAuthToken } = require('../routes/zoho-auth');

// Database pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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

// Function to get Zoho account ID
async function getZohoAccountId(accessToken, userLocation) {
    try {
        const mailDomain = getMailApiDomain(userLocation);
        const response = await axios.get(`${mailDomain}/api/accounts`, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.data && response.data.data && response.data.data.length > 0) {
            return response.data.data[0].accountId;
        }
        
        throw new Error('No Zoho Mail accounts found');
    } catch (error) {
        console.error('Error getting Zoho account ID:', error);
        throw error;
    }
}

// Function to upload attachment to Zoho's file store
async function uploadAttachmentToZoho(pdfBuffer, filename, accessToken, accountId, userLocation) {
    try {
        console.log('Uploading attachment to Zoho file store...');
        
        const mailDomain = getMailApiDomain(userLocation);
        
        // Create form data for multipart upload
        const form = new FormData();
        
        // Add the PDF buffer as a file
        form.append('attach', pdfBuffer, {
            filename: filename,
            contentType: 'application/pdf'
        });
        
        // Upload to Zoho's attachment API
        const uploadResponse = await axios.post(
            `${mailDomain}/api/accounts/${accountId}/messages/attachments?uploadType=multipart`,
            form,
            {
                headers: {
                    'Authorization': `Zoho-oauthtoken ${accessToken}`,
                    ...form.getHeaders()
                }
            }
        );
        
        console.log('Attachment uploaded successfully to Zoho');
        
        // Return the attachment reference for email
        return {
            storeName: uploadResponse.data.storeName,
            attachmentPath: uploadResponse.data.attachmentPath,
            attachmentName: uploadResponse.data.attachmentName || filename
        };
        
    } catch (error) {
        console.error('Failed to upload attachment to Zoho:', error.response?.data || error.message);
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
            orderId,
            orderData
        } = req.body;

        // Validate required fields
        if (!to || !subject || !body) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['to', 'subject', 'body']
            });
        }

        console.log(`Sending email for order ${orderId} to ${to}`);

        // Get active OAuth token (with auto-refresh)
        let token = await getActiveOAuthToken();
        
        if (!token) {
            return res.status(401).json({
                error: 'No active OAuth token found',
                message: 'Please authorise with Zoho first',
                auth_url: '/auth/zoho/auth'
            });
        }

        // Get the correct Mail API domain for user's location
        const mailDomain = getMailApiDomain(token.user_location || 'us');
        
        // Get account ID
        const accountId = await getZohoAccountId(token.access_token, token.user_location || 'us');

        // Generate PDF if order data is provided
        let pdfAttachment = null;
        if (orderData && orderId) {
            try {
                console.log('Generating PDF for email attachment...');
                const pdfBuffer = await generatePurchaseOrderPDF(orderData);
                
                const filename = `Order_${orderData.orderNumber || orderId}_${orderData.customer?.name?.replace(/\s+/g, '_') || 'Customer'}.pdf`;
                
                // Upload to Zoho's file store
                pdfAttachment = await uploadAttachmentToZoho(
                    pdfBuffer, 
                    filename, 
                    token.access_token, 
                    accountId, 
                    token.user_location || 'us'
                );
                
                console.log('PDF generated and uploaded successfully for email attachment');
            } catch (pdfError) {
                console.error('PDF generation or upload failed for email:', pdfError);
                // Continue without PDF attachment - don't fail the email
            }
        }

        // Prepare email data for Zoho Mail API (correct format)
        const emailData = {
            fromAddress: process.env.ZOHO_FROM_EMAIL || 'orders@yourdomain.com',
            toAddress: to,
            subject: subject,
            content: body,
            mailFormat: 'html'
        };

        // Add PDF attachment if generated
        if (pdfAttachment) {
            emailData.attachments = [pdfAttachment];
        } else if (attachments && attachments.length > 0) {
            emailData.attachments = attachments;
        }

        // Send email via Zoho Mail API
        const emailResponse = await axios.post(
            `${mailDomain}/api/accounts/${accountId}/messages`,
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
        if (orderId && !isNaN(parseInt(orderId))) {
            await pool.query(`
                UPDATE processed_orders 
                SET email_sent = true, updated_date = CURRENT_TIMESTAMP 
                WHERE id = $1
            `, [parseInt(orderId)]);
            
            console.log(`Updated order ${orderId} email status`);
        }

        res.json({
            success: true,
            message: 'Email sent successfully',
            messageId: emailResponse.data.messageId || emailResponse.data.id,
            orderId: req.body.orderId || 'unknown'
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
            orderId: req.body.orderId || 'unknown'
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

        // Get the correct Mail API domain for user's location
        const mailDomain = getMailApiDomain(token.user_location || 'us');
        
        // Get account ID
        const accountId = await getZohoAccountId(token.access_token, token.user_location || 'us');

        // Send a simple test email
        const testEmailData = {
            fromAddress: process.env.ZOHO_FROM_EMAIL || 'test@yourdomain.com',
            toAddress: process.env.TEST_EMAIL || 'test@example.com',
            subject: 'Test Email from Shopify Order Processor',
            content: `
                <h2>Test Email</h2>
                <p>This is a test email sent at ${new Date().toISOString()}</p>
                <p>If you receive this, your email automation is working!</p>
            `,
            mailFormat: 'html'
        };

        const emailResponse = await axios.post(
            `${mailDomain}/api/accounts/${accountId}/messages`,
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