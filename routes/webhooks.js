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
    if (domain.includes('caravanmattresses') || domain.includes('d587eb')) return 'Caravan Mattresses';
    if (domain.includes('motorhomemattresses') || domain.includes('uxyxaq-pu')) return 'Motorhome Mattresses';
    if (domain.includes('mybespoke') || domain.includes('mattressmade')) return 'My Bespoke Mattresses';
    
    return null;
}

// Extract customer notes from various Shopify locations
function extractCustomerNotes(order) {
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
    
    const customerNotes = extractCustomerNotes(order);
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
        customerNotes: customerNotes,
        mattressLabel: mattressLabel
    };
}

// Debug empty measurements
function debugEmptyMeasurements(order) {
    console.log('\nDEBUGGING EMPTY MEASUREMENTS:');
    
    if (order.line_items && order.line_items.length > 0) {
        order.line_items.forEach((item, index) => {
            console.log(`\nItem ${index + 1}: ${item.title} (SKU: ${item.sku})`);
            
            if (item.properties && item.properties.length > 0) {
                console.log('   Properties found:');
                item.properties.forEach(prop => {
                    const isEmpty = !prop.value || prop.value.trim() === '';
                    const icon = isEmpty ? 'EMPTY' : 'OK';
                    console.log(`   ${icon} ${prop.name}: "${prop.value}"`);
                });
            } else {
                console.log('   No properties found on this item');
            }
        });
    }
    
    console.log('\nIf dimensions are empty:');
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

// Enhanced measurement extraction with unit support and empty string handling
function extractCustomerMeasurements(properties) {
    const measurements = {};
    const dimensionValues = {};
    
    if (!properties || !Array.isArray(properties)) {
        return { complete: false, data: {}, missing: [], provided: [], option: 'option2' };
    }
    
    properties.forEach(prop => {
        const propName = prop.name?.toLowerCase();
        const propValue = prop.value?.trim();
        
        // Store ALL properties for reference
        measurements[`property_${prop.name}`] = prop.value;
        
        // Only process dimension if it has an actual value (not empty string)
        if (propName?.includes('dimension') && propValue && propValue !== '') {
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
                console.log(`Extracted Dimension ${letter}: ${propValue} ${unit}`);
            }
        } else if (propName?.includes('dimension')) {
            const letterMatch = propName.match(/dimension\s*([a-g])/i);
            if (letterMatch) {
                const letter = letterMatch[1].toUpperCase();
                console.log(`Skipping empty Dimension ${letter}`);
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

// Extract manufacturing options from line item
function extractManufacturingOptions(lineItem) {
    const manufacturingOptions = {
        linkAttachment: null,
        deliveryOption: "Rolled and Boxed" // Default for now
    };
    
    // Extract Link Attachment from variant_title
    if (lineItem.variant_title) {
        const variantParts = lineItem.variant_title.split(' / ');
        if (variantParts.length > 0) {
            const linkAttachment = variantParts[variantParts.length - 1].trim();
            
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
    
    // Extract Delivery Option from properties
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

// Enhanced product data extraction
function extractProductData(lineItems) {
    return lineItems.map(item => {
        const customerMeasurements = extractCustomerMeasurements(item.properties);
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

// Main webhook handler for order creation with multi-item support
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
        
        // Extract data
        const customerData = extractCustomerData(order, store.domain);
        const productData = extractProductData(order.line_items || []);
        
        console.log(`Processing order ${customerData.shopifyOrderNumber} from ${customerData.customerName}`);
        console.log(`Products: ${productData.length} items`);
        
        if (customerData.customerNotes) {
            console.log(`Customer Notes: "${customerData.customerNotes}"`);
        }
        if (customerData.mattressLabel) {
            console.log(`Mattress Label: ${customerData.mattressLabel}`);
        }
        
        // Debug empty measurements
        debugEmptyMeasurements(order);
        
        // Use the new product mapping system instead of database lookup
        const unmappedProducts = [];
        for (const product of productData) {
            if (product.shopifySku) {
                try {
                    // Call the new mapping system
                    const { mapProduct } = require('../routes/product-mapping');
                    
                    // Convert measurement properties back to array format for mapping
                    const properties = [];
                    if (product.measurementStatus?.measurements) {
                        Object.entries(product.measurementStatus.measurements)
                            .filter(([key]) => key.startsWith('property_'))
                            .forEach(([key, value]) => {
                                properties.push({ 
                                    name: key.replace('property_', ''), 
                                    value: value 
                                });
                            });
                    }
                    
                    const mappingResult = mapProduct(
                        product.productTitle,
                        product.variantTitle ? { title: product.variantTitle } : null,
                        properties,
                        product.shopifySku
                    );
                    
                    if (mappingResult.success && mappingResult.specification) {
                        product.supplierSpecification = mappingResult.specification.fullSpecification;
                        console.log(`✓ Mapped SKU ${product.shopifySku}: ${mappingResult.specification.fullSpecification}`);
                    } else {
                        console.log(`No mapping found for SKU: ${product.shopifySku}`);
                        unmappedProducts.push(product.shopifySku);
                    }
                } catch (error) {
                    console.error(`Error mapping SKU ${product.shopifySku}:`, error);
                    unmappedProducts.push(product.shopifySku);
                }
            }
        }
        
        // Log product details
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
        
        // MULTI-ITEM PROCESSING: Store each line item as a separate order
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
            console.log(`Attempting to store ${productData.length} line items as separate orders...`);
            
            for (let itemIndex = 0; itemIndex < productData.length; itemIndex++) {
                const product = productData[itemIndex];
                const lineItem = order.line_items[itemIndex];
                
                console.log(`\nProcessing Item ${itemIndex + 1}/${productData.length}:`);
                console.log(`   Product: ${product.productTitle}`);
                console.log(`   SKU: ${product.shopifySku}`);
                console.log(`   Price: ${lineItem.price}`);
                
                // Create sub-order number
                const subOrderNumber = productData.length > 1 
                    ? `${customerData.shopifyOrderNumber}-${itemIndex + 1}`
                    : customerData.shopifyOrderNumber;
                
                // CORRECT - always use the original orderId as a number
                const subOrderId = customerData.orderId; // Always use original orderId
                
                // Create extracted_measurements for this specific line item
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
                    line_items: [lineItem],
                    extracted_measurements: [extractedMeasurementsForItem]
                };
                
                const orderDataForDb = {
                    orderId: subOrderId,
                    order_number: subOrderNumber,
                    store_domain: customerData.storeDomain,
                    customerName: customerData.customerName,
                    customerEmail: customerData.customerEmail,
                    totalPrice: lineItem.price,
                    order_data: orderWithSingleItem,
                    line_items: [{
                        sku: product.shopifySku,
                        title: product.productTitle,
                        quantity: product.quantity,
                        price: lineItem.price,
                        properties: lineItem.properties,
                        specification: product.supplierSpecification || null,
                        mapped: !!product.supplierSpecification
                    }],
                    supplier_assigned: supplierAssignment,
                    supplier_name: supplierName,
                    notes: customerData.customerNotes,
                    mattress_label: customerData.mattressLabel
                };
                
                console.log(`Creating database entry for: ${subOrderNumber}`);
                
                const dbOrder = await db.orders.create(orderDataForDb);
                
                console.log(`Sub-order ${subOrderNumber} stored successfully (ID: ${dbOrder.id})`);
                
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
                
                // Add each sub-order to Google Sheets separately
                if (supplierAssignment && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
                    try {
                        console.log(`Adding sub-order ${subOrderNumber} to Google Sheets...`);
                        
                        const subOrderCustomerData = {
                            ...customerData,
                            orderId: subOrderId,
                            shopifyOrderNumber: subOrderNumber,
                            totalPrice: lineItem.price
                        };
                        
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
                            console.log(`Sub-order ${subOrderNumber} added to ${sheetsResult.supplierName} at ${sheetsResult.sheetRange}`);
                            responseData.sheetsUpdated = true;
                        }
                    } catch (error) {
                        console.error(`Error adding sub-order ${subOrderNumber} to Google Sheets:`, error.message);
                    }
                }
            }
            
            responseData.subOrdersCreated = responseData.subOrders.length;
            
            console.log(`\nAll ${responseData.subOrdersCreated} sub-orders processed successfully!`);
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

// API endpoint to fetch all sub-orders for a given original order number - POSTGRESQL ONLY
router.get('/orders/by-original/:originalOrderNumber', async (req, res) => {
    try {
        const { originalOrderNumber } = req.params;
        
        // Remove # if present and any existing suffix
        const baseOrderNumber = originalOrderNumber.replace(/^#/, '').replace(/-\d+$/, '');
        
        console.log(`Searching for sub-orders of: ${baseOrderNumber}`);
        
        // Use PostgreSQL query
        const query = `
            SELECT * FROM orders 
            WHERE order_number LIKE $1 
            ORDER BY order_number ASC
        `;
        
        const result = await req.app.locals.db.query(query, [`%${baseOrderNumber}%`]);
        const subOrders = result.rows;
        
        console.log(`Found ${subOrders.length} sub-orders for ${originalOrderNumber}`);
        
        res.json({
            success: true,
            originalOrderNumber: originalOrderNumber,
            subOrders: subOrders,
            count: subOrders.length
        });
        
    } catch (error) {
        console.error('Error fetching sub-orders:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Test endpoint to manually create an order
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

// Add this to your existing webhook router (routes/webhooks.js)
// Insert after your existing routes, before module.exports

// ============================================================================
// FIRMNESS OVERRIDE SYSTEM
// ============================================================================

// Firmness mapping configurations for all mattress types
const FIRMNESS_MAPPINGS = {
  'Novo': {
    name: 'Novolatex',
    depths: ['6"', '8"', '10"'],
    firmness: ['Medium', 'Medium Firm Orthopaedic', 'Hard'],
    combinations: 9
  },
  'Comfi': {
    name: 'Comfisan',
    depths: ['6"', '8"', '10"'],
    firmness: ['Medium-firm', 'Firm Orthopaedic', 'Hard'],
    combinations: 9
  },
  'Grand': {
    name: 'Grand Crescent',
    depths: ['8"', '10"'],
    firmness: ['Medium', 'Firm Orthopaedic'],
    combinations: 4
  },
  'Imperial': {
    name: 'Imperial Elite',
    depths: ['10"'],
    firmness: ['Medium', 'Firm Orthopaedic', 'Hard'],
    combinations: 3
  },
  'Essential': {
    name: 'Essential',
    depths: ['2"', '3"', '4"', '6"', '8"', '10"'],
    firmness: ['Medium-Firm'],
    combinations: 6
  },
  'Coolt': {
    name: 'Coolplus Topper',
    depths: ['2"', '3"'],
    firmness: ['Medium'],
    combinations: 2
  },
  'Cool': {
    name: 'Coolplus Mattress',
    depths: ['6"', '8"', '10"'],
    firmness: ['Medium firm', 'Firm Orthopaedic', 'Hard'],
    combinations: 9
  },
  'Body': {
    name: 'Bodyshape',
    depths: ['6"', '8"', '10"'],
    firmness: ['Medium', 'Firm Orthopaedic', 'Hard'],
    combinations: 9
  },
  'Bodyt': {
    name: 'Bodyshape Topper',
    depths: ['1"', '2"', '3"', '4"', '5"'],
    firmness: ['Soft'],
    combinations: 5
  }
};

// Detect if order needs firmness override
function needsFirmnessOverride(order) {
  // Check if supplier code indicates mapping issue
  const supplierCode = order.supplier_code || order.line_items?.[0]?.specification || '';
  
  return supplierCode.includes('MAPPING_REQUIRED') || 
         supplierCode.includes('DEFAULT') || 
         supplierCode === '' ||
         supplierCode === 'Mapping required';
}

// Detect SKU prefix from order
function detectSKUPrefix(order) {
  console.log('[Override] DEBUG - Full order object keys:', Object.keys(order));
  console.log('[Override] DEBUG - order.line_items:', order.line_items);
  console.log('[Override] DEBUG - First line item:', order.line_items?.[0]);
  
  const sku = order.line_items?.[0]?.sku || '';
  console.log('[Override] DEBUG - Extracted SKU:', sku);
  
  const prefixes = Object.keys(FIRMNESS_MAPPINGS);
  console.log('[Override] DEBUG - Available prefixes:', prefixes);
  
  const foundPrefix = prefixes.find(prefix => sku && sku.startsWith(prefix));
  console.log('[Override] DEBUG - Found prefix:', foundPrefix);
  
  // If SKU detection fails, try product title detection
  if (!foundPrefix && order.line_items && order.line_items[0]) {
    const productTitle = order.line_items[0].title || '';
    console.log('[Override] DEBUG - Trying product title:', productTitle);
    const titleLower = productTitle.toLowerCase();
    
    if (titleLower.includes('coolplus')) return 'Cool';
    else if (titleLower.includes('bodyshape') || titleLower.includes('bodshape')) return 'Body';
    else if (titleLower.includes('novolatex')) return 'Novo';
    else if (titleLower.includes('comfisan')) return 'Comfi';
    else if (titleLower.includes('essential')) return 'Essential';
  }
  
  return foundPrefix || null;
}

// Get available firmness options for a mattress type
router.get('/orders/:orderId/firmness-options', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Get order from database
    const query = `SELECT * FROM processed_orders WHERE id = $1`;
    const result = await req.app.locals.db.query(query, [orderId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    const order = result.rows[0];
    let skuPrefix = detectSKUPrefix(order);
    
    // If SKU detection fails, try to detect from product title
    if (!skuPrefix && order.line_items && order.line_items[0]) {
      const productTitle = order.line_items[0].title || '';
      const titleLower = productTitle.toLowerCase();
      
      if (titleLower.includes('coolplus')) skuPrefix = 'Cool';
      else if (titleLower.includes('bodyshape') || titleLower.includes('bodshape')) skuPrefix = 'Body';
      else if (titleLower.includes('novolatex')) skuPrefix = 'Novo';
      else if (titleLower.includes('comfisan')) skuPrefix = 'Comfi';
      else if (titleLower.includes('essential')) skuPrefix = 'Essential';
    }
    
    if (!skuPrefix) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot detect mattress type from SKU or product title' 
      });
    }
    
    const mapping = FIRMNESS_MAPPINGS[skuPrefix];
    if (!mapping) {
      return res.status(400).json({ 
        success: false, 
        error: `No firmness mapping available for ${skuPrefix}` 
      });
    }
    
    // Generate all combinations
    const options = [];
    mapping.depths.forEach(depth => {
      mapping.firmness.forEach(firmness => {
        options.push({
          value: `${depth}-${firmness}`,
          label: `${depth} - ${firmness}`,
          depth: depth,
          firmness: firmness
        });
      });
    });
    
    res.json({
      success: true,
      mattressType: mapping.name,
      skuPrefix: skuPrefix,
      options: options,
      needsOverride: needsFirmnessOverride(order)
    });
    
  } catch (error) {
    console.error('Error getting firmness options:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Apply firmness override
router.post('/orders/:orderId/override-firmness', express.json(), async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // DEBUG LOGGING
    console.log('[Override] Raw request body:', req.body);
    console.log('[Override] Body type:', typeof req.body);
    console.log('[Override] Body keys:', Object.keys(req.body || {}));
    
    const { depth, firmness, skuPrefix } = req.body;
    
    console.log(`[Override] Parsed values - depth: "${depth}", firmness: "${firmness}", skuPrefix: "${skuPrefix}"`);
    
    console.log(`[Override] Applying firmness override for order ${orderId}: ${depth} - ${firmness}`);
    
    // Get order from database
    const query = `SELECT * FROM processed_orders WHERE id = $1`;
    const result = await req.app.locals.db.query(query, [orderId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    const order = result.rows[0];
    
    // Detect what type of mattress this is
    const detectedPrefix = detectSKUPrefix(order);
    if (!detectedPrefix) {
    return res.status(400).json({ 
        success: false, 
        error: 'Cannot detect mattress type from order data' 
    });
    }

    // Validate that the frontend detected the same mattress type
    if (detectedPrefix !== skuPrefix) {
    return res.status(400).json({ 
        success: false, 
        error: `Mattress type mismatch. Backend detected ${detectedPrefix}, frontend sent ${skuPrefix}` 
    });
    }

    // Check if this order actually needs an override
    const currentSupplierCode = order.supplier_code || order.line_items?.[0]?.specification || '';
    const needsOverride = currentSupplierCode.trim() === '' || currentSupplierCode === '-' || currentSupplierCode.includes('MAPPING_REQUIRED');

    if (!needsOverride) {
    return res.status(400).json({ 
        success: false, 
        error: 'This order already has a valid supplier code and does not need an override' 
    });
    }
    
    // Validate depth/firmness combination exists
    const mapping = FIRMNESS_MAPPINGS[skuPrefix];
    if (!mapping.depths.includes(depth) || !mapping.firmness.includes(firmness)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid combination: ${depth} - ${firmness} for ${mapping.name}` 
      });
    }
    
    // Use existing mapping system to regenerate supplier code
    const { mapProduct } = require('./product-mapping');
    
    // Create override properties array
    const overrideProperties = [
      { name: 'Firmness', value: firmness }
    ];
    
    // Get product title from line items
    const lineItems = order.line_items || [];
    const productTitle = lineItems[0]?.title || mapping.name;
    
    console.log(`[Override] Re-mapping product: ${productTitle} with firmness: ${firmness}`);
    
    // Re-map with override data
    const mappingResult = mapProduct(
      productTitle,
      { title: `${depth} - ${firmness}` }, // productVariant
      overrideProperties, // productProperties
      lineItems[0]?.sku // shopifySku
    );
    
    if (!mappingResult.success) {
      console.error(`[Override] Mapping failed:`, mappingResult.error);
      return res.status(400).json({
        success: false,
        error: `Failed to generate supplier specification: ${mappingResult.error}`
      });
    }
    
    const newSupplierCode = mappingResult.specification.fullSpecification;
    console.log(`[Override] New supplier code: ${newSupplierCode}`);
    
    // Update database with new supplier code and override tracking
    const updateQuery = `
      UPDATE processed_orders
      SET 
        supplier_code = $1,
        line_items = CASE 
          WHEN line_items IS NOT NULL AND jsonb_array_length(line_items) > 0 
          THEN jsonb_set(line_items, '{0,specification}', $2::jsonb)
          ELSE line_items
        END,
        firmness_override_applied = true,
        override_timestamp = NOW(),
        override_depth = $3,
        override_firmness = $4,
        updated_at = NOW()
      WHERE id = $5
      RETURNING *;
    `;
    
    const updateResult = await req.app.locals.db.query(updateQuery, [
      newSupplierCode,
      JSON.stringify(newSupplierCode),
      depth,
      firmness,
      orderId
    ]);
    
    if (updateResult.rows.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update order in database'
      });
    }
    
    console.log(`[Override] Successfully updated order ${orderId}`);
    
    res.json({
      success: true,
      orderId: orderId,
      mattressType: mapping.name,
      depth: depth,
      firmness: firmness,
      newSupplierCode: newSupplierCode,
      overrideApplied: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Override] Error applying firmness override:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get override status for an order
router.get('/orders/:orderId/override-status', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const query = `
      SELECT 
        id, 
        supplier_code, 
        firmness_override_applied,
        override_timestamp,
        override_depth,
        override_firmness,
        line_items
      FROM processed_orders
      WHERE id = $1
    `;
    const result = await req.app.locals.db.query(query, [orderId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    const order = result.rows[0];
    const skuPrefix = detectSKUPrefix(order);
    const needsOverride = needsFirmnessOverride(order);
    
    res.json({
      success: true,
      orderId: orderId,
      needsOverride: needsOverride,
      overrideApplied: order.firmness_override_applied || false,
      overrideTimestamp: order.override_timestamp,
      currentSupplierCode: order.supplier_code,
      skuPrefix: skuPrefix,
      mattressType: skuPrefix ? FIRMNESS_MAPPINGS[skuPrefix]?.name : null,
      appliedOverride: order.firmness_override_applied ? {
        depth: order.override_depth,
        firmness: order.override_firmness
      } : null
    });
    
  } catch (error) {
    console.error('Error checking override status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add database columns if they don't exist (run this once)
router.post('/admin/setup-override-columns', async (req, res) => {
  try {
    const alterQueries = [
    `ALTER TABLE processed_orders ADD COLUMN IF NOT EXISTS firmness_override_applied BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE processed_orders ADD COLUMN IF NOT EXISTS override_timestamp TIMESTAMP`,
    `ALTER TABLE processed_orders ADD COLUMN IF NOT EXISTS override_depth TEXT`,
    `ALTER TABLE processed_orders ADD COLUMN IF NOT EXISTS override_firmness TEXT`
    ];
    
    for (const query of alterQueries) {
      await req.app.locals.db.query(query);
    }
    
    res.json({ 
      success: true, 
      message: 'Override columns added successfully' 
    });
    
  } catch (error) {
    console.error('Error setting up override columns:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;