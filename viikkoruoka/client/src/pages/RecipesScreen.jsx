import React, { useState } from 'react';
import Modal from '../components/Modal.jsx';
import { api } from '../lib/api.js';

/*
 * Recipes tab.
 *
 * Each recipe lists its ingredients. Every ingredient has its own status
 * (have / need) that the user toggles right here. Marking an ingredient as
 * "need" puts it on the shopping list — this is the ONLY way recipe-driven
 * items reach the shop, independent of the pantry tab.
 *
 * Schema v3:
 *   • Statuses are 'have' / 'need' only — no third "unchecked" state.
 *   • Tap an ingredient row to toggle have ↔ need.
 *   • Every ingredient picks a CATEGORY in the recipe builder. New ingredients
 *     reuse the category if a good with that name already exists; otherwise the
 *     selected category is what the new good gets.
 *
 * The pill in the header summarises the ingredient statuses for that recipe:
 *   all 'have' → "Ready to cook"
 *   any 'need' → "N missing"
 */

const EMOJIS = ['🍝','🍲','🥗','🍱','🥩','🐟','🍜','🍛','🥘','🫕','🥞','🥙','🍔','🌮','🫔','🥚','🍳','🥦'];

function StatusDot({ status }) {
  const styles = {
    have: { bg: 'var(--forest)',     border: 'var(--forest)', color: 'white',       icon: '✓' },
    need: { bg: 'var(--rust-light)', border: 'var(--rust)',   color: 'var(--rust)', icon: '✕' },
  };
  const s = styles[status] || styles.need;
  return (
    <span style={{
      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700,
      background: s.bg, border: `1.5px solid ${s.border}`, color: s.color,
      transition: 'all 0.15s',
    }}>{s.icon}</span>
  );
}

function RecipeStatusBadge({ ingredients }) {
  const total = ingredients.length;
  const need  = ingredients.filter(i => i.status === 'need').length;

  if (total === 0) return <span className="badge badge-gray">No ingredients</span>;
  if (need > 0)    return <span className="badge badge-red">{need} missing</span>;
  return <span className="badge badge-green">Ready to cook</span>;
}

function IngredientRow({ ing, onToggle, busy }) {
  const status = ing.status || 'need';
  return (
    <div
      onClick={busy ? undefined : onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 0', borderBottom: '1px solid var(--cream-dark)',
        fontSize: 13, cursor: busy ? 'default' : 'pointer',
        opacity: busy ? 0.6 : 1,
      }}
    >
      <StatusDot status={status} />
      <span style={{
        flex: 1,
        color: status === 'need' ? 'var(--rust)' : 'var(--ink)',
      }}>
        {ing.name}
      </span>
      <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>{ing.qty}</span>
    </div>
  );
}

function IngBuilder({ ingredients, setIngredients, categories }) {
  return (
    <div>
      {ingredients.map((ing, i) => (
        <div key={i}>
          <div className="ing-row-builder">
            <input className="form-input" placeholder="Ingredient name"
              value={ing.name}
              onChange={e => {
                const next = [...ingredients];
                next[i] = { ...next[i], name: e.target.value };
                setIngredients(next);
              }}
            />
            <input className="form-input qty-in" placeholder="Qty"
              value={ing.qty}
              onChange={e => {
                const next = [...ingredients];
                next[i] = { ...next[i], qty: e.target.value };
                setIngredients(next);
              }}
            />
            <button className="remove-ing-btn" onClick={() => setIngredients(ingredients.filter((_, j) => j !== i))}>×</button>
          </div>
          {/* Category picker — required for every ingredient */}
          <select
            className="form-input"
            style={{ fontSize: 12, padding: '6px 8px', marginTop: 4, marginBottom: 8 }}
            value={ing.category_id || ''}
            onChange={e => {
              const next = [...ingredients];
              next[i] = { ...next[i], category_id: e.target.value };
              setIngredients(next);
            }}
          >
            <option value="">Select category...</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      ))}
      <button
        className="add-ing-btn"
        onClick={() => setIngredients([...ingredients, { name: '', qty: '', category_id: '' }])}
      >
        + Add ingredient
      </button>
    </div>
  );
}

