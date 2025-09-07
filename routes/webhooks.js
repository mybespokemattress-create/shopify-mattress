const express = require('express');
const crypto = require('crypto');
const db = require('../database/db');
const googleSheets = require('../google-sheets');

const router = express.Router();

// Store-specific order prefixes
const ORDER_PREFIXES = {
    'uxyxaq-pu.myshopify.com': '#MOTO',
    'mattressmade.myshopify.com': '#MYBE',
    'd587eb.myshopify.com': '#CARA'
};

// Safe service account parsing
function getSafeServiceAccount() {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set');
    }
    
    try {
        const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        
        if (!serviceAccount.client_email || !serviceAccount.private_key || !serviceAccount.project_id) {
            throw new Error('Service account JSON is missing required fields');
        }
        
        return serviceAccount;
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error(`Invalid JSON format in GOOGLE_SERVICE_ACCOUNT_KEY: ${error.message}`);
        }
        throw error;
    }
}

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

// Auto-detect mattress label from store domain
function getMattressLabelFromStore(storeDomain) {
    if (!storeDomain) return null;
    
    const domain = storeDomain.toLowerCase();
    if (domain.includes('caravanmattresses') || domain.includes('d587eb')) return 'CaravanMattresses';
    if (domain.includes('motorhomemattresses') || domain.includes('uxyxaq-pu')) return 'MotorhomeMattresses';
    if (domain.includes('mybespoke') || domain.includes('mattressmade')) return 'MyBespokeMattresses';
    
    return null;
}

// Extract customer notes from various Shopify locations
function extractCustomerNotes(order) {
    // Check multiple possible locations for customer notes
    if (order.note && order.note.trim()) {
        console.log('Found customer notes in order.note:', order.note);
        return order.note.trim();
    }
    
    if (order.notes && order.notes.trim()) {
        console.log('Found customer notes in order.notes:', order.notes);
        return order.notes.trim();
    }
    
    if (order.customer_note && order.customer_note.trim()) {
        console.log('Found customer notes in order.customer_note:', order.customer_note);
        return order.customer_note.trim();
    }
    
    if (order.order_note && order.order_note.trim()) {
        console.log('Found customer notes in order.order_note:', order.order_note);
        return order.order_note.trim();
    }
    
    // Check attributes array (some Shopify setups use this)
    if (order.attributes && Array.isArray(order.attributes)) {
        const notesAttribute = order.attributes.find(attr => 
            attr.name && attr.name.toLowerCase().includes('note')
        );
        if (notesAttribute && notesAttribute.value && notesAttribute.value.trim()) {
            console.log('Found customer notes in order.attributes:', notesAttribute.value);
            return notesAttribute.value.trim();
        }
    }
    
    console.log('No customer notes found in order');
    return null;
}

