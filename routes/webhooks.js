const express = require('express');
const crypto = require('crypto');
const db = require('../database/db');
const googleSheets = require('../google-sheets');
const { Op } = require('sequelize'); // Add this import for the new API endpoint

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
    if (domain.includes('caravanmattresses') || domain.includes('d587eb')) return 'Caravan Mattresses';
    if (domain.includes('motorhomemattresses') || domain.includes('uxyxaq-pu')) return 'Motorhome Mattresses';
    if (domain.includes('mybespoke') || domain.includes('mattressmade')) return 'My Bespoke Mattresses';
    
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

// Enhanced debugging for empty measurements
function debugEmptyMeasurements(order) {
    console.log('\n🔍 DEBUGGING EMPTY MEASUREMENTS:');
    
    if (order.line_items && order.line_items.length > 0) {
        order.line_items.forEach((item, index) => {
            console.log(`\n📦 Item ${index + 1}: ${item.title} (SKU: ${item.sku})`);
            
            if (item.properties && item.properties.length > 0) {
                console.log('   Properties found:');
                item.properties.forEach(prop => {
                    const isEmpty = !prop.value || prop.value.trim() === '';
                    const icon = isEmpty ? '❌' : '✅';
                    console.log(`   ${icon} ${prop.name}: "${prop.value}"`);
                });
            } else {
                console.log('   ❌ No properties found on this item');
            }
        });
    }
    
    console.log('\n💡 If dimensions are empty:');
    console.log('   - Check Shopify product configuration');
    console.log('   - Verify customer filled in the form properly');
    console.log('   - Check if properties are being passed correctly in webhook');
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

// UPDATED: Enhanced measurement extraction with unit support and empty string handling
function extractCustomerMeasurements(properties) {
    const measurements = {};
    const dimensionValues = {};
    
    if (!properties || !Array.isArray(properties)) {
        return { complete: false, data: {}, missing: [], provided: [], option: 'option2' };
    }
    
    properties.forEach(prop => {
        const propName = prop.name?.toLowerCase();
        const propValue = prop.value?.trim(); // Trim whitespace
        
        // Store ALL properties (for debugging and reference)
        measurements[`property_${prop.name}`] = prop.value;
        
        // Check for dimension patterns: "Enter Dimension A (cm)" or "Dimension A"
        // Only process dimension if it has an actual value (not empty string)
        if (propName?.includes('dimension') && propValue && propValue !== '') {
            // Extract the letter (A-G) from various formats
            const letterMatch = propName.match(/dimension\s*([a-g])/i);
            if (letterMatch) {
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
                    value: propValue,
                    unit: unit
                };
                console.log(`✅ Extracted Dimension ${letter}: ${propValue} ${unit}`);
            }
        } else if (propName?.includes('dimension')) {
            // Log when we skip empty dimensions
            const letterMatch = propName.match(/dimension\s*([a-g])/i);
            if (letterMatch) {
                const letter = letterMatch[1].toUpperCase();
                console.log(`❌ Skipping empty Dimension ${letter}`);
            }
        }
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

// UPDATED: Main webhook handler for order creation with improved multi-item processing
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
        
        // UPDATED: Debug empty measurements
        debugEmptyMeasurements(order);
        
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
        
        // UPDATED: MULTI-ITEM PROCESSING with better logging and error handling
        const dbOrders = [];
        const responseData = {
            success: true,
            orderId: customerData.orderId,
            orderNumber: customerData.shopifyOrderNumber,
            store: store.config.name,
            productsProcessed: productData.length,
            subOrdersCreated: 0,
            supplierAssigned: supplierName,
            sheetsUpdated: false,
            unmappedProducts: unmappedProducts.length > 0 ? unmappedProducts : undefined,
            measurementsExtracted: productData.some(p => p.measurementStatus?.providedDimensions?.length > 0),
            customerNotesFound: !!customerData.customerNotes,
            mattressLabelDetected: customerData.mattressLabel,
            subOrders: [],
            timestamp
        };
        
        try {
            console.log(`🔄 Attempting to store ${productData.length} line items as separate orders...`);
            
            for (let itemIndex = 0; itemIndex < productData.length; itemIndex++) {
                const product = productData[itemIndex];
                const lineItem = order.line_items[itemIndex];
                
                console.log(`\n📦 Processing Item ${itemIndex + 1}/${productData.length}:`);
                console.log(`   Product: ${product.productTitle}`);
                console.log(`   SKU: ${product.shopifySku}`);
                console.log(`   Price: ${lineItem.price}`);
                
                // Create sub-order number: #CARA1639-1, #CARA1639-2, etc.
                const subOrderNumber = productData.length > 1 
                    ? `${customerData.shopifyOrderNumber}-${itemIndex + 1}`
                    : customerData.shopifyOrderNumber;
                
                const subOrderId = productData.length > 1
                    ? `${customerData.orderId}-${itemIndex + 1}`
                    : customerData.orderId;
                
                // Create extracted_measurements for THIS specific line item only
                const extractedMeasurementsForItem = {
                    sku: product.shopifySku,
                    measurements: {},
                    provided: product.measurementStatus?.providedDimensions || [],
                    missing: product.measurementStatus?.missingDimensions || [],
                };
                
                // Include A-G dimensions for this specific item
                ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(dim => {
                    if (product.measurementStatus?.measurements[dim]) {
                        extractedMeasurementsForItem.measurements[dim] = product.measurementStatus.measurements[dim];
                    }
                });
                
                // Include properties for this item
                Object.entries(product.measurementStatus?.measurements || {})
                    .filter(([key]) => key.startsWith('property_'))
                    .forEach(([key, value]) => {
                        extractedMeasurementsForItem[key] = value;
                    });
                
                console.log(`   Measurements provided: ${extractedMeasurementsForItem.provided.join(', ') || 'none'}`);
                console.log(`   Missing: ${extractedMeasurementsForItem.missing.join(', ') || 'none'}`);
                
                // Create order data with ONLY this line item
                const orderWithSingleItem = {
                    ...order,
                    line_items: [lineItem], // Only this specific line item
                    extracted_measurements: [extractedMeasurementsForItem]
                };
                
                const orderDataForDb = {
                    orderId: subOrderId,
                    order_number: subOrderNumber,
                    store_domain: customerData.storeDomain,
                    customerName: customerData.customerName,
                    customerEmail: customerData.customerEmail,
                    totalPrice: lineItem.price, // Price for this specific item
                    order_data: orderWithSingleItem,
                    supplier_assigned: supplierAssignment,
                    supplier_name: supplierName,
                    notes: customerData.customerNotes,
                    mattress_label: customerData.mattressLabel
                };
                
                console.log(`💾 Creating database entry for: ${subOrderNumber}`);
                
                const dbOrder = await db.orders.create(orderDataForDb);
                dbOrders.push(dbOrder);
                
                console.log(`✅ Sub-order ${subOrderNumber} stored successfully (ID: ${dbOrder.id})`);
                
                // Add to response data
                responseData.subOrders.push({
                    subOrderNumber: subOrderNumber,
                    dbId: dbOrder.id,
                    sku: product.shopifySku,
                    productTitle: product.productTitle,
                    price: lineItem.price,
                    measurementsCount: extractedMeasurementsForItem.provided.length,
                    shapeNumber: product.shapeInfo?.shapeNumber
                });
                
                // UPDATED: Add each sub-order to Google Sheets separately
                if (supplierAssignment && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
                    try {
                        console.log(`📊 Adding sub-order ${subOrderNumber} to Google Sheets...`);
                        
                        // Create customer data for this specific sub-order
                        const subOrderCustomerData = {
                            ...customerData,
                            orderId: subOrderId,
                            shopifyOrderNumber: subOrderNumber,
                            totalPrice: lineItem.price
                        };
                        
                        // Create product data for this specific item
                        const subOrderProductData = [product];
                        
                        const sheetsResult = await googleSheets.addOrderToSheet(subOrderCustomerData, subOrderProductData);
                        
                        if (sheetsResult && sheetsResult.success) {
                            await db.orders.updateSheetsSync(
                                subOrderId,
                                customerData.storeDomain,
                                true,
                                new Date().toISOString(),
                                sheetsResult.sheetRange
                            );
                            console.log(`✅ Sub-order ${subOrderNumber} added to ${sheetsResult.supplierName} at ${sheetsResult.sheetRange}`);
                            responseData.sheetsUpdated = true;
                        }
                    } catch (error) {
                        console.error(`❌ Error adding sub-order ${subOrderNumber} to Google Sheets:`, error.message);
                    }
                }
                
                // Add small delay between processing items to avoid rate limits
                if (itemIndex < productData.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            responseData.subOrdersCreated = dbOrders.length;
            
            console.log(`\n🎉 All ${dbOrders.length} sub-orders processed successfully!`);
            console.log(`   Original order: ${customerData.shopifyOrderNumber}`);
            console.log(`   Sub-orders: ${responseData.subOrders.map(so => so.subOrderNumber).join(', ')}`);
            
            if (customerData.customerNotes) {
                console.log('Customer notes stored successfully in all sub-orders');
            }
            if (customerData.mattressLabel) {
                console.log(`Mattress label stored: ${customerData.mattressLabel} in all sub-orders`);
            }
            
        } catch (error) {
            console.error('ERROR storing orders in database:', error);
            console.error('Full error stack:', error.stack);
            responseData.error = error.message;
            // Continue processing even if DB fails
        }
        
        // Log summary
        console.log('Order processing complete');
        console.log(`Original order: ${customerData.shopifyOrderNumber}`);
        console.log(`Sub-orders created: ${responseData.subOrdersCreated}/${productData.length}`);
        console.log(`Customer: ${customerData.customerEmail}`);
        console.log(`Total original price: ${customerData.currency} ${customerData.totalPrice}`);
        
        if (unmappedProducts.length > 0) {
            console.log(`Warning: ${unmappedProducts.length} products need mapping`);
        }
        
        // Send response
        res.status(200).json(responseData);
        
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

// NEW: API endpoint to fetch all sub-orders for a given original order number
router.get('/orders/by-original/:originalOrderNumber', async (req, res) => {
    try {
        const { originalOrderNumber } = req.params;
        
        // Remove # if present and any existing suffix
        const baseOrderNumber = originalOrderNumber.replace(/^#/, '').replace(/-\d+$/, '');
        
        console.log(`🔍 Searching for sub-orders of: ${baseOrderNumber}`);
        
        // Find all orders that start with the base order number
        const subOrders = await db.orders.findAll({
            where: {
                order_number: {
                    [Op.like]: `%${baseOrderNumber}%`
                }
            },
            order: [['order_number', 'ASC']]
        });
        
        console.log(`📋 Found ${subOrders.length} sub-orders for ${originalOrderNumber}`);
        
        res.json({
            success: true,
            originalOrderNumber: originalOrderNumber,
            subOrders: subOrders,
            count: subOrders.length
        });
        
    } catch (error) {
        console.error('❌ Error fetching sub-orders:', error);
        res.status(500).json({
            success: false,
            error: error.message
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