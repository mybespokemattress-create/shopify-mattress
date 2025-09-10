const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Database initialisation
async function initialize() {
    console.log('🔧 Initialising PostgreSQL database...');
    
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

        // ADD THIS NEW TABLE HERE - OAuth tokens table for storing Zoho authentication
        await pool.query(`
            CREATE TABLE IF NOT EXISTS oauth_tokens (
                id SERIAL PRIMARY KEY,
                provider VARCHAR(50) NOT NULL DEFAULT 'zoho',
                user_identifier VARCHAR(255),
                access_token TEXT NOT NULL,
                refresh_token TEXT NOT NULL,
                token_type VARCHAR(50) DEFAULT 'Bearer',
                expires_at TIMESTAMP,
                api_domain VARCHAR(255),
                user_location VARCHAR(10),
                scope TEXT,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Created oauth_tokens table');
        
        // Create processed_orders table with correct schema
        await pool.query(`
            CREATE TABLE IF NOT EXISTS processed_orders (
                id SERIAL PRIMARY KEY,
                shopify_order_id BIGINT NOT NULL,
                order_number VARCHAR(255) NOT NULL,
                store_domain TEXT NOT NULL,
                customer_email VARCHAR(255),
                customer_name VARCHAR(255),
                total_price DECIMAL(10,2),
                order_data JSONB,
                processing_status TEXT DEFAULT 'received',
                supplier_assigned TEXT,
                supplier_name TEXT,
                supplier_id INTEGER,
                sheet_row_number INTEGER,
                sheets_synced BOOLEAN DEFAULT false,
                sheets_sync_date TIMESTAMP,
                sheets_range TEXT,
                google_sheets_status VARCHAR(50) DEFAULT 'pending',
                google_sheets_error TEXT,
                po_generated BOOLEAN DEFAULT false,
                error_message TEXT,
                sync_error_message TEXT,
                processed_at TIMESTAMP,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		notes TEXT,
		mattress_label TEXT,
		extracted_measurements JSONB
            )
        `);
        console.log('✅ Created processed_orders table with correct schema');

        // Suppliers table for Google Sheets integration
        await pool.query(`
            CREATE TABLE IF NOT EXISTS suppliers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                sheet_id VARCHAR(255) NOT NULL,
                sheet_url TEXT NOT NULL,
                sku_keywords TEXT[] NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create indexes for performance
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_orders_supplier_assigned ON processed_orders(supplier_assigned)
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_orders_google_sheets_status ON processed_orders(google_sheets_status)
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_orders_shopify_order_id ON processed_orders(shopify_order_id)
        `);
        
        // ADD THESE NEW INDEXES HERE - Create indexes for OAuth tokens table
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_oauth_tokens_provider_active ON oauth_tokens(provider, is_active)
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_identifier ON oauth_tokens(user_identifier)
        `);
        
        // Insert store configurations and sample data
        await insertStoreConfigs();
        await insertSampleData();
        await insertSupplierData();
        
        console.log('✅ Database tables created and sample data inserted');
    } catch (error) {
        console.error('Database initialisation error:', error);
        throw error;
    }
}

