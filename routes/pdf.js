const express = require('express');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Helper function to draw bordered boxes
function drawBorderedBox(doc, x, y, width, height, title = null) {
  // Draw border
  doc.rect(x, y, width, height)
     .stroke();
  
  // Add title if provided
  if (title) {
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text(title, x + 5, y + 5);
  }
  
  return y + (title ? 20 : 5); // Return content start position
}

// Helper function to check if image exists
function imageExists(imagePath) {
  try {
    return fs.existsSync(imagePath);
  } catch (error) {
    return false;
  }
}

// Generate PDF for specific order
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
    const orderData = order.order_data;
    
    // Create PDF with professional styling
    const doc = new PDFDocument({
      margin: 40,
      size: 'A4'
    });
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="purchase-order-${order.order_number}.pdf"`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // HEADER SECTION
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Bespoke Mattress Company', 40, 40);
    
    doc.fontSize(12)
       .font('Helvetica')
       .text('Purchase Order & Manufacturing Specification', 40, 65);
    
    // Order number and CONFIRMED badge
    doc.fontSize(12)
       .font('Helvetica')
       .text(`Order: ${order.order_number}`, 40, 85);
    
    // CONFIRMED badge (top right)
    doc.rect(480, 40, 80, 25)
       .stroke();
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('CONFIRMED', 485, 50);
    
    // Horizontal line under header
    doc.moveTo(40, 115)
       .lineTo(555, 115)
       .stroke();
    
    let yPosition = 130;
    
    // ORDER INFORMATION BOX
    const orderBoxHeight = 60;
    const orderBoxY = drawBorderedBox(doc, 40, yPosition, 250, orderBoxHeight, 'Order Information');
    
    doc.fontSize(10)
       .font('Helvetica')
       .text(`Order Number: ${order.order_number}`, 45, orderBoxY + 5)
       .text(`Order ID: ${order.id}`, 45, orderBoxY + 18)
       .text(`Date: ${new Date(order.created_date).toLocaleDateString('en-GB')}`, 45, orderBoxY + 31);
    
    // CUSTOMER INFORMATION BOX
    const customerBoxY = drawBorderedBox(doc, 305, yPosition, 250, orderBoxHeight, 'Customer Information');
    
    doc.fontSize(10)
       .font('Helvetica')
       .text(`Name: ${order.customer_name}`, 310, customerBoxY + 5)
       .text(`Email: ${order.customer_email}`, 310, customerBoxY + 18);
    
    yPosition += orderBoxHeight + 20;
    
    // PRODUCT SPECIFICATION SECTION
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Product Specification', 40, yPosition);
    
    yPosition += 25;
    
    // Product details box
    const productBoxHeight = 100;
    const productBoxY = drawBorderedBox(doc, 40, yPosition, 515, productBoxHeight);
    
    const lineItems = orderData?.order_data?.line_items;
    if (lineItems && lineItems[0]) {
      const product = lineItems[0];
      
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text(`Product: ${product.title}`, 45, productBoxY + 5);
      
      doc.fontSize(10)
         .font('Helvetica')
         .text(`SKU: ${product.sku}`, 45, productBoxY + 22)
         .text(`Variant: ${product.variant_title || 'Standard'}`, 45, productBoxY + 35)
         .text(`Quantity: ${product.quantity}`, 45, productBoxY + 48);
      
      // Extract firmness and other properties
      if (product.properties) {
        const firmnessProp = product.properties.find(p => p.name === 'Firmness');
        if (firmnessProp) {
          doc.text(`Firmness: ${firmnessProp.value}`, 45, productBoxY + 61);
        }
        
        // Manufacturing specification
        const specification = `Product Specification: ${product.title} - ${product.variant_title || 'Standard'}`;
        doc.fontSize(9)
           .text(specification, 45, productBoxY + 76, { width: 500 });
      }
    }
    
    yPosition += productBoxHeight + 30;
    
    // MEASUREMENTS & SHAPE DIAGRAM SECTION
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Measurements & Shape Diagram', 40, yPosition);
    
    yPosition += 25;
    
    // Left side - Dimensions table
    const dimensionsBoxWidth = 180;
    const dimensionsBoxHeight = 200;
    const dimensionsBoxY = drawBorderedBox(doc, 40, yPosition, dimensionsBoxWidth, dimensionsBoxHeight, 'Dimensions');
    
    // Table headers
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Dim', 45, dimensionsBoxY + 10)
       .text('Value', 100, dimensionsBoxY + 10);
    
    // Horizontal line under headers
    doc.moveTo(45, dimensionsBoxY + 25)
       .lineTo(215, dimensionsBoxY + 25)
       .stroke();
    
    // Dimension rows
    const dimensions = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    let rowY = dimensionsBoxY + 35;
    
    const measurements = orderData?.order_data?.extracted_measurements?.[0]?.measurements || {};
    
    dimensions.forEach(dim => {
      const measurement = measurements[dim];
      let valueText = '-';
      
      if (measurement) {
        if (typeof measurement === 'object' && 'value' in measurement) {
          valueText = measurement.unit 
            ? `${measurement.value} ${measurement.unit}`
            : measurement.value;
        } else {
          valueText = String(measurement);
        }
      }
      
      doc.fontSize(10)
         .font('Helvetica')
         .text(dim, 45, rowY)
         .text(valueText, 100, rowY);
      
      rowY += 15;
    });
    
    // Status at bottom of dimensions box
    const hasValidMeasurements = dimensions.some(dim => {
      const measurement = measurements[dim];
      return measurement && (
        (typeof measurement === 'object' && measurement.value) ||
        (typeof measurement === 'string' && measurement.trim())
      );
    });
    
    doc.fontSize(9)
       .font('Helvetica-Oblique')
       .text(`Status: ${hasValidMeasurements ? 'Verified' : 'Not verified'}`, 45, dimensionsBoxY + 170);
    
    // Right side - Shape Diagram
    const diagramBoxWidth = 320;
    const diagramBoxHeight = 200;
    const diagramBoxX = 235;
    const diagramBoxY = drawBorderedBox(doc, diagramBoxX, yPosition, diagramBoxWidth, diagramBoxHeight, 'Shape Diagram');
    
    // Extract diagram number
    let diagramNumber = null;
    if (lineItems && lineItems[0] && lineItems[0].properties) {
      const diagramProp = lineItems[0].properties.find(prop => prop.name === 'Diagram Number');
      diagramNumber = diagramProp ? diagramProp.value : null;
    }
    
    if (diagramNumber) {
      doc.fontSize(10)
         .font('Helvetica')
         .text(`Diagram: ${diagramNumber}`, diagramBoxX + 5, diagramBoxY + 10);
      
      // Try to add diagram image
      const imagePath = path.join(__dirname, '..', 'public', 'images', 'diagrams', `Shape_${diagramNumber}_Caravan_Mattress_Measuring_Diagram.jpg`);
      
      if (imageExists(imagePath)) {
        try {
          // Add image with proper sizing
          const imageWidth = 300;
          const imageHeight = 150;
          const imageX = diagramBoxX + 10;
          const imageY = diagramBoxY + 30;
          
          doc.image(imagePath, imageX, imageY, {
            width: imageWidth,
            height: imageHeight,
            fit: [imageWidth, imageHeight],
            align: 'center'
          });
        } catch (imageError) {
          console.log('Image load error:', imageError);
          // Fallback text if image fails
          doc.fontSize(10)
             .text(`[Diagram ${diagramNumber} - Technical drawing]`, diagramBoxX + 10, diagramBoxY + 50)
             .text('Image file not accessible', diagramBoxX + 10, diagramBoxY + 70);
        }
      } else {
        // No image available
        doc.fontSize(10)
           .text(`[Diagram ${diagramNumber} - Image not available]`, diagramBoxX + 10, diagramBoxY + 50)
           .text('Please refer to technical specifications', diagramBoxX + 10, diagramBoxY + 70);
      }
    } else {
      doc.fontSize(10)
         .text('No diagram specified', diagramBoxX + 10, diagramBoxY + 50);
    }
    
    yPosition += dimensionsBoxHeight + 30;
    
    // CUSTOMER NOTES SECTION (if present)
    if (order.notes && order.notes.trim()) {
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Customer Notes', 40, yPosition);
      
      yPosition += 20;
      
      const notesBoxHeight = 60;
      const notesBoxY = drawBorderedBox(doc, 40, yPosition, 515, notesBoxHeight);
      
      doc.fontSize(10)
         .font('Helvetica')
         .text(order.notes, 45, notesBoxY + 5, { width: 505, height: 50 });
      
      yPosition += notesBoxHeight + 20;
    }
    
    // FOOTER SECTION
    // Add some space before footer
    if (yPosition < 650) {
      yPosition = 650;
    }
    
    // Horizontal line above footer
    doc.moveTo(40, yPosition)
       .lineTo(555, yPosition)
       .stroke();
    
    yPosition += 15;
    
    // Footer information
    doc.fontSize(9)
       .font('Helvetica')
       .text(`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB')}`, 40, yPosition)
       .text('Bespoke Mattress Company | Professional Manufacturing Specification', 40, yPosition + 12)
       .text('This document contains all specifications required for manufacturing.', 40, yPosition + 24);
    
    // Finalize PDF
    doc.end();
    
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'PDF generation failed', details: error.message });
  }
});

