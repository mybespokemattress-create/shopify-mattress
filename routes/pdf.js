console.log('📄 PDF ROUTES FILE LOADED - routes/pdf.js');

const express = require('express');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const router = express.Router();

console.log('📄 PDF dependencies loaded successfully');

// Helper function to draw clean bordered boxes
function drawCleanBox(doc, x, y, width, height, title = null) {
  // Draw border
  doc.rect(x, y, width, height).stroke();
  
  // Add title if provided
  if (title) {
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text(title, x + 5, y + 5);
    return y + 20; // Return content start position
  }
  
  return y + 5;
}

// Helper function to check if image exists
function imageExists(imagePath) {
  try {
    return fs.existsSync(imagePath);
  } catch (error) {
    return false;
  }
}

// Function to generate PDF content (shared logic)
function generatePDFContent(doc, orderData) {
  // === HEADER SECTION ===
  doc.fontSize(18)
    .font('Helvetica-Bold')
    .fillColor('black')
    .text('My Bespoke Order Ltd', 40, 40);

  doc.fontSize(11)
    .font('Helvetica')
    .fillColor('black')
    .text('Purchase Order & Manufacturing Specification', 40, 62);

  doc.fontSize(11)
    .font('Helvetica')
    .fillColor('black')
    .text(`Order: ${orderData.orderNumber}`, 40, 78)
    .text(`Date: ${orderData.orderDate}`, 450, 78);

  // Horizontal line under header
  doc.strokeColor('black')
    .moveTo(40, 105)
    .lineTo(555, 105)
    .stroke();

  let yPos = 120;

  // === SUPPLIER SPECIFICATION SECTION ===
  doc.fontSize(12)
     .font('Helvetica-Bold')
     .fillColor('black')
     .text('Supplier Specification', 40, yPos);

  yPos += 20;

  // Extract supplier code from React data
  console.log('PDF DEBUG - orderData.supplierCode:', orderData.supplierCode);
  let supplierCode = orderData.supplierCode || 'No supplier mapping found - check SKU processing';
  const lineItems = orderData.lineItems || [];

  // Extract link attachment from React data  
  let linkAttachment = orderData.linkAttachment || 'One Piece Mattress No Link Required';

  console.log('🔍 Final link attachment:', linkAttachment);

  // Supplier Code Box with professional spacing
  const supplierBoxY = drawCleanBox(doc, 40, yPos, 515, 140);

  // Define consistent positioning constants
  const leftMargin = 45;    // Consistent left margin for all elements
  const boxWidth = 470;     // Use maximum width (515px box - 45px margin = 470px available)

  // Row 1: Quantity on same line - professional positioning
  doc.fontSize(10)
    .font('Helvetica-Bold')
    .fillColor('black')
    .text('Quantity:', leftMargin, supplierBoxY + 20);

  doc.fontSize(10)
    .font('Helvetica')
    .fillColor('black')
    .text(orderData.lineItems?.[0]?.quantity || '1', leftMargin + 50, supplierBoxY + 5);

  // Row 2: Supplier Code with maximum width usage
  doc.fontSize(10)
    .font('Helvetica-Bold')
    .fillColor('black')
    .text('Supplier Code:', leftMargin, supplierBoxY + 30);

  doc.fontSize(10)
    .font('Helvetica')
    .fillColor('black')
    .text(supplierCode, leftMargin, supplierBoxY + 45, { 
      width: 470,          // <-- This should be 470px
      height: 40,               // <-- Changed from 35 to 40
      lineGap: 3,              // <-- Changed from 2 to 3
      align: 'justify'         // <-- Added justify alignment
    });

  // Bottom row - properly centered Mattress Label as discussed
  const bottomY = supplierBoxY + 95;
  
  // Link Attachment - Left section 
  doc.fontSize(10)
    .font('Helvetica-Bold')
    .fillColor('black')
    .text('Link Attachment:', leftMargin, bottomY);

  doc.fontSize(9)
    .font('Helvetica')
    .fillColor('black')
    .text(linkAttachment, leftMargin, bottomY + 12);

  // Mattress Label - MOVED FURTHER RIGHT as requested
  const centreX = 280; // Moved right from 222.5px
  doc.fontSize(10)
    .font('Helvetica-Bold')
    .fillColor('black')
    .text('Mattress Label:', centreX, bottomY);

  doc.fontSize(9)
    .font('Helvetica')
    .fillColor('black')
    .text(orderData.mattressLabel || 'Caravan Mattresses', centreX, bottomY + 12, { width: 120 });

  // Delivery - Far right section 
  const farRightX = leftMargin + 380;
  doc.fontSize(10)
    .font('Helvetica-Bold')
    .fillColor('black')
    .text('Delivery:', farRightX, bottomY);

  doc.fontSize(9)
    .font('Helvetica')
    .fillColor('black')
    .text(orderData.deliveryOption || 'Rolled and Boxed', farRightX, bottomY + 12, { width: 120 });

  yPos += 155;

  // === MEASUREMENTS & SHAPE DIAGRAM SECTION ===
  doc.fontSize(12)
     .font('Helvetica-Bold')
     .fillColor('black')
     .text('Measurements & Shape Diagram', 40, yPos);

  yPos += 20;

  // Left side - Dimensions Table (FINALIZED LAYOUT)
  const dimBoxY = drawCleanBox(doc, 40, yPos, 180, 350, 'Dimensions');

  // Extract measurements from React data
  let measurements = {};

  console.log('🔍 Extracting measurements from React data...');

  // Get measurements from React component data
  if (orderData.lineItems && orderData.lineItems[0] && orderData.lineItems[0].properties) {
    const props = orderData.lineItems[0].properties;
    ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(dim => {
      const value = props[`Dimension ${dim}`];
      if (value && value.trim()) {
        measurements[dim] = { value: value, unit: 'cm' };
        console.log(`🔍 Found ${dim}: ${value}`);
      }
    });
  }

  console.log('🔍 Final measurements object:', measurements);

  // Dimension rows A-G - FINALIZED SPACING
  const dimensions = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  let rowY = dimBoxY + 15;  // Start with proper top margin
  let hasValidMeasurements = false;

  dimensions.forEach(dim => {
    const measurement = measurements[dim];
    let valueText = '-';

    if (measurement) {
      if (typeof measurement === 'object' && 'value' in measurement) {
          // DON'T add cm - it's already in the value
          valueText = measurement.value;
          hasValidMeasurements = true;
      } else if (typeof measurement === 'string' && measurement.trim()) {
          // DON'T add cm - it's already in the value
          valueText = String(measurement);
          hasValidMeasurements = true;
      }
    }

    // Dimension letter and value with consistent spacing
    doc.fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('black')
      .text(dim, 50, rowY);
    
    doc.fontSize(12)
      .font('Helvetica')
      .fillColor('black')
      .text(valueText, 85, rowY);

    rowY += 22;  // FINALIZED TIGHT spacing between dimensions
  });

  // Move Additional Specifications UP - FINALIZED spacing
  rowY += 15;

  // Additional Specifications header
  doc.fontSize(11)
    .font('Helvetica-Bold')
    .fillColor('black')
    .text('Additional Specifications', 50, rowY);

  rowY += 20;

  // Safety check for Additional Specifications data
  const radiusTopCorner = (orderData.radiusTopCorner && orderData.radiusTopCorner.trim()) ? orderData.radiusTopCorner : 'Test';
  const radiusBottomCorner = (orderData.radiusBottomCorner && orderData.radiusBottomCorner.trim()) ? orderData.radiusBottomCorner : 'Test';
  const finishedSizeMax = (orderData.finishedSizeMax && orderData.finishedSizeMax.trim()) ? orderData.finishedSizeMax : 'Test';

  // Radius of Top Corner
  doc.fontSize(10)
    .font('Helvetica-Bold')
    .fillColor('black')
    .text('Radius of Top Corner', 50, rowY);

  rowY += 15;

  doc.fontSize(10)
    .font('Helvetica')
    .fillColor('black')
    .text(radiusTopCorner, 50, rowY);

  rowY += 22;  // FINALIZED spacing between specifications

  // Radius of Bottom Corner  
  doc.fontSize(10)
    .font('Helvetica-Bold')
    .fillColor('black')
    .text('Radius of Bottom Corner', 50, rowY);

  rowY += 15;

  doc.fontSize(10)
    .font('Helvetica')
    .fillColor('black')
    .text(radiusBottomCorner, 50, rowY);

  rowY += 22;  // FINALIZED spacing between specifications

  // Max Overall Size - cleaner label
  doc.fontSize(10)
    .font('Helvetica-Bold')
    .fillColor('black')
    .text('Max Overall Size', 50, rowY);

  rowY += 15;

  doc.fontSize(10)
    .font('Helvetica')
    .fillColor('black')
    .text(finishedSizeMax, 50, rowY);

  // NO STATUS LINE - removed as per finalized design

  // Right side - Shape Diagram 
  const diagramBoxY = drawCleanBox(doc, 235, yPos, 320, 350, 'Shape Diagram');

  // Check for custom diagram first
  let imageLoaded = false;
  
  console.log('🔍 Checking for custom diagram...');
  console.log('🔍 Order has_custom_diagram:', orderData.has_custom_diagram);
  console.log('🔍 Order custom_diagram_url:', orderData.custom_diagram_url);

  // PRIORITY 1: Custom uploaded diagram
  if (orderData.has_custom_diagram && orderData.custom_diagram_url) {
    const customDiagramPath = path.join(__dirname, '..', orderData.custom_diagram_url);
    console.log('🔍 Trying custom diagram path:', customDiagramPath);
    
    if (imageExists(customDiagramPath)) {
      try {
        console.log('🔍 Custom diagram found! Loading:', customDiagramPath);
        
        // Add custom diagram label
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .fillColor('black')
           .text('Custom Diagram', 240, diagramBoxY);

        // Add image with MUCH LARGER sizing and positioning
        const imageWidth = 305;  // Almost full width of box
        const imageHeight = 300; // Much taller
        const imageX = 242;      // Centered in box
        const imageY = diagramBoxY + 20;

        doc.image(customDiagramPath, imageX, imageY, {
          width: imageWidth,
          height: imageHeight,
          fit: [imageWidth, imageHeight],
          align: 'center'
        });
        
        imageLoaded = true;
        console.log('🔍 Custom diagram loaded successfully');
        
        // Add filename at bottom (positioned for larger box)
        const filename = orderData.custom_diagram_url.split('/').pop();
        doc.fontSize(8)
           .font('Helvetica')
           .fillColor('gray')
           .text(`File: ${filename}`, 245, diagramBoxY + 310);
           
      } catch (imageError) {
        console.log('🔍 Custom diagram load error:', imageError.message);
      }
    } else {
      console.log('🔍 Custom diagram file not found at path:', customDiagramPath);
    }
  }

  // PRIORITY 2: Standard Shopify diagram (fallback)
  if (!imageLoaded) {
    // Extract diagram number from React data
    let diagramNumber = orderData.diagramNumber || orderData.shapeNumber;

    console.log('🔍 No custom diagram, attempting standard diagram...');
    console.log('🔍 Diagram number from React:', diagramNumber);

    if (diagramNumber) {
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('black')
         .text(`Standard Diagram: ${diagramNumber}`, 240, diagramBoxY);

      // Try multiple possible image paths for Shopify diagrams
      const imagePaths = [
        path.join(__dirname, '..', 'public', 'images', 'diagrams', `Shape_${diagramNumber}_Caravan_Mattress_Measuring_Diagram.jpg`),
        path.join(__dirname, '..', 'client', 'public', 'images', 'diagrams', `Shape_${diagramNumber}_Caravan_Mattress_Measuring_Diagram.jpg`),
        path.join(__dirname, '..', 'images', 'diagrams', `Shape_${diagramNumber}_Caravan_Mattress_Measuring_Diagram.jpg`),
        `/images/diagrams/Shape_${diagramNumber}_Caravan_Mattress_Measuring_Diagram.jpg`
      ];

      for (const imagePath of imagePaths) {
        console.log('🔍 Trying standard image path:', imagePath);
        if (imageExists(imagePath)) {
          try {
            console.log('🔍 Standard image found! Loading:', imagePath);
            // Add image with MUCH LARGER sizing and positioning
            const imageWidth = 305;  // Almost full width of box
            const imageHeight = 300; // Much taller
            const imageX = 242;      // Centered in box
            const imageY = diagramBoxY + 20;

            doc.image(imagePath, imageX, imageY, {
              width: imageWidth,
              height: imageHeight,
              fit: [imageWidth, imageHeight],
              align: 'center'
            });
            imageLoaded = true;
            console.log('🔍 Standard image loaded successfully');
            break;
          } catch (imageError) {
            console.log('🔍 Standard image load error for path:', imagePath, imageError.message);
            continue;
          }
        } else {
          console.log('🔍 Standard image not found at path:', imagePath);
        }
      }
    }
  }

  // PRIORITY 3: No diagram available (fallback message)
  if (!imageLoaded) {
    console.log('🔍 No diagrams found, showing placeholder');
    
    if (orderData.has_custom_diagram) {
      // Custom diagram was expected but failed to load
      doc.fontSize(9)
         .fillColor('red')
         .text('Custom Diagram Upload Failed', 245, diagramBoxY + 60)
         .fillColor('black')
         .text('Please check file availability', 245, diagramBoxY + 80);
    } else if (orderData.diagramNumber) {
      // Standard diagram was expected but failed to load
      doc.fontSize(9)
         .fillColor('black')
         .text(`[Diagram ${orderData.diagramNumber} - Image not available]`, 245, diagramBoxY + 60)
         .text('Please refer to technical specifications', 245, diagramBoxY + 80);
    } else {
      // No diagram specified
      doc.fontSize(9)
         .fillColor('black')
         .text('No diagram specified', 245, diagramBoxY + 60)
         .text('Manual order - refer to customer notes', 245, diagramBoxY + 80);
    }
  }

  yPos += 365; // Updated for larger diagram section

  // === CUSTOMER NOTES SECTION (if present) ===
  if (orderData.notes && orderData.notes.trim()) {
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Customer Notes', 40, yPos);

    yPos += 20;

    const notesBoxY = drawCleanBox(doc, 40, yPos, 515, 35);

    doc.fontSize(9)
       .font('Helvetica')
       .fillColor('black')
       .text(orderData.notes, 45, notesBoxY, { width: 505, height: 40 });

    yPos += 50;
  }

  // === FOOTER SECTION ===
  // Ensure footer is at bottom of page
  if (yPos < 750) {
    yPos = 750;
  }

  // Horizontal line above footer
  doc.strokeColor('black')
     .moveTo(40, yPos)
     .lineTo(555, yPos)
     .stroke();

  yPos += 10;

  // Footer information - BLACK AND WHITE FOR PRINTING
  doc.fontSize(8)
     .font('Helvetica')
     .fillColor('black')
     .text(`Generated: ${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString('en-GB')}`, 40, yPos)
     .text('My Bespoke Order Ltd | Tel: 0121 663 6299, WhatsApp us at 07769 431 970 Messages only - **Calls not accepted**', 40, yPos + 10)
     .text('This document contains all specifications required for manufacturing.', 40, yPos + 20);
}

