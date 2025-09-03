// google-docs-po.js - Purchase Order Generation with Domain-Wide Delegation

const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

// Configuration
const MEASURING_DIAGRAMS_FOLDER_ID = '17IaqJqzj1dLWUY1NG5n4ysdq8f6cJunz';
const PO_OUTPUT_FOLDER_ID = '1-zamjJmI9pHXUKlCsyNiYjHQzAcDmc9x'; // Orders folder
 
let docs = null;
let drive = null;

// Safe service account parsing with validation
function getSafeServiceAccount() {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set');
    }
    
    try {
        const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        
        // Basic validation of required fields
        if (!serviceAccount.client_email || !serviceAccount.private_key || !serviceAccount.project_id) {
            throw new Error('Service account JSON is missing required fields (client_email, private_key, or project_id)');
        }
        
        return serviceAccount;
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error(`Invalid JSON format in GOOGLE_SERVICE_ACCOUNT_KEY: ${error.message}`);
        }
        throw error; // Re-throw if it's our validation error or other error
    }
}

// Initialize Google APIs with Domain-Wide Delegation
async function initializeGoogleAPIs() {
    try {
        const serviceAccount = getSafeServiceAccount();
        
        const auth = new GoogleAuth({
            credentials: serviceAccount,
            scopes: [
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/documents'
            ]
            // Testing direct service account access - comment out subject line
            // subject: 'dev@mybespokemattress.com'
        });

        // Direct initialisation - consistent with webhooks.js pattern
        docs = google.docs({ 
            version: 'v1', 
            auth,
            timeout: 30000
        });
        
        drive = google.drive({ 
            version: 'v3', 
            auth,
            timeout: 30000
        });
        
        console.log('Google Docs and Drive APIs initialised with domain-wide delegation');
        console.log(`Service account: ${serviceAccount.client_email}`);
        console.log(`Acting as: dev@mybespokemattress.com`);
        console.log(`Project ID: ${serviceAccount.project_id}`);
        
        return true;
    } catch (error) {
        console.error('Failed to initialise Google APIs:', error.message);
        console.error('Full error:', error);
        return false;
    }
}

// Find shape diagram in Google Drive by shape number
async function findShapeDiagram(shapeNumber) {
    try {
        // Search for file with specific naming pattern
        const fileName = `Shape ${shapeNumber} Caravan Mattress Measuring Diagram.jpg`;
        
        const response = await drive.files.list({
            q: `name='${fileName}' and parents in '${MEASURING_DIAGRAMS_FOLDER_ID}'`,
            fields: 'files(id, name, webViewLink, webContentLink)'
        });
        
        if (response.data.files && response.data.files.length > 0) {
            const file = response.data.files[0];
            console.log(`Found shape diagram: ${file.name}`);
            return {
                fileId: file.id,
                name: file.name,
                webViewLink: file.webViewLink,
                downloadLink: file.webContentLink
            };
        }
        
        console.log(`Shape diagram not found for shape ${shapeNumber}`);
        return null;
    } catch (error) {
        console.error(`Error finding shape diagram for shape ${shapeNumber}:`, error.message);
        return null;
    }
}

// Determine PO type based on measurement status
function determinePOType(measurementStatus) {
    if (!measurementStatus) return 'measurements_pending';
    
    switch (measurementStatus.option) {
        case 'option1':
            return measurementStatus.hasCompleteMeasurements ? 'complete' : 'measurements_pending';
        case 'option2':
            return 'measurements_pending';
        case 'option3':
            return 'kit_requested';
        default:
            return 'measurements_pending';
    }
}

// Format measurements for display with safe property access
function formatMeasurements(measurementStatus, shapeInfo) {
    if (!measurementStatus || !measurementStatus.hasCompleteMeasurements) {
        return 'MEASUREMENTS TO BE PROVIDED';
    }
    
    const dimensions = [];
    if (measurementStatus.providedDimensions && measurementStatus.measurements) {
        measurementStatus.providedDimensions.forEach(dim => {
            const measurement = measurementStatus.measurements[dim];
            if (measurement && measurement.value) {
                dimensions.push(`${dim}: ${measurement.value}${measurement.unit || 'cm'}`);
            }
        });
    }
    
    return dimensions.length > 0 ? dimensions.join(', ') : 'MEASUREMENTS TO BE PROVIDED';
}

