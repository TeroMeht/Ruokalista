const { Pool } = require('pg');
require('dotenv').config();

const connectionString = (process.env.DATABASE_URL || '')
  .replace(/^postgres:\/\//, 'postgresql://');

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err.message);
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  if (process.env.NODE_ENV === 'development') {
    const duration = Date.now() - start;
    console.log(`[db] ${duration}ms — ${text.slice(0, 60).replace(/\s+/g, ' ')}`);
  }
  return res;
}

async function testConnection() {
  try {
    await pool.query('SELECT 1');
    console.log('✅ Database connected');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    console.error('   Check DATABASE_URL in your .env file');
    process.exit(1);
  }
}

module.exports = { query, pool, testConnection };
