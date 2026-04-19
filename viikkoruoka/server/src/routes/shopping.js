const router = require('express').Router();
const db = require('../db');

// GET computed shopping list: all "need" pantry items + any recipe ingredients
// that reference pantry items not in "have" status.
// The recipe ingredient matching is fuzzy (case-insensitive, trimmed).
router.get('/', async (req, res) => {
  try {
    // Pantry items needed
    const pantryNeeds = await db.query(`
      SELECT pi.id, pi.name, pi.qty, pc.name AS category_name
      FROM pantry_items pi
      JOIN pantry_categories pc ON pc.id = pi.category_id
      WHERE pi.status = 'need'
      ORDER BY pc.sort_order, pi.sort_order
    `);

    // Build a set of "have" item names (lowercase)
    const haveSet = await db.query(`
      SELECT LOWER(TRIM(name)) AS name FROM pantry_items WHERE status = 'have'
    `);
    const haveNames = new Set(haveSet.rows.map(r => r.name));

    // All recipe ingredients
    const allIngredients = await db.query(`
      SELECT ri.name, ri.qty, r.name AS recipe_name, r.id AS recipe_id
      FROM recipe_ingredients ri
      JOIN recipes r ON r.id = ri.recipe_id
      ORDER BY r.sort_order, ri.sort_order
    `);

    // Group recipe ingredients that are missing from pantry
    const recipeNeedsMap = new Map();
    allIngredients.rows.forEach(ing => {
      const key = ing.name.toLowerCase().trim();
      if (!haveNames.has(key)) {
        if (!recipeNeedsMap.has(key)) {
          recipeNeedsMap.set(key, { name: ing.name, qty: ing.qty, recipes: [] });
        }
        const entry = recipeNeedsMap.get(key);
        if (!entry.recipes.includes(ing.recipe_name)) {
          entry.recipes.push(ing.recipe_name);
        }
      }
    });

    res.json({
      pantry_needs: pantryNeeds.rows,
      recipe_needs: Array.from(recipeNeedsMap.values()),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
