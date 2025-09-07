const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrate() {
    try {
        console.log('Running database migration...');
        
        // Add missing columns
        await pool.query(`
            ALTER TABLE processed_orders 
            ADD COLUMN IF NOT EXISTS extracted_measurements JSONB
        `);
        
        console.log('Migration completed successfully');
        
        // Test by creating a simple order
        const testResult = await pool.query(`
            INSERT INTO processed_orders 
            (shopify_order_id, order_number, store_domain, customer_name, customer_email, 
             total_price, order_data, processing_status, google_sheets_status, notes, mattress_label, extracted_measurements) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id
        `, [999999, '#TEST-MIGRATION', 'test.com', 'Test User', 'test@test.com', 0, '{}', 'received', 'pending', 'Test note', 'Test Label', '{}']);
        
        console.log('Test insert successful, order ID:', testResult.rows[0].id);
        
    } catch (error) {
        console.error('Migration failed:', error.message);
    }
    
    process.exit(0);
}

if (require.main === module) {
    migrate();
}