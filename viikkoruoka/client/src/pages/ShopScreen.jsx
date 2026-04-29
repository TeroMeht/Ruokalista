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
 *
 * Behaviour:
 *   • Checking an item persists status='have' on the server for every source
 *     of that item — pantry good and/or each recipe ingredient that put it
 *     here. The item then drops into a dimmed "Done" section at the bottom,
 *     where it can still be unchecked (which flips the same sources back to
 *     'need').
 *   • Refreshing the list (or reloading the app) refetches from the server,
 *     at which point items still flagged 'have' simply don't reappear.
 */

export default function ShopScreen({ categories, recipes, toast }) {
  const [shopData, setShopData] = useState(null);
  const [done, setDone]         = useState({});  // { good_id: true }
  const [busy, setBusy]         = useState({});  // { good_id: true } while a network call is in flight
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getShopping();
      setShopData(data);
      setDone({});  // Fresh list — clear local "done" memory.
    } catch (e) { toast('Error loading shopping list: ' + e.message); }
    setLoading(false);
  }, [toast]);

  // Reload when pantry or recipes state changes (e.g. user flipped an
  // ingredient's have/need status on another tab).
  useEffect(() => { load(); }, [categories, recipes, load]);

  const items = shopData?.items || [];

  // Split by done state, then group the active items by category.
  const activeItems = items.filter(i => !done[i.good_id]);
  const doneItems   = items.filter(i =>  done[i.good_id]);

  const byCategory = [];
  const catIndex = new Map();
  for (const item of activeItems) {
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
  const doneCount = doneItems.length;
  const remaining = total - doneCount;
  const pct       = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  // Persist the new status on every source of this item (pantry and/or each
  // recipe ingredient). We collect promises and await them in parallel.
  async function pushStatus(item, status) {
    const calls = [];
    for (const src of item.sources) {
      if (src.kind === 'pantry') {
        calls.push(api.updateItem(item.good_id, { status }));
      } else if (src.kind === 'recipe' && src.ingredient_id) {
        calls.push(api.patchIngredient(src.recipe_id, src.ingredient_id, { status }));
      }
    }
    await Promise.all(calls);
  }

  async function toggle(item) {
    const id = item.good_id;
    if (busy[id]) return;
    const wasDone = !!done[id];
    // Optimistic flip.
    setDone(d => ({ ...d, [id]: !wasDone }));
    setBusy(b => ({ ...b, [id]: true }));
    try {
      await pushStatus(item, wasDone ? 'need' : 'have');
    } catch (e) {
      // Rollback on error.
      setDone(d => ({ ...d, [id]: wasDone }));
      toast('Error: ' + e.message);
    } finally {
      setBusy(b => {
        const { [id]: _, ...rest } = b;
        return rest;
      });
    }
  }

  function clearDone() {
    // Just forget the local "done" entries — they're already persisted on
    // the server, so a manual refresh will drop them from the list naturally.
    setDone({});
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
        <>
          {byCategory.map(group => (
            <div key={group.id || '__none__'}>
              <div className="section-label">{group.name}</div>
              <div className="card">
                {group.items.map(item => (
                  <ShopItem
                    key={item.good_id}
                    item={item}
                    done={false}
                    busy={!!busy[item.good_id]}
                    onToggle={() => toggle(item)}
                  />
                ))}
              </div>
            </div>
          ))}

          {doneItems.length > 0 && (
            <div style={{ marginTop: 22, opacity: 0.6 }}>
              <div className="section-label" style={{ color: 'var(--ink-faint)' }}>
                Done ({doneItems.length})
              </div>
              <div className="card">
                {doneItems.map(item => (
                  <ShopItem
                    key={item.good_id}
                    item={item}
                    done={true}
                    busy={!!busy[item.good_id]}
                    onToggle={() => toggle(item)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <button
        onClick={load}
        style={{
          width: '100%', marginTop: 14, marginBottom: 24,
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

function ShopItem({ item, done, busy, onToggle }) {
  const recipeSrcs = item.sources.filter(s => s.kind === 'recipe');

  // Subtitle: qty · recipe emojis. Pantry origin is intentionally not shown
  // — at the store the source doesn't matter, and we group by category
  // regardless of whether the item came from the pantry or a recipe.
  const parts = [];
  if (item.qty) parts.push(item.qty);
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
      onClick={busy ? undefined : onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderBottom: '1px solid var(--cream-dark)',
        cursor: busy ? 'default' : 'pointer',
        opacity: busy ? 0.5 : 1,
        transition: 'opacity 0.1s, background 0.1s',
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
