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

// Shape drawing functions for professional diagrams
function drawShape45(doc, centerX, centerY, width, height) {
  // Shape 45 - Narrow Right Cut
  const startX = centerX - width/2;
  const startY = centerY - height/2;
  
  doc.strokeColor('#0066cc').lineWidth(2);
  
  // Main rectangle
  doc.rect(startX, startY, width * 0.8, height).stroke();
  
  // Right cut section
  doc.moveTo(startX + width * 0.8, startY)
     .lineTo(startX + width, startY + height * 0.3)
     .lineTo(startX + width, startY + height * 0.7)
     .lineTo(startX + width * 0.8, startY + height)
     .stroke();
  
  // Add dimension labels
  doc.fontSize(8).fillColor('#0066cc');
  doc.text('A', centerX - 10, startY - 15);
  doc.text('B', startX - 15, centerY);
  doc.text('C', centerX - 10, startY + height + 5);
  doc.text('D', startX + width + 5, centerY);
}

function drawShape49(doc, centerX, centerY, width, height) {
  // Shape 49 - Narrow Right Cut Out
  const startX = centerX - width/2;
  const startY = centerY - height/2;
  
  doc.strokeColor('#0066cc').lineWidth(2);
  
  // Main rectangle with cut out
  doc.moveTo(startX, startY)
     .lineTo(startX + width * 0.7, startY)
     .lineTo(startX + width * 0.7, startY + height * 0.3)
     .lineTo(startX + width, startY + height * 0.3)
     .lineTo(startX + width, startY + height * 0.7)
     .lineTo(startX + width * 0.7, startY + height * 0.7)
     .lineTo(startX + width * 0.7, startY + height)
     .lineTo(startX, startY + height)
     .lineTo(startX, startY)
     .stroke();
  
  // Add dimension labels
  doc.fontSize(8).fillColor('#0066cc');
  doc.text('A', centerX - 10, startY - 15);
  doc.text('B', startX - 15, centerY);
  doc.text('C', centerX - 10, startY + height + 5);
  doc.text('D', startX + width + 5, centerY);
}

function drawShape48(doc, centerX, centerY, width, height) {
  // Shape 48 - Narrow Left Cut Out
  const startX = centerX - width/2;
  const startY = centerY - height/2;
  
  doc.strokeColor('#0066cc').lineWidth(2);
  
  // Main rectangle with left cut out
  doc.moveTo(startX + width * 0.3, startY)
     .lineTo(startX + width, startY)
     .lineTo(startX + width, startY + height)
     .lineTo(startX + width * 0.3, startY + height)
     .lineTo(startX + width * 0.3, startY + height * 0.7)
     .lineTo(startX, startY + height * 0.7)
     .lineTo(startX, startY + height * 0.3)
     .lineTo(startX + width * 0.3, startY + height * 0.3)
     .lineTo(startX + width * 0.3, startY)
     .stroke();
  
  // Add dimension labels
  doc.fontSize(8).fillColor('#0066cc');
  doc.text('A', centerX - 10, startY - 15);
  doc.text('B', startX - 15, centerY);
  doc.text('C', centerX - 10, startY + height + 5);
  doc.text('D', startX + width + 5, centerY);
}

function drawShape3(doc, centerX, centerY, width, height) {
  // Shape 3 - Island Curved Foot End Bolster
  const startX = centerX - width/2;
  const startY = centerY - height/2;
  
  doc.strokeColor('#0066cc').lineWidth(2);
  
  // Main rectangle
  doc.rect(startX, startY, width * 0.7, height).stroke();
  
  // Curved bolster section
  doc.moveTo(startX + width * 0.7, startY)
     .quadraticCurveTo(startX + width, startY + height * 0.3, startX + width * 0.7, startY + height)
     .stroke();
  
  // Add dimension labels
  doc.fontSize(8).fillColor('#0066cc');
  doc.text('A', centerX - 10, startY - 15);
  doc.text('B', startX - 15, centerY);
  doc.text('C', centerX - 10, startY + height + 5);
  doc.text('D', startX + width + 5, centerY);
}

function drawGenericShape(doc, centerX, centerY, width, height) {
  // Generic rectangle with dimension labels
  const startX = centerX - width/2;
  const startY = centerY - height/2;
  
  doc.strokeColor('#0066cc').lineWidth(2);
  doc.rect(startX, startY, width, height).stroke();
  
  // Add dimension labels
  doc.fontSize(8).fillColor('#0066cc');
  doc.text('A', centerX - 10, startY - 15);
  doc.text('B', startX - 15, centerY);
  doc.text('C', centerX - 10, startY + height + 5);
  doc.text('D', startX + width + 5, centerY);
}