// Generate Purchase Order with Domain-Wide Delegation
async function generatePO(orderData, productData, supplierInfo) {
    if (!docs || !drive) {
        const initialised = await initializeGoogleAPIs();
        if (!initialised) {
            throw new Error('Google APIs not initialised');
        }
    }
    
    console.log(`Generating PO for order ${orderData.shopifyOrderNumber}`);
    
    try {
        const product = productData[0]; // Handle single product for now
        const poType = determinePOType(product.measurementStatus);
        
        console.log(`PO Type: ${poType}`);
        
        // Create the document using impersonated user's quota
        const docTitle = `PO ${orderData.shopifyOrderNumber} - ${orderData.customerName.replace(/[^a-zA-Z0-9\s]/g, '')}`;
        
        console.log('Creating document with impersonated user...');
        console.log(`Document title: ${docTitle}`);
        
        // Create document directly in Orders folder
        const createResponse = await drive.files.create({
            resource: {
                name: docTitle,
                parents: [PO_OUTPUT_FOLDER_ID],
                mimeType: 'application/vnd.google-apps.document'
            },
            fields: 'id,name,parents'
        });
        
        const documentId = createResponse.data.id;
        console.log(`Created document: ${documentId}`);
        
        // Build document content
        const currentDate = new Date().toLocaleDateString('en-GB');
        const address = orderData.shippingAddress || orderData.billingAddress || {};
        const customerAddress = [
            address.address1,
            address.address2,
            address.city,
            address.province,
            address.zip,
            address.country
        ].filter(Boolean).join(', ');
        
        // Status section based on PO type
        let statusSection = '';
        switch (poType) {
            case 'complete':
                statusSection = 'STATUS: READY FOR PRODUCTION';
                break;
            case 'measurements_pending':
                statusSection = 'STATUS: AWAITING CUSTOMER MEASUREMENTS\nDO NOT PROCEED TO PRODUCTION';
                break;
            case 'kit_requested':
                statusSection = 'STATUS: MEASURING KIT REQUIRED\nCUSTOMER TO BE CONTACTED';
                break;
        }
        
        // Prepare content text
        const contentText = [
            'PURCHASE ORDER',
            '',
            `Order Number: ${orderData.shopifyOrderNumber}`,
            `Date: ${currentDate}`,
            `Supplier: ${supplierInfo.name}`,
            '',
            statusSection,
            '',
            'CUSTOMER INFORMATION',
            `Name: ${orderData.customerName}`,
            `Email: ${orderData.customerEmail}`,
            `Phone: ${orderData.customerPhone}`,
            `Delivery Address: ${customerAddress}`,
            '',
            'PRODUCT DETAILS',
            `Product: ${product.productTitle}`,
            `SKU: ${product.shopifySku}`,
            `Quantity: ${product.quantity}`,
            `Price: £${product.price}`,
            '',
            'MEASUREMENTS',
            formatMeasurements(product.measurementStatus, product.shapeInfo),
            '',
            'SHAPE DIAGRAM',
            '[Shape diagram will be inserted below]',
            '',
            ''
        ].join('\n');
        
        // Insert content
        await docs.documents.batchUpdate({
            documentId: documentId,
            resource: {
                requests: [
                    {
                        insertText: {
                            location: { index: 1 },
                            text: contentText
                        }
                    }
                ]
            }
        });
        
        // Try to insert shape diagram if we have shape information
        if (product.shapeInfo && product.shapeInfo.shapeNumber) {
            await insertShapeDiagram(documentId, product.shapeInfo.shapeNumber);
        }
        
        // Create shareable link
        await drive.permissions.create({
            fileId: documentId,
            resource: {
                role: 'reader',
                type: 'anyone'
            }
        });
        
        const file = await drive.files.get({
            fileId: documentId,
            fields: 'webViewLink'
        });
        
        console.log(`PO generated successfully: ${file.data.webViewLink}`);
        
        return {
            success: true,
            documentId: documentId,
            documentUrl: file.data.webViewLink,
            title: docTitle,
            poType: poType
        };
        
    } catch (error) {
        console.error(`Error generating PO:`, error.message);
        console.error(`Error details:`, {
            name: error.name,
            code: error.code,
            status: error.status,
            response: error.response?.data || 'No response data'
        });
        throw error;
    }
}

// Insert shape diagram into document
async function insertShapeDiagram(documentId, shapeNumber) {
    try {
        console.log(`Inserting shape diagram ${shapeNumber} into PO`);
        
        const shapeDiagram = await findShapeDiagram(shapeNumber);
        if (!shapeDiagram) {
            console.log(`Shape diagram ${shapeNumber} not found, skipping image insertion`);
            return false;
        }
        
        // Get document content to find insertion point
        const doc = await docs.documents.get({
            documentId: documentId
        });
        
        // Find the text "[Shape diagram will be inserted below]" and replace it
        const content = doc.data.body.content;
        let insertIndex = -1;
        
        for (const element of content) {
            if (element.paragraph && element.paragraph.elements) {
                for (const textElement of element.paragraph.elements) {
                    if (textElement.textRun && textElement.textRun.content.includes('[Shape diagram will be inserted below]')) {
                        insertIndex = element.startIndex;
                        break;
                    }
                }
                if (insertIndex !== -1) break;
            }
        }
        
        if (insertIndex !== -1) {
            // Insert image
            await docs.documents.batchUpdate({
                documentId: documentId,
                resource: {
                    requests: [
                        {
                            insertInlineImage: {
                                location: { index: insertIndex },
                                uri: shapeDiagram.downloadLink,
                                objectSize: {
                                    height: { magnitude: 300, unit: 'PT' },
                                    width: { magnitude: 400, unit: 'PT' }
                                }
                            }
                        }
                    ]
                }
            });
            
            console.log(`Shape diagram inserted successfully`);
            return true;
        }
        
        console.log(`Could not find insertion point for shape diagram`);
        return false;
        
    } catch (error) {
        console.error(`Error inserting shape diagram:`, error.message);
        return false;
    }
}

// Test PO generation with domain-wide delegation
async function testPOGeneration() {
    try {
        console.log('Testing PO generation with domain-wide delegation...');
        
        const initialised = await initializeGoogleAPIs();
        if (!initialised) {
            console.log('API initialisation failed');
            return false;
        }
        
        // Test a basic Drive API call to verify authentication
        console.log('Testing basic Drive API access with service account...');
        const testList = await drive.files.list({
            pageSize: 1,
            fields: 'files(id, name)'
        });
        
        console.log('Drive API test successful:', testList.data.files?.length || 0, 'files found');
        
        // Test finding a shape diagram
        const testShape = await findShapeDiagram('20');
        console.log('Test shape result:', testShape);
        
        return true;
    } catch (error) {
        console.error('PO generation test failed:', error.message);
        console.error('Full error:', error);
        return false;
    }
}

module.exports = {
    generatePO,
    testPOGeneration,
    initializeGoogleAPIs,
    findShapeDiagram
};