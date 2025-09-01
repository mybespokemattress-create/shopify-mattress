// google-sheets.js - Google Sheets Integration Module

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

// Format order data for Google Sheets row
function formatOrderData(orderData, productData) {
    const currentDate = new Date().toLocaleDateString('en-GB');
    
    // Format contact details (billing address)
    let contactDetails = '';
    if (orderData.billingAddress) {
        const addr = orderData.billingAddress;
        contactDetails = [
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
                .filter(([key, value]) => !key.startsWith('property_'))
                .map(([key, value]) => `${key}: ${value.value || value}`)
                .join(', ');
            if (measurementText) {
                note += ` | Measurements: ${measurementText}`;
            }
        }
        
        return note;
    }).join('\n');
    
    // Return array matching the sheet column order:
    // Week no | Order Received | Order Submission Date | Cover Ready | Sheets cut | 
    // Mattress Shape | Working Days Since Submission | Order number | Name | Priority | 
    // Ship by Date | Contact Details | Telephone | E-mail | Notes | Date of Dispatch | 
    // Tracking No | Courier | Order Sent | Order Received | Fulfilled Email | Invoiced
    
    return [
        '', // Week no - manual
        currentDate, // Order Received
        '', // Order Submission Date - manual  
        '', // Cover Ready - manual
        '', // Sheets cut - manual
        productData[0]?.productTitle || '', // Mattress Shape - first product title
        '', // Working Days Since Submission - manual
        orderData.shopifyOrderNumber, // Order number
        orderData.customerName, // Name
        '', // Priority - manual
        '', // Ship by Date - manual
        contactDetails, // Contact Details
        orderData.customerPhone || '', // Telephone
        orderData.customerEmail || '', // E-mail
        productNotes, // Notes
        '', // Date of Dispatch - manual
        '', // Tracking No - manual
        '', // Courier - manual
        '', // Order Sent - manual
        '', // Order Received - manual
        '', // Fulfilled Email - manual
        '' // Invoiced - manual
    ];
}

// Add order to appropriate Google Sheet
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
        // Format the row data
        const rowData = formatOrderData(orderData, productData);
        
        // Append row to the sheet
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: supplier.sheetId,
            range: 'A:V', // Covers all 22 columns
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [rowData]
            }
        });
        
        console.log(`✅ Order added to ${supplier.name} - Row ${response.data.updates.updatedRange}`);
        
        return {
            success: true,
            supplier: supplierKey,
            supplierName: supplier.name,
            sheetRange: response.data.updates.updatedRange
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