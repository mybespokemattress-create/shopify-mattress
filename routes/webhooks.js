const express = require('express');
const crypto = require('crypto');
const db = require('../database/db');
const googleSheets = require('../google-sheets');
const ShopifyAPI = require('../shopify-api'); // NEW: Import Shopify API

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

// Enhanced product data extraction with Shopify API metafield fetching
async function extractProductData(lineItems, storeDomain, storeConfig) {
    const results = [];
    
    // Initialize Shopify API client for this store
    const shopifyAPI = new ShopifyAPI(storeDomain, storeConfig.api_access_token);
    
    for (const item of lineItems) {
        // Extract customer measurements
        const customerMeasurements = extractCustomerMeasurements(item.properties);
        
        // Fetch product metafields from Shopify API
        let shapeInfo = {
            shapeNumber: null,
            availableMeasurements: null,
            requiredMeasurements: null,
            diagramUrl: null
        };
        
        if (item.product_id) {
            try {
                console.log(`🔍 Fetching shape data for product ID: ${item.product_id}`);
                const metafields = await shopifyAPI.getProductMetafields(item.product_id);
                shapeInfo = shopifyAPI.extractShapeInfo(metafields);
                
                if (shapeInfo.shapeNumber) {
                    console.log(`📐 Found shape ${shapeInfo.shapeNumber} for product ${item.title}`);
                } else {
                    console.log(`⚠️ No shape information found for product ${item.title}`);
                }
                
            } catch (error) {
                console.error(`❌ Failed to fetch metafields for product ${item.product_id}:`, error.message);
            }
        }
        
        results.push({
            shopifySku: item.sku,
            productTitle: item.title,
            variantTitle: item.variant_title,
            quantity: item.quantity,
            price: item.price,
            lineItemId: item.id,
            productId: item.product_id,
            variantId: item.variant_id,
            
            // Shape information from Shopify API
            shapeInfo: shapeInfo,
            
            // Customer measurement data and status
            measurementStatus: {
                option: customerMeasurements.option,
                hasCompleteMeasurements: customerMeasurements.complete,
                measurements: customerMeasurements.data,
                missingDimensions: customerMeasurements.missing,
                providedDimensions: customerMeasurements.provided
            }
        });
    }
    
    return results;
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
        const productData = await extractProductData(order.line_items || [], store.domain, store.config);
        
        console.log(`📋 Processing order ${customerData.shopifyOrderNumber} from ${customerData.customerName}`);
        console.log(`🛒 Products: ${productData.length} items`);
        
        // NEW: Log shape and measurement information
        productData.forEach((product, index) => {
            console.log(`🔧 Product ${index + 1}: ${product.productTitle}`);
            
            // Log shape information
            if (product.shapeInfo.shapeNumber) {
                console.log(`📐 Shape: ${product.shapeInfo.shapeNumber}`);
                console.log(`📊 Required measurements: ${product.shapeInfo.requiredMeasurements}`);
                console.log(`🔗 Diagram URL: ${product.shapeInfo.diagramUrl}`);
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
        
        // Check for product mappings and determine supplier
        const unmappedProducts = [];
        let supplierAssignment = null;
        let supplierName = null;
        
        // Determine supplier based on SKU patterns
        const detectedSupplier = googleSheets.determineSupplier(productData);
        if (detectedSupplier) {
            supplierAssignment = detectedSupplier;
            supplierName = googleSheets.SUPPLIERS[detectedSupplier].name;
            console.log(`📊 Auto-assigned to supplier: ${supplierName}`);
        } else {
            console.log('⚠️ No supplier match found for order SKUs');
        }
        
        // Check product mappings
        for (const product of productData) {
            if (product.shopifySku) {
                try {
                    const mapping = await db.productMappings.getBySku(product.shopifySku);
                    if (mapping) {
                        console.log(`✅ Found mapping for SKU: ${product.shopifySku}`);
                        product.supplierSpecification = mapping.supplier_specification;
                        product.shapeId = mapping.shape_id;
                    } else {
                        console.log(`⚠️  No mapping found for SKU: ${product.shopifySku}`);
                        unmappedProducts.push(product.shopifySku);
                    }
                } catch (error) {
                    console.error(`Error checking mapping for SKU ${product.shopifySku}:`, error);
                    unmappedProducts.push(product.shopifySku);
                }
            }
        }
        
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
        } else {
            if (!supplierAssignment) {
                console.log('⚠️ Skipping Google Sheets - no supplier assigned');
            }
            if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
                console.log('⚠️ Skipping Google Sheets - no credentials configured');
            }
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