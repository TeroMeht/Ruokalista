require('dotenv').config();
const { pool } = require('./index');

async function seed() {
  console.log('Seeding database with sample data...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Clear existing data
    await client.query('DELETE FROM recipe_ingredients');
    await client.query('DELETE FROM recipes');
    await client.query('DELETE FROM pantry_items');
    await client.query('DELETE FROM pantry_categories');

    // Categories
    const cats = await client.query(`
      INSERT INTO pantry_categories (name, sort_order) VALUES
        ('Dairy & Eggs', 0),
        ('Vegetables',   1),
        ('Meat & Fish',  2),
        ('Pantry Staples', 3)
      RETURNING id, name
    `);
    const catMap = Object.fromEntries(cats.rows.map(r => [r.name, r.id]));

    // Pantry items
    await client.query(`
      INSERT INTO pantry_items (category_id, name, qty, status, sort_order) VALUES
        ($1,'Milk (3.5%)','1 L','have',0),
        ($1,'Eggs','12 pcs','need',1),
        ($1,'Greek yogurt','500 g','have',2),
        ($1,'Butter','200 g','need',3),
        ($1,'Cheese (gouda)','300 g','have',4),
        ($2,'Onions','1 kg','have',0),
        ($2,'Garlic','1 head','have',1),
        ($2,'Tomatoes','500 g','need',2),
        ($2,'Carrots','3 pcs','have',3),
        ($2,'Bell peppers','2 pcs','unchecked',4),
        ($2,'Broccoli','300 g','need',5),
        ($3,'Chicken breast','600 g','have',0),
        ($3,'Ground beef','400 g','need',1),
        ($3,'Salmon fillet','400 g','unchecked',2),
        ($4,'Pasta','2 × 500 g','have',0),
        ($4,'Rice','1 kg','have',1),
        ($4,'Olive oil','750 ml','need',2),
        ($4,'Canned tomatoes','4 cans','have',3),
        ($4,'Soy sauce','200 ml','need',4),
        ($4,'Flour','1 kg','have',5)
    `, [catMap['Dairy & Eggs'], catMap['Vegetables'], catMap['Meat & Fish'], catMap['Pantry Staples']]);

    // Recipes
    const r1 = await client.query(`
      INSERT INTO recipes (emoji, name, cook_time, servings, notes) VALUES
        ('🍝','Pasta Bolognese',40,4,'Use good quality canned tomatoes')
      RETURNING id
    `);
    await client.query(`
      INSERT INTO recipe_ingredients (recipe_id, name, qty, sort_order) VALUES
        ($1,'Pasta','500 g',0),($1,'Ground beef','400 g',1),
        ($1,'Tomatoes','500 g',2),($1,'Onions','1 pc',3),
        ($1,'Garlic','3 cloves',4),($1,'Olive oil','3 tbsp',5)
    `, [r1.rows[0].id]);

    const r2 = await client.query(`
      INSERT INTO recipes (emoji, name, cook_time, servings, notes) VALUES
        ('🍲','Chicken Soup',60,6,'Great for meal prep')
      RETURNING id
    `);
    await client.query(`
      INSERT INTO recipe_ingredients (recipe_id, name, qty, sort_order) VALUES
        ($1,'Chicken breast','600 g',0),($1,'Carrots','3 pcs',1),
        ($1,'Onions','2 pcs',2),($1,'Garlic','2 cloves',3),
        ($1,'Rice','200 g',4)
    `, [r2.rows[0].id]);

    const r3 = await client.query(`
      INSERT INTO recipes (emoji, name, cook_time, servings, notes) VALUES
        ('🥗','Vegetable Stir-fry',20,2,'')
      RETURNING id
    `);
    await client.query(`
      INSERT INTO recipe_ingredients (recipe_id, name, qty, sort_order) VALUES
        ($1,'Bell peppers','2 pcs',0),($1,'Broccoli','300 g',1),
        ($1,'Soy sauce','3 tbsp',2),($1,'Rice','200 g',3),
        ($1,'Garlic','2 cloves',4),($1,'Olive oil','2 tbsp',5)
    `, [r3.rows[0].id]);

    const r4 = await client.query(`
      INSERT INTO recipes (emoji, name, cook_time, servings, notes) VALUES
        ('🐟','Baked Salmon',25,2,'Season with lemon and dill')
      RETURNING id
    `);
    await client.query(`
      INSERT INTO recipe_ingredients (recipe_id, name, qty, sort_order) VALUES
        ($1,'Salmon fillet','400 g',0),
        ($1,'Olive oil','2 tbsp',1),
        ($1,'Garlic','2 cloves',2)
    `, [r4.rows[0].id]);

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
