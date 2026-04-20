const router = require('express').Router();
const db = require('../db');

/*
 * Canonical goods catalog — backs the ingredient picker and any admin UI.
 *
 *   GET    /api/goods             — list all goods, optionally filtered
 *                                    ?q=foo            (name contains)
 *                                    ?common=true|false
 *   POST   /api/goods             — create a good
 *   PATCH  /api/goods/:id         — update any mutable field
 *   DELETE /api/goods/:id         — remove a good (fails if referenced by a recipe)
 */

router.get('/', async (req, res) => {
  try {
    const params = [];
    const where = [];
    if (req.query.q) {
      params.push(`%${req.query.q.trim()}%`);
      where.push(`g.name ILIKE $${params.length}`);
    }
    if (req.query.common === 'true' || req.query.common === 'false') {
      params.push(req.query.common === 'true');
      where.push(`g.is_common = $${params.length}`);
    }
    const sql = `
      SELECT g.id, g.name, g.category_id, g.qty, g.status,
             g.is_common, g.notes, g.sort_order, g.created_at, g.updated_at,
             c.name AS category_name
        FROM goods g
        LEFT JOIN pantry_categories c ON c.id = g.category_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY g.name
    `;
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const {
    name,
    category_id = null,
    qty = '',
    is_common = true,
    status = 'unchecked',
    notes = '',
  } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  try {
    const { rows } = await db.query(
      `INSERT INTO goods (name, category_id, qty, is_common, status, notes, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,
         (SELECT COALESCE(MAX(sort_order)+1,0) FROM goods))
       RETURNING *`,
      [name.trim(), category_id, qty, is_common, status, notes]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'a good with that name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  const { name, category_id, qty, is_common, status, notes } = req.body;
  try {
    const fields = [];
    const vals = [];
    let i = 1;
    if (name !== undefined)        { fields.push(`name=$${i++}`);        vals.push(name.trim()); }
    if (category_id !== undefined) { fields.push(`category_id=$${i++}`); vals.push(category_id); }
    if (qty !== undefined)         { fields.push(`qty=$${i++}`);         vals.push(qty); }
    if (is_common !== undefined)   { fields.push(`is_common=$${i++}`);   vals.push(!!is_common); }
    if (status !== undefined)      { fields.push(`status=$${i++}`);      vals.push(status); }
    if (notes !== undefined)       { fields.push(`notes=$${i++}`);       vals.push(notes); }
    if (!fields.length) return res.status(400).json({ error: 'nothing to update' });
    vals.push(req.params.id);
    const { rows } = await db.query(
      `UPDATE goods SET ${fields.join(',')} WHERE id=$${i} RETURNING *`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'a good with that name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    // recipe_ingredients.good_id is ON DELETE RESTRICT — we surface the error nicely.
    const used = await db.query(
      `SELECT COUNT(*)::int AS n FROM recipe_ingredients WHERE good_id=$1`,
      [req.params.id]
    );
    if (used.rows[0].n > 0) {
      return res.status(409).json({
        error: `Cannot delete — used by ${used.rows[0].n} recipe ingredient(s)`,
      });
    }
    await db.query('DELETE FROM goods WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
