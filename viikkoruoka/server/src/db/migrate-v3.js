// Resolve .env relative to this file (server/.env) so the script works no
// matter what cwd it's invoked from.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set.');
  console.error('   Looked for .env at:', path.join(__dirname, '../../.env'));
  console.error('   Make sure server/.env exists and contains DATABASE_URL=...');
  process.exit(1);
}

const { pool } = require('./index');

/*
 * Schema v3 — in-place upgrade from v2.
 *
 * Changes:
 *   1. Drop the 'unchecked' status — every item is now either 'have' or 'need'.
 *      Existing 'unchecked' rows migrate to 'need' (assume the user is "listing"
 *      it as something to think about → put it on the shopping list).
 *   2. Categories are required on every good. We create a fallback
 *      'Uncategorized' bucket and assign any category-less goods to it, then
 *      enforce NOT NULL.
 *
 * This script is non-destructive: it preserves all data. It's safe to run
 * against a v2 database that already has goods/recipes/etc.
 */

const statements = [
  // ── 1. Ensure an 'Uncategorized' fallback category exists ────
  `INSERT INTO pantry_categories (name, sort_order)
     SELECT 'Uncategorized',
            COALESCE((SELECT MAX(sort_order) + 1 FROM pantry_categories), 0)
     WHERE NOT EXISTS (
       SELECT 1 FROM pantry_categories WHERE LOWER(name) = 'uncategorized'
     )`,

  // Reassign all NULL category_id goods to that bucket.
  `UPDATE goods
      SET category_id = (
        SELECT id FROM pantry_categories
         WHERE LOWER(name) = 'uncategorized'
         LIMIT 1
      )
    WHERE category_id IS NULL`,

  // ── 2. Migrate 'unchecked' → 'need' on goods + recipe_ingredients ──
  // We must drop the CHECK constraints first because they still forbid
  // anything outside ('have','need','unchecked'), but we'll re-add tighter
  // constraints below.
  `ALTER TABLE goods DROP CONSTRAINT IF EXISTS goods_status_check`,
  `ALTER TABLE recipe_ingredients DROP CONSTRAINT IF EXISTS recipe_ingredients_status_check`,

  `UPDATE goods              SET status = 'need' WHERE status = 'unchecked'`,
  `UPDATE recipe_ingredients SET status = 'need' WHERE status = 'unchecked'`,

  `ALTER TABLE goods
     ADD CONSTRAINT goods_status_check
     CHECK (status IN ('have','need'))`,

  `ALTER TABLE recipe_ingredients
     ADD CONSTRAINT recipe_ingredients_status_check
     CHECK (status IN ('have','need'))`,

  // ── 3. Make goods.category_id NOT NULL ───────────────────────
  // (At this point every row has a non-null value thanks to step 1.)
  `ALTER TABLE goods ALTER COLUMN category_id SET NOT NULL`,
];

async function migrate() {
  console.log('Running v3 migration (in-place upgrade)...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const sql of statements) {
      console.log('  •', sql.trim().split('\n')[0].slice(0, 80));
      await client.query(sql);
    }
    await client.query('COMMIT');
    console.log('✅ v3 migration complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