// Extract customer data from Shopify order (enhanced with notes and mattress label)
function extractCustomerData(order, storeDomain) {
    const customer = order.customer;
    const billing = order.billing_address;
    const shipping = order.shipping_address;
    
    const orderPrefix = ORDER_PREFIXES[storeDomain] || '#';
    
    const orderNumber = order.order_number || order.name;
    const fullOrderNumber = orderNumber.toString().startsWith('#') 
        ? orderNumber 
        : `${orderPrefix}${orderNumber}`;
    
    // Extract customer notes
    const customerNotes = extractCustomerNotes(order);
    
    // Auto-detect mattress label from store domain
    const mattressLabel = getMattressLabelFromStore(storeDomain);
    
    console.log(`Customer notes extracted: ${customerNotes ? 'Yes' : 'No'}`);
    console.log(`Mattress label detected: ${mattressLabel || 'None'} (from ${storeDomain})`);
    
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
        currency: order.currency,
        // NEW: Customer notes and mattress label
        customerNotes: customerNotes,
        mattressLabel: mattressLabel
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

// Enhanced measurement extraction with unit support
function extractCustomerMeasurements(properties) {
    const measurements = {};
    const dimensionValues = {};
    
    if (!properties || !Array.isArray(properties)) {
        return { complete: false, data: {}, missing: [], provided: [], option: 'option2' };
    }
    
    properties.forEach(prop => {
        const propName = prop.name?.toLowerCase();
        
        // Check for dimension patterns: "Enter Dimension A (cm)" or "Dimension A"
        if (propName?.includes('dimension')) {
            // Extract the letter (A-G) from various formats
            const letterMatch = propName.match(/dimension\s*([a-g])/i);
            if (letterMatch && prop.value) {
                const letter = letterMatch[1].toUpperCase();
                
                // Extract unit from property name
                let unit = 'cm'; // default unit
                if (prop.name.includes('(mm)')) {
                    unit = 'mm';
                } else if (prop.name.includes('(in)') || prop.name.includes('(inches)')) {
                    unit = 'in';
                } else if (prop.name.includes('(cm)')) {
                    unit = 'cm';
                }
                
                dimensionValues[letter] = {
                    value: prop.value,
                    unit: unit
                };
                console.log(`Extracted Dimension ${letter}: ${prop.value} ${unit}`);
            }
        }
        
        // Store original property for reference
        measurements[`property_${prop.name}`] = prop.value;
    });
    
    const providedDimensions = Object.keys(dimensionValues);
    const expectedDimensions = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const missingDimensions = expectedDimensions.filter(dim => !providedDimensions.includes(dim));
    
    console.log(`Dimensions extracted: ${providedDimensions.join(', ') || 'none'}`);
    console.log(`Missing dimensions: ${missingDimensions.join(', ') || 'none'}`);
    
    return {
        complete: missingDimensions.length === 0 && providedDimensions.length > 0,
        data: { ...measurements, ...dimensionValues },
        missing: missingDimensions,
        provided: providedDimensions,
        option: determineMeasurementOption({ ...measurements, ...dimensionValues })
    };
}

// Enhanced product data extraction with measurements, shape info, and manufacturing options
function extractProductData(lineItems) {
    return lineItems.map(item => {
        const customerMeasurements = extractCustomerMeasurements(item.properties);
        
        // Extract manufacturing options from line item
        const manufacturingOptions = extractManufacturingOptions(item);
        
        return {
            shopifySku: item.sku,
            productTitle: item.title,
            variantTitle: item.variant_title,
            quantity: item.quantity,
            price: item.price,
            lineItemId: item.id,
            productId: item.product_id,
            variantId: item.variant_id,
            
            // Manufacturing options
            manufacturingOptions: manufacturingOptions,
            
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

// Extract manufacturing options from line item
function extractManufacturingOptions(lineItem) {
    const manufacturingOptions = {
        linkAttachment: null,
        deliveryOption: "Rolled and Boxed" // Default for now
    };
    
    // Extract Link Attachment from variant_title
    if (lineItem.variant_title) {
        // Split by " / " and get the last segment
        const variantParts = lineItem.variant_title.split(' / ');
        if (variantParts.length > 0) {
            const linkAttachment = variantParts[variantParts.length - 1].trim();
            
            // Check if it's a recognised Link Attachment option
            const linkOptions = [
                'Leave Sections Loose',
                'Leave Bolster Loose', 
                'Fabric Link (+£40)',
                'Zip-Link (+£40)'
            ];
            
            if (linkOptions.some(option => linkAttachment.includes(option.split(' ')[0]))) {
                manufacturingOptions.linkAttachment = linkAttachment;
                console.log(`Extracted Link Attachment: ${linkAttachment}`);
            }
        }
    }
    
    // Extract Delivery Option from properties (for future use)
    if (lineItem.properties) {
        const deliveryProperty = lineItem.properties.find(prop => 
            prop.name === 'Delivery'
        );
        if (deliveryProperty && deliveryProperty.value) {
            manufacturingOptions.deliveryOption = deliveryProperty.value;
        }
    }
    
    return manufacturingOptions;
}

// Main webhook handler for order creation
router.post('/orders/create', express.raw({ type: 'application/json' }), async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Received webhook from Shopify`);
    
    try {
        let order;
        let rawBodyString;
        
        // Parse the request body
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
        
        // Verify webhook signature
        const signature = req.get('X-Shopify-Hmac-Sha256');
        if (!signature) {
            console.error('Missing webhook signature');
            return res.status(401).json({ error: 'Missing signature' });
        }
        
        // Get store configuration
        const store = getStoreFromHeaders(req);
        if (!store) {
            console.error('Could not verify webhook signature or identify store');
            return res.status(401).json({ error: 'Invalid signature or unknown store' });
        }
        
        console.log(`Verified webhook from store: ${store.config.name} (${store.domain})`);
        
        // Verify signature
        if (!verifyWebhookSignature(rawBodyString, signature, store.config.webhookSecret)) {
            console.error('Webhook signature verification failed');
            return res.status(401).json({ error: 'Invalid signature' });
        }
        
        // Extract data (now includes customer notes and mattress label)
        const customerData = extractCustomerData(order, store.domain);
        const productData = extractProductData(order.line_items || []);
        
        console.log(`Processing order ${customerData.shopifyOrderNumber} from ${customerData.customerName}`);
        console.log(`Products: ${productData.length} items`);
        
        // Log customer notes and mattress label if present
        if (customerData.customerNotes) {
            console.log(`Customer Notes: "${customerData.customerNotes}"`);
        }
        if (customerData.mattressLabel) {
            console.log(`Mattress Label: ${customerData.mattressLabel}`);
        }
        
        // Debug: Log raw line item properties
        if (order.line_items && order.line_items.length > 0) {
            console.log('=== DEBUG: Line Item Properties ===');
            order.line_items.forEach((item, index) => {
                console.log(`Item ${index + 1}: ${item.title}`);
                if (item.properties && item.properties.length > 0) {
                    console.log('Properties found:');
                    item.properties.forEach(prop => {
                        console.log(`  - ${prop.name}: ${prop.value}`);
                    });
                } else {
                    console.log('  No properties on this item');
                }
            });
            console.log('=== END DEBUG ===');
        }
        
        // Check product mappings and enhance with shape info
        const unmappedProducts = [];
        for (const product of productData) {
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
                    } else {
                        console.log(`No mapping found for SKU: ${product.shopifySku}`);
                        unmappedProducts.push(product.shopifySku);
                    }
                } catch (error) {
                    console.error(`Error checking mapping for SKU ${product.shopifySku}:`, error);
                    unmappedProducts.push(product.shopifySku);
                }
            }
        }
        
        // Log product details including measurements
        productData.forEach((product, index) => {
            console.log(`Product ${index + 1}: ${product.productTitle}`);
            
            if (product.shapeInfo && product.shapeInfo.shapeNumber) {
                console.log(`  Shape: ${product.shapeInfo.shapeNumber}`);
            }
            
            if (product.measurementStatus) {
                console.log(`  Measurement option: ${product.measurementStatus.option}`);
                console.log(`  Complete measurements: ${product.measurementStatus.hasCompleteMeasurements}`);
                
                if (product.measurementStatus.providedDimensions && product.measurementStatus.providedDimensions.length > 0) {
                    console.log(`  Provided dimensions: ${product.measurementStatus.providedDimensions.join(', ')}`);
                    // Log actual values with units
                    product.measurementStatus.providedDimensions.forEach(dim => {
                        const measurement = product.measurementStatus.measurements[dim];
                        if (measurement) {
                            console.log(`    ${dim}: ${measurement.value} ${measurement.unit}`);
                        }
                    });
                }
                
                if (product.measurementStatus.missingDimensions && product.measurementStatus.missingDimensions.length > 0) {
                    console.log(`  Missing dimensions: ${product.measurementStatus.missingDimensions.join(', ')}`);
                }
            }
        });
        
        // Determine supplier
        let supplierAssignment = null;
        let supplierName = null;
        
        if (googleSheets && googleSheets.determineSupplier) {
            const detectedSupplier = googleSheets.determineSupplier(productData);
            if (detectedSupplier) {
                supplierAssignment = detectedSupplier;
                supplierName = googleSheets.SUPPLIERS[detectedSupplier].name;
                console.log(`Auto-assigned to supplier: ${supplierName}`);
            }
        }
        
        // Store order in database with measurements, notes, and mattress label
        let dbOrder;
        try {
            console.log('Attempting to store order in database...');
            
            // Create extracted_measurements array with proper structure
            const extractedMeasurements = productData.map(p => {
                const measurements = {};
                
                // Only include A-G dimensions with their values and units
                ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(dim => {
                    if (p.measurementStatus?.measurements[dim]) {
                        measurements[dim] = p.measurementStatus.measurements[dim];
                    }
                });
                
                return {
                    sku: p.shopifySku,
                    measurements: measurements,
                    provided: p.measurementStatus?.providedDimensions || [],
                    missing: p.measurementStatus?.missingDimensions || [],
                    // Include all original properties for reference
                    ...Object.fromEntries(
                        Object.entries(p.measurementStatus?.measurements || {})
                            .filter(([key]) => key.startsWith('property_'))
                    )
                };
            });
            
            // Include measurement data in the order_data JSON
            const orderWithMeasurements = {
                ...order,
                extracted_measurements: extractedMeasurements
            };
            
            const orderDataForDb = {
                orderId: customerData.orderId,
                order_number: customerData.shopifyOrderNumber,
                store_domain: customerData.storeDomain,
                customerName: customerData.customerName,
                customerEmail: customerData.customerEmail,
                totalPrice: customerData.totalPrice,
                order_data: orderWithMeasurements,
                supplier_assigned: supplierAssignment,
                supplier_name: supplierName,
                // NEW: Customer notes and mattress label
                notes: customerData.customerNotes,
                mattress_label: customerData.mattressLabel
            };
            
            console.log('Creating order with data:', {
                orderId: orderDataForDb.orderId,
                order_number: orderDataForDb.order_number,
                store_domain: orderDataForDb.store_domain,
                customerName: orderDataForDb.customerName,
                notes: orderDataForDb.notes ? 'Yes' : 'No',
                mattress_label: orderDataForDb.mattress_label || 'None'
            });
            
            dbOrder = await db.orders.create(orderDataForDb);
            
            console.log('Order stored in database successfully');
            console.log('Database returned order ID:', dbOrder.id);
            console.log('Measurements stored:', JSON.stringify(extractedMeasurements, null, 2));
            
            if (customerData.customerNotes) {
                console.log('Customer notes stored successfully');
            }
            if (customerData.mattressLabel) {
                console.log(`Mattress label stored: ${customerData.mattressLabel}`);
            }
            
        } catch (error) {
            console.error('ERROR storing order in database:', error);
            console.error('Full error stack:', error.stack);
            // Continue processing even if DB fails
        }
        
        // Add to Google Sheets if configured
        let sheetsResult = null;
        if (supplierAssignment && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
            try {
                console.log('Adding order to Google Sheets...');
                sheetsResult = await googleSheets.addOrderToSheet(customerData, productData);
                
                if (sheetsResult && sheetsResult.success) {
                    await db.orders.updateSheetsSync(
                        customerData.orderId,
                        customerData.storeDomain,
                        true,
                        new Date().toISOString(),
                        sheetsResult.sheetRange
                    );
                    console.log(`Order added to ${sheetsResult.supplierName}`);
                }
            } catch (error) {
                console.error('Error adding to Google Sheets:', error.message);
            }
        }
        
        // Log summary
        console.log('Order processed successfully');
        console.log(`Customer: ${customerData.customerEmail}`);
        console.log(`Total: ${customerData.currency} ${customerData.totalPrice}`);
        
        if (unmappedProducts.length > 0) {
            console.log(`Warning: ${unmappedProducts.length} products need mapping`);
        }
        
        // Send response
        res.status(200).json({
            success: true,
            orderId: customerData.orderId,
            orderNumber: customerData.shopifyOrderNumber,
            store: store.config.name,
            productsProcessed: productData.length,
            supplierAssigned: supplierName,
            sheetsUpdated: sheetsResult?.success || false,
            unmappedProducts: unmappedProducts.length > 0 ? unmappedProducts : undefined,
            measurementsExtracted: productData.some(p => p.measurementStatus?.providedDimensions?.length > 0),
            customerNotesFound: !!customerData.customerNotes,
            mattressLabelDetected: customerData.mattressLabel,
            timestamp
        });
        
    } catch (error) {
        console.error('Webhook processing error:', error);
        console.error('Stack trace:', error.stack);
        
        res.status(500).json({
            error: 'Webhook processing failed',
            message: error.message,
            timestamp
        });
    }
});

// Test endpoint to manually create an order with measurements, notes, and mattress label
router.post('/test/create-order', async (req, res) => {
    try {
        const timestamp = Date.now().toString();
        const testOrderData = {
            orderId: timestamp,
            order_number: `#TEST-${timestamp}`,
            store_domain: 'test-store.myshopify.com',
            customerName: 'Test Customer',
            customerEmail: 'test@example.com',
            totalPrice: 99.99,
            notes: 'Please deliver by 25th December. We are going on holiday. Thank you!',
            mattress_label: 'CaravanMattresses',
            order_data: { 
                id: timestamp,
                test: true,
                note: 'Please deliver by 25th December. We are going on holiday. Thank you!',
                line_items: [{
                    sku: 'TEST-SKU',
                    title: 'Test Product',
                    quantity: 1,
                    price: 99.99,
                    properties: [
                        { name: 'Enter Dimension A (cm)', value: '100' },
                        { name: 'Enter Dimension B (cm)', value: '200' },
                        { name: 'Enter Dimension C (mm)', value: '300' },
                        { name: 'Enter Dimension D (in)', value: '12' }
                    ]
                }],
                extracted_measurements: [{
                    sku: 'TEST-SKU',
                    measurements: {
                        A: { value: '100', unit: 'cm' },
                        B: { value: '200', unit: 'cm' },
                        C: { value: '300', unit: 'mm' },
                        D: { value: '12', unit: 'in' }
                    },
                    provided: ['A', 'B', 'C', 'D'],
                    missing: ['E', 'F', 'G']
                }]
            }
        };
        
        console.log('Creating test order with notes and mattress label:', testOrderData);
        const testOrder = await db.orders.create(testOrderData);
        
        res.json({ 
            success: true, 
            order: testOrder,
            message: 'Test order created successfully with measurements, notes, and mattress label'
        });
    } catch (error) {
        console.error('Test order creation failed:', error);
        res.status(500).json({ 
            error: error.message, 
            stack: error.stack
        });
    }
});

// Google Sheets test endpoint
router.get('/sheets/test', async (req, res) => {
    try {
        if (googleSheets && googleSheets.testConnection) {
            const connected = await googleSheets.testConnection();
            res.json({
                message: 'Google Sheets test endpoint',
                connected,
                suppliers: googleSheets.SUPPLIERS ? Object.keys(googleSheets.SUPPLIERS) : [],
                timestamp: new Date().toISOString()
            });
        } else {
            res.json({
                message: 'Google Sheets not configured',
                connected: false,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        res.status(500).json({
            error: 'Sheets test failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Basic webhook test endpoint
router.get('/test', (req, res) => {
    res.json({
        message: 'Webhook endpoint is active',
        stores: Object.keys(req.app.locals.storeConfigs),
        timestamp: new Date().toISOString()
    });
});

module.exports = router;