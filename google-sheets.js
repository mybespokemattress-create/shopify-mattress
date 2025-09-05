// google-sheets.js - Google Sheets Integration Module - FIXED VERSION

const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

// Supplier configurations
const SUPPLIERS = {
    SOUTHERN: {
        name: 'Southern Production Schedule',
        sheetId: '1msn3axI6YVuRbHYYf32APoxQPG61zKKlNx6CZR1iO3w',
        keywords: ['Essential', 'Grand', 'Cool', 'Novo', 'Body']
    },
    MATTRESSSHIRE: {
        name: 'Mattressshire Production Schedule', 
        sheetId: '16IssobN0vG-oYEyEW8HgZIOqAsiIO_pTCOt0czmqQJM',
        keywords: ['Comfi', 'Imperial']
    }
};

// Google Sheets client initialization
let sheets = null;

async function initializeGoogleSheets() {
    try {
        // Parse service account credentials from environment
        const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        
        const auth = new GoogleAuth({
            credentials: serviceAccount,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        sheets = google.sheets({ version: 'v4', auth });
        console.log('✅ Google Sheets API initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize Google Sheets:', error.message);
        return false;
    }
}

// Determine supplier based on SKU patterns
function determineSupplier(products) {
    for (const product of products) {
        const sku = product.shopifySku || '';
        
        // Check Southern supplier keywords
        for (const keyword of SUPPLIERS.SOUTHERN.keywords) {
            if (sku.toLowerCase().includes(keyword.toLowerCase())) {
                return 'SOUTHERN';
            }
        }
        
        // Check Mattressshire supplier keywords  
        for (const keyword of SUPPLIERS.MATTRESSSHIRE.keywords) {
            if (sku.toLowerCase().includes(keyword.toLowerCase())) {
                return 'MATTRESSSHIRE';
            }
        }
    }
    
    return null; // No supplier match found
}

// Format order data for specific columns only
function formatOrderData(orderData, productData) {
    const currentDate = new Date().toLocaleDateString('en-GB');
    
    // Format contact details (SHIPPING address - this is where the mattress goes)
    let contactDetails = '';
    if (orderData.shippingAddress) {
        const addr = orderData.shippingAddress;
        contactDetails = [
            addr.company,
            addr.address1,
            addr.address2,
            addr.city,
            addr.province,
            addr.zip,
            addr.country
        ].filter(Boolean).join(', ');
    } else if (orderData.billingAddress) {
        // Fallback to billing address if no shipping address provided
        const addr = orderData.billingAddress;
        contactDetails = [
            addr.company,
            addr.address1,
            addr.address2,
            addr.city,
            addr.province,
            addr.zip,
            addr.country
        ].filter(Boolean).join(', ');
    }
    
    // Format product details and measurements for notes
    const productNotes = productData.map(product => {
        let note = `${product.productTitle}`;
        if (product.variantTitle) {
            note += ` (${product.variantTitle})`;
        }
        note += ` - SKU: ${product.shopifySku || 'N/A'}`;
        
        // Add measurements if available
        if (product.measurements && Object.keys(product.measurements).length > 0) {
            const measurementText = Object.entries(product.measurements)
                .filter(([key, value]) => !key.startsWith('property_') && key.match(/^[A-G]$/))
                .map(([key, value]) => `${key}: ${value.value || value}`)
                .join(', ');
            if (measurementText) {
                note += ` | Measurements: ${measurementText}`;
            }
        }
        
        return note;
    }).join('\n');
    
    return {
        orderReceived: currentDate,
        orderNumber: orderData.shopifyOrderNumber,
        customerName: orderData.customerName,
        contactDetails: contactDetails,
        telephone: orderData.customerPhone || '',
        email: orderData.customerEmail || '',
        notes: productNotes
    };
}

// Add order to appropriate Google Sheet using specific cell updates
async function addOrderToSheet(orderData, productData) {
    if (!sheets) {
        const initialized = await initializeGoogleSheets();
        if (!initialized) {
            throw new Error('Google Sheets not initialized');
        }
    }
    
    // Determine which supplier based on SKU patterns
    const supplierKey = determineSupplier(productData);
    if (!supplierKey) {
        console.log('⚠️ No supplier match found for SKUs:', productData.map(p => p.shopifySku));
        return { success: false, reason: 'No supplier match found' };
    }
    
    const supplier = SUPPLIERS[supplierKey];
    console.log(`📊 Adding order to ${supplier.name}`);
    
    try {
        // Format the data for the 7 specific fields
        const formattedData = formatOrderData(orderData, productData);
        
        // Find the next empty row by checking column H (Order number)
        const checkRange = await sheets.spreadsheets.values.get({
            spreadsheetId: supplier.sheetId,
            range: 'H:H'
        });
        
        const nextRow = (checkRange.data.values?.length || 1) + 1;
        console.log(`📍 Adding to row ${nextRow}`);
        
        // Update each specific column individually to avoid column misalignment
        // Force text formatting by prefixing with apostrophe for order number
        const updates = [
            { range: `B${nextRow}`, values: [[formattedData.orderReceived]] },     // Order Received
            { range: `H${nextRow}`, values: [[`'${formattedData.orderNumber}`]] }, // Order number (force text)
            { range: `I${nextRow}`, values: [[formattedData.customerName]] },      // Name
            { range: `L${nextRow}`, values: [[formattedData.contactDetails]] },    // Contact Details
            { range: `M${nextRow}`, values: [[formattedData.telephone]] },         // Telephone
            { range: `N${nextRow}`, values: [[formattedData.email]] },             // E-mail
            { range: `O${nextRow}`, values: [[formattedData.notes]] }              // Notes
        ];
        
        // Execute all updates in a batch
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: supplier.sheetId,
            resource: {
                valueInputOption: 'USER_ENTERED',
                data: updates
            }
        });
        
        console.log(`✅ Order added to ${supplier.name} - Row ${nextRow}`);
        
        return {
            success: true,
            supplier: supplierKey,
            supplierName: supplier.name,
            sheetRange: `Row ${nextRow}`,
            rowNumber: nextRow
        };
        
    } catch (error) {
        console.error(`❌ Error adding to ${supplier.name}:`, error.message);
        throw error;
    }
}

// Test Google Sheets connection
async function testConnection() {
    try {
        const initialized = await initializeGoogleSheets();
        if (!initialized) return false;
        
        // Test access to both sheets
        for (const [key, supplier] of Object.entries(SUPPLIERS)) {
            const response = await sheets.spreadsheets.get({
                spreadsheetId: supplier.sheetId
            });
            console.log(`✅ Connected to ${supplier.name}: "${response.data.properties.title}"`);
        }
        
        return true;
    } catch (error) {
        console.error('❌ Google Sheets connection test failed:', error.message);
        return false;
    }
}

module.exports = {
    initializeGoogleSheets,
    addOrderToSheet,
    testConnection,
    determineSupplier,
    SUPPLIERS
};