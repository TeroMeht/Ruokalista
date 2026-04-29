import React, { useState } from 'react';
import Modal from '../components/Modal.jsx';
import { api } from '../lib/api.js';

/*
 * Pantry tab.
 *
 * Schema v3 simplifications:
 *   • Items are 'have' or 'need' — no third "unchecked" state.
 *   • Tapping the dot toggles have ↔ need.
 *   • Tapping the item name opens an edit modal (name, qty, category, status).
 *   • Tapping the category name opens an edit modal (rename).
 *   • Newly added items default to 'need' (you're listing what to remember).
 */

const STATUS_LABEL = { have: 'Have', need: 'Need' };
const STATUS_BADGE = { have: 'badge-green', need: 'badge-red' };

function ToggleDot({ status }) {
  const colors = {
    have: { bg: 'var(--forest)',     border: 'var(--forest)', color: 'white' },
    need: { bg: 'var(--rust-light)', border: 'var(--rust)',   color: 'var(--rust)' },
  };
  const c = colors[status] || colors.need;
  return (
    <span style={{
      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 600,
      background: c.bg, border: `1.5px solid ${c.border}`, color: c.color,
      transition: 'all 0.15s',
    }}>
      {status === 'have' ? '✓' : '✕'}
    </span>
  );
}

export default function PantryScreen({ categories, setCategories, toast }) {
  const [collapsed, setCollapsed]     = useState({});
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addCatOpen, setAddCatOpen]   = useState(false);
  const [editItem, setEditItem]       = useState(null);  // { id, name, qty, status, category_id }
  const [editCat, setEditCat]         = useState(null);  // { id, name }
  const [newItem, setNewItem]         = useState({ name: '', qty: '', status: 'need', category_id: '' });
  const [newCatName, setNewCatName]   = useState('');
  const [quickInputs, setQuickInputs] = useState({});
  const [saving, setSaving]           = useState({});

  const setSav = (key, val) => setSaving(s => ({ ...s, [key]: val }));

  // ── Status toggle (have ↔ need) ───────────────────────────
  async function toggleStatus(catId, itemId, currentStatus) {
    const next = currentStatus === 'have' ? 'need' : 'have';
    setSav(itemId, true);
    try {
      await api.updateItem(itemId, { status: next });
      setCategories(cats => cats.map(cat =>
        cat.id !== catId ? cat : {
          ...cat,
          items: cat.items.map(it => it.id === itemId ? { ...it, status: next } : it),
        }
      ));
    } catch (e) { toast('Error: ' + e.message); }
    setSav(itemId, false);
  }

  // ── Quick add in category — defaults to 'need' ────────────
  async function quickAdd(catId, e) {
    if (e.key !== 'Enter' && e.type !== 'click') return;
    const name = (quickInputs[catId] || '').trim();
    if (!name) return;
    try {
      const item = await api.addItem({ category_id: catId, name, qty: '', status: 'need' });
      setCategories(cats => cats.map(cat =>
        cat.id !== catId ? cat : { ...cat, items: [...cat.items, item] }
      ));
      setQuickInputs(q => ({ ...q, [catId]: '' }));
      toast('Added: ' + name);
    } catch (e) { toast('Error: ' + e.message); }
  }

  // ── Delete item ───────────────────────────────────────────
  async function deleteItem(catId, itemId) {
    try {
      await api.deleteItem(itemId);
      setCategories(cats => cats.map(cat =>
        cat.id !== catId ? cat : { ...cat, items: cat.items.filter(it => it.id !== itemId) }
      ));
      toast('Item removed');
    } catch (e) { toast('Error: ' + e.message); }
  }

  // ── Add item modal ────────────────────────────────────────
  async function submitAddItem() {
    if (!newItem.name.trim()) { toast('Enter an item name'); return; }
    if (!newItem.category_id) { toast('Select a category'); return; }
    try {
      const item = await api.addItem(newItem);
      setCategories(cats => cats.map(cat =>
        cat.id !== newItem.category_id ? cat : { ...cat, items: [...cat.items, item] }
      ));
      setAddItemOpen(false);
      setNewItem({ name: '', qty: '', status: 'need', category_id: '' });
      toast('Item added');
    } catch (e) { toast('Error: ' + e.message); }
  }

  // ── Edit item modal ───────────────────────────────────────
  async function submitEditItem() {
    if (!editItem.name.trim()) { toast('Enter an item name'); return; }
    if (!editItem.category_id) { toast('Select a category'); return; }
    try {
      const updated = await api.updateItem(editItem.id, {
        name:        editItem.name.trim(),
        qty:         editItem.qty,
        status:      editItem.status,
        category_id: editItem.category_id,
      });
      // Item may have moved to a different category — rebuild the list.
      setCategories(cats => cats.map(cat => ({
        ...cat,
        items: cat.id === updated.category_id
          // Add to new category list if not already there, replace if existing.
          ? (cat.items.some(it => it.id === updated.id)
              ? cat.items.map(it => it.id === updated.id ? updated : it)
              : [...cat.items, updated])
          // Remove from any other category.
          : cat.items.filter(it => it.id !== updated.id),
      })));
      setEditItem(null);
      toast('Item updated');
    } catch (e) { toast('Error: ' + e.message); }
  }

  // ── Add category ──────────────────────────────────────────
  async function submitAddCat() {
    if (!newCatName.trim()) { toast('Enter a category name'); return; }
    try {
      const cat = await api.addCategory({ name: newCatName.trim() });
      setCategories(cats => [...cats, cat]);
      setAddCatOpen(false);
      setNewCatName('');
      toast('Category added');
    } catch (e) { toast('Error: ' + e.message); }
  }

  // ── Edit category (rename) ────────────────────────────────
  async function submitEditCat() {
    if (!editCat.name.trim()) { toast('Enter a category name'); return; }
    try {
      const updated = await api.updateCategory(editCat.id, { name: editCat.name.trim() });
      setCategories(cats => cats.map(c => c.id === updated.id ? { ...c, ...updated } : c));
      setEditCat(null);
      toast('Category renamed');
    } catch (e) { toast('Error: ' + e.message); }
  }

  // ── Delete category ───────────────────────────────────────
  async function deleteCategory(catId) {
    if (!window.confirm('Delete this category and all its items?\n\nItems used by recipes will move to "Uncategorized".')) return;
    try {
      await api.deleteCategory(catId);
      // Refresh the whole list since recipe-linked goods may have been
      // reassigned to 'Uncategorized' instead of being deleted.
      const fresh = await api.getCategories();
      setCategories(fresh);
      toast('Category removed');
    } catch (e) { toast('Error: ' + e.message); }
  }

  const totalItems = categories.reduce((s, c) => s + c.items.length, 0);
  const haveItems  = categories.reduce((s, c) => s + c.items.filter(i => i.status === 'have').length, 0);
  const needItems  = categories.reduce((s, c) => s + c.items.filter(i => i.status === 'need').length, 0);

  return (
    <div className="scroll-area">
      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'In stock',    value: haveItems, color: 'var(--forest)' },
          { label: 'Need to buy', value: needItems, color: 'var(--rust)' },
          { label: 'Total items', value: totalItems, color: 'var(--ink-soft)' },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, background: 'white', border: '1px solid var(--cream-dark)',
            borderRadius: 'var(--r)', padding: '11px 12px',
          }}>
            <div style={{ fontSize: 22, fontWeight: 500, color: s.color, fontFamily: "'DM Serif Display', serif" }}>
              {s.value}
            </div>
            <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Categories */}
      {categories.map(cat => {
        const isCollapsed = collapsed[cat.id];
        const haveC = cat.items.filter(i => i.status === 'have').length;
        return (
          <div key={cat.id} className="card" style={{ marginBottom: 10 }}>
            {/* Category header — chevron toggles collapse, name opens rename */}
            <div
              onClick={() => setCollapsed(c => ({ ...c, [cat.id]: !c[cat.id] }))}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', background: 'var(--cream)',
                borderBottom: isCollapsed ? 'none' : '1px solid var(--cream-dark)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  onClick={e => { e.stopPropagation(); setEditCat({ id: cat.id, name: cat.name }); }}
                  style={{
                    fontSize: 16, fontWeight: 700, color: '#000',
                    cursor: 'text', textDecoration: 'underline',
                    textDecorationColor: 'transparent', textUnderlineOffset: 3,
                  }}
                  onMouseEnter={e => e.currentTarget.style.textDecorationColor = 'var(--sage)'}
                  onMouseLeave={e => e.currentTarget.style.textDecorationColor = 'transparent'}
                  title="Tap to rename"
                >
                  {cat.name}
                </span>
                <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{haveC}/{cat.items.length}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={e => { e.stopPropagation(); deleteCategory(cat.id); }}
                  style={{ fontSize: 12, color: 'var(--ink-faint)', background: 'none', border: 'none', padding: '2px 4px' }}
                >
                  ✕
                </button>
                <span style={{ fontSize: 14, color: 'var(--ink-faint)', transition: 'transform 0.2s', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                  ▾
                </span>
              </div>
            </div>

            {!isCollapsed && (
              <>
                {cat.items.map(item => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--cream-dark)',
                      opacity: saving[item.id] ? 0.5 : 1,
                      transition: 'opacity 0.1s',
                    }}
                  >
                    <div style={{ cursor: 'pointer' }} onClick={() => toggleStatus(cat.id, item.id, item.status)}>
                      <ToggleDot status={item.status} />
                    </div>
                    {/* Tap on name → edit modal */}
                    <span
                      style={{ flex: 1, fontSize: 14, color: 'var(--ink)', cursor: 'pointer' }}
                      onClick={() => setEditItem({
                        id: item.id, name: item.name, qty: item.qty || '',
                        status: item.status, category_id: item.category_id,
                      })}
                    >
                      {item.name}
                    </span>
                    {item.qty && (
                      <span style={{ fontSize: 12, color: 'var(--ink-faint)', marginRight: 4 }}>{item.qty}</span>
                    )}
                    <span className={`badge ${STATUS_BADGE[item.status]}`}>{STATUS_LABEL[item.status]}</span>
                    <button
                      onClick={() => deleteItem(cat.id, item.id)}
                      style={{ fontSize: 13, color: 'var(--ink-faint)', background: 'none', border: 'none', padding: '2px 4px', flexShrink: 0 }}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {/* Quick add row */}
                <div style={{ display: 'flex', gap: 8, padding: '8px 14px 10px', borderTop: cat.items.length ? '1px solid var(--cream-dark)' : 'none' }}>
                  <input
                    className="form-input"
                    style={{ fontSize: 13, padding: '7px 10px', background: 'var(--cream)', border: 'none' }}
                    placeholder="Quick add item..."
                    value={quickInputs[cat.id] || ''}
                    onChange={e => setQuickInputs(q => ({ ...q, [cat.id]: e.target.value }))}
                    onKeyDown={e => quickAdd(cat.id, e)}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={e => quickAdd(cat.id, e)}
                  >Add</button>
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* New category button */}
      <button
        onClick={() => setAddCatOpen(true)}
        style={{
          width: '100%', marginBottom: 24, padding: 11,
          borderRadius: 'var(--r)',
          border: '1px dashed var(--sage)',
          background: 'transparent', color: 'var(--forest-mid)',
          fontSize: 13, fontWeight: 500,
        }}
      >
        + New category
      </button>

      {/* FAB */}
      <button className="fab" onClick={() => { setNewItem({ name: '', qty: '', status: 'need', category_id: categories[0]?.id || '' }); setAddItemOpen(true); }}>
        +
      </button>

      {/* Add Item Modal */}
      <Modal open={addItemOpen} onClose={() => setAddItemOpen(false)} title="Add pantry item">
        <div className="form-group">
          <label className="form-label">Item name</label>
          <input className="form-input" placeholder="e.g. Pasta, Olive oil..." autoFocus
            value={newItem.name} onChange={e => setNewItem(n => ({ ...n, name: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && submitAddItem()}
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Quantity</label>
            <input className="form-input" placeholder="e.g. 500g, 2 pcs"
              value={newItem.qty} onChange={e => setNewItem(n => ({ ...n, qty: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-input" value={newItem.status} onChange={e => setNewItem(n => ({ ...n, status: e.target.value }))}>
              <option value="need">Need ✕</option>
              <option value="have">Have ✓</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Category <span style={{ color: 'var(--rust)' }}>*</span></label>
          <select className="form-input" value={newItem.category_id} onChange={e => setNewItem(n => ({ ...n, category_id: e.target.value }))}>
            <option value="">Select category...</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button className="btn btn-primary btn-full" style={{ marginTop: 4 }} onClick={submitAddItem}>Add to pantry</button>
        <button className="btn btn-secondary btn-full" style={{ marginTop: 8 }} onClick={() => setAddItemOpen(false)}>Cancel</button>
      </Modal>

      {/* Edit Item Modal */}
      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Edit item">
        {editItem && (
          <>
            <div className="form-group">
              <label className="form-label">Item name</label>
              <input className="form-input" autoFocus
                value={editItem.name} onChange={e => setEditItem(n => ({ ...n, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && submitEditItem()}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input className="form-input" placeholder="e.g. 500g, 2 pcs"
                  value={editItem.qty} onChange={e => setEditItem(n => ({ ...n, qty: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={editItem.status} onChange={e => setEditItem(n => ({ ...n, status: e.target.value }))}>
                  <option value="need">Need ✕</option>
                  <option value="have">Have ✓</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Category <span style={{ color: 'var(--rust)' }}>*</span></label>
              <select className="form-input" value={editItem.category_id || ''} onChange={e => setEditItem(n => ({ ...n, category_id: e.target.value }))}>
                <option value="">Select category...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button className="btn btn-primary btn-full" style={{ marginTop: 4 }} onClick={submitEditItem}>Save changes</button>
            <button className="btn btn-secondary btn-full" style={{ marginTop: 8 }} onClick={() => setEditItem(null)}>Cancel</button>
          </>
        )}
      </Modal>

      {/* Add Category Modal */}
      <Modal open={addCatOpen} onClose={() => setAddCatOpen(false)} title="New category">
        <div className="form-group">
          <label className="form-label">Category name</label>
          <input className="form-input" placeholder="e.g. Bakery, Drinks..." autoFocus
            value={newCatName} onChange={e => setNewCatName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitAddCat()}
          />
        </div>
        <button className="btn btn-primary btn-full" onClick={submitAddCat}>Add category</button>
        <button className="btn btn-secondary btn-full" style={{ marginTop: 8 }} onClick={() => setAddCatOpen(false)}>Cancel</button>
      </Modal>

      {/* Edit Category Modal */}
      <Modal open={!!editCat} onClose={() => setEditCat(null)} title="Rename category">
        {editCat && (
          <>
            <div className="form-group">
              <label className="form-label">Category name</label>
              <input className="form-input" autoFocus
                value={editCat.name} onChange={e => setEditCat(n => ({ ...n, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && submitEditCat()}
              />
            </div>
            <button className="btn btn-primary btn-full" onClick={submitEditCat}>Save</button>
            <button className="btn btn-secondary btn-full" style={{ marginTop: 8 }} onClick={() => setEditCat(null)}>Cancel</button>
          </>
        )}
      </Modal>
    </div>
  );
}
