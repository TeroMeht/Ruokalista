const router = require('express').Router();
const db = require('../db');

/*
 * Recipe routes.
 *
 * Each ingredient row has its OWN status (have / need / unchecked) set on the
 * Recipes page. This is independent of the pantry — a recipe can want 1 kg of
 * flour and the user can mark "need" on that recipe even if their pantry has
 * flour listed separately as a household staple.
 *
 * Client sends ingredients as [{ name, qty, status? }].
 * Server upserts a good by case-insensitive name (creating a one-off with
 * is_common=false if it doesn't exist) and stores status on the junction row.
 */

const SELECT_INGREDIENTS = `
  SELECT ri.id, ri.recipe_id, ri.good_id, ri.qty, ri.status, ri.sort_order,
         g.name, g.is_common, g.category_id
    FROM recipe_ingredients ri
    JOIN goods g ON g.id = ri.good_id
   WHERE ri.recipe_id = $1
   ORDER BY ri.sort_order
`;

async function upsertGoodByName(client, rawName) {
  const name = (rawName || '').trim();
  if (!name) return null;
  const existing = await client.query(
    `SELECT id FROM goods WHERE LOWER(TRIM(name)) = LOWER($1)`,
    [name]
  );
  if (existing.rows.length) return existing.rows[0].id;
  const { rows } = await client.query(
    `INSERT INTO goods (name, is_common, status)
     VALUES ($1, false, 'unchecked')
     RETURNING id`,
    [name]
  );
  return rows[0].id;
}

async function writeIngredients(client, recipeId, ingredients) {
  // Save existing statuses so an edit that re-uses the same good keeps its status.
  const existing = await client.query(
    `SELECT good_id, status FROM recipe_ingredients WHERE recipe_id=$1`,
    [recipeId]
  );
  const prevStatus = new Map(existing.rows.map(r => [r.good_id, r.status]));

  await client.query('DELETE FROM recipe_ingredients WHERE recipe_id=$1', [recipeId]);
  const seen = new Set();
  for (let i = 0; i < ingredients.length; i++) {
    const ing = ingredients[i] || {};
    const goodId = await upsertGoodByName(client, ing.name);
    if (!goodId) continue;
    if (seen.has(goodId)) continue;  // UNIQUE(recipe_id, good_id)
    seen.add(goodId);
    const status = ing.status || prevStatus.get(goodId) || 'unchecked';
    await client.query(
      `INSERT INTO recipe_ingredients (recipe_id, good_id, qty, status, sort_order)
       VALUES ($1,$2,$3,$4,$5)`,
      [recipeId, goodId, ing.qty || '', status, i]
    );
  }
}

// GET all recipes with ingredients
router.get('/', async (req, res) => {
  try {
    const recipes = await db.query(
      'SELECT * FROM recipes ORDER BY sort_order, created_at'
    );
    const ings = await db.query(`
      SELECT ri.id, ri.recipe_id, ri.good_id, ri.qty, ri.status, ri.sort_order,
             g.name, g.is_common, g.category_id
        FROM recipe_ingredients ri
        JOIN goods g ON g.id = ri.good_id
       ORDER BY ri.sort_order
    `);
    const result = recipes.rows.map(r => ({
      ...r,
      ingredients: ings.rows.filter(i => i.recipe_id === r.id),
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
    const ings = await db.query(SELECT_INGREDIENTS, [req.params.id]);
    res.json({ ...rows[0], ingredients: ings.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new recipe
router.post('/', async (req, res) => {
  const {
    emoji = '🍽️', name, cook_time = 30, servings = 4, notes = '', ingredients = [],
  } = req.body;
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
    await writeIngredients(client, recipe.id, ingredients);
    await client.query('COMMIT');
    const ingRows = await db.query(SELECT_INGREDIENTS, [recipe.id]);
    res.status(201).json({ ...recipe, ingredients: ingRows.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH partial update — metadata only (name, emoji, cook_time, servings, notes).
// Does NOT touch ingredients; use PUT for that.
router.patch('/:id', async (req, res) => {
  const { emoji, name, cook_time, servings, notes } = req.body;
  try {
    const fields = [];
    const vals = [];
    let i = 1;
    if (emoji !== undefined)     { fields.push(`emoji=$${i++}`);     vals.push(emoji); }
    if (name !== undefined)      { fields.push(`name=$${i++}`);      vals.push(name.trim()); }
    if (cook_time !== undefined) { fields.push(`cook_time=$${i++}`); vals.push(cook_time); }
    if (servings !== undefined)  { fields.push(`servings=$${i++}`);  vals.push(servings); }
    if (notes !== undefined)     { fields.push(`notes=$${i++}`);     vals.push(notes); }
    if (!fields.length) return res.status(400).json({ error: 'nothing to update' });
    vals.push(req.params.id);
    const { rows } = await db.query(
      `UPDATE recipes SET ${fields.join(',')} WHERE id=$${i} RETURNING *`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    const ingRows = await db.query(SELECT_INGREDIENTS, [req.params.id]);
    res.json({ ...rows[0], ingredients: ingRows.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update recipe (replaces ingredients)
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
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'not found' });
    }
    await writeIngredients(client, req.params.id, ingredients);
    await client.query('COMMIT');
    const ingRows = await db.query(SELECT_INGREDIENTS, [req.params.id]);
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

// ── Ingredient-level routes ────────────────────────────────
// PATCH /api/recipes/:rid/ingredients/:id  { status?, qty? }
router.patch('/:rid/ingredients/:id', async (req, res) => {
  const { status, qty } = req.body;
  try {
    const fields = [];
    const vals = [];
    let i = 1;
    if (status !== undefined) { fields.push(`status=$${i++}`); vals.push(status); }
    if (qty !== undefined)    { fields.push(`qty=$${i++}`);    vals.push(qty); }
    if (!fields.length) return res.status(400).json({ error: 'nothing to update' });
    vals.push(req.params.id, req.params.rid);
    const { rows } = await db.query(
      `UPDATE recipe_ingredients
          SET ${fields.join(',')}
        WHERE id=$${i++} AND recipe_id=$${i}
        RETURNING id, recipe_id, good_id, qty, status, sort_order`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    // Include the joined `name` so client can merge cleanly.
    const joined = await db.query(
      `SELECT ri.id, ri.recipe_id, ri.good_id, ri.qty, ri.status, ri.sort_order,
              g.name, g.is_common, g.category_id
         FROM recipe_ingredients ri
         JOIN goods g ON g.id = ri.good_id
        WHERE ri.id=$1`,
      [rows[0].id]
    );
    res.json(joined.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
