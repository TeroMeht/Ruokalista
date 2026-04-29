const router = require('express').Router();
const db = require('../db');

/*
 * Pantry routes operate on *common goods* (goods.is_common = true).
 * Response shape is kept compatible with the existing client:
 *   GET /categories → [{id, name, sort_order, items: [{id, name, qty, status, category_id, ...}]}]
 *
 * Schema v3 invariants enforced here:
 *   • status is always 'have' or 'need' (no 'unchecked')
 *   • category_id is required on every item
 */

const VALID_STATUS = new Set(['have', 'need']);

function badStatus(s) {
  return s !== undefined && !VALID_STATUS.has(s);
}

// ── Categories ───────────────────────────────────────────────
router.get('/categories', async (req, res) => {
  try {
    const cats = await db.query(
      'SELECT * FROM pantry_categories ORDER BY sort_order, created_at'
    );
    // Only common goods show on the pantry screen.
    const goods = await db.query(`
      SELECT id, name, category_id, qty, status, sort_order, created_at, updated_at
      FROM goods
      WHERE is_common = true
      ORDER BY sort_order, created_at
    `);
    const result = cats.rows.map(cat => ({
      ...cat,
      items: goods.rows.filter(g => g.category_id === cat.id),
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/categories', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  try {
    const { rows } = await db.query(
      `INSERT INTO pantry_categories (name, sort_order)
       VALUES ($1, (SELECT COALESCE(MAX(sort_order)+1,0) FROM pantry_categories))
       RETURNING *`,
      [name.trim()]
    );
    res.status(201).json({ ...rows[0], items: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /categories/:id — rename a category.
router.patch('/categories/:id', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  try {
    const { rows } = await db.query(
      `UPDATE pantry_categories SET name=$1 WHERE id=$2 RETURNING *`,
      [name.trim(), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /categories/:id — cascade-delete the category and its items.
//
// Goods used by recipes can't be hard-deleted (recipe_ingredients FK is
// RESTRICT and we'd break the recipe). For those, we keep the good but
// reassign it to 'Uncategorized' and flip is_common=false so it stops
// appearing on the pantry screen. For pantry-only goods we delete outright.
router.delete('/categories/:id', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Find or create an 'Uncategorized' fallback for orphaned recipe goods.
    const fallback = await client.query(
      `INSERT INTO pantry_categories (name, sort_order)
         SELECT 'Uncategorized',
                COALESCE((SELECT MAX(sort_order)+1 FROM pantry_categories), 0)
         WHERE NOT EXISTS (
           SELECT 1 FROM pantry_categories WHERE LOWER(name) = 'uncategorized'
         )
         RETURNING id`
    );
    const fallbackId = fallback.rows.length
      ? fallback.rows[0].id
      : (await client.query(
          `SELECT id FROM pantry_categories WHERE LOWER(name) = 'uncategorized' LIMIT 1`
        )).rows[0].id;

    if (req.params.id === fallbackId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "Can't delete 'Uncategorized'" });
    }

    // Goods in this category that are referenced by any recipe → keep but reassign.
    await client.query(
      `UPDATE goods
          SET category_id = $1,
              is_common  = false
        WHERE category_id = $2
          AND id IN (SELECT good_id FROM recipe_ingredients)`,
      [fallbackId, req.params.id]
    );

    // Goods in this category that are NOT referenced anywhere → hard delete.
    await client.query(
      `DELETE FROM goods
        WHERE category_id = $1
          AND id NOT IN (SELECT good_id FROM recipe_ingredients)`,
      [req.params.id]
    );

    // Now safe to delete the category itself.
    await client.query('DELETE FROM pantry_categories WHERE id=$1', [req.params.id]);

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── Items (= common goods) ───────────────────────────────────
router.post('/items', async (req, res) => {
  const { category_id, name, qty = '', status = 'need' } = req.body;
  if (!category_id || !name?.trim()) {
    return res.status(400).json({ error: 'category_id and name required' });
  }
  if (badStatus(status)) {
    return res.status(400).json({ error: "status must be 'have' or 'need'" });
  }
  try {
    // Upsert by case-insensitive name: if a good already exists (maybe as a
    // recipe-only ingredient), flip it to is_common=true and set category/qty/status.
    const trimmed = name.trim();
    const existing = await db.query(
      `SELECT id FROM goods WHERE LOWER(TRIM(name)) = LOWER($1)`,
      [trimmed]
    );
    let row;
    if (existing.rows.length) {
      const { rows } = await db.query(
        `UPDATE goods
           SET category_id=$1, qty=$2, status=$3, is_common=true, name=$4
         WHERE id=$5
         RETURNING id, name, category_id, qty, status, sort_order, created_at, updated_at`,
        [category_id, qty, status, trimmed, existing.rows[0].id]
      );
      row = rows[0];
    } else {
      const { rows } = await db.query(
        `INSERT INTO goods (category_id, name, qty, status, is_common, sort_order)
         VALUES ($1,$2,$3,$4,true,
           (SELECT COALESCE(MAX(sort_order)+1,0) FROM goods WHERE category_id=$1))
         RETURNING id, name, category_id, qty, status, sort_order, created_at, updated_at`,
        [category_id, trimmed, qty, status]
      );
      row = rows[0];
    }
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/items/:id', async (req, res) => {
  const { status, name, qty, category_id } = req.body;
  if (badStatus(status)) {
    return res.status(400).json({ error: "status must be 'have' or 'need'" });
  }
  if (category_id === null) {
    return res.status(400).json({ error: 'category_id is required' });
  }
  try {
    const fields = [];
    const vals = [];
    let i = 1;
    if (status !== undefined)      { fields.push(`status=$${i++}`);      vals.push(status); }
    if (name !== undefined)        { fields.push(`name=$${i++}`);        vals.push(name.trim()); }
    if (qty !== undefined)         { fields.push(`qty=$${i++}`);         vals.push(qty); }
    if (category_id !== undefined) { fields.push(`category_id=$${i++}`); vals.push(category_id); }
    if (!fields.length) return res.status(400).json({ error: 'nothing to update' });
    vals.push(req.params.id);
    const { rows } = await db.query(
      `UPDATE goods SET ${fields.join(',')}
         WHERE id=$${i} AND is_common=true
         RETURNING id, name, category_id, qty, status, sort_order, created_at, updated_at`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a common good — if it's referenced by any recipe we keep the good but
// flip it to is_common=false so the recipe link stays intact. (Status flips
// to 'have' so it doesn't sit on the shopping list under the recipe heading.)
router.delete('/items/:id', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const used = await client.query(
      `SELECT 1 FROM recipe_ingredients WHERE good_id=$1 LIMIT 1`,
      [req.params.id]
    );
    if (used.rows.length) {
      await client.query(
        `UPDATE goods SET is_common=false, status='have' WHERE id=$1`,
        [req.params.id]
      );
    } else {
      await client.query('DELETE FROM goods WHERE id=$1', [req.params.id]);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
