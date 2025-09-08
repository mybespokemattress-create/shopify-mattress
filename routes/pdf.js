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
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text(title, x + 6, y + 6);
    return y + 24; // Return content start position
  }
  
  return y + 6;
}

// Helper function to check if image exists
function imageExists(imagePath) {
  try {
    return fs.existsSync(imagePath);
  } catch (error) {
    return false;
  }
}

// Professional PDF route for React component - OPTIMISED FOR A4
router.post('/generate', async (req, res) => {
  console.log('🔍 PDF ROUTE: POST /generate - OPTIMISED A4 PDF');
  console.log('🔍 Order data from React:', req.body.order?.orderNumber);
  
  try {
    const { order } = req.body;
    
    if (!order) {
      return res.status(400).json({ error: 'Order data required' });
    }
    
    console.log('🔍 Generating optimised A4 PDF for:', order.orderNumber);
    
    // Create PDF with A4 dimensions and optimised margins
    const doc = new PDFDocument({
      margin: 30,
      size: 'A4'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="purchase-order-${order.orderNumber}.pdf"`);
    
    doc.pipe(res);
    
    // A4 dimensions: 595.28 x 841.89 points
    // Usable area with 30pt margins: 535.28 x 781.89 points
    
    // === COMPACT HEADER SECTION ===
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Bespoke Mattress Company', 30, 30);
    
    doc.fontSize(12)
       .font('Helvetica')
       .fillColor('black')
       .text('Purchase Order & Manufacturing Specification', 30, 55);
    
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text(`Order: ${order.orderNumber}`, 30, 75);
    
    // Horizontal line under header
    doc.strokeColor('black')
       .lineWidth(1.5)
       .moveTo(30, 95)
       .lineTo(565, 95)
       .stroke();
    
    // === COMPACT ORDER INFORMATION BOX ===
    let yPos = 105;
    
    // Order Information Box - more compact
    const orderBoxY = drawCleanBox(doc, 30, yPos, 535, 60, 'Order Information');
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('black')
       .text(`Order Number: ${order.orderNumber}`, 40, orderBoxY)
       .text(`Order ID: ${order.id}`, 40, orderBoxY + 15)
       .text(`Date: ${order.orderDate}`, 300, orderBoxY)
       .text(`Delivery: ${order.deliveryOption || 'Rolled and Boxed'}`, 300, orderBoxY + 15);
    
    yPos += 75;
    
    // === COMPACT SUPPLIER SPECIFICATION SECTION ===
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Supplier Specification', 30, yPos);
    
    yPos += 25;
    
    // Supplier Code Box - more compact
    const supplierBoxY = drawCleanBox(doc, 30, yPos, 535, 70);
    
    // Extract supplier code from React data
    let supplierCode = order.supplierCode || 'Not mapped';
    const lineItems = order.lineItems || [];
    
    if (lineItems && lineItems[0] && lineItems[0].sku) {
      supplierCode = `SKU: ${lineItems[0].sku} (Mapping required)`;
    }
    
    // Extract link attachment from React data  
    let linkAttachment = order.linkAttachment || 'One Piece Mattress No Link Required';
    
    console.log('🔍 Final link attachment:', linkAttachment);
    
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Supplier Code:', 40, supplierBoxY);
    
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor('black')
       .text(supplierCode, 40, supplierBoxY + 15);
    
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Link Attachment:', 40, supplierBoxY + 35);
    
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor('black')
       .text(linkAttachment, 40, supplierBoxY + 50);
    
    yPos += 85;
    
    // === COMPACT MEASUREMENTS & SHAPE DIAGRAM SECTION ===
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Measurements & Shape Diagram', 30, yPos);
    
    yPos += 25;
    
    // Left side - Dimensions Table - compact
    const dimBoxY = drawCleanBox(doc, 30, yPos, 180, 220, 'Dimensions');
    
    // Table headers
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Dim', 40, dimBoxY)
       .text('Value', 100, dimBoxY);
    
    // Header underline
    doc.strokeColor('black')
       .lineWidth(0.5)
       .moveTo(40, dimBoxY + 15)
       .lineTo(200, dimBoxY + 15)
       .stroke();
    
    // Extract measurements from React data
    let measurements = {};
    
    console.log('🔍 Extracting measurements from React data...');
    
    // Get measurements from React component data
    if (order.lineItems && order.lineItems[0] && order.lineItems[0].properties) {
      const props = order.lineItems[0].properties;
      ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(dim => {
        const value = props[`Dimension ${dim}`];
        if (value && value.trim()) {
          measurements[dim] = { value: value, unit: 'cm' };
          console.log(`🔍 Found ${dim}: ${value}`);
        }
      });
    }
    
    console.log('🔍 Final measurements object:', measurements);
    
    // Dimension rows A-G - compact spacing
    const dimensions = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    let rowY = dimBoxY + 25;
    let hasValidMeasurements = false;
    
    dimensions.forEach(dim => {
      const measurement = measurements[dim];
      let valueText = '-';
      
      if (measurement) {
        if (typeof measurement === 'object' && 'value' in measurement) {
          valueText = measurement.unit 
            ? `${measurement.value} ${measurement.unit}`
            : measurement.value;
          hasValidMeasurements = true;
        } else if (typeof measurement === 'string' && measurement.trim()) {
          valueText = String(measurement);
          hasValidMeasurements = true;
        }
      }
      
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('black')
         .text(dim, 40, rowY)
         .text(valueText, 100, rowY);
      
      rowY += 16; // Compact spacing
    });
    
    // Status at bottom
    doc.fontSize(8)
       .font('Helvetica-Oblique')
       .fillColor('black')
       .text(`Status: ${hasValidMeasurements ? 'Verified' : 'Not verified'}`, 40, dimBoxY + 195);
    
    // Right side - Shape Diagram - optimised size
    const diagramBoxY = drawCleanBox(doc, 230, yPos, 335, 220, 'Shape Diagram');
    
    // Extract diagram number from React data
    let diagramNumber = order.diagramNumber || order.shapeNumber;
    
    console.log('🔍 Attempting to extract diagram number from React...');
    console.log('🔍 Diagram number from React:', diagramNumber);
    
    if (diagramNumber) {
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('black')
         .text(`Diagram: ${diagramNumber}`, 240, diagramBoxY);
      
      // Try multiple possible image paths for Shopify diagrams
      const imagePaths = [
        path.join(__dirname, '..', 'public', 'images', 'diagrams', `Shape_${diagramNumber}_Caravan_Mattress_Measuring_Diagram.jpg`),
        path.join(__dirname, '..', 'client', 'public', 'images', 'diagrams', `Shape_${diagramNumber}_Caravan_Mattress_Measuring_Diagram.jpg`),
        path.join(__dirname, '..', 'images', 'diagrams', `Shape_${diagramNumber}_Caravan_Mattress_Measuring_Diagram.jpg`),
        `/images/diagrams/Shape_${diagramNumber}_Caravan_Mattress_Measuring_Diagram.jpg`
      ];
      
      let imageLoaded = false;
      
      for (const imagePath of imagePaths) {
        console.log('🔍 Trying image path:', imagePath);
        if (imageExists(imagePath)) {
          try {
            console.log('🔍 Image found! Loading:', imagePath);
            // Optimised image size to fit within diagram box
            const imageWidth = 320;
            const imageHeight = 170;
            const imageX = 235;
            const imageY = diagramBoxY + 20;
            
            doc.image(imagePath, imageX, imageY, {
              width: imageWidth,
              height: imageHeight,
              fit: [imageWidth, imageHeight],
              align: 'center'
            });
            imageLoaded = true;
            console.log('🔍 Optimised image loaded successfully');
            break;
          } catch (imageError) {
            console.log('🔍 Image load error for path:', imagePath, imageError.message);
            continue;
          }
        } else {
          console.log('🔍 Image not found at path:', imagePath);
        }
      }
      
      if (!imageLoaded) {
        console.log('🔍 No image found in any path, showing placeholder');
        // Fallback text if no image found
        doc.fontSize(10)
           .fillColor('black')
           .text(`[Diagram ${diagramNumber} - Image not available]`, 240, diagramBoxY + 60)
           .text('Please refer to technical specifications', 240, diagramBoxY + 90);
      }
    } else {
      console.log('🔍 No diagram number found in React data');
      doc.fontSize(10)
         .fillColor('black')
         .text('No diagram specified', 240, diagramBoxY + 60);
    }
    
    yPos += 240;
    
    // === CUSTOMER NOTES SECTION - COMPACT ===
    // Check if we have notes and if there's space (keep within A4 bounds)
    if (order.notes && order.notes.trim() && yPos < 700) {
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('black')
         .text('Customer Notes', 30, yPos);
      
      yPos += 20;
      
      // Calculate available height for notes (ensure footer fits)
      const maxNotesHeight = Math.min(80, 750 - yPos);
      const notesBoxY = drawCleanBox(doc, 30, yPos, 535, maxNotesHeight);
      
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('black')
         .text(order.notes, 40, notesBoxY, { 
           width: 515, 
           height: maxNotesHeight - 20,
           ellipsis: true // Truncate if too long
         });
      
      yPos += maxNotesHeight + 10;
    }
    
    // === COMPACT FOOTER SECTION ===
    // Ensure footer starts no later than position 750 to stay on page
    if (yPos > 750) {
      yPos = 750;
    }
    
    // Horizontal line above footer
    doc.strokeColor('black')
       .lineWidth(1)
       .moveTo(30, yPos)
       .lineTo(565, yPos)
       .stroke();
    
    yPos += 10;
    
    // Footer information - compact
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('black')
       .text(`Generated: ${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString('en-GB')}`, 30, yPos)
       .text('Bespoke Mattress Company | Professional Manufacturing Specification', 30, yPos + 12)
       .text('This document contains all specifications required for manufacturing.', 30, yPos + 24);
    
    // Finalize PDF
    doc.end();
    
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'PDF generation failed', details: error.message });
  }
});

// Test routes
router.get('/test', (req, res) => {
  console.log('📄 PDF test endpoint called');
  res.json({
    success: true,
    message: 'Optimised A4 PDF layout ready',
    endpoints: [
      'POST /api/pdf/generate - Generate optimised A4 PDF from React component data'
    ],
    timestamp: new Date().toISOString()
  });
});

console.log('📄 PDF routes registered: POST /generate with optimised A4 design');

module.exports = router;