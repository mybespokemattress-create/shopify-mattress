const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbDir = path.dirname(process.env.DATABASE_PATH || './database/mattress_orders.db');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(process.env.DATABASE_PATH || './database/mattress_orders.db');

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Database initialization
function initialize() {
    console.log('🔧 Initializing database...');
    
    // Store configurations table
    db.exec(`
        CREATE TABLE IF NOT EXISTS store_configs (
            store_domain TEXT PRIMARY KEY,
            store_name TEXT NOT NULL,
            webhook_secret TEXT NOT NULL,
            api_access_token TEXT NOT NULL,
            active BOOLEAN DEFAULT 1,
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Product mappings table (shared across stores)
    db.exec(`
        CREATE TABLE IF NOT EXISTS product_mappings (
            shopify_sku TEXT PRIMARY KEY,
            supplier_specification TEXT NOT NULL,
            shape_id TEXT,
            measurement_diagram_url TEXT,
            applicable_stores TEXT DEFAULT 'all',
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_date DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Shape configurations table
    db.exec(`
        CREATE TABLE IF NOT EXISTS shape_configs (
            shape_id TEXT PRIMARY KEY,
            shape_name TEXT NOT NULL,
            required_dimensions TEXT NOT NULL,
            diagram_filename TEXT,
            notes TEXT,
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Orders processing log
    db.exec(`
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
    `);
    
    // Insert store configurations
    const insertStore = db.prepare(`
        INSERT OR REPLACE INTO store_configs 
        (store_domain, store_name, webhook_secret, api_access_token) 
        VALUES (?, ?, ?, ?)
    `);
    
    // Add your configured stores
    insertStore.run(
        process.env.STORE1_DOMAIN,
        process.env.STORE1_NAME,
        process.env.STORE1_WEBHOOK_SECRET,
        process.env.STORE1_ACCESS_TOKEN
    );
    
    insertStore.run(
        process.env.STORE2_DOMAIN,
        process.env.STORE2_NAME,
        process.env.STORE2_WEBHOOK_SECRET,
        process.env.STORE2_ACCESS_TOKEN
    );
    
    insertStore.run(
        process.env.STORE3_DOMAIN,
        process.env.STORE3_NAME,
        process.env.STORE3_WEBHOOK_SECRET,
        process.env.STORE3_ACCESS_TOKEN
    );
    
    // Add sample product mappings for testing
    const insertMapping = db.prepare(`
        INSERT OR IGNORE INTO product_mappings 
        (shopify_sku, supplier_specification, shape_id) 
        VALUES (?, ?, ?)
    `);
    
    insertMapping.run(
        'NOVOD272',
        '4" 33/175 Blue Base Layer + 4" 30/130 White Middle Layer + 2" RF39/120 Peach Top Layer + Diamond Stem',
        'shape_boat_58'
    );
    
    insertMapping.run(
        'SAMPLE123',
        '6" Standard Foam Core + Diamond Stem',
        'shape_round_54'
    );
    
    // Add sample shape config
    const insertShape = db.prepare(`
        INSERT OR IGNORE INTO shape_configs 
        (shape_id, shape_name, required_dimensions, diagram_filename) 
        VALUES (?, ?, ?, ?)
    `);
    
    insertShape.run(
        'shape_boat_58',
        'Boat Shape 58',
        JSON.stringify(['A', 'B', 'C', 'D', 'E']),
        'boat_58_diagram.jpg'
    );
    
    console.log('✅ Database tables created and sample data inserted');
}

// Health check
function isHealthy() {
    try {
        db.prepare('SELECT 1').get();
        return true;
    } catch (error) {
        console.error('Database health check failed:', error.message);
        return false;
    }
}

// CRUD operations for product mappings
const productMappings = {
    getAll: () => db.prepare('SELECT * FROM product_mappings ORDER BY updated_date DESC').all(),
    
    getByStoreDomain: (domain) => {
        return db.prepare(`
            SELECT * FROM product_mappings 
            WHERE applicable_stores = 'all' 
               OR applicable_stores LIKE '%' || ? || '%'
            ORDER BY updated_date DESC
        `).all(domain);
    },
    
    getBySku: (sku) => db.prepare('SELECT * FROM product_mappings WHERE shopify_sku = ?').get(sku),
    
    create: (sku, specification, shapeId = null, applicableStores = 'all') => {
        return db.prepare(`
            INSERT INTO product_mappings 
            (shopify_sku, supplier_specification, shape_id, applicable_stores, updated_date) 
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(sku, specification, shapeId, applicableStores);
    },
    
    update: (sku, specification, shapeId = null) => {
        return db.prepare(`
            UPDATE product_mappings 
            SET supplier_specification = ?, shape_id = ?, updated_date = CURRENT_TIMESTAMP 
            WHERE shopify_sku = ?
        `).run(specification, shapeId, sku);
    },
    
    delete: (sku) => db.prepare('DELETE FROM product_mappings WHERE shopify_sku = ?').run(sku),
    
    search: (query) => {
        return db.prepare(`
            SELECT * FROM product_mappings 
            WHERE shopify_sku LIKE '%' || ? || '%' 
               OR supplier_specification LIKE '%' || ? || '%'
            ORDER BY updated_date DESC
        `).all(query, query);
    },
    
    getStats: () => {
        const total = db.prepare('SELECT COUNT(*) as count FROM product_mappings').get().count;
        const withShapes = db.prepare('SELECT COUNT(*) as count FROM product_mappings WHERE shape_id IS NOT NULL').get().count;
        return { total, withShapes, percentage: total > 0 ? Math.round((withShapes / total) * 100) : 0 };
    }
};

// Store operations
const stores = {
    getAll: () => db.prepare('SELECT * FROM store_configs WHERE active = 1').all(),
    getByDomain: (domain) => db.prepare('SELECT * FROM store_configs WHERE store_domain = ?').get(domain)
};

// Order operations
const orders = {
    create: (orderData) => {
        return db.prepare(`
            INSERT OR REPLACE INTO processed_orders 
            (order_id, store_domain, shopify_order_number, customer_name, customer_email, processing_status) 
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            orderData.orderId,
            orderData.storeDomain,
            orderData.shopifyOrderNumber,
            orderData.customerName,
            orderData.customerEmail,
            orderData.status || 'received'
        );
    },
    
    updateStatus: (orderId, storeDomain, status, errorMessage = null) => {
        return db.prepare(`
            UPDATE processed_orders 
            SET processing_status = ?, error_message = ?, updated_date = CURRENT_TIMESTAMP 
            WHERE order_id = ? AND store_domain = ?
        `).run(status, errorMessage, orderId, storeDomain);
    },
    
    getRecent: (limit = 50) => {
        return db.prepare(`
            SELECT * FROM processed_orders 
            ORDER BY created_date DESC 
            LIMIT ?
        `).all(limit);
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