// REST OF YOUR FILE STAYS THE SAME...
async function insertStoreConfigs() {
    const stores = [
        [process.env.STORE1_DOMAIN, process.env.STORE1_NAME, process.env.STORE1_WEBHOOK_SECRET, process.env.STORE1_ACCESS_TOKEN],
        [process.env.STORE2_DOMAIN, process.env.STORE2_NAME, process.env.STORE2_WEBHOOK_SECRET, process.env.STORE2_ACCESS_TOKEN],
        [process.env.STORE3_DOMAIN, process.env.STORE3_NAME, process.env.STORE3_WEBHOOK_SECRET, process.env.STORE3_ACCESS_TOKEN]
    ];
    
    for (const store of stores) {
        if (store[0]) { // Only insert if domain exists
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

// Insert supplier data for Google Sheets integration
async function insertSupplierData() {
    await pool.query(`
        INSERT INTO suppliers (name, sheet_id, sheet_url, sku_keywords) 
        VALUES 
            ('Southern Production', '1msn3axI6YVuRbHYYf32APoxQPG61zKKlNx6CZR1iO3w', 
             'https://docs.google.com/spreadsheets/d/1msn3axI6YVuRbHYYf32APoxQPG61zKKlNx6CZR1iO3w/', 
             ARRAY['Essential', 'Grand', 'Cool', 'Novo', 'Body']),
            ('Mattressshire Production', '16IssobN0vG-oYEyEW8HgZIOqAsiIO_pTCOt0czmqQJM', 
             'https://docs.google.com/spreadsheets/d/16IssobN0vG-oYEyEW8HgZIOqAsiIO_pTCOt0czmqQJM/', 
             ARRAY['Comfi', 'Imperial'])
        ON CONFLICT (name) DO UPDATE SET
            sheet_id = EXCLUDED.sheet_id,
            sheet_url = EXCLUDED.sheet_url,
            sku_keywords = EXCLUDED.sku_keywords,
            updated_at = CURRENT_TIMESTAMP
    `);
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

// Order operations - COMPLETE implementation for React frontend
const orders = {
    // Create method for webhook processing with correct column names
    create: async (orderData) => {
        // Extract customer name properly
        let customerName = 'Guest Customer';
        if (orderData.customerName) {
            customerName = orderData.customerName;
        } else if (orderData.billing_address) {
            customerName = `${orderData.billing_address.first_name || ''} ${orderData.billing_address.last_name || ''}`.trim();
        } else if (orderData.customer) {
            customerName = `${orderData.customer.first_name || ''} ${orderData.customer.last_name || ''}`.trim();
        }
        
        const result = await pool.query(`
            INSERT INTO processed_orders 
            (shopify_order_id, order_number, store_domain, customer_name, customer_email, 
            total_price, order_data, processing_status, google_sheets_status, notes, mattress_label, extracted_measurements, line_items) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `, [
            orderData.orderId || orderData.id,
            orderData.shopifyOrderNumber || orderData.order_number || orderData.name,
            orderData.storeDomain || orderData.store_domain || orderData.shopDomain,
            customerName,
            orderData.customerEmail || orderData.email,
            orderData.totalPrice || orderData.total_price,
            JSON.stringify(orderData),
            'received',
            'pending',
            orderData.notes || null,
            orderData.mattress_label || null,
            orderData.extracted_measurements ? JSON.stringify(orderData.extracted_measurements) : null,
            orderData.line_items ? JSON.stringify(orderData.line_items) : null
        ]);
        return result.rows[0];
    },

    // Get all orders for React frontend (with proper sorting and status)
    getAllOrders: async (limit = 20) => {
        const result = await pool.query(`
            SELECT 
                o.id,
                o.shopify_order_id,
                o.order_number,
                o.store_domain,
                o.customer_name,
                o.customer_email,
                o.total_price,
                o.order_data,
                o.processing_status,
                o.supplier_assigned,
                o.supplier_name,
                o.supplier_id,
                o.sheet_row_number,
                o.sheets_synced,
                o.sheets_sync_date,
                o.google_sheets_status,
                o.google_sheets_error,
                o.po_generated,
                o.error_message,
                o.processed_at,
                o.created_date,
                o.updated_date,
                s.name as supplier_full_name,
                s.sheet_url as supplier_sheet_url
            FROM processed_orders o
            LEFT JOIN suppliers s ON o.supplier_id = s.id
            ORDER BY o.created_date DESC
            LIMIT $1
        `, [limit]);
        return result.rows;
    },

    // Get order by ID (enhanced version for React frontend)
    getOrderById: async (orderId) => {
        const result = await pool.query(`
            SELECT 
                o.*,
                s.name as supplier_full_name,
                s.sheet_url as supplier_sheet_url,
                s.sku_keywords as supplier_keywords
            FROM processed_orders o
            LEFT JOIN suppliers s ON o.supplier_id = s.id
            WHERE o.id = $1
        `, [orderId]);
        return result.rows[0];
    },

    // Update order (for React frontend editing)
    updateOrder: async (orderId, updateData) => {
        const {
            customer_name,
            customer_email,
            supplier_assigned,
            supplier_name,
            processing_status,
            order_data,
            google_sheets_status,
            error_message
        } = updateData;

        const result = await pool.query(`
            UPDATE processed_orders 
            SET 
                customer_name = COALESCE($2, customer_name),
                customer_email = COALESCE($3, customer_email),
                supplier_assigned = COALESCE($4, supplier_assigned),
                supplier_name = COALESCE($5, supplier_name),
                processing_status = COALESCE($6, processing_status),
                order_data = COALESCE($7::jsonb, order_data),
                google_sheets_status = COALESCE($8, google_sheets_status),
                error_message = COALESCE($9, error_message),
                updated_date = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `, [orderId, customer_name, customer_email, supplier_assigned, supplier_name, 
            processing_status, order_data ? JSON.stringify(order_data) : null, 
            google_sheets_status, error_message]);
        
        return result.rows[0];
    },

    // Search orders (for React frontend search functionality)
    searchOrders: async (searchTerm, limit = 20) => {
        const result = await pool.query(`
            SELECT 
                o.id,
                o.shopify_order_id,
                o.order_number,
                o.store_domain,
                o.customer_name,
                o.customer_email,
                o.total_price,
                o.processing_status,
                o.supplier_assigned,
                o.google_sheets_status,
                o.created_date,
                s.name as supplier_full_name
            FROM processed_orders o
            LEFT JOIN suppliers s ON o.supplier_id = s.id
            WHERE 
                o.order_number ILIKE '%' || $1 || '%' OR
                o.customer_name ILIKE '%' || $1 || '%' OR
                o.customer_email ILIKE '%' || $1 || '%' OR
                o.supplier_assigned ILIKE '%' || $1 || '%'
            ORDER BY o.created_date DESC
            LIMIT $2
        `, [searchTerm, limit]);
        return result.rows;
    },

    // Get order statistics for React frontend dashboard
    getOrderStats: async () => {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_orders,
                COUNT(CASE WHEN processing_status = 'received' THEN 1 END) as pending_orders,
                COUNT(CASE WHEN processing_status = 'processed' THEN 1 END) as processed_orders,
                COUNT(CASE WHEN sheets_synced = true THEN 1 END) as synced_orders,
                COUNT(CASE WHEN po_generated = true THEN 1 END) as po_generated_orders,
                COUNT(CASE WHEN google_sheets_status = 'error' THEN 1 END) as error_orders
            FROM processed_orders
        `);
        return result.rows[0];
    },

    // Update Google Sheets status
    updateGoogleSheetsStatus: async (orderId, supplierId, rowNumber, status, errorMessage = null) => {
        const result = await pool.query(`
            UPDATE processed_orders 
            SET supplier_id = $2, 
                sheet_row_number = $3, 
                google_sheets_status = $4,
                google_sheets_error = $5,
                processed_at = CURRENT_TIMESTAMP,
                updated_date = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `, [orderId, supplierId, rowNumber, status, errorMessage]);
        return result.rows[0];
    },

    // Get orders status for Google Sheets monitoring
    getOrdersStatus: async () => {
        const result = await pool.query(`
            SELECT 
                o.id,
                o.shopify_order_id,
                o.order_number,
                o.customer_email,
                s.name as supplier_name,
                o.sheet_row_number,
                o.google_sheets_status,
                o.google_sheets_error,
                o.processed_at,
                o.created_date
            FROM processed_orders o
            LEFT JOIN suppliers s ON o.supplier_id = s.id
            ORDER BY o.created_date DESC
        `);
        return result.rows;
    },
    
    updateStatus: async (orderId, storeDomain, status, errorMessage = null) => {
        // Handle both internal ID (integer) and Shopify order ID (bigint)
        const isShopifyOrderId = orderId.toString().length > 10;
        
        const result = await pool.query(`
            UPDATE processed_orders 
            SET processing_status = $1, error_message = $2, updated_date = CURRENT_TIMESTAMP 
            WHERE ${isShopifyOrderId ? 'shopify_order_id = $3::bigint' : 'id = $3'}
            RETURNING *
        `, [status, errorMessage, orderId]);
        return result.rows[0];
    },
    
    updateSheetsSync: async (orderId, storeDomain, synced, syncDate = null, sheetRange = null, errorMessage = null) => {
        // Handle both internal ID (integer) and Shopify order ID (bigint)
        const isShopifyOrderId = orderId.toString().length > 10;
        
        const result = await pool.query(`
            UPDATE processed_orders 
            SET sheets_synced = $1, sheets_sync_date = $2, sheets_range = $3, 
                sync_error_message = $4, updated_date = CURRENT_TIMESTAMP 
            WHERE ${isShopifyOrderId ? 'shopify_order_id = $5::bigint' : 'id = $5'}
            RETURNING *
        `, [synced, syncDate, sheetRange, errorMessage, orderId]);
        return result.rows[0];
    },
    
    getRecent: async (limit = 50) => {
    const result = await pool.query(`
        SELECT *, line_items,
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

// Suppliers operations for Google Sheets integration
const suppliers = {
    getAll: async () => {
        const result = await pool.query('SELECT * FROM suppliers ORDER BY id');
        return result.rows;
    },
    
    getById: async (id) => {
        const result = await pool.query('SELECT * FROM suppliers WHERE id = $1', [id]);
        return result.rows[0];
    },
    
    getByName: async (name) => {
        const result = await pool.query('SELECT * FROM suppliers WHERE name = $1', [name]);
        return result.rows[0];
    }
};

module.exports = {
    initialize,
    isHealthy,
    productMappings,
    stores,
    orders,
    suppliers,
    pool
};