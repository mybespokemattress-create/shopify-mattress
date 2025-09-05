const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const db = require('../database/db');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Admin Dashboard
router.get('/', async (req, res) => {
    try {
        const mappingStats = await db.productMappings.getStats();
        const recentOrders = await db.orders.getRecent(10);
        const stores = await db.stores.getAll();
        
        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            mappingStats,
            recentOrders,
            stores,
            storeConfigs: req.app.locals.storeConfigs
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).render('error', { error: error.message });
    }
});

// Product Mappings List
router.get('/mappings', async (req, res) => {
    try {
        const search = req.query.search || '';
        const mappings = search 
            ? await db.productMappings.search(search)
            : await db.productMappings.getAll();
        
        res.render('admin/mappings', {
            title: 'Product Mappings',
            mappings,
            search,
            stats: await db.productMappings.getStats()
        });
    } catch (error) {
        console.error('Mappings list error:', error);
        res.status(500).render('error', { error: error.message });
    }
});

// Add New Mapping - GET form
router.get('/mappings/add', (req, res) => {
    res.render('admin/mapping-form', {
        title: 'Add Product Mapping',
        mapping: null,
        action: '/admin/mappings/add'
    });
});

// Add New Mapping - POST
router.post('/mappings/add', async (req, res) => {
    try {
        const { shopify_sku, supplier_specification, shape_id, applicable_stores } = req.body;
        
        if (!shopify_sku || !supplier_specification) {
            return res.status(400).render('admin/mapping-form', {
                title: 'Add Product Mapping',
                mapping: req.body,
                action: '/admin/mappings/add',
                error: 'SKU and supplier specification are required'
            });
        }
        
        await db.productMappings.create(
            shopify_sku.trim(),
            supplier_specification.trim(),
            shape_id || null,
            applicable_stores || 'all'
        );
        
        res.redirect('/admin/mappings?success=added');
    } catch (error) {
        console.error('Add mapping error:', error);
        res.status(500).render('admin/mapping-form', {
            title: 'Add Product Mapping',
            mapping: req.body,
            action: '/admin/mappings/add',
            error: error.message
        });
    }
});

// Edit Mapping - GET form
router.get('/mappings/edit/:sku', async (req, res) => {
    try {
        const mapping = await db.productMappings.getBySku(req.params.sku);
        if (!mapping) {
            return res.status(404).render('error', { error: 'Mapping not found' });
        }
        
        res.render('admin/mapping-form', {
            title: 'Edit Product Mapping',
            mapping,
            action: `/admin/mappings/edit/${req.params.sku}`
        });
    } catch (error) {
        console.error('Edit mapping error:', error);
        res.status(500).render('error', { error: error.message });
    }
});

// Edit Mapping - POST
router.post('/mappings/edit/:sku', async (req, res) => {
    try {
        const { supplier_specification, shape_id } = req.body;
        
        if (!supplier_specification) {
            const mapping = await db.productMappings.getBySku(req.params.sku);
            return res.status(400).render('admin/mapping-form', {
                title: 'Edit Product Mapping',
                mapping: { ...mapping, ...req.body },
                action: `/admin/mappings/edit/${req.params.sku}`,
                error: 'Supplier specification is required'
            });
        }
        
        await db.productMappings.update(
            req.params.sku,
            supplier_specification.trim(),
            shape_id || null
        );
        
        res.redirect('/admin/mappings?success=updated');
    } catch (error) {
        console.error('Update mapping error:', error);
        const mapping = await db.productMappings.getBySku(req.params.sku);
        res.status(500).render('admin/mapping-form', {
            title: 'Edit Product Mapping',
            mapping: { ...mapping, ...req.body },
            action: `/admin/mappings/edit/${req.params.sku}`,
            error: error.message
        });
    }
});

// Delete Mapping
router.post('/mappings/delete/:sku', async (req, res) => {
    try {
        await db.productMappings.delete(req.params.sku);
        res.redirect('/admin/mappings?success=deleted');
    } catch (error) {
        console.error('Delete mapping error:', error);
        res.redirect('/admin/mappings?error=' + encodeURIComponent(error.message));
    }
});

// CSV Upload Page
router.get('/upload', (req, res) => {
    res.render('admin/upload', {
        title: 'Bulk Upload Mappings'
    });
});

// CSV Upload Processing
router.post('/upload', upload.single('csvfile'), (req, res) => {
    if (!req.file) {
        return res.status(400).render('admin/upload', {
            title: 'Bulk Upload Mappings',
            error: 'Please select a CSV file'
        });
    }
    
    const results = [];
    const errors = [];
    let rowCount = 0;
    
    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => {
            rowCount++;
            try {
                // Validate required fields
                if (!data.shopify_sku || !data.supplier_specification) {
                    errors.push(`Row ${rowCount}: Missing required fields`);
                    return;
                }
                
                // Clean data
                const cleanData = {
                    shopify_sku: data.shopify_sku.trim(),
                    supplier_specification: data.supplier_specification.trim(),
                    shape_id: data.shape_id?.trim() || null,
                    applicable_stores: data.applicable_stores?.trim() || 'all'
                };
                
                results.push(cleanData);
            } catch (error) {
                errors.push(`Row ${rowCount}: ${error.message}`);
            }
        })
        .on('end', async () => {
            // Clean up uploaded file
            fs.unlinkSync(req.file.path);
            
            if (errors.length > 0) {
                return res.render('admin/upload', {
                    title: 'Bulk Upload Mappings',
                    error: 'CSV parsing errors',
                    errors,
                    processed: results.length
                });
            }
            
            // Insert valid records
            let successful = 0;
            let failed = 0;
            
            for (const mapping of results) {
                try {
                    await db.productMappings.create(
                        mapping.shopify_sku,
                        mapping.supplier_specification,
                        mapping.shape_id,
                        mapping.applicable_stores
                    );
                    successful++;
                } catch (error) {
                    failed++;
                    errors.push(`SKU ${mapping.shopify_sku}: ${error.message}`);
                }
            }
            
            res.render('admin/upload', {
                title: 'Bulk Upload Mappings',
                success: `Successfully imported ${successful} mappings`,
                errors: failed > 0 ? errors : null,
                stats: { total: results.length, successful, failed }
            });
        })
        .on('error', (error) => {
            // Clean up uploaded file
            fs.unlinkSync(req.file.path);
            res.status(500).render('admin/upload', {
                title: 'Bulk Upload Mappings',
                error: 'Failed to process CSV: ' + error.message
            });
        });
});

// Download CSV Template
router.get('/download-template', (req, res) => {
    const csvContent = 'shopify_sku,supplier_specification,shape_id,applicable_stores\n' +
                      'EXAMPLE123,"6inch Standard Foam + Diamond Stem",shape_boat_58,all\n' +
                      'SAMPLE456,"4inch Blue Base + White Middle + Peach Top",shape_round_54,all';
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="product_mappings_template.csv"');
    res.send(csvContent);
});

// Stores Management
router.get('/stores', async (req, res) => {
    try {
        const stores = await db.stores.getAll();
        res.render('admin/stores', {
            title: 'Store Management',
            stores,
            storeConfigs: req.app.locals.storeConfigs
        });
    } catch (error) {
        console.error('Stores error:', error);
        res.status(500).render('error', { error: error.message });
    }
});

// Orders List
router.get('/orders', async (req, res) => {
    try {
        const orders = await db.orders.getRecent(100);
        res.render('admin/orders', {
            title: 'Recent Orders',
            orders
        });
    } catch (error) {
        console.error('Orders error:', error);
        res.status(500).render('error', { error: error.message });
    }
});

module.exports = router;