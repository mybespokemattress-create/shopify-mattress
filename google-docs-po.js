// google-docs-po.js - Purchase Order Generation with Shape Diagrams

const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

// Configuration
const MEASURING_DIAGRAMS_FOLDER_ID = '1E5OHL4RZiIvz0uXuPgRdwquTTPW7WjJT';
const PO_OUTPUT_FOLDER_ID = '19RJxQRQ5rercn3IeWIeh5nPoLGykei0k'; // Orders folder for review

let docs = null;
let drive = null;

// Initialize Google APIs with FIXED authentication
async function initializeGoogleAPIs() {
    try {
        const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        
        const auth = new GoogleAuth({
            credentials: serviceAccount,
            scopes: [
                'https://www.googleapis.com/auth/documents',
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/drive.file'
            ],
            projectId: serviceAccount.project_id,
            clientOptions: {
                subject: serviceAccount.client_email
            }
        });

        const authClient = await auth.getClient();

        docs = google.docs({ 
            version: 'v1', 
            auth: authClient,
            timeout: 30000
        });
        
        drive = google.drive({ 
            version: 'v3', 
            auth: authClient,
            timeout: 30000
        });
        
        console.log('✅ Google Docs and Drive APIs initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize Google APIs:', error.message);
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
            console.log(`📐 Found shape diagram: ${file.name}`);
            return {
                fileId: file.id,
                name: file.name,
                webViewLink: file.webViewLink,
                downloadLink: file.webContentLink
            };
        }
        
        console.log(`⚠️ Shape diagram not found for shape ${shapeNumber}`);
        return null;
    } catch (error) {
        console.error(`❌ Error finding shape diagram for shape ${shapeNumber}:`, error.message);
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

// Format measurements for display
function formatMeasurements(measurementStatus, shapeInfo) {
    if (!measurementStatus || !measurementStatus.hasCompleteMeasurements) {
        return 'MEASUREMENTS TO BE PROVIDED';
    }
    
    const dimensions = [];
    measurementStatus.providedDimensions.forEach(dim => {
        if (measurementStatus.measurements[dim]) {
            const measurement = measurementStatus.measurements[dim];
            dimensions.push(`${dim}: ${measurement.value}${measurement.unit || 'cm'}`);
        }
    });
    
    return dimensions.length > 0 ? dimensions.join(', ') : 'MEASUREMENTS TO BE PROVIDED';
}

// Create PO document content
function createPOContent(orderData, productData, supplierInfo, poType) {
    const product = productData[0]; // Assuming single product for now
    const currentDate = new Date().toLocaleDateString('en-GB');
    
    // Format customer address
    const address = orderData.shippingAddress || orderData.billingAddress || {};
    const customerAddress = [
        address.address1,
        address.address2,
        address.city,
        address.province,
        address.zip,
        address.country
    ].filter(Boolean).join(', ');
    
    // PO status based on type
    let statusSection = '';
    switch (poType) {
        case 'complete':
            statusSection = 'STATUS: READY FOR PRODUCTION';
            break;
        case 'measurements_pending':
            statusSection = 'STATUS: AWAITING CUSTOMER MEASUREMENTS - DO NOT PROCEED TO PRODUCTION';
            break;
        case 'kit_requested':
            statusSection = 'STATUS: MEASURING KIT REQUIRED - CUSTOMER TO BE CONTACTED';
            break;
    }
    
    return {
        title: `PO ${orderData.shopifyOrderNumber} - ${orderData.customerName}`,
        content: [
            {
                insertText: {
                    location: { index: 1 },
                    text: `PURCHASE ORDER\n\n`
                }
            },
            {
                updateTextStyle: {
                    range: { startIndex: 1, endIndex: 15 },
                    textStyle: { bold: true, fontSize: { magnitude: 16, unit: 'PT' } }
                }
            },
            {
                insertText: {
                    location: { index: 17 },
                    text: `Order Number: ${orderData.shopifyOrderNumber}\n`
                }
            },
            {
                insertText: {
                    location: { index: 17 + `Order Number: ${orderData.shopifyOrderNumber}\n`.length },
                    text: `Date: ${currentDate}\n`
                }
            },
            {
                insertText: {
                    location: { index: 17 + `Order Number: ${orderData.shopifyOrderNumber}\nDate: ${currentDate}\n`.length },
                    text: `Supplier: ${supplierInfo.name}\n\n`
                }
            },
            {
                insertText: {
                    location: { index: 17 + `Order Number: ${orderData.shopifyOrderNumber}\nDate: ${currentDate}\nSupplier: ${supplierInfo.name}\n\n`.length },
                    text: `${statusSection}\n\n`
                }
            }
        ]
    };
}

// Generate Purchase Order
async function generatePO(orderData, productData, supplierInfo) {
    if (!docs || !drive) {
        const initialized = await initializeGoogleAPIs();
        if (!initialized) {
            throw new Error('Google APIs not initialized');
        }
    }
    
    console.log(`📄 Generating PO for order ${orderData.shopifyOrderNumber}`);
    
    try {
        const product = productData[0]; // Handle single product for now
        const poType = determinePOType(product.measurementStatus);
        
        console.log(`📋 PO Type: ${poType}`);
        
        // Create the document
        const docTitle = `PO ${orderData.shopifyOrderNumber} - ${orderData.customerName.replace(/[^a-zA-Z0-9\s]/g, '')}`;
        
        const createResponse = await docs.documents.create({
            resource: {
                title: docTitle
            }
        });
        
        const documentId = createResponse.data.documentId;
        console.log(`📄 Created document: ${documentId}`);
        
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
                statusSection = '🟢 STATUS: READY FOR PRODUCTION';
                break;
            case 'measurements_pending':
                statusSection = '🟡 STATUS: AWAITING CUSTOMER MEASUREMENTS\n⚠️  DO NOT PROCEED TO PRODUCTION';
                break;
            case 'kit_requested':
                statusSection = '🟡 STATUS: MEASURING KIT REQUIRED\n📞 CUSTOMER TO BE CONTACTED';
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
        
        // Move document to orders folder for review
        await drive.files.update({
            fileId: documentId,
            addParents: PO_OUTPUT_FOLDER_ID,
            removeParents: 'root'
        });
        
        // Get shareable link
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
        
        console.log(`✅ PO generated successfully: ${file.data.webViewLink}`);
        
        return {
            success: true,
            documentId: documentId,
            documentUrl: file.data.webViewLink,
            title: docTitle,
            poType: poType
        };
        
    } catch (error) {
        console.error(`❌ Error generating PO:`, error.message);
        throw error;
    }
}

// Insert shape diagram into document
async function insertShapeDiagram(documentId, shapeNumber) {
    try {
        console.log(`📐 Inserting shape diagram ${shapeNumber} into PO`);
        
        const shapeDiagram = await findShapeDiagram(shapeNumber);
        if (!shapeDiagram) {
            console.log(`⚠️ Shape diagram ${shapeNumber} not found, skipping image insertion`);
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
            
            console.log(`✅ Shape diagram inserted successfully`);
            return true;
        }
        
        console.log(`⚠️ Could not find insertion point for shape diagram`);
        return false;
        
    } catch (error) {
        console.error(`❌ Error inserting shape diagram:`, error.message);
        return false;
    }
}

// Test PO generation
async function testPOGeneration() {
    try {
        const initialized = await initializeGoogleAPIs();
        if (!initialized) return false;
        
        // Test finding a shape diagram
        const testShape = await findShapeDiagram('20');
        console.log('Test shape result:', testShape);
        
        return true;
    } catch (error) {
        console.error('PO generation test failed:', error.message);
        return false;
    }
}

module.exports = {
    generatePO,
    testPOGeneration,
    initializeGoogleAPIs,
    findShapeDiagram
};