// Alternative route for React component
router.post('/generate', async (req, res) => {
  try {
    const { order } = req.body;
    
    if (!order) {
      return res.status(400).json({ error: 'Order data required' });
    }
    
    // Create PDF using the order data from React
    const doc = new PDFDocument({
      margin: 40,
      size: 'A4'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="purchase-order-${order.orderNumber}.pdf"`);
    
    doc.pipe(res);
    
    // HEADER SECTION
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Bespoke Mattress Company', 40, 40);
    
    doc.fontSize(12)
       .font('Helvetica')
       .text('Purchase Order & Manufacturing Specification', 40, 65);
    
    // Order number
    doc.fontSize(12)
       .font('Helvetica')
       .text(`Order: ${order.orderNumber}`, 40, 85);
    
    // CONFIRMED badge (top right)
    doc.rect(480, 40, 80, 25)
       .stroke();
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('CONFIRMED', 485, 50);
    
    // Horizontal line under header
    doc.moveTo(40, 115)
       .lineTo(555, 115)
       .stroke();
    
    let yPosition = 130;
    
    // ORDER INFORMATION BOX
    const orderBoxHeight = 60;
    const orderBoxY = drawBorderedBox(doc, 40, yPosition, 250, orderBoxHeight, 'Order Information');
    
    doc.fontSize(10)
       .font('Helvetica')
       .text(`Order Number: ${order.orderNumber}`, 45, orderBoxY + 5)
       .text(`Order ID: ${order.id}`, 45, orderBoxY + 18)
       .text(`Date: ${order.orderDate}`, 45, orderBoxY + 31);
    
    // CUSTOMER INFORMATION BOX
    const customerBoxY = drawBorderedBox(doc, 305, yPosition, 250, orderBoxHeight, 'Customer Information');
    
    doc.fontSize(10)
       .font('Helvetica')
       .text(`Name: ${order.customer.name}`, 310, customerBoxY + 5)
       .text(`Email: ${order.customer.email}`, 310, customerBoxY + 18);
    
    yPosition += orderBoxHeight + 20;
    
    // PRODUCT SPECIFICATION SECTION
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Product Specification', 40, yPosition);
    
    yPosition += 25;
    
    // Product details box
    const productBoxHeight = 100;
    const productBoxY = drawBorderedBox(doc, 40, yPosition, 515, productBoxHeight);
    
    if (order.lineItems && order.lineItems[0]) {
      const product = order.lineItems[0];
      
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text(`Product: ${product.productTitle}`, 45, productBoxY + 5);
      
      doc.fontSize(10)
         .font('Helvetica')
         .text(`SKU: ${product.sku}`, 45, productBoxY + 22)
         .text(`Quantity: ${product.quantity}`, 45, productBoxY + 35);
      
      // Manufacturing options
      if (order.linkAttachment) {
        doc.text(`Link Attachment: ${order.linkAttachment}`, 45, productBoxY + 48);
      }
      
      if (order.deliveryOption) {
        doc.text(`Delivery: ${order.deliveryOption}`, 45, productBoxY + 61);
      }
    }
    
    yPosition += productBoxHeight + 30;
    
    // MEASUREMENTS & SHAPE DIAGRAM SECTION
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Measurements & Shape Diagram', 40, yPosition);
    
    yPosition += 25;
    
    // Left side - Dimensions table
    const dimensionsBoxWidth = 180;
    const dimensionsBoxHeight = 200;
    const dimensionsBoxY = drawBorderedBox(doc, 40, yPosition, dimensionsBoxWidth, dimensionsBoxHeight, 'Dimensions');
    
    // Table headers
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Dim', 45, dimensionsBoxY + 10)
       .text('Value', 100, dimensionsBoxY + 10);
    
    // Horizontal line under headers
    doc.moveTo(45, dimensionsBoxY + 25)
       .lineTo(215, dimensionsBoxY + 25)
       .stroke();
    
    // Dimension rows from React component
    const dimensions = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    let rowY = dimensionsBoxY + 35;
    
    let hasValues = false;
    
    dimensions.forEach(dim => {
      const value = order.lineItems?.[0]?.properties?.[`Dimension ${dim}`] || '-';
      if (value && value !== '' && value !== '-') {
        hasValues = true;
      }
      
      doc.fontSize(10)
         .font('Helvetica')
         .text(dim, 45, rowY)
         .text(value, 100, rowY);
      
      rowY += 15;
    });
    
    // Status at bottom of dimensions box
    doc.fontSize(9)
       .font('Helvetica-Oblique')
       .text(`Status: ${hasValues ? 'Verified' : 'Not verified'}`, 45, dimensionsBoxY + 170);
    
    // Right side - Shape Diagram
    const diagramBoxWidth = 320;
    const diagramBoxHeight = 200;
    const diagramBoxX = 235;
    const diagramBoxY = drawBorderedBox(doc, diagramBoxX, yPosition, diagramBoxWidth, diagramBoxHeight, 'Shape Diagram');
    
    if (order.diagramNumber) {
      doc.fontSize(10)
         .font('Helvetica')
         .text(`Diagram: ${order.diagramNumber}`, diagramBoxX + 5, diagramBoxY + 10);
      
      // Try to add diagram image
      const imagePath = path.join(__dirname, '..', 'public', 'images', 'diagrams', `Shape_${order.diagramNumber}_Caravan_Mattress_Measuring_Diagram.jpg`);
      
      if (imageExists(imagePath)) {
        try {
          const imageWidth = 300;
          const imageHeight = 150;
          const imageX = diagramBoxX + 10;
          const imageY = diagramBoxY + 30;
          
          doc.image(imagePath, imageX, imageY, {
            width: imageWidth,
            height: imageHeight,
            fit: [imageWidth, imageHeight],
            align: 'center'
          });
        } catch (imageError) {
          doc.fontSize(10)
             .text(`[Diagram ${order.diagramNumber} - Technical drawing]`, diagramBoxX + 10, diagramBoxY + 50)
             .text('Image file not accessible', diagramBoxX + 10, diagramBoxY + 70);
        }
      } else {
        doc.fontSize(10)
           .text(`[Diagram ${order.diagramNumber} - Image not available]`, diagramBoxX + 10, diagramBoxY + 50);
      }
    } else {
      doc.fontSize(10)
         .text('No diagram specified', diagramBoxX + 10, diagramBoxY + 50);
    }
    
    yPosition += dimensionsBoxHeight + 30;
    
    // CUSTOMER NOTES SECTION (if present)
    if (order.notes && order.notes.trim()) {
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Customer Notes', 40, yPosition);
      
      yPosition += 20;
      
      const notesBoxHeight = 60;
      const notesBoxY = drawBorderedBox(doc, 40, yPosition, 515, notesBoxHeight);
      
      doc.fontSize(10)
         .font('Helvetica')
         .text(order.notes, 45, notesBoxY + 5, { width: 505, height: 50 });
      
      yPosition += notesBoxHeight + 20;
    }
    
    // FOOTER SECTION
    if (yPosition < 650) {
      yPosition = 650;
    }
    
    // Horizontal line above footer
    doc.moveTo(40, yPosition)
       .lineTo(555, yPosition)
       .stroke();
    
    yPosition += 15;
    
    // Footer information
    doc.fontSize(9)
       .font('Helvetica')
       .text(`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB')}`, 40, yPosition)
       .text('Bespoke Mattress Company | Professional Manufacturing Specification', 40, yPosition + 12)
       .text('This document contains all specifications required for manufacturing.', 40, yPosition + 24);
    
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
    message: 'Professional PDF routes are working!',
    endpoints: [
      'GET /api/pdf/orders/:id/pdf - Generate PDF for specific order',
      'POST /api/pdf/generate - Generate PDF from React component data'
    ],
    timestamp: new Date().toISOString()
  });
});

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'PDF service operational with professional styling',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;