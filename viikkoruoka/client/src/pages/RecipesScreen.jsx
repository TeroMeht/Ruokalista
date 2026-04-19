import React, { useState } from 'react';
import Modal from '../components/Modal.jsx';
import { api } from '../lib/api.js';

const EMOJIS = ['🍝','🍲','🥗','🍱','🥩','🐟','🍜','🍛','🥘','🫕','🥞','🥙','🍔','🌮','🫔','🥚','🍳','🥦'];

function RecipeStatusBadge({ recipe, pantryMap }) {
  const missing = recipe.ingredients.filter(ing => pantryMap[ing.name.toLowerCase()] !== 'have').length;
  if (missing === 0) return <span className="badge badge-green">Ready to cook</span>;
  if (missing <= 2)  return <span className="badge badge-amber">{missing} missing</span>;
  return <span className="badge badge-red">{missing} missing</span>;
}

function IngredientRow({ ing, pantryMap }) {
  const have = pantryMap[ing.name.toLowerCase()] === 'have';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 0', borderBottom: '1px solid var(--cream-dark)',
      fontSize: 13,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: have ? 'var(--forest-light)' : 'var(--rust)',
      }} />
      <span style={{ flex: 1 }}>{ing.name}</span>
      <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>{ing.qty}</span>
      <span style={{ fontSize: 11, fontWeight: 500, color: have ? 'var(--forest-mid)' : 'var(--rust)' }}>
        {have ? 'Have' : 'Need'}
      </span>
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
  const [emoji, setEmoji]         = useState(initialRecipe?.emoji || '🍝');
  const [name, setName]           = useState(initialRecipe?.name || '');
  const [cookTime, setCookTime]   = useState(initialRecipe?.cook_time || 30);
  const [servings, setServings]   = useState(initialRecipe?.servings || 4);
  const [notes, setNotes]         = useState(initialRecipe?.notes || '');
  const [ingredients, setIngredients] = useState(
    initialRecipe?.ingredients?.map(i => ({ name: i.name, qty: i.qty })) || [{ name: '', qty: '' }, { name: '', qty: '' }]
  );

  // Reset when modal opens with new initial value
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

  // Build pantry map
  const pantryMap = {};
  categories.forEach(cat => cat.items.forEach(item => {
    pantryMap[item.name.toLowerCase()] = item.status;
  }));

  function openAdd()       { setEditRecipe(null); setModalOpen(true); }
  function openEdit(r)     { setEditRecipe(r);    setModalOpen(true); }

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
          const missing = recipe.ingredients.filter(ing => pantryMap[ing.name.toLowerCase()] !== 'have').length;

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
                  <RecipeStatusBadge recipe={recipe} pantryMap={pantryMap} />
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
                  <div style={{ padding: '10px 14px' }}>
                    {recipe.ingredients.length === 0 ? (
                      <p style={{ fontSize: 13, color: 'var(--ink-faint)', padding: '4px 0' }}>No ingredients listed</p>
                    ) : (
                      recipe.ingredients.map((ing, i) => (
                        <IngredientRow key={i} ing={ing} pantryMap={pantryMap} />
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