function RecipeModal({ open, onClose, onSave, initialRecipe, categories }) {
  const editing = !!initialRecipe;
  const [emoji, setEmoji]       = useState(initialRecipe?.emoji || '🍝');
  const [name, setName]         = useState(initialRecipe?.name || '');
  const [cookTime, setCookTime] = useState(initialRecipe?.cook_time || 30);
  const [servings, setServings] = useState(initialRecipe?.servings || 4);
  const [notes, setNotes]       = useState(initialRecipe?.notes || '');
  const [ingredients, setIngredients] = useState(
    initialRecipe?.ingredients?.map(i => ({
      name: i.name, qty: i.qty, category_id: i.category_id || '',
    })) || [{ name: '', qty: '', category_id: '' }, { name: '', qty: '', category_id: '' }]
  );
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (open) {
      setEmoji(initialRecipe?.emoji || '🍝');
      setName(initialRecipe?.name || '');
      setCookTime(initialRecipe?.cook_time || 30);
      setServings(initialRecipe?.servings || 4);
      setNotes(initialRecipe?.notes || '');
      setIngredients(
        initialRecipe?.ingredients?.map(i => ({
          name: i.name, qty: i.qty, category_id: i.category_id || '',
        })) || [{ name: '', qty: '', category_id: '' }, { name: '', qty: '', category_id: '' }]
      );
      setError('');
    }
  }, [open, initialRecipe?.id]);

  function handleSave() {
    if (!name.trim()) { setError('Recipe needs a name'); return; }
    const filled = ingredients.filter(i => i.name.trim());
    const missingCat = filled.find(i => !i.category_id);
    if (missingCat) {
      setError(`Pick a category for "${missingCat.name}"`);
      return;
    }
    setError('');
    onSave({
      emoji, name: name.trim(), cook_time: Number(cookTime),
      servings: Number(servings), notes: notes.trim(),
      ingredients: filled,
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit recipe' : 'New recipe'}>
      <div className="form-group">
        <label className="form-label">Icon</label>
        <div className="emoji-grid">
          {EMOJIS.map(e => (
            <button key={e} className={`emoji-opt${emoji === e ? ' selected' : ''}`} onClick={() => setEmoji(e)}>{e}</button>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Recipe name</label>
        <input className="form-input" placeholder="e.g. Pasta Bolognese" autoFocus
          value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Cook time (min)</label>
          <input className="form-input" type="number" placeholder="30"
            value={cookTime} onChange={e => setCookTime(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Servings</label>
          <input className="form-input" type="number" placeholder="4"
            value={servings} onChange={e => setServings(e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Notes (optional)</label>
        <input className="form-input" placeholder="Tips, variations..."
          value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">
          Ingredients <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontWeight: 400 }}>· each needs a category</span>
        </label>
        <IngBuilder ingredients={ingredients} setIngredients={setIngredients} categories={categories} />
      </div>
      {error && (
        <div style={{ fontSize: 12, color: 'var(--rust)', marginBottom: 8 }}>{error}</div>
      )}
      <button className="btn btn-primary btn-full" style={{ marginTop: 4 }} onClick={handleSave}>
        {editing ? 'Save changes' : 'Add recipe'}
      </button>
      <button className="btn btn-secondary btn-full" style={{ marginTop: 8 }} onClick={onClose}>Cancel</button>
    </Modal>
  );
}

export default function RecipesScreen({ recipes, setRecipes, categories, toast }) {
  const [expanded, setExpanded]     = useState({});
  const [modalOpen, setModalOpen]   = useState(false);
  const [editRecipe, setEditRecipe] = useState(null);
  const [pendingIng, setPendingIng] = useState({});  // { [ingredient_id]: true } while saving

  function openAdd()   { setEditRecipe(null); setModalOpen(true); }
  function openEdit(r) { setEditRecipe(r);    setModalOpen(true); }

  async function handleSave(data) {
    try {
      if (editRecipe) {
        const updated = await api.updateRecipe(editRecipe.id, data);
        setRecipes(rs => rs.map(r => r.id === editRecipe.id ? updated : r));
        toast('Recipe updated');
      } else {
        const created = await api.addRecipe(data);
        setRecipes(rs => [...rs, created]);
        toast('Recipe added');
      }
      setModalOpen(false);
    } catch (e) { toast('Error: ' + e.message); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this recipe?')) return;
    try {
      await api.deleteRecipe(id);
      setRecipes(rs => rs.filter(r => r.id !== id));
      toast('Recipe deleted');
    } catch (e) { toast('Error: ' + e.message); }
  }

  // Toggle have ↔ need on an ingredient row.
  async function toggleIngredient(recipe, ing) {
    const current = ing.status || 'need';
    const nextStatus = current === 'have' ? 'need' : 'have';
    // Optimistic update
    setRecipes(rs => rs.map(r => r.id !== recipe.id ? r : {
      ...r,
      ingredients: r.ingredients.map(i => i.id === ing.id ? { ...i, status: nextStatus } : i),
    }));
    setPendingIng(p => ({ ...p, [ing.id]: true }));
    try {
      const saved = await api.patchIngredient(recipe.id, ing.id, { status: nextStatus });
      setRecipes(rs => rs.map(r => r.id !== recipe.id ? r : {
        ...r,
        ingredients: r.ingredients.map(i => i.id === ing.id ? { ...i, ...saved } : i),
      }));
    } catch (e) {
      // Roll back
      setRecipes(rs => rs.map(r => r.id !== recipe.id ? r : {
        ...r,
        ingredients: r.ingredients.map(i => i.id === ing.id ? { ...i, status: current } : i),
      }));
      toast('Error: ' + e.message);
    } finally {
      setPendingIng(p => {
        const { [ing.id]: _, ...rest } = p;
        return rest;
      });
    }
  }

  return (
    <div className="scroll-area">
      {recipes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📖</div>
          <div className="empty-title">No recipes yet</div>
          <div className="empty-sub">Tap + to add your first recipe</div>
        </div>
      ) : (
        recipes.map(recipe => {
          const isOpen = expanded[recipe.id];
          return (
            <div key={recipe.id} style={{
              background: 'white', borderRadius: 'var(--r)',
              border: '1px solid var(--cream-dark)',
              marginBottom: 10, overflow: 'hidden',
            }}>
              {/* Header row */}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, cursor: 'pointer' }}
                onClick={() => setExpanded(e => ({ ...e, [recipe.id]: !e[recipe.id] }))}
              >
                <div style={{
                  width: 46, height: 46, borderRadius: 10,
                  background: 'var(--cream)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 26, flexShrink: 0,
                }}>
                  {recipe.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {recipe.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                    {recipe.cook_time} min · {recipe.servings} servings
                    {recipe.notes && ` · ${recipe.notes.slice(0, 28)}${recipe.notes.length > 28 ? '…' : ''}`}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  <RecipeStatusBadge ingredients={recipe.ingredients} />
                  <span style={{
                    fontSize: 14, color: 'var(--ink-faint)',
                    display: 'inline-block',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                  }}>▾</span>
                </div>
              </div>

              {/* Expanded body */}
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--cream-dark)' }}>
                  <div style={{ padding: '4px 14px 10px' }}>
                    <div style={{
                      fontSize: 11, color: 'var(--ink-faint)',
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                      padding: '8px 0 4px',
                    }}>
                      Tap each to toggle: have ↔ need
                    </div>
                    {recipe.ingredients.length === 0 ? (
                      <p style={{ fontSize: 13, color: 'var(--ink-faint)', padding: '4px 0' }}>No ingredients listed</p>
                    ) : (
                      recipe.ingredients.map((ing) => (
                        <IngredientRow
                          key={ing.id}
                          ing={ing}
                          busy={!!pendingIng[ing.id]}
                          onToggle={() => toggleIngredient(recipe, ing)}
                        />
                      ))
                    )}
                  </div>
                  <div style={{
                    display: 'flex', gap: 8, padding: '10px 14px',
                    borderTop: '1px solid var(--cream-dark)',
                  }}>
                    <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => openEdit(recipe)}>Edit</button>
                    <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => handleDelete(recipe.id)}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      <button className="fab" onClick={openAdd}>+</button>

      <RecipeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initialRecipe={editRecipe}
        categories={categories}
      />
    </div>
  );
}
