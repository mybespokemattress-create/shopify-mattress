const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Database initialization
async function initialize() {
    console.log('🔧 Initializing PostgreSQL database...');
    
    try {
        // Store configurations table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS store_configs (
                store_domain TEXT PRIMARY KEY,
                store_name TEXT NOT NULL,
                webhook_secret TEXT NOT NULL,
                api_access_token TEXT NOT NULL,
                active BOOLEAN DEFAULT true,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Product mappings table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS product_mappings (
                shopify_sku TEXT PRIMARY KEY,
                supplier_specification TEXT NOT NULL,
                shape_id TEXT,
                measurement_diagram_url TEXT,
                applicable_stores TEXT DEFAULT 'all',
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Shape configurations table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS shape_configs (
                shape_id TEXT PRIMARY KEY,
                shape_name TEXT NOT NULL,
                required_dimensions TEXT NOT NULL,
                diagram_filename TEXT,
                notes TEXT,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Orders processing log with Google Sheets integration
        await pool.query(`
            CREATE TABLE IF NOT EXISTS processed_orders (
                order_id TEXT,
                store_domain TEXT,
                shopify_order_number TEXT NOT NULL,
                customer_name TEXT,
                customer_email TEXT,
                processing_status TEXT DEFAULT 'received',
                supplier_assigned TEXT,
                supplier_name TEXT,
                sheets_updated BOOLEAN DEFAULT false,
                sheets_synced BOOLEAN DEFAULT false,
                sheets_sync_date TIMESTAMP,
                sheets_range TEXT,
                po_generated BOOLEAN DEFAULT false,
                error_message TEXT,
                sync_error_message TEXT,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (order_id, store_domain)
            )
        `);
        
        // Insert store configurations
        await insertStoreConfigs();
        await insertSampleData();
        
        console.log('✅ Database tables created and sample data inserted');
    } catch (error) {
        console.error('Database initialization error:', error);
        throw error;
    }
}

async function insertStoreConfigs() {
    const stores = [
        [process.env.STORE1_DOMAIN, process.env.STORE1_NAME, process.env.STORE1_WEBHOOK_SECRET, process.env.STORE1_ACCESS_TOKEN],
        [process.env.STORE2_DOMAIN, process.env.STORE2_NAME, process.env.STORE2_WEBHOOK_SECRET, process.env.STORE2_ACCESS_TOKEN],
        [process.env.STORE3_DOMAIN, process.env.STORE3_NAME, process.env.STORE3_WEBHOOK_SECRET, process.env.STORE3_ACCESS_TOKEN]
    ];
    
    for (const store of stores) {
        await pool.query(`
            INSERT INTO store_configs (store_domain, store_name, webhook_secret, api_access_token) 
            VALUES ($1, $2, $3, $4) 
            ON CONFLICT (store_domain) DO UPDATE SET
                store_name = EXCLUDED.store_name,
                webhook_secret = EXCLUDED.webhook_secret,
                api_access_token = EXCLUDED.api_access_token
        `, store);
    }
}

async function insertSampleData() {
    const mappings = [
        ['NOVOD272', '4" 33/175 Blue Base Layer + 4" 30/130 White Middle Layer + 2" RF39/120 Peach Top Layer + Diamond Stem', 'shape_boat_58'],
        ['SAMPLE123', '6" Standard Foam Core + Diamond Stem', 'shape_round_54']
    ];
    
    for (const mapping of mappings) {
        await pool.query(`
            INSERT INTO product_mappings (shopify_sku, supplier_specification, shape_id) 
            VALUES ($1, $2, $3) 
            ON CONFLICT (shopify_sku) DO NOTHING
        `, mapping);
    }
    
    // Add sample shape config
    await pool.query(`
        INSERT INTO shape_configs (shape_id, shape_name, required_dimensions, diagram_filename) 
        VALUES ($1, $2, $3, $4) 
        ON CONFLICT (shape_id) DO NOTHING
    `, ['shape_boat_58', 'Boat Shape 58', JSON.stringify(['A', 'B', 'C', 'D', 'E']), 'boat_58_diagram.jpg']);
}

// Health check
async function isHealthy() {
    try {
        await pool.query('SELECT 1');
        return true;
    } catch (error) {
        console.error('Database health check failed:', error.message);
        return false;
    }
}

// CRUD operations for product mappings
const productMappings = {
    getAll: async () => {
        const result = await pool.query('SELECT * FROM product_mappings ORDER BY updated_date DESC');
        return result.rows;
    },
    
    getByStoreDomain: async (domain) => {
        const result = await pool.query(`
            SELECT * FROM product_mappings 
            WHERE applicable_stores = 'all' 
               OR applicable_stores LIKE '%' || $1 || '%'
            ORDER BY updated_date DESC
        `, [domain]);
        return result.rows;
    },
    
    getBySku: async (sku) => {
        const result = await pool.query('SELECT * FROM product_mappings WHERE shopify_sku = $1', [sku]);
        return result.rows[0];
    },
    
    create: async (sku, specification, shapeId = null, applicableStores = 'all') => {
        const result = await pool.query(`
            INSERT INTO product_mappings 
            (shopify_sku, supplier_specification, shape_id, applicable_stores, updated_date) 
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            RETURNING *
        `, [sku, specification, shapeId, applicableStores]);
        return result.rows[0];
    },
    
    update: async (sku, specification, shapeId = null) => {
        const result = await pool.query(`
            UPDATE product_mappings 
            SET supplier_specification = $1, shape_id = $2, updated_date = CURRENT_TIMESTAMP 
            WHERE shopify_sku = $3
            RETURNING *
        `, [specification, shapeId, sku]);
        return result.rows[0];
    },
    
    delete: async (sku) => {
        const result = await pool.query('DELETE FROM product_mappings WHERE shopify_sku = $1', [sku]);
        return { changes: result.rowCount };
    },
    
    search: async (query) => {
        const result = await pool.query(`
            SELECT * FROM product_mappings 
            WHERE shopify_sku ILIKE '%' || $1 || '%' 
               OR supplier_specification ILIKE '%' || $1 || '%'
            ORDER BY updated_date DESC
        `, [query]);
        return result.rows;
    },
    
    getStats: async () => {
        const totalResult = await pool.query('SELECT COUNT(*) as count FROM product_mappings');
        const shapesResult = await pool.query('SELECT COUNT(*) as count FROM product_mappings WHERE shape_id IS NOT NULL');
        
        const total = parseInt(totalResult.rows[0].count);
        const withShapes = parseInt(shapesResult.rows[0].count);
        const percentage = total > 0 ? Math.round((withShapes / total) * 100) : 0;
        
        return { total, withShapes, percentage };
    }
};

// Store operations
const stores = {
    getAll: async () => {
        const result = await pool.query('SELECT * FROM store_configs WHERE active = true');
        return result.rows;
    },
    
    getByDomain: async (domain) => {
        const result = await pool.query('SELECT * FROM store_configs WHERE store_domain = $1', [domain]);
        return result.rows[0];
    }
};

// Order operations with Google Sheets integration
const orders = {
    create: async (orderData) => {
        const result = await pool.query(`
            INSERT INTO processed_orders 
            (order_id, store_domain, shopify_order_number, customer_name, customer_email, 
             processing_status, supplier_assigned, supplier_name) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (order_id, store_domain) DO UPDATE SET
                shopify_order_number = EXCLUDED.shopify_order_number,
                customer_name = EXCLUDED.customer_name,
                customer_email = EXCLUDED.customer_email,
                processing_status = EXCLUDED.processing_status,
                supplier_assigned = EXCLUDED.supplier_assigned,
                supplier_name = EXCLUDED.supplier_name,
                updated_date = CURRENT_TIMESTAMP
            RETURNING *
        `, [
            orderData.orderId,
            orderData.storeDomain,
            orderData.shopifyOrderNumber,
            orderData.customerName,
            orderData.customerEmail,
            orderData.status || 'received',
            orderData.supplierAssigned || null,
            orderData.supplierName || null
        ]);
        return result.rows[0];
    },
    
    updateStatus: async (orderId, storeDomain, status, errorMessage = null) => {
        const result = await pool.query(`
            UPDATE processed_orders 
            SET processing_status = $1, error_message = $2, updated_date = CURRENT_TIMESTAMP 
            WHERE order_id = $3 AND store_domain = $4
            RETURNING *
        `, [status, errorMessage, orderId, storeDomain]);
        return result.rows[0];
    },
    
    updateSheetsSync: async (orderId, storeDomain, synced, syncDate = null, sheetRange = null, errorMessage = null) => {
        const result = await pool.query(`
            UPDATE processed_orders 
            SET sheets_synced = $1, sheets_sync_date = $2, sheets_range = $3, 
                sync_error_message = $4, updated_date = CURRENT_TIMESTAMP 
            WHERE order_id = $5 AND store_domain = $6
            RETURNING *
        `, [synced, syncDate, sheetRange, errorMessage, orderId, storeDomain]);
        return result.rows[0];
    },
    
    getRecent: async (limit = 50) => {
        const result = await pool.query(`
            SELECT *, 
                   CASE WHEN supplier_assigned IS NOT NULL THEN true ELSE false END as has_supplier,
                   CASE WHEN sheets_synced = true THEN true ELSE false END as synced_to_sheets
            FROM processed_orders 
            ORDER BY created_date DESC 
            LIMIT $1
        `, [limit]);
        return result.rows;
    },

    getBySupplier: async (supplierKey) => {
        const result = await pool.query(`
            SELECT * FROM processed_orders 
            WHERE supplier_assigned = $1 
            ORDER BY created_date DESC
        `, [supplierKey]);
        return result.rows;
    },

    getUnassigned: async () => {
        const result = await pool.query(`
            SELECT * FROM processed_orders 
            WHERE supplier_assigned IS NULL 
            ORDER BY created_date DESC
        `);
        return result.rows;
    },

    getUnsyncedToSheets: async () => {
        const result = await pool.query(`
            SELECT * FROM processed_orders 
            WHERE supplier_assigned IS NOT NULL 
            AND (sheets_synced = false OR sheets_synced IS NULL)
            ORDER BY created_date DESC
        `);
        return result.rows;
    }
};

module.exports = {
    initialize,
    isHealthy,
    productMappings,
    stores,
    orders,
    pool // Raw database access if needed
};