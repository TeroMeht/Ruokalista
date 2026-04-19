const router = require('express').Router();
const db = require('../db');

// GET all recipes with ingredients
router.get('/', async (req, res) => {
  try {
    const recipes = await db.query('SELECT * FROM recipes ORDER BY sort_order, created_at');
    const ings = await db.query('SELECT * FROM recipe_ingredients ORDER BY sort_order');
    const result = recipes.rows.map(r => ({
      ...r,
      ingredients: ings.rows.filter(i => i.recipe_id === r.id)
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single recipe
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM recipes WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    const ings = await db.query(
      'SELECT * FROM recipe_ingredients WHERE recipe_id=$1 ORDER BY sort_order',
      [req.params.id]
    );
    res.json({ ...rows[0], ingredients: ings.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new recipe
router.post('/', async (req, res) => {
  const { emoji = '🍽️', name, cook_time = 30, servings = 4, notes = '', ingredients = [] } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO recipes (emoji, name, cook_time, servings, notes, sort_order)
       VALUES ($1,$2,$3,$4,$5,(SELECT COALESCE(MAX(sort_order)+1,0) FROM recipes))
       RETURNING *`,
      [emoji, name.trim(), cook_time, servings, notes]
    );
    const recipe = rows[0];
    for (let i = 0; i < ingredients.length; i++) {
      const ing = ingredients[i];
      if (!ing.name?.trim()) continue;
      await client.query(
        'INSERT INTO recipe_ingredients (recipe_id, name, qty, sort_order) VALUES ($1,$2,$3,$4)',
        [recipe.id, ing.name.trim(), ing.qty || '', i]
      );
    }
    await client.query('COMMIT');
    const ingRows = await db.query(
      'SELECT * FROM recipe_ingredients WHERE recipe_id=$1 ORDER BY sort_order',
      [recipe.id]
    );
    res.status(201).json({ ...recipe, ingredients: ingRows.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT update recipe
router.put('/:id', async (req, res) => {
  const { emoji, name, cook_time, servings, notes, ingredients = [] } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE recipes SET emoji=$1, name=$2, cook_time=$3, servings=$4, notes=$5
       WHERE id=$6 RETURNING *`,
      [emoji, name.trim(), cook_time, servings, notes, req.params.id]
    );
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }); }
    await client.query('DELETE FROM recipe_ingredients WHERE recipe_id=$1', [req.params.id]);
    for (let i = 0; i < ingredients.length; i++) {
      const ing = ingredients[i];
      if (!ing.name?.trim()) continue;
      await client.query(
        'INSERT INTO recipe_ingredients (recipe_id, name, qty, sort_order) VALUES ($1,$2,$3,$4)',
        [req.params.id, ing.name.trim(), ing.qty || '', i]
      );
    }
    await client.query('COMMIT');
    const ingRows = await db.query(
      'SELECT * FROM recipe_ingredients WHERE recipe_id=$1 ORDER BY sort_order',
      [req.params.id]
    );
    res.json({ ...rows[0], ingredients: ingRows.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE recipe
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM recipes WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
