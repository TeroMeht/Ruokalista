const { Pool } = require('pg');
require('dotenv').config();

const connectionString = (process.env.DATABASE_URL || '')
  .replace(/^postgres:\/\//, 'postgresql://');

// Enable SSL only when it's actually needed (hosted DBs like Render, Neon,
// Supabase) — local Postgres rejects SSL by default.
function shouldUseSsl(url) {
  if (process.env.PGSSLMODE === 'disable') return false;
  if (process.env.DATABASE_SSL === 'true') return true;
  if (process.env.DATABASE_SSL === 'false') return false;
  if (!url) return false;
  if (/sslmode=require|sslmode=verify/i.test(url)) return true;
  // Any host that isn't localhost/127.0.0.1 is assumed to want SSL.
  try {
    const host = new URL(url).hostname;
    return host && host !== 'localhost' && host !== '127.0.0.1';
  } catch {
    return false;
  }
}

const pool = new Pool({
  connectionString,
  ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : false,
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
