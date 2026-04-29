require('dotenv').config();
const { pool } = require('./index');

/*
 * Schema v3 — goods-centric, 2-state status, mandatory categories.
 *
 *   pantry_categories  : display groups for everything on the shopping list
 *   goods              : canonical "thing" — referenced by pantry stock AND recipe ingredients
 *                        Every good MUST belong to a category (NOT NULL).
 *                        is_common=true means it shows on the pantry screen.
 *                        is_common=false is a one-off recipe ingredient (still has a category
 *                        so it can be grouped on the shopping list).
 *                        status is just 'have' or 'need' — no third "unchecked" state.
 *   recipes            : as before
 *   recipe_ingredients : links a recipe to a good (+ recipe-specific qty + status)
 *
 * Shopping list (computed) = common goods with status='need'
 *                          ∪ recipe ingredients with status='need'.
 *
 * If you're upgrading an existing v2 database, run migrate-v3.js instead — it
 * preserves data. This script wipes and recreates from scratch.
 */

const statements = [
  `CREATE EXTENSION IF NOT EXISTS pgcrypto`,

  // Wipe old schema (we chose "wipe and reseed" during design).
  `DROP TABLE IF EXISTS recipe_ingredients CASCADE`,
  `DROP TABLE IF EXISTS recipes            CASCADE`,
  `DROP TABLE IF EXISTS pantry_items       CASCADE`,
  `DROP TABLE IF EXISTS goods              CASCADE`,
  `DROP TABLE IF EXISTS pantry_categories  CASCADE`,

  `CREATE TABLE pantry_categories (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  // category_id is NOT NULL — every good belongs to a category. We use
  // ON DELETE RESTRICT so the API can decide what to do (e.g. reassign to
  // 'Uncategorized') instead of silently nulling out goods.
  `CREATE TABLE goods (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    category_id  UUID NOT NULL REFERENCES pantry_categories(id) ON DELETE RESTRICT,
    qty          TEXT NOT NULL DEFAULT '',
    is_common    BOOLEAN NOT NULL DEFAULT true,
    status       TEXT NOT NULL DEFAULT 'need'
                   CHECK (status IN ('have','need')),
    notes        TEXT NOT NULL DEFAULT '',
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  // Unique canonical name (case-insensitive) — prevents "Milk" and "milk" drift.
  `CREATE UNIQUE INDEX goods_name_ci ON goods (LOWER(TRIM(name)))`,
  `CREATE INDEX idx_goods_category ON goods(category_id)`,
  `CREATE INDEX idx_goods_is_common ON goods(is_common)`,

  `CREATE TABLE recipes (
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

  `CREATE TABLE recipe_ingredients (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id  UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    good_id    UUID NOT NULL REFERENCES goods(id)   ON DELETE RESTRICT,
    qty        TEXT NOT NULL DEFAULT '',
    status     TEXT NOT NULL DEFAULT 'need'
                 CHECK (status IN ('have','need')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE (recipe_id, good_id)
  )`,

  `CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id)`,
  `CREATE INDEX idx_recipe_ingredients_good   ON recipe_ingredients(good_id)`,
  `CREATE INDEX idx_recipe_ingredients_need   ON recipe_ingredients(status) WHERE status = 'need'`,

  `CREATE OR REPLACE FUNCTION update_updated_at()
   RETURNS TRIGGER AS $$
   BEGIN NEW.updated_at = now(); RETURN NEW; END;
   $$ LANGUAGE plpgsql`,

  `DROP TRIGGER IF EXISTS goods_updated_at ON goods`,
  `CREATE TRIGGER goods_updated_at
     BEFORE UPDATE ON goods
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
    console.log('✅ Schema v3 installed (goods, pantry_categories, recipes, recipe_ingredients)');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
