const express = require('express');
const crypto = require('crypto');
const db = require('../database/db');
const googleSheets = require('../google-sheets');
const googleDocsPO = require('../google-docs-po');

const router = express.Router();

// Store-specific order prefixes
const ORDER_PREFIXES = {
    'uxyxaq-pu.myshopify.com': '#MOTO',
    'mattressmade.myshopify.com': '#MYBE',
    'd587eb.myshopify.com': '#CARA'
};

// Webhook signature verification
function verifyWebhookSignature(data, signature, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(data, 'utf8');
    const calculatedSignature = hmac.digest('base64');
    
    const expectedSignature = signature.replace('sha256=', '');
    
    console.log('Calculated signature (base64):', calculatedSignature);
    console.log('Expected signature (base64):', expectedSignature);
    
    return calculatedSignature === expectedSignature;
}

// Get store config from webhook
function getStoreFromHeaders(req) {
    const shopDomain = req.get('X-Shopify-Shop-Domain');
    
    if (shopDomain && req.app.locals.storeConfigs[shopDomain]) {
        return {
            domain: shopDomain,
            config: req.app.locals.storeConfigs[shopDomain]
        };
    }
    
    const signature = req.get('X-Shopify-Hmac-Sha256');
    let bodyString;
    
    if (typeof req.body === 'string') {
        bodyString = req.body;
    } else if (Buffer.isBuffer(req.body)) {
        bodyString = req.body.toString();
    } else {
        bodyString = JSON.stringify(req.body);
    }
    
    for (const [domain, config] of Object.entries(req.app.locals.storeConfigs)) {
        if (verifyWebhookSignature(bodyString, signature, config.webhookSecret)) {
            return { domain, config };
        }
    }
    
    return null;
}

// Extract customer data from Shopify order
function extractCustomerData(order, storeDomain) {
    const customer = order.customer;
    const billing = order.billing_address;
    const shipping = order.shipping_address;
    
    const orderPrefix = ORDER_PREFIXES[storeDomain] || '#';
    
    const orderNumber = order.order_number || order.name;
    const fullOrderNumber = orderNumber.toString().startsWith('#') 
        ? orderNumber 
        : `${orderPrefix}${orderNumber}`;
    
    return {
        orderId: order.id.toString(),
        storeDomain,
        shopifyOrderNumber: fullOrderNumber,
        customerName: customer ? `${customer.first_name} ${customer.last_name}` : 'Guest Customer',
        customerEmail: customer?.email || order.email || '',
        customerPhone: customer?.phone || billing?.phone || shipping?.phone || '',
        billingAddress: billing ? {
            address1: billing.address1,
            address2: billing.address2,
            city: billing.city,
            province: billing.province,
            zip: billing.zip,
            country: billing.country
        } : null,
        shippingAddress: shipping ? {
            address1: shipping.address1,
            address2: shipping.address2,
            city: shipping.city,
            province: shipping.province,
            zip: shipping.zip,
            country: shipping.country
        } : null,
        orderDate: order.created_at,
        totalPrice: order.total_price,
        currency: order.currency
    };
}

// Determine measurement option from order properties
function determineMeasurementOption(measurements) {
    const hasDimensions = Object.keys(measurements).some(key => 
        key.match(/^[A-G]$/) && measurements[key].value
    );
    
    if (hasDimensions) {
        return 'option1';
    }
    
    const measurementChoice = Object.keys(measurements).find(key => 
        key.toLowerCase().includes('measurement') && key.toLowerCase().includes('option')
    );
    
    if (measurementChoice) {
        const choice = measurements[measurementChoice];
        if (choice.includes('later') || choice.includes('send')) {
            return 'option2';
        }
        if (choice.includes('kit') || choice.includes('measuring')) {
            return 'option3';
        }
    }
    
    return hasDimensions ? 'option1' : 'option2';
}

