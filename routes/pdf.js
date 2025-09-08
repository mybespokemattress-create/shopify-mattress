const express = require('express');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const router = express.Router();

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

// Generate PDF for specific order - FIXED LAYOUT
router.get('/orders/:id/pdf', async (req, res) => {
  try {
    const orderId = req.params.id;
    
    // Get order data from database
    const pool = req.app.locals.db;
    const orderQuery = 'SELECT * FROM processed_orders WHERE id = $1';
    const result = await pool.query(orderQuery, [orderId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const order = result.rows[0];
    console.log('Generating PDF for order:', order.order_number);
    
    // Create PDF with A4 dimensions
    const doc = new PDFDocument({
      margin: 40,
      size: 'A4'
    });
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="purchase-order-${order.order_number}.pdf"`);
    
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
       .text(`Order: ${order.order_number}`, 40, 78);
    
    // CONFIRMED badge (top right)
    doc.rect(500, 40, 70, 20).stroke();
    doc.fontSize(9)
       .font('Helvetica-Bold')
       .text('CONFIRMED', 505, 48);
    
    // Horizontal line under header
    doc.moveTo(40, 105)
       .lineTo(555, 105)
       .stroke();
    
    // === ORDER & CUSTOMER INFORMATION BOXES ===
    let yPos = 120;
    
    // Order Information Box (left)
    const orderBoxY = drawCleanBox(doc, 40, yPos, 250, 70, 'Order Information');
    doc.fontSize(9)
       .font('Helvetica')
       .text(`Order Number: ${order.order_number}`, 45, orderBoxY)
       .text(`Order ID: ${order.id}`, 45, orderBoxY + 12)
       .text(`Date: ${new Date(order.created_date).toLocaleDateString('en-GB')}`, 45, orderBoxY + 24);
    
    // Customer Information Box (right)
    const customerBoxY = drawCleanBox(doc, 305, yPos, 250, 70, 'Customer Information');
    doc.fontSize(9)
       .font('Helvetica')
       .text(`Name: ${order.customer_name}`, 310, customerBoxY)
       .text(`Email: ${order.customer_email}`, 310, customerBoxY + 12);
    
    yPos += 85;
    
    // === PRODUCT SPECIFICATION SECTION ===
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('Product Specification', 40, yPos);
    
    yPos += 20;
    
    // Product Box
    const productBoxY = drawCleanBox(doc, 40, yPos, 515, 90);
    
    // Extract product data from order
    const orderData = order.order_data;
    const lineItems = orderData?.order_data?.line_items || orderData?.line_items;
    
    if (lineItems && lineItems[0]) {
      const product = lineItems[0];
      
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text(`Product: ${product.title}`, 45, productBoxY);
      
      doc.fontSize(9)
         .font('Helvetica')
         .text(`SKU: ${product.sku}`, 45, productBoxY + 15)
         .text(`Variant: ${product.variant_title || 'Standard'}`, 45, productBoxY + 27)
         .text(`Quantity: ${product.quantity}`, 45, productBoxY + 39);
      
      // Extract firmness and manufacturing details
      if (product.properties) {
        const firmnessProp = product.properties.find(p => p.name === 'Firmness');
        if (firmnessProp) {
          doc.text(`Firmness: ${firmnessProp.value}`, 45, productBoxY + 51);
        }
      }
      
      // Full specification line
      const specification = `Full specification: ${product.title} - ${product.variant_title || 'Standard'}`;
      doc.fontSize(8)
         .text(specification, 45, productBoxY + 65, { width: 500 });
    }
    
    yPos += 105;
    
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
    
    // Extract measurements from the correct path
    let measurements = {};
    
    // Try multiple possible paths for measurements
    if (order.order_data?.order_data?.extracted_measurements?.[0]?.measurements) {
      measurements = order.order_data.order_data.extracted_measurements[0].measurements;
    } else if (order.extracted_measurements) {
      // Handle JSONB field
      const extractedMeasurements = typeof order.extracted_measurements === 'string' 
        ? JSON.parse(order.extracted_measurements) 
        : order.extracted_measurements;
      measurements = extractedMeasurements?.measurements || extractedMeasurements || {};
    }
    
    console.log('Extracted measurements:', measurements);
    
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
    
    // Extract diagram number
    let diagramNumber = null;
    if (lineItems && lineItems[0] && lineItems[0].properties) {
      const diagramProp = lineItems[0].properties.find(prop => prop.name === 'Diagram Number');
      diagramNumber = diagramProp ? diagramProp.value : null;
    }
    
    if (diagramNumber) {
      doc.fontSize(9)
         .font('Helvetica')
         .text(`Diagram: ${diagramNumber}`, 240, diagramBoxY);
      
      // Try to add diagram image
      const imagePath = path.join(__dirname, '..', 'public', 'images', 'diagrams', `Shape_${diagramNumber}_Caravan_Mattress_Measuring_Diagram.jpg`);
      
      if (imageExists(imagePath)) {
        try {
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
        } catch (imageError) {
          console.log('Image load error:', imageError);
          // Fallback text
          doc.fontSize(9)
             .text(`[Diagram ${diagramNumber} - Technical drawing]`, 245, diagramBoxY + 60)
             .text('Image file not accessible', 245, diagramBoxY + 80);
        }
      } else {
        // No image available - show placeholder
        doc.fontSize(9)
           .text(`[Diagram ${diagramNumber} - Image not available]`, 245, diagramBoxY + 60)
           .text('Please refer to technical specifications', 245, diagramBoxY + 80);
      }
    } else {
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

// Alternative route for React component - SAME CLEAN LAYOUT
router.post('/generate', async (req, res) => {
  console.log('🔍 PDF ROUTE 2: POST /generate - REACT ENDPOINT');
  console.log('🔍 Order data from React:', req.body.order?.orderNumber);
  try {
    const { order } = req.body;
    
    if (!order) {
      return res.status(400).json({ error: 'Order data required' });
    }
    
    console.log('Generating PDF from React for:', order.orderNumber);
    
    // Create PDF using the order data from React
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
       .text('Purchase Order & Manufacturing Specification', 40, 62);
    
    doc.fontSize(11)
       .font('Helvetica')
       .text(`Order: ${order.orderNumber}`, 40, 78);
    
    // CONFIRMED badge
    doc.rect(500, 40, 70, 20).stroke();
    doc.fontSize(9)
       .font('Helvetica-Bold')
       .text('CONFIRMED', 505, 48);
    
    // Header line
    doc.moveTo(40, 105)
       .lineTo(555, 105)
       .stroke();
    
    // === ORDER & CUSTOMER INFO ===
    let yPos = 120;
    
    // Order Information Box
    const orderBoxY = drawCleanBox(doc, 40, yPos, 250, 70, 'Order Information');
    doc.fontSize(9)
       .font('Helvetica')
       .text(`Order Number: ${order.orderNumber}`, 45, orderBoxY)
       .text(`Order ID: ${order.id}`, 45, orderBoxY + 12)
       .text(`Date: ${order.orderDate}`, 45, orderBoxY + 24);
    
    // Customer Information Box
    const customerBoxY = drawCleanBox(doc, 305, yPos, 250, 70, 'Customer Information');
    doc.fontSize(9)
       .font('Helvetica')
       .text(`Name: ${order.customer.name}`, 310, customerBoxY)
       .text(`Email: ${order.customer.email}`, 310, customerBoxY + 12);
    
    yPos += 85;
    
    // === PRODUCT SPECIFICATION ===
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('Product Specification', 40, yPos);
    
    yPos += 20;
    
    const productBoxY = drawCleanBox(doc, 40, yPos, 515, 90);
    
    if (order.lineItems && order.lineItems[0]) {
      const product = order.lineItems[0];
      
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text(`Product: ${product.productTitle}`, 45, productBoxY);
      
      doc.fontSize(9)
         .font('Helvetica')
         .text(`SKU: ${product.sku}`, 45, productBoxY + 15)
         .text(`Quantity: ${product.quantity}`, 45, productBoxY + 27);
      
      if (order.linkAttachment) {
        doc.text(`Link Attachment: ${order.linkAttachment}`, 45, productBoxY + 39);
      }
      
      if (order.deliveryOption) {
        doc.text(`Delivery: ${order.deliveryOption}`, 45, productBoxY + 51);
      }
      
      const specification = `Full specification: ${product.productTitle}`;
      doc.fontSize(8)
         .text(specification, 45, productBoxY + 65, { width: 500 });
    }
    
    yPos += 105;
    
    // === MEASUREMENTS & SHAPE DIAGRAM ===
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('Measurements & Shape Diagram', 40, yPos);
    
    yPos += 20;
    
    // Dimensions Table
    const dimBoxY = drawCleanBox(doc, 40, yPos, 180, 250, 'Dimensions');
    
    doc.fontSize(9)
       .font('Helvetica-Bold')
       .text('Dim', 45, dimBoxY)
       .text('Value', 100, dimBoxY);
    
    doc.moveTo(45, dimBoxY + 12)
       .lineTo(215, dimBoxY + 12)
       .stroke();
    
    // Dimension rows from React component
    const dimensions = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    let rowY = dimBoxY + 20;
    let hasValues = false;
    
    dimensions.forEach(dim => {
      const value = order.lineItems?.[0]?.properties?.[`Dimension ${dim}`] || '-';
      if (value && value !== '' && value !== '-') {
        hasValues = true;
      }
      
      doc.fontSize(9)
         .font('Helvetica')
         .text(dim, 45, rowY)
         .text(value, 100, rowY);
      
      rowY += 14;
    });
    
    doc.fontSize(8)
       .font('Helvetica-Oblique')
       .text(`Status: ${hasValues ? 'Verified' : 'Not verified'}`, 45, dimBoxY + 220);
    
    // Shape Diagram
    const diagramBoxY = drawCleanBox(doc, 235, yPos, 320, 250, 'Shape Diagram');
    
    if (order.diagramNumber) {
      doc.fontSize(9)
         .font('Helvetica')
         .text(`Diagram: ${order.diagramNumber}`, 240, diagramBoxY);
      
      const imagePath = path.join(__dirname, '..', 'public', 'images', 'diagrams', `Shape_${order.diagramNumber}_Caravan_Mattress_Measuring_Diagram.jpg`);
      
      if (imageExists(imagePath)) {
        try {
          doc.image(imagePath, 245, diagramBoxY + 20, {
            width: 300,
            height: 200,
            fit: [300, 200],
            align: 'center'
          });
        } catch (imageError) {
          doc.fontSize(9)
             .text(`[Diagram ${order.diagramNumber} - Technical drawing]`, 245, diagramBoxY + 60);
        }
      } else {
        doc.fontSize(9)
           .text(`[Diagram ${order.diagramNumber} - Image not available]`, 245, diagramBoxY + 60);
      }
    } else {
      doc.fontSize(9)
         .text('No diagram specified', 245, diagramBoxY + 60);
    }
    
    yPos += 265;
    
    // === CUSTOMER NOTES ===
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
    
    // === FOOTER ===
    if (yPos < 750) {
      yPos = 750;
    }
    
    doc.moveTo(40, yPos)
       .lineTo(555, yPos)
       .stroke();
    
    yPos += 10;
    
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
  res.json({
    success: true,
    message: 'Clean professional PDF layout is ready!',
    endpoints: [
      'GET /api/pdf/orders/:id/pdf - Generate PDF for specific order',
      'POST /api/pdf/generate - Generate PDF from React component data'
    ],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;