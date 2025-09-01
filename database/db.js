const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbDir = path.dirname(process.env.DATABASE_PATH || './database/mattress_orders.db');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(process.env.DATABASE_PATH || './database/mattress_orders.db');

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Database initialization
function initialize() {
    return new Promise((resolve, reject) => {
        console.log('🔧 Initializing database...');
        
        // Store configurations table
        db.run(`
            CREATE TABLE IF NOT EXISTS store_configs (
                store_domain TEXT PRIMARY KEY,
                store_name TEXT NOT NULL,
                webhook_secret TEXT NOT NULL,
                api_access_token TEXT NOT NULL,
                active BOOLEAN DEFAULT 1,
                created_date DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) return reject(err);
            
            // Product mappings table (shared across stores)
            db.run(`
                CREATE TABLE IF NOT EXISTS product_mappings (
                    shopify_sku TEXT PRIMARY KEY,
                    supplier_specification TEXT NOT NULL,
                    shape_id TEXT,
                    measurement_diagram_url TEXT,
                    applicable_stores TEXT DEFAULT 'all',
                    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_date DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) return reject(err);
                
                // Shape configurations table
                db.run(`
                    CREATE TABLE IF NOT EXISTS shape_configs (
                        shape_id TEXT PRIMARY KEY,
                        shape_name TEXT NOT NULL,
                        required_dimensions TEXT NOT NULL,
                        diagram_filename TEXT,
                        notes TEXT,
                        created_date DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) return reject(err);
                    
                    // Orders processing log
                    db.run(`
                        CREATE TABLE IF NOT EXISTS processed_orders (
                            order_id TEXT,
                            store_domain TEXT,
                            shopify_order_number TEXT NOT NULL,
                            customer_name TEXT,
                            customer_email TEXT,
                            processing_status TEXT DEFAULT 'received',
                            sheets_updated BOOLEAN DEFAULT 0,
                            po_generated BOOLEAN DEFAULT 0,
                            error_message TEXT,
                            created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                            PRIMARY KEY (order_id, store_domain)
                        )
                    `, (err) => {
                        if (err) return reject(err);
                        
                        // Insert store configurations
                        insertStoreConfigs(resolve, reject);
                    });
                });
            });
        });
    });
}

function insertStoreConfigs(resolve, reject) {
    const stores = [
        [
            process.env.STORE1_DOMAIN,
            process.env.STORE1_NAME,
            process.env.STORE1_WEBHOOK_SECRET,
            process.env.STORE1_ACCESS_TOKEN
        ],
        [
            process.env.STORE2_DOMAIN,
            process.env.STORE2_NAME,
            process.env.STORE2_WEBHOOK_SECRET,
            process.env.STORE2_ACCESS_TOKEN
        ],
        [
            process.env.STORE3_DOMAIN,
            process.env.STORE3_NAME,
            process.env.STORE3_WEBHOOK_SECRET,
            process.env.STORE3_ACCESS_TOKEN
        ]
    ];
    
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO store_configs 
        (store_domain, store_name, webhook_secret, api_access_token) 
        VALUES (?, ?, ?, ?)
    `);
    
    let completed = 0;
    stores.forEach(store => {
        stmt.run(store, (err) => {
            if (err) return reject(err);
            completed++;
            if (completed === stores.length) {
                stmt.finalize();
                insertSampleData(resolve, reject);
            }
        });
    });
}

function insertSampleData(resolve, reject) {
    // Add sample product mappings for testing
    const mappings = [
        ['NOVOD272', '4" 33/175 Blue Base Layer + 4" 30/130 White Middle Layer + 2" RF39/120 Peach Top Layer + Diamond Stem', 'shape_boat_58'],
        ['SAMPLE123', '6" Standard Foam Core + Diamond Stem', 'shape_round_54']
    ];
    
    const mappingStmt = db.prepare(`
        INSERT OR IGNORE INTO product_mappings 
        (shopify_sku, supplier_specification, shape_id) 
        VALUES (?, ?, ?)
    `);
    
    let mappingCompleted = 0;
    mappings.forEach(mapping => {
        mappingStmt.run(mapping, (err) => {
            if (err) return reject(err);
            mappingCompleted++;
            if (mappingCompleted === mappings.length) {
                mappingStmt.finalize();
                
                // Add sample shape config
                db.run(`
                    INSERT OR IGNORE INTO shape_configs 
                    (shape_id, shape_name, required_dimensions, diagram_filename) 
                    VALUES (?, ?, ?, ?)
                `, [
                    'shape_boat_58',
                    'Boat Shape 58',
                    JSON.stringify(['A', 'B', 'C', 'D', 'E']),
                    'boat_58_diagram.jpg'
                ], (err) => {
                    if (err) return reject(err);
                    console.log('✅ Database tables created and sample data inserted');
                    resolve();
                });
            }
        });
    });
}

// Health check
function isHealthy() {
    return new Promise((resolve) => {
        db.get('SELECT 1', (err) => {
            if (err) {
                console.error('Database health check failed:', err.message);
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}

// CRUD operations for product mappings
const productMappings = {
    getAll: () => {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM product_mappings ORDER BY updated_date DESC', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },
    
    getByStoreDomain: (domain) => {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT * FROM product_mappings 
                WHERE applicable_stores = 'all' 
                   OR applicable_stores LIKE '%' || ? || '%'
                ORDER BY updated_date DESC
            `, [domain], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },
    
    getBySku: (sku) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM product_mappings WHERE shopify_sku = ?', [sku], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },
    
    create: (sku, specification, shapeId = null, applicableStores = 'all') => {
        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO product_mappings 
                (shopify_sku, supplier_specification, shape_id, applicable_stores, updated_date) 
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [sku, specification, shapeId, applicableStores], function(err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    },
    
    update: (sku, specification, shapeId = null) => {
        return new Promise((resolve, reject) => {
            db.run(`
                UPDATE product_mappings 
                SET supplier_specification = ?, shape_id = ?, updated_date = CURRENT_TIMESTAMP 
                WHERE shopify_sku = ?
            `, [specification, shapeId, sku], function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
    },
    
    delete: (sku) => {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM product_mappings WHERE shopify_sku = ?', [sku], function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
    },
    
    search: (query) => {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT * FROM product_mappings 
                WHERE shopify_sku LIKE '%' || ? || '%' 
                   OR supplier_specification LIKE '%' || ? || '%'
                ORDER BY updated_date DESC
            `, [query, query], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },
    
    getStats: () => {
        return new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM product_mappings', (err, totalRow) => {
                if (err) return reject(err);
                
                db.get('SELECT COUNT(*) as count FROM product_mappings WHERE shape_id IS NOT NULL', (err, shapesRow) => {
                    if (err) return reject(err);
                    
                    const total = totalRow.count;
                    const withShapes = shapesRow.count;
                    const percentage = total > 0 ? Math.round((withShapes / total) * 100) : 0;
                    
                    resolve({ total, withShapes, percentage });
                });
            });
        });
    }
};

// Store operations
const stores = {
    getAll: () => {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM store_configs WHERE active = 1', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },
    
    getByDomain: (domain) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM store_configs WHERE store_domain = ?', [domain], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
};

// Order operations
const orders = {
    create: (orderData) => {
        return new Promise((resolve, reject) => {
            db.run(`
                INSERT OR REPLACE INTO processed_orders 
                (order_id, store_domain, shopify_order_number, customer_name, customer_email, processing_status) 
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                orderData.orderId,
                orderData.storeDomain,
                orderData.shopifyOrderNumber,
                orderData.customerName,
                orderData.customerEmail,
                orderData.status || 'received'
            ], function(err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    },
    
    updateStatus: (orderId, storeDomain, status, errorMessage = null) => {
        return new Promise((resolve, reject) => {
            db.run(`
                UPDATE processed_orders 
                SET processing_status = ?, error_message = ?, updated_date = CURRENT_TIMESTAMP 
                WHERE order_id = ? AND store_domain = ?
            `, [status, errorMessage, orderId, storeDomain], function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
    },
    
    getRecent: (limit = 50) => {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT * FROM processed_orders 
                ORDER BY created_date DESC 
                LIMIT ?
            `, [limit], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
};

module.exports = {
    initialize,
    isHealthy,
    productMappings,
    stores,
    orders,
    db // Raw database access if needed
};