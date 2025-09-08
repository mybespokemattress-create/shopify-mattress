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

// Generate PDF for specific order - GOOD PDF VERSION
router.get('/orders/:id/pdf', async (req, res) => {
  console.log('🔍 PDF ROUTE 1: GET /orders/:id/pdf - DATABASE ENDPOINT');
  console.log('🔍 Order ID requested:', req.params.id);
  
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
    console.log('🔍 Generating PDF for order:', order.order_number);
    
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
    
    // Horizontal line under header
    doc.moveTo(40, 105)
       .lineTo(555, 105)
       .stroke();
    
    // === ORDER INFORMATION BOX (SINGLE BOX) ===
    let yPos = 120;
    
    // Order Information Box (full width)
    const orderBoxY = drawCleanBox(doc, 40, yPos, 515, 50, 'Order Information');
    doc.fontSize(9)
       .font('Helvetica')
       .text(`Order Number: ${order.order_number}`, 45, orderBoxY)
       .text(`Order ID: ${order.id}`, 45, orderBoxY + 12)
       .text(`Date: ${new Date(order.created_date).toLocaleDateString('en-GB')}`, 300, orderBoxY);
    
    yPos += 65;
    
    // === SUPPLIER SPECIFICATION SECTION ===
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('Supplier Specification', 40, yPos);
    
    yPos += 20;
    
    // Supplier Code Box
    const supplierBoxY = drawCleanBox(doc, 40, yPos, 515, 70);
    
    // Extract supplier specification
    let supplierCode = 'Not mapped';
    const orderData = order.order_data;
    const lineItems = orderData?.order_data?.line_items || orderData?.line_items;
    
    if (lineItems && lineItems[0] && lineItems[0].sku) {
      // This would need to be looked up from your product_mappings table
      // For now, showing the SKU until mapping is implemented
      supplierCode = `SKU: ${lineItems[0].sku} (Mapping required)`;
    }
    
    // Extract link attachment from variant title
    let linkAttachment = 'One Piece Mattress No Link Required';
    if (lineItems && lineItems[0] && lineItems[0].variant_title) {
      const variantTitle = lineItems[0].variant_title;
      console.log('🔍 Extracting link attachment from variant:', variantTitle);
      
      if (variantTitle.includes('Leave Bolster Loose')) {
        linkAttachment = 'Leave Bolster Loose';
      } else if (variantTitle.includes('Leave Sections Loose')) {
        linkAttachment = 'Leave Sections Loose';
      } else if (variantTitle.includes('Fabric Link')) {
        linkAttachment = 'Fabric Link (+£40)';
      } else if (variantTitle.includes('Zip-Link')) {
        linkAttachment = 'Zip-Link (+£40)';
      }
    }
    
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
       .text('Rolled and Boxed', 300, supplierBoxY + 50);
    
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
    
    // Extract measurements from the correct path - MULTIPLE FALLBACK PATHS
    let measurements = {};
    
    console.log('🔍 Attempting to extract measurements...');
    console.log('🔍 Full order object keys:', Object.keys(order));
    console.log('🔍 Order data structure:', JSON.stringify(order, null, 2));
    
    // Try multiple possible paths for measurements
    if (order.extracted_measurements) {
      console.log('🔍 Found extracted_measurements field');
      // Handle JSONB field
      const extractedMeasurements = typeof order.extracted_measurements === 'string' 
        ? JSON.parse(order.extracted_measurements) 
        : order.extracted_measurements;
      measurements = extractedMeasurements?.measurements || extractedMeasurements || {};
      console.log('🔍 Parsed measurements from extracted_measurements:', measurements);
    } else if (order.order_data?.order_data?.extracted_measurements?.[0]?.measurements) {
      measurements = order.order_data.order_data.extracted_measurements[0].measurements;
      console.log('🔍 Found measurements in nested order_data:', measurements);
    } else if (order.order_data?.extracted_measurements?.[0]?.measurements) {
      measurements = order.order_data.extracted_measurements[0].measurements;
      console.log('🔍 Found measurements in order_data level:', measurements);
    } else {
      console.log('🔍 No measurements found in any expected location');
      // Try to extract from line item properties as fallback
      if (lineItems && lineItems[0] && lineItems[0].properties) {
        console.log('🔍 Attempting to extract from line item properties');
        const props = lineItems[0].properties;
        ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(dim => {
          const prop = props.find(p => p.name === `Dimension ${dim}` || p.name.includes(`Dimension ${dim}`));
          if (prop && prop.value) {
            measurements[dim] = { value: prop.value, unit: 'cm' };
            console.log(`🔍 Found ${dim}: ${prop.value}`);
          }
        });
      }
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
    
    // Extract diagram number - MULTIPLE FALLBACK PATHS
    let diagramNumber = null;
    
    console.log('🔍 Attempting to extract diagram number...');
    console.log('🔍 Line items found:', lineItems ? lineItems.length : 0);
    
    if (lineItems && lineItems[0] && lineItems[0].properties) {
      console.log('🔍 Line item properties:', lineItems[0].properties);
      const diagramProp = lineItems[0].properties.find(prop => 
        prop.name === 'Diagram Number' || 
        prop.name.toLowerCase().includes('diagram')
      );
      diagramNumber = diagramProp ? diagramProp.value : null;
      console.log('🔍 Found diagram number:', diagramNumber);
    }
    
    if (diagramNumber) {
      doc.fontSize(9)
         .font('Helvetica')
         .text(`Diagram: ${diagramNumber}`, 240, diagramBoxY);
      
      // Try multiple possible image paths
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
           .text(`[Diagram ${diagramNumber} - Image not available]`, 245, diagramBoxY + 60)
           .text('Please refer to technical specifications', 245, diagramBoxY + 80);
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

// FIXED POST ROUTE - COPIED FROM GOOD GET ROUTE
router.post('/generate', async (req, res) => {
  console.log('🔍 PDF ROUTE 2: POST /generate - REACT ENDPOINT');
  console.log('🔍 Order data from React:', req.body.order?.orderNumber);
  
  try {
    const { order } = req.body;
    
    if (!order) {
      return res.status(400).json({ error: 'Order data required' });
    }
    
    console.log('🔍 Generating PDF from React for:', order.orderNumber);
    
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
       .text('Purchase Order & Manufacturing Specification', 40, 62);
    
    doc.fontSize(11)
       .font('Helvetica')
       .text(`Order: ${order.orderNumber}`, 40, 78);
    
    // Horizontal line under header
    doc.moveTo(40, 105)
       .lineTo(555, 105)
       .stroke();
    
    // === ORDER INFORMATION BOX (SINGLE BOX) ===
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
    
    // Extract measurements from React data - FIXED VERSION
    let measurements = {};
    
    console.log('🔍 Attempting to extract measurements from React...');
    
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
    
    // Right side - Shape Diagram - FIXED IMAGE LOADING
    const diagramBoxY = drawCleanBox(doc, 235, yPos, 320, 250, 'Shape Diagram');
    
    // Extract diagram number from React data
    let diagramNumber = order.diagramNumber || order.shapeNumber;
    
    console.log('🔍 Attempting to extract diagram number from React...');
    console.log('🔍 Diagram number from React:', diagramNumber);
    
    if (diagramNumber) {
      doc.fontSize(9)
         .font('Helvetica')
         .text(`Diagram: ${diagramNumber}`, 240, diagramBoxY);
      
      // Try multiple possible image paths - SAME AS GET ROUTE
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
           .text(`[Diagram ${diagramNumber} - Image not available]`, 245, diagramBoxY + 60)
           .text('Please refer to technical specifications', 245, diagramBoxY + 80);
      }
    } else {
      console.log('🔍 No diagram number found in React data');
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
    message: 'Clean professional PDF layout is ready!',
    endpoints: [
      'GET /api/pdf/orders/:id/pdf - Generate PDF for specific order',
      'POST /api/pdf/generate - Generate PDF from React component data'
    ],
    timestamp: new Date().toISOString()
  });
});

console.log('📄 PDF routes registered: GET /orders/:id/pdf and POST /generate');

module.exports = router;