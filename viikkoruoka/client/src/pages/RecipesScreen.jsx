import React, { useState } from 'react';
import Modal from '../components/Modal.jsx';
import { api } from '../lib/api.js';

/*
 * Recipes tab.
 *
 * Each recipe lists its ingredients. Every ingredient has its own status
 * (have / need / unchecked) that the user toggles right here. Marking an
 * ingredient as "need" puts it on the shopping list — this is the ONLY way
 * recipe-driven items reach the shop, independent of the pantry tab.
 *
 * The pill in the header summarises the ingredient statuses for that recipe:
 *   all 'have'                → "Ready to cook"
 *   any 'need'                → "N missing"
 *   only 'have'/'unchecked'   → "N unchecked"
 */

const EMOJIS = ['🍝','🍲','🥗','🍱','🥩','🐟','🍜','🍛','🥘','🫕','🥞','🥙','🍔','🌮','🫔','🥚','🍳','🥦'];

// Same 3-state cycle as the pantry tab.
const STATUS_CYCLE = { have: 'need', need: 'unchecked', unchecked: 'have' };

function StatusDot({ status }) {
  const styles = {
    have:      { bg: 'var(--forest)',      border: 'var(--forest)',     color: 'white', icon: '✓' },
    need:      { bg: 'var(--rust-light)',  border: 'var(--rust)',       color: 'var(--rust)', icon: '✕' },
    unchecked: { bg: 'white',              border: 'var(--cream-dark)', color: 'transparent', icon: '' },
  };
  const s = styles[status] || styles.unchecked;
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
  const total     = ingredients.length;
  const have      = ingredients.filter(i => i.status === 'have').length;
  const need      = ingredients.filter(i => i.status === 'need').length;
  const unchecked = total - have - need;

  if (total === 0)   return <span className="badge badge-gray">No ingredients</span>;
  if (need > 0)      return <span className="badge badge-red">{need} missing</span>;
  if (unchecked > 0) return <span className="badge badge-amber">{unchecked} to check</span>;
  return <span className="badge badge-green">Ready to cook</span>;
}

function IngredientRow({ ing, onCycle, busy }) {
  const status = ing.status || 'unchecked';
  return (
    <div
      onClick={busy ? undefined : onCycle}
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

function IngBuilder({ ingredients, setIngredients }) {
  return (
    <div>
      {ingredients.map((ing, i) => (
        <div key={i} className="ing-row-builder">
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
      ))}
      <button className="add-ing-btn" onClick={() => setIngredients([...ingredients, { name: '', qty: '' }])}>
        + Add ingredient
      </button>
    </div>
  );
}

function RecipeModal({ open, onClose, onSave, initialRecipe }) {
  const editing = !!initialRecipe;
  const [emoji, setEmoji]       = useState(initialRecipe?.emoji || '🍝');
  const [name, setName]         = useState(initialRecipe?.name || '');
  const [cookTime, setCookTime] = useState(initialRecipe?.cook_time || 30);
  const [servings, setServings] = useState(initialRecipe?.servings || 4);
  const [notes, setNotes]       = useState(initialRecipe?.notes || '');
  const [ingredients, setIngredients] = useState(
    initialRecipe?.ingredients?.map(i => ({ name: i.name, qty: i.qty })) || [{ name: '', qty: '' }, { name: '', qty: '' }]
  );

  React.useEffect(() => {
    if (open) {
      setEmoji(initialRecipe?.emoji || '🍝');
      setName(initialRecipe?.name || '');
      setCookTime(initialRecipe?.cook_time || 30);
      setServings(initialRecipe?.servings || 4);
      setNotes(initialRecipe?.notes || '');
      setIngredients(
        initialRecipe?.ingredients?.map(i => ({ name: i.name, qty: i.qty })) || [{ name: '', qty: '' }, { name: '', qty: '' }]
      );
    }
  }, [open, initialRecipe?.id]);

  function handleSave() {
    if (!name.trim()) return;
    onSave({
      emoji, name: name.trim(), cook_time: Number(cookTime),
      servings: Number(servings), notes: notes.trim(),
      ingredients: ingredients.filter(i => i.name.trim()),
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
        <label className="form-label">Ingredients</label>
        <IngBuilder ingredients={ingredients} setIngredients={setIngredients} />
      </div>
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

  async function cycleIngredient(recipe, ing) {
    const nextStatus = STATUS_CYCLE[ing.status || 'unchecked'];
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
        ingredients: r.ingredients.map(i => i.id === ing.id ? { ...i, status: ing.status } : i),
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
                      Tap each to cycle: have → need → unchecked
                    </div>
                    {recipe.ingredients.length === 0 ? (
                      <p style={{ fontSize: 13, color: 'var(--ink-faint)', padding: '4px 0' }}>No ingredients listed</p>
                    ) : (
                      recipe.ingredients.map((ing) => (
                        <IngredientRow
                          key={ing.id}
                          ing={ing}
                          busy={!!pendingIng[ing.id]}
                          onCycle={() => cycleIngredient(recipe, ing)}
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
      />
    </div>
  );
}