// Professional PDF route for React component
router.post('/generate', async (req, res) => {
  console.log('🔍 PDF ROUTE: POST /generate - PROFESSIONAL PDF GENERATION');
  console.log('🔍 Order data from React:', req.body.order?.orderNumber);
  
  try {
    const { order } = req.body;
    
    if (!order) {
      return res.status(400).json({ error: 'Order data required' });
    }
    
    console.log('🔍 Generating PROFESSIONAL PDF for:', order.orderNumber);
    
    // Create PDF with A4 dimensions
    const doc = new PDFDocument({
      margin: 40,
      size: 'A4'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="purchase-order-${order.orderNumber}.pdf"`);
    
    doc.pipe(res);
    
    // Generate PDF content
    generatePDFContent(doc, order);
    
    // Finalize PDF
    doc.end();
    
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'PDF generation failed', details: error.message });
  }
});

// Export function for email attachment generation
async function generatePurchaseOrderPDF(orderData) {
  return new Promise((resolve, reject) => {
    try {
      console.log('🔧 Generating PDF buffer for email attachment...');
      
      // Create PDF with A4 dimensions
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4'
      });

      // Collect PDF buffer
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        console.log('🔧 PDF buffer generated successfully, size:', pdfBuffer.length);
        resolve(pdfBuffer);
      });

      // Generate PDF content using shared function
      generatePDFContent(doc, orderData);

      // Finalize PDF
      doc.end();

    } catch (error) {
      console.error('PDF generation error for email:', error);
      reject(error);
    }
  });
}

// Test routes
router.get('/test', (req, res) => {
  console.log('📄 PDF test endpoint called');
  res.json({
    success: true,
    message: 'Professional PDF layout ready - with email function export',
    endpoints: [
      'POST /api/pdf/generate - Generate PDF from React component data'
    ],
    functions: [
      'generatePurchaseOrderPDF - For email attachments'
    ],
    timestamp: new Date().toISOString()
  });
});

console.log('📄 PDF routes registered: POST /generate + email function export');

// Export both the router and the function
module.exports = router;
module.exports.generatePurchaseOrderPDF = generatePurchaseOrderPDF;