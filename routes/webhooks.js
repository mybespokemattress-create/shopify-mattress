const express = require('express');
const crypto = require('crypto');
const db = require('../database/db');

const router = express.Router();

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
    
    return {
        orderId: order.id.toString(),
        storeDomain,
        shopifyOrderNumber: order.order_number || order.name,
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

// Extract product data and measurements from line items
function extractProductData(lineItems) {
    return lineItems.map(item => {
        const measurements = {};
        
        // Extract custom measurements from line item properties
        if (item.properties && Array.isArray(item.properties)) {
            item.properties.forEach(prop => {
                // Look for measurement properties
                const propName = prop.name?.toLowerCase();
                if (propName?.includes('dimension') || propName?.includes('measurement')) {
                    // Extract dimension letter (A, B, C, D, E)
                    const dimensionMatch = propName.match(/dimension\s*([a-e])/i);
                    if (dimensionMatch) {
                        measurements[dimensionMatch[1].toUpperCase()] = {
                            value: prop.value,
                            unit: 'cm' // Default, could be extracted from value
                        };
                    }
                }
                
                // Store all properties for debugging
                measurements[`property_${prop.name}`] = prop.value;
            });
        }
        
        return {
            shopifySku: item.sku,
            productTitle: item.title,
            variantTitle: item.variant_title,
            quantity: item.quantity,
            price: item.price,
            measurements,
            lineItemId: item.id,
            productId: item.product_id,
            variantId: item.variant_id
        };
    });
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
            // Body is already a JavaScript object (shouldn't happen with express.raw, but just in case)
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
        
        console.log(`📋 Processing order #${customerData.shopifyOrderNumber} from ${customerData.customerName}`);
        console.log(`🛒 Products: ${productData.length} items`);
        
        // Log product SKUs and check for mappings
        const unmappedProducts = [];
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
        try {
            await db.orders.create({
                orderId: customerData.orderId,
                storeDomain: customerData.storeDomain,
                shopifyOrderNumber: customerData.shopifyOrderNumber,
                customerName: customerData.customerName,
                customerEmail: customerData.customerEmail,
                status: unmappedProducts.length > 0 ? 'needs_mapping' : 'received'
            });
            
            console.log('✅ Order stored in database successfully');
        } catch (error) {
            console.error('❌ Error storing order in database:', error);
        }
        
        // Log detailed order information
        console.log(`📧 Customer: ${customerData.customerEmail}`);
        console.log(`📞 Phone: ${customerData.customerPhone}`);
        console.log(`💰 Total: ${customerData.currency} ${customerData.totalPrice}`);
        
        // Log measurements if found
        productData.forEach((product, index) => {
            console.log(`🔧 Product ${index + 1}: ${product.productTitle}`);
            if (Object.keys(product.measurements).length > 0) {
                console.log(`📐 Measurements:`, product.measurements);
            }
        });
        
        // Return success response
        const response = {
            success: true,
            orderId: customerData.orderId,
            orderNumber: customerData.shopifyOrderNumber,
            store: store.config.name,
            productsProcessed: productData.length,
            unmappedProducts: unmappedProducts.length > 0 ? unmappedProducts : undefined,
            timestamp
        };
        
        console.log(`✅ Order processed successfully`);
        if (unmappedProducts.length > 0) {
            console.log(`⚠️  Warning: ${unmappedProducts.length} products need mapping`);
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

// Webhook test endpoint
router.get('/test', (req, res) => {
    res.json({
        message: 'Webhook endpoint is active',
        stores: Object.keys(req.app.locals.storeConfigs),
        timestamp: new Date().toISOString()
    });
});

module.exports = router;