// Professional PDF route for React component
router.post('/generate', async (req, res) => {
  console.log('🔍 PDF ROUTE 2: POST /generate - REACT ENDPOINT');
  console.log('🔍 Order data from React:', req.body.order?.orderNumber);
  
  try {
    const { order } = req.body;
    
    if (!order) {
      return res.status(400).json({ error: 'Order data required' });
    }
    
    console.log('🔍 Generating PROFESSIONAL PDF from React for:', order.orderNumber);
    
    // Create PDF with A4 dimensions
    const doc = new PDFDocument({
      margin: 40,
      size: 'A4'
    });
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="purchase-order-${order.orderNumber}.pdf"`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // === HEADER SECTION ===
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Bespoke Mattress Company', 40, 40);
    
    doc.fontSize(11)
       .font('Helvetica')
       .text('Purchase Order & Manufacturing Specification', 40, 62);
    
    doc.fontSize(11)
       .font('Helvetica')
       .text(`Order: ${order.orderNumber}`, 40, 78);
    
    // Horizontal line under header
    doc.moveTo(40, 105)
       .lineTo(555, 105)
       .stroke();
    
    // === ORDER INFORMATION BOX ===
    let yPos = 120;
    
    // Order Information Box (full width)
    const orderBoxY = drawCleanBox(doc, 40, yPos, 515, 50, 'Order Information');
    doc.fontSize(9)
       .font('Helvetica')
       .text(`Order Number: ${order.orderNumber}`, 45, orderBoxY)
       .text(`Order ID: ${order.id}`, 45, orderBoxY + 12)
       .text(`Date: ${order.orderDate}`, 300, orderBoxY);
    
    yPos += 65;
    
    // === SUPPLIER SPECIFICATION SECTION ===
    doc.fontSize(12)
       .font('Helvetica-Bold')
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
       .text('Supplier Code:', 45, supplierBoxY);
    
    doc.fontSize(9)
       .font('Helvetica')
       .text(supplierCode, 45, supplierBoxY + 15);
    
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Link Attachment:', 45, supplierBoxY + 35);
    
    doc.fontSize(9)
       .font('Helvetica')
       .text(linkAttachment, 45, supplierBoxY + 50);
    
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Delivery:', 300, supplierBoxY + 35);
    
    doc.fontSize(9)
       .font('Helvetica')
       .text(order.deliveryOption || 'Rolled and Boxed', 300, supplierBoxY + 50);
    
    yPos += 85;
    
    // === MEASUREMENTS & SHAPE DIAGRAM SECTION ===
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('Measurements & Shape Diagram', 40, yPos);
    
    yPos += 20;
    
    // Left side - Dimensions Table
    const dimBoxY = drawCleanBox(doc, 40, yPos, 180, 250, 'Dimensions');
    
    // Table headers
    doc.fontSize(9)
       .font('Helvetica-Bold')
       .text('Dim', 45, dimBoxY)
       .text('Value', 100, dimBoxY);
    
    // Header underline
    doc.moveTo(45, dimBoxY + 12)
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
         .text(dim, 45, rowY)
         .text(valueText, 100, rowY);
      
      rowY += 14;
    });
    
    // Status at bottom
    doc.fontSize(8)
       .font('Helvetica-Oblique')
       .text(`Status: ${hasValidMeasurements ? 'Verified' : 'Not verified'}`, 45, dimBoxY + 220);
    
    // Right side - Shape Diagram
    const diagramBoxY = drawCleanBox(doc, 235, yPos, 320, 250, 'Shape Diagram');
    
    // Extract diagram number from React data
    let diagramNumber = order.diagramNumber || order.shapeNumber;
    
    console.log('🔍 Diagram number from React:', diagramNumber);
    
    if (diagramNumber) {
      doc.fontSize(9)
         .font('Helvetica')
         .text(`Diagram: ${diagramNumber}`, 240, diagramBoxY);
      
      // Draw the shape diagram based on diagram number
      if (diagramNumber == '45') {
        // Draw shape 45 - narrow right cut
        drawShape45(doc, 395, diagramBoxY + 120, 200, 150);
      } else if (diagramNumber == '49') {
        // Draw shape 49 - narrow right cut out
        drawShape49(doc, 395, diagramBoxY + 120, 200, 150);
      } else if (diagramNumber == '48') {
        // Draw shape 48 - narrow left cut out
        drawShape48(doc, 395, diagramBoxY + 120, 200, 150);
      } else if (diagramNumber == '3') {
        // Draw shape 3 - island curved foot end bolster
        drawShape3(doc, 395, diagramBoxY + 120, 200, 150);
      } else {
        // Generic rectangle with labels
        drawGenericShape(doc, 395, diagramBoxY + 120, 200, 150);
      }
    } else {
      console.log('🔍 No diagram number found');
      doc.fontSize(9)
         .text('No diagram specified', 245, diagramBoxY + 60);
    }
    
    yPos += 265;
    
    // === CUSTOMER NOTES SECTION (if present) ===
    if (order.notes && order.notes.trim()) {
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('Customer Notes', 40, yPos);
      
      yPos += 20;
      
      const notesBoxY = drawCleanBox(doc, 40, yPos, 515, 50);
      
      doc.fontSize(9)
         .font('Helvetica')
         .text(order.notes, 45, notesBoxY, { width: 505, height: 40 });
      
      yPos += 65;
    }
    
    // === FOOTER SECTION ===
    // Ensure footer is at bottom of page
    if (yPos < 750) {
      yPos = 750;
    }
    
    // Horizontal line above footer
    doc.moveTo(40, yPos)
       .lineTo(555, yPos)
       .stroke();
    
    yPos += 10;
    
    // Footer information
    doc.fontSize(8)
       .font('Helvetica')
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
    message: 'Professional PDF layout with shape diagrams ready!',
    endpoints: [
      'POST /api/pdf/generate - Generate PDF from React component data'
    ],
    timestamp: new Date().toISOString()
  });
});

console.log('📄 PDF routes registered: POST /generate');

module.exports = router;