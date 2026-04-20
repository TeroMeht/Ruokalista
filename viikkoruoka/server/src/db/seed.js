require('dotenv').config();
const { pool } = require('./index');

/**
 * Seed data for Viikkoruoka schema v2.
 *
 * Each good has a canonical row. Recipe ingredients reference goods by id.
 * A few one-off ingredients (fresh dill, lemon, etc.) exist as goods with
 * is_common=false so they don't clutter the pantry screen but still make it
 * onto the shopping list when a recipe needs them.
 */

async function seed() {
  console.log('Seeding database with sample data...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── clean slate ────────────────────────────────────────
    await client.query('DELETE FROM recipe_ingredients');
    await client.query('DELETE FROM recipes');
    await client.query('DELETE FROM goods');
    await client.query('DELETE FROM pantry_categories');

    // ── categories ─────────────────────────────────────────
    const catRes = await client.query(`
      INSERT INTO pantry_categories (name, sort_order) VALUES
        ('Dairy & Eggs',    0),
        ('Vegetables',      1),
        ('Meat & Fish',     2),
        ('Pantry Staples',  3),
        ('Herbs & Spices',  4),
        ('Fruit',           5)
      RETURNING id, name
    `);
    const cat = Object.fromEntries(catRes.rows.map(r => [r.name, r.id]));

    // ── goods ──────────────────────────────────────────────
    // [name, category, qty, is_common, status]
    const goods = [
      // Dairy
      ['Milk (3.5%)',     'Dairy & Eggs',   '1 L',     true,  'have'],
      ['Eggs',            'Dairy & Eggs',   '12 pcs',  true,  'need'],
      ['Greek yogurt',    'Dairy & Eggs',   '500 g',   true,  'have'],
      ['Butter',          'Dairy & Eggs',   '200 g',   true,  'need'],
      ['Cheese (gouda)',  'Dairy & Eggs',   '300 g',   true,  'have'],

      // Vegetables
      ['Onions',          'Vegetables',     '1 kg',    true,  'have'],
      ['Garlic',          'Vegetables',     '1 head',  true,  'have'],
      ['Tomatoes',        'Vegetables',     '500 g',   true,  'need'],
      ['Carrots',         'Vegetables',     '3 pcs',   true,  'have'],
      ['Bell peppers',    'Vegetables',     '2 pcs',   true,  'unchecked'],
      ['Broccoli',        'Vegetables',     '300 g',   true,  'need'],

      // Meat & fish
      ['Chicken breast',  'Meat & Fish',    '600 g',   true,  'have'],
      ['Ground beef',     'Meat & Fish',    '400 g',   true,  'need'],
      ['Salmon fillet',   'Meat & Fish',    '400 g',   true,  'unchecked'],

      // Pantry staples
      ['Pasta',           'Pantry Staples', '2 × 500 g', true, 'have'],
      ['Rice',            'Pantry Staples', '1 kg',    true,  'have'],
      ['Olive oil',       'Pantry Staples', '750 ml',  true,  'need'],
      ['Canned tomatoes', 'Pantry Staples', '4 cans',  true,  'have'],
      ['Soy sauce',       'Pantry Staples', '200 ml',  true,  'need'],
      ['Flour',           'Pantry Staples', '1 kg',    true,  'have'],

      // Fruit
      ['Lemon',           'Fruit',          '2 pcs',   true,  'unchecked'],

      // One-off recipe ingredients (is_common = false) — don't show on pantry screen
      ['Fresh dill',      'Herbs & Spices', '',        false, 'unchecked'],
      ['Black pepper',    'Herbs & Spices', '',        false, 'unchecked'],
      ['Salt',            'Herbs & Spices', '',        false, 'unchecked'],
    ];

    const goodIds = {};
    for (let i = 0; i < goods.length; i++) {
      const [name, catName, qty, isCommon, status] = goods[i];
      const { rows } = await client.query(
        `INSERT INTO goods (name, category_id, qty, is_common, status, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name`,
        [name, cat[catName], qty, isCommon, status, i]
      );
      goodIds[name] = rows[0].id;
    }

    // ── recipes + ingredients ──────────────────────────────
    async function insertRecipe({ emoji, name, cook_time, servings, notes, ingredients }) {
      const { rows } = await client.query(
        `INSERT INTO recipes (emoji, name, cook_time, servings, notes, sort_order)
         VALUES ($1,$2,$3,$4,$5,(SELECT COALESCE(MAX(sort_order)+1,0) FROM recipes))
         RETURNING id`,
        [emoji, name, cook_time, servings, notes]
      );
      const recipeId = rows[0].id;
      for (let i = 0; i < ingredients.length; i++) {
        // ingredients entry: [goodName, qty]  OR  [goodName, qty, status]
        const [goodName, qty, status = 'unchecked'] = ingredients[i];
        const goodId = goodIds[goodName];
        if (!goodId) throw new Error(`seed: unknown good "${goodName}"`);
        await client.query(
          `INSERT INTO recipe_ingredients (recipe_id, good_id, qty, status, sort_order)
           VALUES ($1,$2,$3,$4,$5)`,
          [recipeId, goodId, qty, status, i]
        );
      }
    }

    // Bolognese has two ingredients user wants to cook and is missing — good
    // demo data for the shopping list (ground beef + olive oil show up).
    await insertRecipe({
      emoji: '🍝', name: 'Pasta Bolognese', cook_time: 40, servings: 4,
      notes: 'Use good quality canned tomatoes',
      ingredients: [
        ['Pasta',           '500 g',      'have'],
        ['Ground beef',     '400 g',      'need'],
        ['Canned tomatoes', '2 cans',     'have'],
        ['Onions',          '1 pc',       'have'],
        ['Garlic',          '3 cloves',   'have'],
        ['Olive oil',       '3 tbsp',     'need'],
        ['Salt',            'to taste',   'have'],
        ['Black pepper',    'to taste',   'unchecked'],
      ],
    });

    await insertRecipe({
      emoji: '🍲', name: 'Chicken Soup', cook_time: 60, servings: 6,
      notes: 'Great for meal prep',
      ingredients: [
        ['Chicken breast', '600 g'], ['Carrots', '3 pcs'], ['Onions', '2 pcs'],
        ['Garlic', '2 cloves'], ['Rice', '200 g'], ['Salt', 'to taste'],
      ],
    });

    await insertRecipe({
      emoji: '🥗', name: 'Vegetable Stir-fry', cook_time: 20, servings: 2,
      notes: '',
      ingredients: [
        ['Bell peppers', '2 pcs'], ['Broccoli', '300 g'], ['Soy sauce', '3 tbsp'],
        ['Rice', '200 g'], ['Garlic', '2 cloves'], ['Olive oil', '2 tbsp'],
      ],
    });

    await insertRecipe({
      emoji: '🐟', name: 'Baked Salmon', cook_time: 25, servings: 2,
      notes: 'Season with lemon and dill',
      ingredients: [
        ['Salmon fillet', '400 g'], ['Olive oil', '2 tbsp'], ['Garlic', '2 cloves'],
        ['Lemon', '1 pc'], ['Fresh dill', 'small bunch'], ['Salt', 'to taste'],
      ],
    });

    await client.query('COMMIT');
    console.log('✅ Seed data inserted');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
