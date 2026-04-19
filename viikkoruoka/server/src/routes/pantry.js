const router = require('express').Router();
const db = require('../db');

// GET all categories with their items
router.get('/categories', async (req, res) => {
  try {
    const cats = await db.query(
      'SELECT * FROM pantry_categories ORDER BY sort_order, created_at'
    );
    const items = await db.query(
      'SELECT * FROM pantry_items ORDER BY sort_order, created_at'
    );
    const result = cats.rows.map(cat => ({
      ...cat,
      items: items.rows.filter(i => i.category_id === cat.id)
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new category
router.post('/categories', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  try {
    const { rows } = await db.query(
      'INSERT INTO pantry_categories (name, sort_order) VALUES ($1, (SELECT COALESCE(MAX(sort_order)+1,0) FROM pantry_categories)) RETURNING *',
      [name.trim()]
    );
    res.status(201).json({ ...rows[0], items: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE category
router.delete('/categories/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM pantry_categories WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new item
router.post('/items', async (req, res) => {
  const { category_id, name, qty = '', status = 'unchecked' } = req.body;
  if (!category_id || !name?.trim()) return res.status(400).json({ error: 'category_id and name required' });
  try {
    const { rows } = await db.query(
      `INSERT INTO pantry_items (category_id, name, qty, status, sort_order)
       VALUES ($1,$2,$3,$4,(SELECT COALESCE(MAX(sort_order)+1,0) FROM pantry_items WHERE category_id=$1))
       RETURNING *`,
      [category_id, name.trim(), qty, status]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH item status or details
router.patch('/items/:id', async (req, res) => {
  const { status, name, qty } = req.body;
  try {
    const fields = [];
    const vals = [];
    let i = 1;
    if (status !== undefined) { fields.push(`status=$${i++}`); vals.push(status); }
    if (name !== undefined)   { fields.push(`name=$${i++}`);   vals.push(name.trim()); }
    if (qty !== undefined)    { fields.push(`qty=$${i++}`);     vals.push(qty); }
    if (!fields.length) return res.status(400).json({ error: 'nothing to update' });
    vals.push(req.params.id);
    const { rows } = await db.query(
      `UPDATE pantry_items SET ${fields.join(',')} WHERE id=$${i} RETURNING *`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE item
router.delete('/items/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM pantry_items WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
