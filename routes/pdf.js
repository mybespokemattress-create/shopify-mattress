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
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text(title, x + 8, y + 8);
    return y + 30; // Return content start position
  }
  
  return y + 8;
}

// Helper function to check if image exists
function imageExists(imagePath) {
  try {
    return fs.existsSync(imagePath);
  } catch (error) {
    return false;
  }
}

// Professional PDF route for React component - LARGER DESIGN
router.post('/generate', async (req, res) => {
  console.log('🔍 PDF ROUTE: POST /generate - LARGER PROFESSIONAL PDF');
  console.log('🔍 Order data from React:', req.body.order?.orderNumber);
  
  try {
    const { order } = req.body;
    
    if (!order) {
      return res.status(400).json({ error: 'Order data required' });
    }
    
    console.log('🔍 Generating LARGER PDF for:', order.orderNumber);
    
    // Create PDF with A4 dimensions
    const doc = new PDFDocument({
      margin: 40,
      size: 'A4'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="purchase-order-${order.orderNumber}.pdf"`);
    
    doc.pipe(res);
    
    // === HEADER SECTION - LARGER ===
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Bespoke Mattress Company', 40, 40);
    
    doc.fontSize(14)
       .font('Helvetica')
       .fillColor('black')
       .text('Purchase Order & Manufacturing Specification', 40, 70);
    
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text(`Order: ${order.orderNumber}`, 40, 95);
    
    // Horizontal line under header - thicker
    doc.strokeColor('black')
       .lineWidth(2)
       .moveTo(40, 125)
       .lineTo(555, 125)
       .stroke();
    
    // === ORDER INFORMATION BOX - LARGER ===
    let yPos = 145;
    
    // Order Information Box (full width, taller)
    const orderBoxY = drawCleanBox(doc, 40, yPos, 515, 80, 'Order Information');
    doc.fontSize(12)
       .font('Helvetica')
       .fillColor('black')
       .text(`Order Number: ${order.orderNumber}`, 50, orderBoxY)
       .text(`Order ID: ${order.id}`, 50, orderBoxY + 20)
       .text(`Date: ${order.orderDate}`, 350, orderBoxY);
    
    yPos += 100;
    
    // === SUPPLIER SPECIFICATION SECTION - LARGER ===
    doc.fontSize(16)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Supplier Specification', 40, yPos);
    
    yPos += 30;
    
    // Supplier Code Box - larger
    const supplierBoxY = drawCleanBox(doc, 40, yPos, 515, 100);
    
    // Extract supplier code from React data
    let supplierCode = order.supplierCode || 'Not mapped';
    const lineItems = order.lineItems || [];
    
    if (lineItems && lineItems[0] && lineItems[0].sku) {
      supplierCode = `SKU: ${lineItems[0].sku} (Mapping required)`;
    }
    
    // Extract link attachment from React data  
    let linkAttachment = order.linkAttachment || 'One Piece Mattress No Link Required';
    
    console.log('🔍 Final link attachment:', linkAttachment);
    
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Supplier Code:', 50, supplierBoxY);
    
    doc.fontSize(11)
       .font('Helvetica')
       .fillColor('black')
       .text(supplierCode, 50, supplierBoxY + 20);
    
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Link Attachment:', 50, supplierBoxY + 50);
    
    doc.fontSize(11)
       .font('Helvetica')
       .fillColor('black')
       .text(linkAttachment, 50, supplierBoxY + 70);
    
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Delivery:', 350, supplierBoxY + 50);
    
    doc.fontSize(11)
       .font('Helvetica')
       .fillColor('black')
       .text(order.deliveryOption || 'Rolled and Boxed', 350, supplierBoxY + 70);
    
    yPos += 120;
    
    // === MEASUREMENTS & SHAPE DIAGRAM SECTION - LARGER ===
    doc.fontSize(16)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Measurements & Shape Diagram', 40, yPos);
    
    yPos += 30;
    
    // Left side - Dimensions Table - larger
    const dimBoxY = drawCleanBox(doc, 40, yPos, 200, 300, 'Dimensions');
    
    // Table headers - larger
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Dim', 50, dimBoxY)
       .text('Value', 120, dimBoxY);
    
    // Header underline - thicker
    doc.strokeColor('black')
       .lineWidth(1)
       .moveTo(50, dimBoxY + 18)
       .lineTo(230, dimBoxY + 18)
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
    
    // Dimension rows A-G - larger spacing
    const dimensions = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    let rowY = dimBoxY + 30;
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
      
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('black')
         .text(dim, 50, rowY)
         .text(valueText, 120, rowY);
      
      rowY += 20; // More spacing between rows
    });
    
    // Status at bottom - larger
    doc.fontSize(10)
       .font('Helvetica-Oblique')
       .fillColor('black')
       .text(`Status: ${hasValidMeasurements ? 'Verified' : 'Not verified'}`, 50, dimBoxY + 260);
    
    // Right side - Shape Diagram - MUCH LARGER
    const diagramBoxY = drawCleanBox(doc, 260, yPos, 295, 300, 'Shape Diagram');
    
    // Extract diagram number from React data
    let diagramNumber = order.diagramNumber || order.shapeNumber;
    
    console.log('🔍 Attempting to extract diagram number from React...');
    console.log('🔍 Diagram number from React:', diagramNumber);
    
    if (diagramNumber) {
      doc.fontSize(12)
         .font('Helvetica')
         .fillColor('black')
         .text(`Diagram: ${diagramNumber}`, 270, diagramBoxY);
      
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
            // Add MUCH LARGER image
            const imageWidth = 280;
            const imageHeight = 240;
            const imageX = 265;
            const imageY = diagramBoxY + 25;
            
            doc.image(imagePath, imageX, imageY, {
              width: imageWidth,
              height: imageHeight,
              fit: [imageWidth, imageHeight],
              align: 'center'
            });
            imageLoaded = true;
            console.log('🔍 Large image loaded successfully');
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
        // Fallback text if no image found - larger
        doc.fontSize(12)
           .fillColor('black')
           .text(`[Diagram ${diagramNumber} - Image not available]`, 270, diagramBoxY + 80)
           .text('Please refer to technical specifications', 270, diagramBoxY + 120);
      }
    } else {
      console.log('🔍 No diagram number found in React data');
      doc.fontSize(12)
         .fillColor('black')
         .text('No diagram specified', 270, diagramBoxY + 80);
    }
    
    yPos += 320;
    
    // === CUSTOMER NOTES SECTION - LARGER ===
    if (order.notes && order.notes.trim()) {
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .fillColor('black')
         .text('Customer Notes', 40, yPos);
      
      yPos += 30;
      
      const notesBoxY = drawCleanBox(doc, 40, yPos, 515, 80);
      
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('black')
         .text(order.notes, 50, notesBoxY, { width: 495, height: 60 });
      
      yPos += 100;
    }
    
    // === FOOTER SECTION - LARGER ===
    // Ensure footer is at bottom of page but with proper spacing
    if (yPos < 750) {
      yPos = 750;
    }
    
    // Horizontal line above footer - thicker
    doc.strokeColor('black')
       .lineWidth(2)
       .moveTo(40, yPos)
       .lineTo(555, yPos)
       .stroke();
    
    yPos += 15;
    
    // Footer information - LARGER TEXT
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('black')
       .text(`Generated: ${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString('en-GB')}`, 40, yPos)
       .text('Bespoke Mattress Company | Professional Manufacturing Specification', 40, yPos + 15)
       .text('This document contains all specifications required for manufacturing.', 40, yPos + 30);
    
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
    message: 'Larger professional PDF layout ready',
    endpoints: [
      'POST /api/pdf/generate - Generate larger PDF from React component data'
    ],
    timestamp: new Date().toISOString()
  });
});

console.log('📄 PDF routes registered: POST /generate with larger design');

module.exports = router;