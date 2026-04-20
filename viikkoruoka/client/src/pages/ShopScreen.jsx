import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';

/*
 * Unified shopping list.
 *
 * One flat, deduped list of things to buy. The shopping API returns items
 * with a `sources` array explaining *why* each item is here (pantry restock
 * and/or one or more recipes whose ingredients were flagged 'need'), but we
 * lead with the item itself — at the store the reason doesn't matter, only
 * what to grab.
 */

export default function ShopScreen({ categories, recipes, toast }) {
  const [shopData, setShopData] = useState(null);
  const [checked, setChecked]   = useState({});
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getShopping();
      setShopData(data);
    } catch (e) { toast('Error loading shopping list: ' + e.message); }
    setLoading(false);
  }, [toast]);

  // Reload when pantry or recipes state changes (e.g. user flipped an
  // ingredient's have/need status on the Recipes tab).
  useEffect(() => { load(); }, [categories, recipes, load]);

  const items = shopData?.items || [];

  // Group by category, preserving server-side ordering.
  const byCategory = [];
  const catIndex = new Map();
  for (const item of items) {
    const key = item.category_id || '__none__';
    if (!catIndex.has(key)) {
      catIndex.set(key, byCategory.length);
      byCategory.push({
        id:   item.category_id,
        name: item.category_name || 'Uncategorized',
        items: [],
      });
    }
    byCategory[catIndex.get(key)].items.push(item);
  }

  const total     = items.length;
  const doneCount = items.filter(i => checked[i.good_id]).length;
  const remaining = total - doneCount;
  const pct       = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  function toggle(id) {
    setChecked(c => ({ ...c, [id]: !c[id] }));
  }
  function clearDone() {
    setChecked({});
    toast('Cleared ✓');
  }

  if (loading) return <div className="scroll-area"><div className="spinner" /></div>;

  return (
    <div className="scroll-area">
      {/* Banner */}
      <div style={{
        background: 'var(--forest)', borderRadius: 'var(--r-lg)',
        padding: '16px 18px', marginBottom: 14,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 38, color: 'var(--mint)', lineHeight: 1 }}>
            {remaining}
          </div>
          <div style={{ fontSize: 12, color: 'var(--sage)', marginTop: 3 }}>items to buy</div>
        </div>
        <div style={{ width: 130 }}>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden', marginBottom: 5 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--mint)', borderRadius: 2, transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--sage)', textAlign: 'right' }}>{doneCount}/{total} done</div>
          {doneCount > 0 && (
            <button onClick={clearDone} style={{
              fontSize: 11, color: 'var(--sage)', background: 'none',
              border: 'none', cursor: 'pointer', marginTop: 4, width: '100%', textAlign: 'right',
            }}>
              Clear done
            </button>
          )}
        </div>
      </div>

      {total === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎉</div>
          <div className="empty-title">All stocked up!</div>
          <div className="empty-sub">
            Mark items as "Need" in the pantry, or flag recipe ingredients as
            "Need" on the Recipes tab, and they'll show up here.
          </div>
        </div>
      ) : (
        byCategory.map(group => (
          <div key={group.id || '__none__'}>
            <div className="section-label">{group.name}</div>
            <div className="card">
              {group.items.map(item => (
                <ShopItem
                  key={item.good_id}
                  item={item}
                  done={!!checked[item.good_id]}
                  onToggle={() => toggle(item.good_id)}
                />
              ))}
            </div>
          </div>
        ))
      )}

      <button
        onClick={load}
        style={{
          width: '100%', marginTop: 8, marginBottom: 24,
          padding: 11, borderRadius: 'var(--r)',
          border: '1px solid var(--cream-dark)',
          background: 'white', color: 'var(--ink-mid)',
          fontSize: 13, fontWeight: 500,
        }}
      >
        ↻ Refresh list
      </button>
    </div>
  );
}

function ShopItem({ item, done, onToggle }) {
  const hasPantry  = item.sources.some(s => s.kind === 'pantry');
  const recipeSrcs = item.sources.filter(s => s.kind === 'recipe');

  // Subtitle: qty · pantry hint · recipe emojis
  const parts = [];
  if (item.qty) parts.push(item.qty);
  if (hasPantry) parts.push('pantry');
  if (recipeSrcs.length) {
    parts.push(
      recipeSrcs
        .map(r => `${r.emoji || '🍽️'} ${r.recipe_name}`)
        .join(' · ')
    );
  }
  const subtitle = parts.join(' · ');

  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderBottom: '1px solid var(--cream-dark)',
        cursor: 'pointer', transition: 'background 0.1s',
      }}
    >
      {/* Checkbox */}
      <div style={{
        width: 22, height: 22, borderRadius: 5, flexShrink: 0,
        border: `1.5px solid ${done ? 'var(--forest)' : 'var(--cream-dark)'}`,
        background: done ? 'var(--forest)' : 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, color: 'white', transition: 'all 0.15s',
      }}>
        {done ? '✓' : ''}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14,
          color: done ? 'var(--ink-faint)' : 'var(--ink)',
          textDecoration: done ? 'line-through' : 'none',
          transition: 'all 0.15s',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {item.name}
        </div>
        {subtitle && (
          <div style={{
            fontSize: 11, color: 'var(--ink-faint)', marginTop: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
