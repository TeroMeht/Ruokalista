import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';

export default function ShopScreen({ categories, recipes, toast }) {
  const [shopData, setShopData]   = useState(null);
  const [checked, setChecked]     = useState({});
  const [loading, setLoading]     = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getShopping();
      setShopData(data);
    } catch (e) { toast('Error loading shopping list: ' + e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [categories, recipes]);

  function toggle(key) {
    setChecked(c => ({ ...c, [key]: !c[key] }));
  }

  function clearDone() {
    setChecked({});
    toast('Cleared ✓');
  }

  if (loading) return <div className="scroll-area"><div className="spinner" /></div>;

  const recipeNeeds = shopData?.recipe_needs  || [];
  const pantryNeeds = shopData?.pantry_needs  || [];
  const allItems = [
    ...recipeNeeds.map(i => ({ ...i, key: 'r_' + i.name.toLowerCase(), source: 'recipe' })),
    ...pantryNeeds.map(i => ({ ...i, key: 'p_' + i.name.toLowerCase(), source: 'pantry' })),
  ];
  const total     = allItems.length;
  const doneCount = allItems.filter(i => checked[i.key]).length;
  const remaining = total - doneCount;
  const pct       = total > 0 ? Math.round((doneCount / total) * 100) : 0;

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
          <div className="empty-sub">Mark items as "Need" in the pantry to build your shopping list.</div>
        </div>
      ) : (
        <>
          {recipeNeeds.length > 0 && (
            <>
              <div className="section-label">From recipes</div>
              <div className="card">
                {recipeNeeds.map(item => {
                  const key = 'r_' + item.name.toLowerCase();
                  const done = !!checked[key];
                  return (
                    <ShopItem
                      key={key} item={item} itemKey={key}
                      done={done} onToggle={toggle}
                      subtitle={`${item.qty}${item.qty && item.recipes?.length ? ' · ' : ''}${item.recipes?.join(', ') || ''}`}
                      sourceLabel="Recipe" sourceCls="recipe"
                    />
                  );
                })}
              </div>
            </>
          )}

          {pantryNeeds.length > 0 && (
            <>
              <div className="section-label">Pantry restock</div>
              <div className="card">
                {pantryNeeds.map(item => {
                  const key = 'p_' + item.name.toLowerCase();
                  const done = !!checked[key];
                  return (
                    <ShopItem
                      key={key} item={item} itemKey={key}
                      done={done} onToggle={toggle}
                      subtitle={`${item.qty}${item.qty && item.category_name ? ' · ' : ''}${item.category_name || ''}`}
                      sourceLabel="Pantry" sourceCls="pantry"
                    />
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* Refresh button */}
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

function ShopItem({ item, itemKey, done, onToggle, subtitle, sourceLabel, sourceCls }) {
  const sourceColors = {
    recipe: { bg: 'rgba(26,58,42,0.09)', color: 'var(--forest-mid)' },
    pantry: { bg: 'var(--amber-light)',  color: 'var(--amber)' },
  };
  const sc = sourceColors[sourceCls];

  return (
    <div
      onClick={() => onToggle(itemKey)}
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

      {/* Name + subtitle */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: done ? 'var(--ink-faint)' : 'var(--ink)', textDecoration: done ? 'line-through' : 'none', transition: 'all 0.15s' }}>
          {item.name}
        </div>
        {subtitle && (
          <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 1 }}>{subtitle}</div>
        )}
      </div>

      {/* Source badge */}
      <span style={{
        fontSize: 10, fontWeight: 500, padding: '3px 8px',
        borderRadius: 20, background: sc.bg, color: sc.color,
        flexShrink: 0,
      }}>
        {sourceLabel}
      </span>
    </div>
  );
}
