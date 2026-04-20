const router = require('express').Router();
const db = require('../db');

/*
 * Unified shopping list.
 *
 * Two independent sources, both driven by explicit user choices:
 *
 *   1. Pantry: common goods the user has flagged status='need'.
 *   2. Recipes: recipe_ingredients the user has flagged status='need'
 *               (one status per ingredient per recipe, set on the Recipes tab).
 *
 * The two sources are deduplicated by good_id in the response so the same
 * item never appears twice on the store-facing list. A `sources` array per
 * item explains the "why" (pantry / which recipe) for any UI that wants it.
 */

router.get('/', async (req, res) => {
  try {
    const rows = await db.query(`
      -- 1. Pantry source: common goods marked 'need'
      SELECT g.id        AS good_id,
             g.name,
             g.qty,
             g.is_common,
             g.category_id,
             g.sort_order AS good_sort,
             c.name        AS category_name,
             c.sort_order  AS cat_sort,
             'pantry'::text AS source_kind,
             NULL::uuid   AS recipe_id,
             NULL::text   AS recipe_name,
             NULL::text   AS recipe_emoji,
             NULL::text   AS recipe_qty
        FROM goods g
        LEFT JOIN pantry_categories c ON c.id = g.category_id
       WHERE g.is_common = true AND g.status = 'need'

      UNION ALL

      -- 2. Recipe source: ingredients explicitly marked 'need' on a recipe
      SELECT g.id        AS good_id,
             g.name,
             g.qty,
             g.is_common,
             g.category_id,
             g.sort_order AS good_sort,
             c.name        AS category_name,
             c.sort_order  AS cat_sort,
             'recipe'::text AS source_kind,
             r.id          AS recipe_id,
             r.name        AS recipe_name,
             r.emoji       AS recipe_emoji,
             ri.qty        AS recipe_qty
        FROM recipe_ingredients ri
        JOIN recipes r ON r.id = ri.recipe_id
        JOIN goods   g ON g.id = ri.good_id
        LEFT JOIN pantry_categories c ON c.id = g.category_id
       WHERE ri.status = 'need'

      ORDER BY cat_sort NULLS LAST, good_sort
    `);

    // Fold duplicates — one entry per good with all sources collected.
    const map = new Map();
    for (const r of rows.rows) {
      if (!map.has(r.good_id)) {
        map.set(r.good_id, {
          good_id:       r.good_id,
          name:          r.name,
          qty:           r.qty,
          is_common:     r.is_common,
          category_id:   r.category_id,
          category_name: r.category_name,
          sources:       [],
        });
      }
      const entry = map.get(r.good_id);
      if (r.source_kind === 'pantry') {
        entry.sources.push({ kind: 'pantry' });
      } else {
        entry.sources.push({
          kind:        'recipe',
          recipe_id:   r.recipe_id,
          recipe_name: r.recipe_name,
          emoji:       r.recipe_emoji,
          qty:         r.recipe_qty,
        });
        // Prefer the recipe's qty over the (often blank) good-level qty.
        if (!entry.qty && r.recipe_qty) entry.qty = r.recipe_qty;
      }
    }

    res.json({ items: Array.from(map.values()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
