require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkColumns() {
    try {
        console.log('Connecting to database...');
        
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'processed_orders' 
            ORDER BY ordinal_position
        `);
        
        console.log('\n=== CURRENT processed_orders TABLE COLUMNS ===');
        console.log('Total columns found:', result.rows.length);
        console.log('');
        
        if (result.rows.length === 0) {
            console.log('❌ No columns found - table may not exist yet');
        } else {
            result.rows.forEach((row, index) => {
                const nullable = row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
                const defaultVal = row.column_default ? ` DEFAULT ${row.column_default}` : '';
                console.log(`${index + 1}. ${row.column_name} (${row.data_type}) ${nullable}${defaultVal}`);
            });
        }
        
        console.log('\n=== CHECKING FOR REQUIRED COLUMNS ===');
        const requiredColumns = [
            'supplier_assigned',
            'supplier_name', 
            'notes',
            'mattress_label',
            'sheets_synced',
            'sheets_sync_date',
            'sheets_range',
            'extracted_measurements'
        ];
        
        const existingColumns = result.rows.map(row => row.column_name);
        const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
        
        if (missingColumns.length === 0) {
            console.log('✅ All required columns exist!');
        } else {
            console.log('❌ Missing columns:');
            missingColumns.forEach(col => {
                console.log(`   - ${col}`);
            });
            console.log('\nYou need to add these columns to your database.');
        }
        
        await pool.end();
        
    } catch (error) {
        console.error('❌ Error connecting to database:', error.message);
        console.error('Make sure your DATABASE_URL is set correctly in .env');
        await pool.end();
    }
}

checkColumns();