// Extract customer measurements and validate completeness
function extractCustomerMeasurements(properties) {
    const measurements = {};
    const dimensionValues = {};
    
    if (!properties || !Array.isArray(properties)) {
        return { complete: false, data: {}, missing: [], option: 'option2' };
    }
    
    properties.forEach(prop => {
        const propName = prop.name?.toLowerCase();
        
        if (propName?.includes('dimension')) {
            const dimensionMatch = propName.match(/dimension\s*([a-g])/i);
            if (dimensionMatch && prop.value) {
                const letter = dimensionMatch[1].toUpperCase();
                dimensionValues[letter] = {
                    value: prop.value,
                    unit: 'cm'
                };
            }
        }
        
        measurements[`property_${prop.name}`] = prop.value;
    });
    
    const providedDimensions = Object.keys(dimensionValues);
    const expectedDimensions = ['A', 'B', 'C', 'D', 'E'];
    const missingDimensions = expectedDimensions.filter(dim => !providedDimensions.includes(dim));
    
    return {
        complete: missingDimensions.length === 0 && providedDimensions.length > 0,
        data: { ...measurements, ...dimensionValues },
        missing: missingDimensions,
        provided: providedDimensions,
        option: determineMeasurementOption({ ...measurements, ...dimensionValues })
    };
}

// Enhanced product data extraction with shape metafields
function extractProductData(lineItems) {
    return lineItems.map(item => {
        const customerMeasurements = extractCustomerMeasurements(item.properties);
        
        return {
            shopifySku: item.sku,
            productTitle: item.title,
            variantTitle: item.variant_title,
            quantity: item.quantity,
            price: item.price,
            lineItemId: item.id,
            productId: item.product_id,
            variantId: item.variant_id,
            
            shapeInfo: {
                shapeNumber: null,
                availableMeasurements: null,
                requiredMeasurements: null,
                diagramUrl: null
            },
            
            measurementStatus: {
                option: customerMeasurements.option,
                hasCompleteMeasurements: customerMeasurements.complete,
                measurements: customerMeasurements.data,
                missingDimensions: customerMeasurements.missing,
                providedDimensions: customerMeasurements.provided
            }
        };
    });
}

// Enhanced product mapping check with shape information
async function enhanceProductWithShapeInfo(product) {
    if (product.shopifySku) {
        try {
            const mapping = await db.productMappings.getBySku(product.shopifySku);
            if (mapping) {
                console.log(`Found mapping for SKU: ${product.shopifySku}`);
                product.supplierSpecification = mapping.supplier_specification;
                product.shapeId = mapping.shape_id;
                
                if (mapping.shape_id) {
                    const shapeMatch = mapping.shape_id.match(/(\d+)/);
                    if (shapeMatch) {
                        product.shapeInfo.shapeNumber = shapeMatch[1];
                        console.log(`Shape ${product.shapeInfo.shapeNumber} assigned to ${product.shopifySku}`);
                    }
                }
                
                return true;
            } else {
                console.log(`No mapping found for SKU: ${product.shopifySku}`);
                return false;
            }
        } catch (error) {
            console.error(`Error checking mapping for SKU ${product.shopifySku}:`, error);
            return false;
        }
    }
    return false;
}

// Helper function to determine which step failed
function determineFailedStep(error) {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('create') || errorMessage.includes('documents.create')) {
        return 'Step 1: Document creation failed - Service account cannot create documents';
    } else if (errorMessage.includes('update') || errorMessage.includes('addparents')) {
        return 'Step 2: Folder placement failed - Service account cannot move files to Orders folder';
    } else if (errorMessage.includes('batchupdate') || errorMessage.includes('inserttext')) {
        return 'Step 3: Content insertion failed - Service account cannot edit document content';
    } else if (errorMessage.includes('get') || errorMessage.includes('webviewlink')) {
        return 'Step 4: Link generation failed - Service account cannot generate shareable links';
    } else {
        return 'Unknown step - Check error message for details';
    }
}

