require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function addMissingColumns() {
    try {
        console.log('Adding missing columns...');
        
        await pool.query(`
            ALTER TABLE processed_orders 
            ADD COLUMN IF NOT EXISTS extracted_measurements JSONB
        `);
        
        console.log('✅ extracted_measurements column added successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error adding column:', error.message);
        process.exit(1);
    }
}

addMissingColumns();