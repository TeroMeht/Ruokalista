const router = require('express').Router();
const db = require('../db');

/*
 * Pantry routes operate on *common goods* (goods.is_common = true).
 * Response shape is kept compatible with the existing client:
 *   GET /categories → [{id, name, sort_order, items: [{id, name, qty, status, category_id, ...}]}]
 */

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

router.delete('/categories/:id', async (req, res) => {
  try {
    // goods.category_id is ON DELETE SET NULL — goods are preserved, just uncategorised.
    await db.query('DELETE FROM pantry_categories WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Items (= common goods) ───────────────────────────────────
router.post('/items', async (req, res) => {
  const { category_id, name, qty = '', status = 'unchecked' } = req.body;
  if (!category_id || !name?.trim()) {
    return res.status(400).json({ error: 'category_id and name required' });
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
// flip it to is_common=false so the recipe link stays intact.
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
        `UPDATE goods SET is_common=false, status='unchecked' WHERE id=$1`,
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