// Main webhook handler for order creation
router.post('/orders/create', express.raw({ type: 'application/json' }), async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Received webhook from Shopify`);
    
    try {
        let order;
        let rawBodyString;
        
        if (typeof req.body === 'string') {
            rawBodyString = req.body;
            order = JSON.parse(req.body);
        } else if (Buffer.isBuffer(req.body)) {
            rawBodyString = req.body.toString();
            order = JSON.parse(rawBodyString);
        } else {
            order = req.body;
            rawBodyString = JSON.stringify(req.body);
        }
        
        console.log('Body type:', typeof req.body);
        console.log('Order ID:', order.id);
        
        const signature = req.get('X-Shopify-Hmac-Sha256');
        if (!signature) {
            console.error('Missing webhook signature');
            return res.status(401).json({ error: 'Missing signature' });
        }
        
        const store = getStoreFromHeaders(req);
        if (!store) {
            console.error('Could not verify webhook signature or identify store');
            return res.status(401).json({ error: 'Invalid signature or unknown store' });
        }
        
        console.log(`Verified webhook from store: ${store.config.name} (${store.domain})`);
        
        if (!verifyWebhookSignature(rawBodyString, signature, store.config.webhookSecret)) {
            console.error('Webhook signature verification failed');
            return res.status(401).json({ error: 'Invalid signature' });
        }
        
        const customerData = extractCustomerData(order, store.domain);
        const productData = extractProductData(order.line_items || []);
        
        console.log(`Processing order ${customerData.shopifyOrderNumber} from ${customerData.customerName}`);
        console.log(`Products: ${productData.length} items`);
        
        const unmappedProducts = [];
        for (const product of productData) {
            const hasMapping = await enhanceProductWithShapeInfo(product);
            if (!hasMapping) {
                unmappedProducts.push(product.shopifySku);
            }
        }
        
        let supplierAssignment = null;
        let supplierName = null;
        
        const detectedSupplier = googleSheets.determineSupplier(productData);
        if (detectedSupplier) {
            supplierAssignment = detectedSupplier;
            supplierName = googleSheets.SUPPLIERS[detectedSupplier].name;
            console.log(`Auto-assigned to supplier: ${supplierName}`);
        } else {
            console.log('No supplier match found for order SKUs');
        }
        
        productData.forEach((product, index) => {
            console.log(`Product ${index + 1}: ${product.productTitle}`);
            
            if (product.shapeInfo.shapeNumber) {
                console.log(`Shape: ${product.shapeInfo.shapeNumber}`);
            }
            
            console.log(`Measurement option: ${product.measurementStatus.option}`);
            console.log(`Complete measurements: ${product.measurementStatus.hasCompleteMeasurements}`);
            
            if (product.measurementStatus.providedDimensions.length > 0) {
                console.log(`Provided dimensions: ${product.measurementStatus.providedDimensions.join(', ')}`);
            }
            
            if (product.measurementStatus.missingDimensions.length > 0) {
                console.log(`Missing dimensions: ${product.measurementStatus.missingDimensions.join(', ')}`);
            }
        });
        
        let dbOrder;
        try {
            dbOrder = await db.orders.create({
                orderId: customerData.orderId,
                storeDomain: customerData.storeDomain,
                shopifyOrderNumber: customerData.shopifyOrderNumber,
                customerName: customerData.customerName,
                customerEmail: customerData.customerEmail,
                status: unmappedProducts.length > 0 ? 'needs_mapping' : 'received',
                supplierAssigned: supplierAssignment,
                supplierName: supplierName
            });
            
            console.log('Order stored in database successfully');
        } catch (error) {
            console.error('Error storing order in database:', error);
        }
        
        let sheetsResult = null;
        if (supplierAssignment && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
            try {
                console.log('Adding order to Google Sheets...');
                sheetsResult = await googleSheets.addOrderToSheet(customerData, productData);
                
                if (sheetsResult.success) {
                    await db.orders.updateSheetsSync(
                        customerData.orderId,
                        customerData.storeDomain,
                        true,
                        new Date().toISOString(),
                        sheetsResult.sheetRange
                    );
                    console.log(`Order added to ${sheetsResult.supplierName}`);
                } else {
                    console.log(`Could not add to sheets: ${sheetsResult.reason}`);
                }
            } catch (error) {
                console.error('Error adding to Google Sheets:', error.message);
                await db.orders.updateSheetsSync(
                    customerData.orderId,
                    customerData.storeDomain,
                    false,
                    null,
                    null,
                    error.message
                );
            }
        }
        
        let poResult = null;
        if (sheetsResult && sheetsResult.success && supplierAssignment) {
            try {
                console.log('Generating Purchase Order...');
                
                const supplierInfo = {
                    key: supplierAssignment,
                    name: supplierName
                };
                
                poResult = await googleDocsPO.generatePO(customerData, productData, supplierInfo);
                
                if (poResult.success) {
                    console.log(`PO generated: ${poResult.documentUrl}`);
                    console.log(`PO Type: ${poResult.poType}`);
                } else {
                    console.log('PO generation failed');
                }
                
            } catch (error) {
                console.error('Error generating PO:', error.message);
            }
        } else {
            console.log('Skipping PO generation - Google Sheets sync required first');
        }
        
        console.log(`Customer: ${customerData.customerEmail}`);
        console.log(`Phone: ${customerData.customerPhone}`);
        console.log(`Total: ${customerData.currency} ${customerData.totalPrice}`);
        
        const response = {
            success: true,
            orderId: customerData.orderId,
            orderNumber: customerData.shopifyOrderNumber,
            store: store.config.name,
            productsProcessed: productData.length,
            supplierAssigned: supplierName,
            sheetsUpdated: sheetsResult?.success || false,
            poGenerated: poResult?.success || false,
            poUrl: poResult?.documentUrl || null,
            poType: poResult?.poType || null,
            unmappedProducts: unmappedProducts.length > 0 ? unmappedProducts : undefined,
            timestamp
        };
        
        console.log('Order processed successfully');
        if (unmappedProducts.length > 0) {
            console.log(`Warning: ${unmappedProducts.length} products need mapping`);
        }
        if (sheetsResult?.success) {
            console.log(`Google Sheets updated: ${sheetsResult.supplierName}`);
        }
        if (poResult?.success) {
            console.log(`Purchase Order generated: ${poResult.poType}`);
        }
        
        res.status(200).json(response);
        
    } catch (error) {
        console.error('Webhook processing error:', error);
        
        try {
            let order;
            if (typeof req.body === 'string') {
                order = JSON.parse(req.body);
            } else if (Buffer.isBuffer(req.body)) {
                order = JSON.parse(req.body.toString());
            } else {
                order = req.body;
            }
            
            if (order && order.id) {
                await db.orders.updateStatus(
                    order.id.toString(),
                    'unknown',
                    'error',
                    error.message
                );
            }
        } catch (dbError) {
            console.error('Failed to log error to database:', dbError);
        }
        
        res.status(500).json({
            error: 'Webhook processing failed',
            message: error.message,
            timestamp
        });
    }
});

// Test endpoints with domain-wide delegation

router.get('/po/debug-request', async (req, res) => {
    try {
        console.log('Debugging exact HTTP request vs APIs Explorer...');
        
        const { GoogleAuth } = require('google-auth-library');
        const { google } = require('googleapis');
        
        const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        
        const auth = new GoogleAuth({
            credentials: serviceAccount,
            scopes: [
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/documents'
            ],
            subject: 'dev@mybespokemattress.com'
        });
        
        const drive = google.drive({ version: 'v3', auth });
        
        console.log('Drive API initialized');
        
        const requestBody = {
            name: 'Debug HTTP Request Test',
            mimeType: 'application/vnd.google-apps.document',
            parents: ['1-zamjJmI9pHXUKlCsyNiYjHQzAcDmc9x']
        };
        
        console.log('Request body:', JSON.stringify(requestBody, null, 2));
        
        const authClient = await auth.getClient();
        const tokenInfo = await authClient.getAccessToken();
        console.log('Token exists:', !!tokenInfo.token);
        console.log('Token length:', tokenInfo.token ? tokenInfo.token.length : 0);
        
        console.log('Making Drive API request...');
        
        const createResponse = await drive.files.create({
            resource: requestBody,
            fields: 'id,name,mimeType,parents'
        });
        
        console.log('SUCCESS! Document created:', createResponse.data);
        
        await drive.files.delete({
            fileId: createResponse.data.id
        });
        console.log('Test document deleted');
        
        res.json({
            message: 'Debug request completed successfully',
            success: true,
            documentData: createResponse.data,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Debug request failed:', error);
        
        res.status(500).json({
            message: 'Debug request failed',
            success: false,
            error: error.message,
            errorCode: error.code,
            errorStatus: error.status,
            errorResponse: error.response?.data,
            timestamp: new Date().toISOString()
        });
    }
});

router.get('/po/copy-permissions-test', async (req, res) => {
    try {
        console.log('Testing if service account can copy existing Google Docs vs create new ones...');
        
        const { GoogleAuth } = require('google-auth-library');
        const { google } = require('googleapis');
        
        const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        
        const auth = new GoogleAuth({
            credentials: serviceAccount,
            scopes: [
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/documents'
            ],
            subject: 'dev@mybespokemattress.com'
        });
        
        const drive = google.drive({ version: 'v3', auth });
        
        console.log('Drive API initialized');
        
        console.log('Looking for existing Google Docs in Orders folder to copy...');
        
        const ordersFolder = '1-zamjJmI9pHXUKlCsyNiYjHQzAcDmc9x';
        
        const searchResponse = await drive.files.list({
            q: `parents in '${ordersFolder}' and mimeType='application/vnd.google-apps.document'`,
            fields: 'files(id, name)',
            pageSize: 5
        });
        
        if (searchResponse.data.files.length === 0) {
            throw new Error('No existing Google Docs found in Orders folder to test copying');
        }
        
        const templateDoc = searchResponse.data.files[0];
        console.log(`Found existing doc to copy: ${templateDoc.name} (${templateDoc.id})`);
        
        console.log('Testing document copying...');
        
        const copyResponse = await drive.files.copy({
            fileId: templateDoc.id,
            resource: {
                name: 'Copy Permission Test - ' + new Date().toISOString(),
                parents: [ordersFolder]
            },
            fields: 'id,webViewLink,name'
        });
        
        const copiedDocId = copyResponse.data.id;
        const copiedDocUrl = copyResponse.data.webViewLink;
        const copiedDocName = copyResponse.data.name;
        
        console.log('Document copied successfully:', copiedDocName);
        console.log('Copied document ID:', copiedDocId);
        console.log('Copied document URL:', copiedDocUrl);
        
        await drive.files.delete({
            fileId: copiedDocId
        });
        console.log('Test copy deleted');
        
        res.json({
            message: 'Document copying test completed successfully',
            success: true,
            method: 'copy_existing_document',
            sourceDocument: templateDoc.name,
            copiedDocumentId: copiedDocId,
            copiedDocumentUrl: copiedDocUrl,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Copy permissions test failed:', error);
        
        res.status(500).json({
            message: 'Copy permissions test failed',
            success: false,
            error: error.message,
            errorCode: error.code,
            timestamp: new Date().toISOString()
        });
    }
});

router.get('/po/simple-test', async (req, res) => {
    try {
        console.log('Testing simple Google Docs creation with domain-wide delegation...');
        
        const { GoogleAuth } = require('google-auth-library');
        const { google } = require('googleapis');
        
        const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        
        const auth = new GoogleAuth({
            credentials: serviceAccount,
            scopes: [
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/documents'
            ],
            subject: 'dev@mybespokemattress.com'
        });
        
        const docs = google.docs({ version: 'v1', auth });
        const drive = google.drive({ version: 'v3', auth });
        
        console.log('APIs initialized');
        
        console.log('Creating document with direct service account authentication...');
        
        const createResponse = await docs.documents.create({
            resource: {
                title: 'Simple Test Document - ' + new Date().toISOString()
            }
        });
        
        const documentId = createResponse.data.documentId;
        console.log('Document created successfully:', documentId);
        
        const file = await drive.files.get({
            fileId: documentId,
            fields: 'webViewLink'
        });
        
        const documentUrl = file.data.webViewLink;
        console.log('Document URL:', documentUrl);
        
        await drive.files.delete({
            fileId: documentId
        });
        console.log('Test document deleted');
        
        res.json({
            message: 'Simple Google Docs test completed successfully with domain-wide delegation',
            success: true,
            documentId: documentId,
            documentUrl: documentUrl,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Simple Google Docs test failed:', error);
        
        res.status(500).json({
            message: 'Simple Google Docs test failed',
            success: false,
            error: error.message,
            errorCode: error.code,
            timestamp: new Date().toISOString()
        });
    }
});

router.get('/po/create-test', async (req, res) => {
    try {
        console.log('Testing Google Docs document creation with domain-wide delegation...');
        
        const { GoogleAuth } = require('google-auth-library');
        const { google } = require('googleapis');
        
        const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        
        const auth = new GoogleAuth({
            credentials: serviceAccount,
            scopes: [
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/documents'
            ],
            subject: 'dev@mybespokemattress.com'
        });
        
        console.log('Auth client created');
        
        const docs = google.docs({ version: 'v1', auth });
        const drive = google.drive({ version: 'v3', auth });
        
        console.log('APIs initialized');
        
        console.log('Step 1: Creating basic document...');
        
        const createResponse = await docs.documents.create({
            resource: {
                title: 'PO Test Document - ' + new Date().toISOString()
            }
        });
        
        const documentId = createResponse.data.documentId;
        console.log('Step 1: Document created successfully:', documentId);
        
        console.log('Step 2: Moving document to Orders folder...');
        
        const ordersFolder = '1-zamjJmI9pHXUKlCsyNiYjHQzAcDmc9x';
        
        await drive.files.update({
            fileId: documentId,
            addParents: ordersFolder,
            removeParents: 'root'
        });
        
        console.log('Step 2: Document moved to folder successfully');
        
        console.log('Step 3: Adding content to document...');
        
        await docs.documents.batchUpdate({
            documentId: documentId,
            resource: {
                requests: [
                    {
                        insertText: {
                            location: {
                                index: 1
                            },
                            text: 'TEST PURCHASE ORDER\n\nThis is a test document to verify Google Docs API permissions.\n\nCreated: ' + new Date().toISOString()
                        }
                    }
                ]
            }
        });
        
        console.log('Step 3: Content added successfully');
        
        console.log('Step 4: Creating shareable link...');
        
        await drive.permissions.create({
            fileId: documentId,
            resource: {
                role: 'reader',
                type: 'anyone'
            }
        });
        
        const shareResponse = await drive.files.get({
            fileId: documentId,
            fields: 'webViewLink'
        });
        
        const documentUrl = shareResponse.data.webViewLink;
        console.log('Step 4: Shareable link created:', documentUrl);
        
        console.log('Cleaning up test document...');
        await drive.files.delete({
            fileId: documentId
        });
        console.log('Test document deleted');
        
        res.json({
            message: 'Google Docs creation test completed successfully with domain-wide delegation',
            success: true,
            steps: [
                'Document creation: Success',
                'Folder placement: Success',
                'Content insertion: Success',
                'Shareable link: Success',
                'Cleanup: Success'
            ],
            documentUrl: documentUrl,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Google Docs test failed:', error);
        
        res.status(500).json({
            message: 'Google Docs creation test failed',
            success: false,
            error: error.message,
            step: determineFailedStep(error),
            timestamp: new Date().toISOString()
        });
    }
});

router.get('/po/test', async (req, res) => {
    try {
        const testResult = await googleDocsPO.testPOGeneration();
        res.json({
            message: 'PO generation test endpoint',
            initialized: testResult,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: 'PO test failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

router.get('/sheets/test', async (req, res) => {
    try {
        const connected = await googleSheets.testConnection();
        res.json({
            message: 'Google Sheets test endpoint',
            connected,
            suppliers: Object.keys(googleSheets.SUPPLIERS),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: 'Sheets test failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

router.get('/test', (req, res) => {
    res.json({
        message: 'Webhook endpoint is active',
        stores: Object.keys(req.app.locals.storeConfigs),
        timestamp: new Date().toISOString()
    });
});

module.exports = router;