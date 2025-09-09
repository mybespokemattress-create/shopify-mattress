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

// Professional PDF route for React component - SINGLE ROUTE SOLUTION
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
    
    // === HEADER SECTION ===
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Bespoke Mattress Company', 40, 40);
    
    doc.fontSize(11)
       .font('Helvetica')
       .fillColor('black')
       .text('Purchase Order & Manufacturing Specification', 40, 62);
    
    doc.fontSize(11)
       .font('Helvetica')
       .fillColor('black')
       .text(`Order: ${order.orderNumber}`, 40, 78);
    
    // Horizontal line under header
    doc.strokeColor('black')
       .moveTo(40, 105)
       .lineTo(555, 105)
       .stroke();
    
    // === ORDER INFORMATION BOX ===
    let yPos = 120;
    
    // Order Information Box (full width)
    const orderBoxY = drawCleanBox(doc, 40, yPos, 515, 50, 'Order Information');
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor('black')
       .text(`Order Number: ${order.orderNumber}`, 45, orderBoxY)
       .text(`Order ID: ${order.id}`, 45, orderBoxY + 12)
       .text(`Date: ${order.orderDate}`, 300, orderBoxY);
    
    yPos += 65;
    
    // === SUPPLIER SPECIFICATION SECTION ===
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Supplier Specification', 40, yPos);
    
    yPos += 20;
    
    // Supplier Code Box
    const supplierBoxY = drawCleanBox(doc, 40, yPos, 515, 70);
    
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
       .text('Supplier Code:', 45, supplierBoxY);
    
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor('black')
       .text(supplierCode, 45, supplierBoxY + 15);
    
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Link Attachment:', 45, supplierBoxY + 35);
    
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor('black')
       .text(linkAttachment, 45, supplierBoxY + 50);
    
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Delivery:', 300, supplierBoxY + 35);
    
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor('black')
       .text(order.deliveryOption || 'Rolled and Boxed', 300, supplierBoxY + 50);
    
    yPos += 85;
    
    // === MEASUREMENTS & SHAPE DIAGRAM SECTION ===
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Measurements & Shape Diagram', 40, yPos);
    
    yPos += 20;
    
    // Left side - Dimensions Table
    const dimBoxY = drawCleanBox(doc, 40, yPos, 180, 250, 'Dimensions');
    
    // Table headers
    doc.fontSize(9)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Dim', 45, dimBoxY)
       .text('Value', 100, dimBoxY);
    
    // Header underline
    doc.strokeColor('black')
       .moveTo(45, dimBoxY + 12)
       .lineTo(215, dimBoxY + 12)
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
    
    // Dimension rows A-G
    const dimensions = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    let rowY = dimBoxY + 20;
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
         .text(dim, 45, rowY)
         .text(valueText, 100, rowY);
      
      rowY += 14;
    });
    
    // Status at bottom
    doc.fontSize(8)
       .font('Helvetica-Oblique')
       .fillColor('black')
       .text(`Status: ${hasValidMeasurements ? 'Verified' : 'Not verified'}`, 45, dimBoxY + 220);
    
    // Right side - Shape Diagram with Shopify image loading
    const diagramBoxY = drawCleanBox(doc, 235, yPos, 320, 250, 'Shape Diagram');
    
    // Extract diagram number from React data
    let diagramNumber = order.diagramNumber || order.shapeNumber;
    
    console.log('🔍 Attempting to extract diagram number from React...');
    console.log('🔍 Diagram number from React:', diagramNumber);
    
    if (diagramNumber) {
      doc.fontSize(9)
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
            // Add image with proper sizing and positioning
            const imageWidth = 300;
            const imageHeight = 200;
            const imageX = 245;
            const imageY = diagramBoxY + 20;
            
            doc.image(imagePath, imageX, imageY, {
              width: imageWidth,
              height: imageHeight,
              fit: [imageWidth, imageHeight],
              align: 'center'
            });
            imageLoaded = true;
            console.log('🔍 Image loaded successfully');
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
        doc.fontSize(9)
           .fillColor('black')
           .text(`[Diagram ${diagramNumber} - Image not available]`, 245, diagramBoxY + 60)
           .text('Please refer to technical specifications', 245, diagramBoxY + 80);
      }
    } else {
      console.log('🔍 No diagram number found in React data');
      doc.fontSize(9)
         .fillColor('black')
         .text('No diagram specified', 245, diagramBoxY + 60);
    }
    
    yPos += 265;
    
    // === CUSTOMER NOTES SECTION (if present) ===
    if (order.notes && order.notes.trim()) {
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor('black')
         .text('Customer Notes', 40, yPos);
      
      yPos += 20;
      
      const notesBoxY = drawCleanBox(doc, 40, yPos, 515, 50);
      
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('black')
         .text(order.notes, 45, notesBoxY, { width: 505, height: 40 });
      
      yPos += 65;
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
       .text('Bespoke Mattress Company | Professional Manufacturing Specification', 40, yPos + 10)
       .text('This document contains all specifications required for manufacturing.', 40, yPos + 20);
    
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
    message: 'Professional PDF layout ready - single route solution',
    endpoints: [
      'POST /api/pdf/generate - Generate PDF from React component data'
    ],
    timestamp: new Date().toISOString()
  });
});

console.log('📄 PDF routes registered: POST /generate only');

module.exports = router;