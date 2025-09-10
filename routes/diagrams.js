// Create new file: routes/diagrams.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Ensure upload directory exists
const uploadDir = './uploads/manual-diagrams/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// File validation function
const validateFile = (file) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('Invalid file type. Only JPG, PNG, and PDF allowed.');
  }
  
  if (file.size > maxSize) {
    throw new Error('File too large. Maximum size is 5MB.');
  }
};

// Storage configuration
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const orderNumber = req.params.id;
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `custom_${orderNumber}_${timestamp}${ext}`);
  }
});

// Multer configuration
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    try {
      validateFile(file);
      cb(null, true);
    } catch (error) {
      cb(error, false);
    }
  }
});

// Check storage space
const checkStorageSpace = async () => {
  try {
    const stats = fs.statSync(uploadDir);
    // Get total size of all files in upload directory
    const files = fs.readdirSync(uploadDir);
    let totalSize = 0;
    
    files.forEach(file => {
      const filePath = path.join(uploadDir, file);
      const fileStats = fs.statSync(filePath);
      totalSize += fileStats.size;
    });
    
    const totalSizeMB = totalSize / (1024 * 1024);
    const limit = 800; // 800MB soft limit (Railway has 1GB)
    const percentage = (totalSizeMB / limit) * 100;
    
    return {
      used: totalSizeMB.toFixed(2) + 'MB',
      limit: limit + 'MB',
      percentage: Math.round(percentage),
      files: files.length
    };
  } catch (error) {
    console.error('Storage check error:', error);
    return { used: '0MB', limit: '1GB', percentage: 0, files: 0 };
  }
};

// Delete file helper
const deleteFile = async (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('Deleted file:', filePath);
    }
  } catch (error) {
    console.error('Error deleting file:', error);
  }
};

// Upload diagram endpoint
router.post('/:id/upload-diagram', upload.single('diagram'), async (req, res) => {
  try {
    // Check storage space before processing
    const storageStatus = await checkStorageSpace();
    if (storageStatus.percentage > 90) {
      return res.status(507).json({ 
        error: 'Storage space insufficient. Please contact support.',
        storage: storageStatus
      });
    }
    
    const orderId = req.params.id;
    const file = req.file;
    const pool = req.app.locals.db;
    
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Remove old diagram if exists
    const existingOrder = await pool.query(
      'SELECT custom_diagram_url FROM processed_orders WHERE id = $1',
      [orderId]
    );
    
    if (existingOrder.rows[0]?.custom_diagram_url) {
      await deleteFile(existingOrder.rows[0].custom_diagram_url);
    }
    
    // Update database
    await pool.query(`
      UPDATE processed_orders 
      SET custom_diagram_url = $1, 
          has_custom_diagram = true,
          diagram_upload_date = CURRENT_TIMESTAMP,
          updated_date = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [file.path, orderId]);
    
    res.json({
      success: true,
      filename: file.filename,
      url: `/uploads/manual-diagrams/${file.filename}`,
      size: file.size,
      storage: storageStatus
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove diagram endpoint
router.delete('/:id/diagram', async (req, res) => {
  try {
    const orderId = req.params.id;
    const pool = req.app.locals.db;
    
    // Get current diagram path
    const result = await pool.query(
      'SELECT custom_diagram_url FROM processed_orders WHERE id = $1',
      [orderId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const diagramUrl = result.rows[0].custom_diagram_url;
    
    // Delete file if exists
    if (diagramUrl) {
      await deleteFile(diagramUrl);
    }
    
    // Update database
    await pool.query(`
      UPDATE processed_orders 
      SET custom_diagram_url = NULL, 
          has_custom_diagram = false,
          diagram_upload_date = NULL,
          updated_date = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [orderId]);
    
    res.json({ success: true, message: 'Diagram removed successfully' });
    
  } catch (error) {
    console.error('Remove diagram error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get storage status
router.get('/storage-status', async (req, res) => {
  try {
    const storageStatus = await checkStorageSpace();
    res.json(storageStatus);
  } catch (error) {
    console.error('Storage status error:', error);
    res.status(500).json({ error: 'Failed to get storage status' });
  }
});

// Serve uploaded files
router.get('/file/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('File serve error:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

module.exports = router;