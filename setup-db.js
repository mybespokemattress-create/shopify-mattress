const { Pool } = require('pg');
require('dotenv').config();

async function setupDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Add missing columns
    await pool.query('ALTER TABLE processed_orders ADD COLUMN IF NOT EXISTS notes TEXT');
    await pool.query('ALTER TABLE processed_orders ADD COLUMN IF NOT EXISTS mattress_label VARCHAR(50)');
    
    console.log('Database setup completed successfully');
  } catch (error) {
    console.error('Database setup failed:', error);
  } finally {
    await pool.end();
  }
}

setupDatabase();