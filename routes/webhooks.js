const express = require('express');
const crypto = require('crypto');
const db = require('../database/db');
const googleSheets = require('../google-sheets');
const googleDocsPO = require('../google-docs-po'); // NEW: Import PO generator

const router = express.Router();

// Store-specific order prefixes
const ORDER_PREFIXES = {
    'uxyxaq-pu.myshopify.com': '#MOTO',        // Motorhome Mattresses
    'mattressmade.myshopify.com': '#MYBE',     // My Bespoke Mattress
    'd587eb.myshopify.com': '#CARA'            // Caravan Mattresses
};

// Webhook signature verification
function verifyWebhookSignature(data, signature, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(data, 'utf8');
    const calculatedSignature = hmac.digest('base64');
    
    // Shopify sends the signature as sha256=<signature>
    const expectedSignature = signature.replace('sha256=', '');
    
    console.log('Calculated signature (base64):', calculatedSignature);
    console.log('Expected signature (base64):', expectedSignature);
    
    return calculatedSignature === expectedSignature;
}

// Get store config from webhook
function getStoreFromHeaders(req) {
    // Try to get store domain from Shopify headers
    const shopDomain = req.get('X-Shopify-Shop-Domain');
    
    if (shopDomain && req.app.locals.storeConfigs[shopDomain]) {
        return {
            domain: shopDomain,
            config: req.app.locals.storeConfigs[shopDomain]
        };
    }
    
    // Fallback: try to match webhook signature with known stores
    const signature = req.get('X-Shopify-Hmac-Sha256');
    let bodyString;
    
    // Handle different body types
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
    
    // Get store-specific order prefix
    const orderPrefix = ORDER_PREFIXES[storeDomain] || '#';
    
    // Format the complete order number with store prefix
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

// NEW: Determine measurement option from order properties
function determineMeasurementOption(measurements) {
    // Check if customer provided measurements (Option 1)
    const hasDimensions = Object.keys(measurements).some(key => 
        key.match(/^[A-G]$/) && measurements[key].value
    );
    
    if (hasDimensions) {
        return 'option1'; // Customer provided measurements
    }
    
    // Check order properties for measurement choice indicators
    const measurementChoice = Object.keys(measurements).find(key => 
        key.toLowerCase().includes('measurement') && key.toLowerCase().includes('option')
    );
    
    if (measurementChoice) {
        const choice = measurements[measurementChoice];
        if (choice.includes('later') || choice.includes('send')) {
            return 'option2'; // Send measurements later
        }
        if (choice.includes('kit') || choice.includes('measuring')) {
            return 'option3'; // Measuring kit requested
        }
    }
    
    // Default fallback based on presence of measurements
    return hasDimensions ? 'option1' : 'option2';
}

// NEW: Extract customer measurements and validate completeness
function extractCustomerMeasurements(properties) {
    const measurements = {};
    const dimensionValues = {};
    
    if (!properties || !Array.isArray(properties)) {
        return { complete: false, data: {}, missing: [], option: 'option2' };
    }
    
    properties.forEach(prop => {
        const propName = prop.name?.toLowerCase();
        
        // Extract dimension measurements (A, B, C, D, E, F, G)
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
        
        // Store all properties for reference
        measurements[`property_${prop.name}`] = prop.value;
    });
    
    // Determine which dimensions were provided
    const providedDimensions = Object.keys(dimensionValues);
    const expectedDimensions = ['A', 'B', 'C', 'D', 'E']; // Standard set
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
        // Extract customer measurements
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
            
            // NEW: Shape information placeholder (will be enhanced later)
            shapeInfo: {
                shapeNumber: null, // To be populated from database mapping
                availableMeasurements: null,
                requiredMeasurements: null,
                diagramUrl: null
            },
            
            // NEW: Customer measurement data and status
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

// NEW: Enhanced product mapping check with shape information
async function enhanceProductWithShapeInfo(product) {
    if (product.shopifySku) {
        try {
            const mapping = await db.productMappings.getBySku(product.shopifySku);
            if (mapping) {
                console.log(`✅ Found mapping for SKU: ${product.shopifySku}`);
                product.supplierSpecification = mapping.supplier_specification;
                product.shapeId = mapping.shape_id;
                
                // If we have a shape_id, extract the shape number
                if (mapping.shape_id) {
                    // Assuming shape_id format like "shape_boat_40" or just "40"
                    const shapeMatch = mapping.shape_id.match(/(\d+)/);
                    if (shapeMatch) {
                        product.shapeInfo.shapeNumber = shapeMatch[1];
                        console.log(`📐 Shape ${product.shapeInfo.shapeNumber} assigned to ${product.shopifySku}`);
                    }
                }
                
                return true; // Found mapping
            } else {
                console.log(`⚠️  No mapping found for SKU: ${product.shopifySku}`);
                return false; // No mapping
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
    console.log(`[${timestamp}] 📦 Received webhook from Shopify`);
    
    try {
        // Parse the JSON body - handle different formats
        let order;
        let rawBodyString;
        
        if (typeof req.body === 'string') {
            rawBodyString = req.body;
            order = JSON.parse(req.body);
        } else if (Buffer.isBuffer(req.body)) {
            rawBodyString = req.body.toString();
            order = JSON.parse(rawBodyString);
        } else {
            // Body is already a JavaScript object
            order = req.body;
            rawBodyString = JSON.stringify(req.body);
        }
        
        console.log('Body type:', typeof req.body);
        console.log('Order ID:', order.id);
        
        // Verify webhook signature and identify store
        const signature = req.get('X-Shopify-Hmac-Sha256');
        if (!signature) {
            console.error('❌ Missing webhook signature');
            return res.status(401).json({ error: 'Missing signature' });
        }
        
        const store = getStoreFromHeaders(req);
        if (!store) {
            console.error('❌ Could not verify webhook signature or identify store');
            return res.status(401).json({ error: 'Invalid signature or unknown store' });
        }
        
        console.log(`✅ Verified webhook from store: ${store.config.name} (${store.domain})`);
        
        // Verify the signature one more time for security
        if (!verifyWebhookSignature(rawBodyString, signature, store.config.webhookSecret)) {
            console.error('❌ Webhook signature verification failed');
            return res.status(401).json({ error: 'Invalid signature' });
        }
        
        // Extract order data
        const customerData = extractCustomerData(order, store.domain);
        const productData = extractProductData(order.line_items || []);
        
        console.log(`📋 Processing order ${customerData.shopifyOrderNumber} from ${customerData.customerName}`);
        console.log(`🛒 Products: ${productData.length} items`);
        
        // NEW: Enhanced product mapping with shape information
        const unmappedProducts = [];
        for (const product of productData) {
            const hasMapping = await enhanceProductWithShapeInfo(product);
            if (!hasMapping) {
                unmappedProducts.push(product.shopifySku);
            }
        }
        
        // Determine supplier based on SKU patterns
        let supplierAssignment = null;
        let supplierName = null;
        
        const detectedSupplier = googleSheets.determineSupplier(productData);
        if (detectedSupplier) {
            supplierAssignment = detectedSupplier;
            supplierName = googleSheets.SUPPLIERS[detectedSupplier].name;
            console.log(`📊 Auto-assigned to supplier: ${supplierName}`);
        } else {
            console.log('⚠️ No supplier match found for order SKUs');
        }
        
        // NEW: Log shape and measurement information
        productData.forEach((product, index) => {
            console.log(`🔧 Product ${index + 1}: ${product.productTitle}`);
            
            // Log shape information
            if (product.shapeInfo.shapeNumber) {
                console.log(`📐 Shape: ${product.shapeInfo.shapeNumber}`);
            }
            
            // Log measurement status
            console.log(`📏 Measurement option: ${product.measurementStatus.option}`);
            console.log(`✅ Complete measurements: ${product.measurementStatus.hasCompleteMeasurements}`);
            
            if (product.measurementStatus.providedDimensions.length > 0) {
                console.log(`📋 Provided dimensions: ${product.measurementStatus.providedDimensions.join(', ')}`);
            }
            
            if (product.measurementStatus.missingDimensions.length > 0) {
                console.log(`⚠️ Missing dimensions: ${product.measurementStatus.missingDimensions.join(', ')}`);
            }
        });
        
        // Store order in database
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
            
            console.log('✅ Order stored in database successfully');
        } catch (error) {
            console.error('❌ Error storing order in database:', error);
        }
        
        // Try to add to Google Sheets if supplier is determined
        let sheetsResult = null;
        if (supplierAssignment && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
            try {
                console.log('📊 Adding order to Google Sheets...');
                sheetsResult = await googleSheets.addOrderToSheet(customerData, productData);
                
                if (sheetsResult.success) {
                    // Update database with sync status
                    await db.orders.updateSheetsSync(
                        customerData.orderId,
                        customerData.storeDomain,
                        true,
                        new Date().toISOString(),
                        sheetsResult.sheetRange
                    );
                    console.log(`✅ Order added to ${sheetsResult.supplierName}`);
                } else {
                    console.log(`⚠️ Could not add to sheets: ${sheetsResult.reason}`);
                }
            } catch (error) {
                console.error('❌ Error adding to Google Sheets:', error.message);
                // Update database with sync status
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
        
        // NEW: Generate Purchase Order if Google Sheets was successful
        let poResult = null;
        if (sheetsResult && sheetsResult.success && supplierAssignment) {
            try {
                console.log('📄 Generating Purchase Order...');
                
                const supplierInfo = {
                    key: supplierAssignment,
                    name: supplierName
                };
                
                poResult = await googleDocsPO.generatePO(customerData, productData, supplierInfo);
                
                if (poResult.success) {
                    console.log(`✅ PO generated: ${poResult.documentUrl}`);
                    console.log(`📋 PO Type: ${poResult.poType}`);
                } else {
                    console.log(`⚠️ PO generation failed`);
                }
                
            } catch (error) {
                console.error('❌ Error generating PO:', error.message);
            }
        } else {
            console.log('⚠️ Skipping PO generation - Google Sheets sync required first');
        }
        
        // Log detailed order information
        console.log(`📧 Customer: ${customerData.customerEmail}`);
        console.log(`📞 Phone: ${customerData.customerPhone}`);
        console.log(`💰 Total: ${customerData.currency} ${customerData.totalPrice}`);
        
        // Return success response
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
        
        console.log(`✅ Order processed successfully`);
        if (unmappedProducts.length > 0) {
            console.log(`⚠️  Warning: ${unmappedProducts.length} products need mapping`);
        }
        if (sheetsResult?.success) {
            console.log(`📊 Google Sheets updated: ${sheetsResult.supplierName}`);
        }
        if (poResult?.success) {
            console.log(`📄 Purchase Order generated: ${poResult.poType}`);
        }
        
        res.status(200).json(response);
        
    } catch (error) {
        console.error(`❌ Webhook processing error:`, error);
        
        // Try to log the error in database if we have basic order info
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

// NEW: Simple Google Docs creation test endpoint
router.get('/po/simple-test', async (req, res) => {
    try {
        console.log('🧪 Testing simple Google Docs creation in root Drive...');
        
        // Use the same method as your working google-docs-po.js
        const { GoogleAuth } = require('google-auth-library');
        const { google } = require('googleapis');
        
        const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        
        const auth = new GoogleAuth({
            credentials: serviceAccount,
            scopes: [
                'https://www.googleapis.com/auth/documents',
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/drive.file'
            ]
        });
        
        const docs = google.docs({ version: 'v1', auth });
        const drive = google.drive({ version: 'v3', auth });
        
        console.log('✅ APIs initialized');
        
        // Try the EXACT same method as your google-docs-po.js uses
        console.log('🧪 Creating document in root Drive (same method as PO module)...');
        
        const createResponse = await docs.documents.create({
            resource: {
                title: 'Simple Test Document - ' + new Date().toISOString()
            }
        });
        
        const documentId = createResponse.data.documentId;
        console.log('✅ Document created successfully:', documentId);
        
        // Get the document URL
        const file = await drive.files.get({
            fileId: documentId,
            fields: 'webViewLink'
        });
        
        const documentUrl = file.data.webViewLink;
        console.log('✅ Document URL:', documentUrl);
        
        // Clean up
        await drive.files.delete({
            fileId: documentId
        });
        console.log('✅ Test document deleted');
        
        res.json({
            message: 'Simple Google Docs test completed successfully',
            success: true,
            documentId: documentId,
            documentUrl: documentUrl,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Simple Google Docs test failed:', error);
        
        res.status(500).json({
            message: 'Simple Google Docs test failed',
            success: false,
            error: error.message,
            errorCode: error.code,
            errorDetails: error.details,
            timestamp: new Date().toISOString()
        });
    }
});

// NEW: Google Docs creation test endpoint (FIXED VERSION)
router.get('/po/create-test', async (req, res) => {
    try {
        console.log('🧪 Testing Google Docs document creation...');
        
        // Use the same authentication method as google-docs-po.js
        const { GoogleAuth } = require('google-auth-library');
        const { google } = require('googleapis');
        
        // Parse service account key (same as your working module)
        const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        
        // Create auth client using GoogleAuth (same method as your PO module)
        const auth = new GoogleAuth({
            credentials: serviceAccount,
            scopes: [
                'https://www.googleapis.com/auth/documents',
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/drive.file'
            ]
        });
        
        console.log('✅ Auth client created');
        
        // Initialize APIs (same as your PO module)
        const docs = google.docs({ version: 'v1', auth });
        const drive = google.drive({ version: 'v3', auth });
        
        console.log('✅ APIs initialized');
        
        // Step 1: Test basic document creation (no folder)
        console.log('🧪 Step 1: Creating basic document...');
        
        const createResponse = await docs.documents.create({
            resource: {
                title: 'PO Test Document - ' + new Date().toISOString()
            }
        });
        
        const documentId = createResponse.data.documentId;
        console.log('✅ Step 1: Document created successfully:', documentId);
        
        // Step 2: Test moving to folder
        console.log('🧪 Step 2: Moving document to Orders folder...');
        
        const ordersFolder = '19RJxQRQ5rercn3IeWIeh5nPoLGykei0k'; // Your orders folder ID
        
        await drive.files.update({
            fileId: documentId,
            addParents: ordersFolder,
            removeParents: 'root'
        });
        
        console.log('✅ Step 2: Document moved to folder successfully');
        
        // Step 3: Test document content insertion
        console.log('🧪 Step 3: Adding content to document...');
        
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
        
        console.log('✅ Step 3: Content added successfully');
        
        // Step 4: Generate shareable link
        console.log('🧪 Step 4: Creating shareable link...');
        
        // Set permissions to make it shareable
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
        console.log('✅ Step 4: Shareable link created:', documentUrl);
        
        // Clean up - delete test document
        console.log('🧹 Cleaning up test document...');
        await drive.files.delete({
            fileId: documentId
        });
        console.log('✅ Test document deleted');
        
        res.json({
            message: 'Google Docs creation test completed successfully',
            success: true,
            steps: [
                'Document creation: ✅',
                'Folder placement: ✅',
                'Content insertion: ✅',
                'Shareable link: ✅',
                'Cleanup: ✅'
            ],
            documentUrl: documentUrl, // This will be deleted but shows it worked
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Google Docs test failed:', error);
        
        res.status(500).json({
            message: 'Google Docs creation test failed',
            success: false,
            error: error.message,
            step: determineFailedStep(error),
            timestamp: new Date().toISOString()
        });
    }
});

// NEW: PO generation test endpoint
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

// Google Sheets test endpoint
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

// Webhook test endpoint
router.get('/test', (req, res) => {
    res.json({
        message: 'Webhook endpoint is active',
        stores: Object.keys(req.app.locals.storeConfigs),
        timestamp: new Date().toISOString()
    });
});

module.exports = router;