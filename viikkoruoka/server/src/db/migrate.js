require('dotenv').config();
const { pool } = require('./index');

const statements = [
  // Enable UUID generation (needed for gen_random_uuid())
  `CREATE EXTENSION IF NOT EXISTS pgcrypto`,

  `CREATE TABLE IF NOT EXISTS pantry_categories (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS pantry_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES pantry_categories(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    qty         TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'unchecked'
                  CHECK (status IN ('have','need','unchecked')),
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS recipes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    emoji      TEXT NOT NULL DEFAULT '🍽️',
    name       TEXT NOT NULL,
    cook_time  INTEGER NOT NULL DEFAULT 30,
    servings   INTEGER NOT NULL DEFAULT 4,
    notes      TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id  UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    qty        TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,

  `CREATE INDEX IF NOT EXISTS idx_pantry_items_category ON pantry_items(category_id)`,
  `CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id)`,

  `CREATE OR REPLACE FUNCTION update_updated_at()
   RETURNS TRIGGER AS $$
   BEGIN NEW.updated_at = now(); RETURN NEW; END;
   $$ LANGUAGE plpgsql`,

  `DROP TRIGGER IF EXISTS pantry_items_updated_at ON pantry_items`,
  `CREATE TRIGGER pantry_items_updated_at
     BEFORE UPDATE ON pantry_items
     FOR EACH ROW EXECUTE PROCEDURE update_updated_at()`,

  `DROP TRIGGER IF EXISTS recipes_updated_at ON recipes`,
  `CREATE TRIGGER recipes_updated_at
     BEFORE UPDATE ON recipes
     FOR EACH ROW EXECUTE PROCEDURE update_updated_at()`,
];

async function migrate() {
  console.log('Running migrations...');
  const client = await pool.connect();
  try {
    for (const sql of statements) {
      await client.query(sql);
    }
    console.log('✅ All tables created / verified');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();