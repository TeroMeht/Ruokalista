import React from 'react';

export default function Header({ categories }) {
  const total = categories.reduce((s, c) => s + c.items.length, 0);
  const have  = categories.reduce((s, c) => s + c.items.filter(i => i.status === 'have').length, 0);
  const need  = categories.reduce((s, c) => s + c.items.filter(i => i.status === 'need').length, 0);

  return (
    <header style={{
      background: 'var(--forest)',
      padding: 'env(safe-area-inset-top,0) 18px 12px',
      paddingTop: 'max(env(safe-area-inset-top,0px), 14px)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      flexShrink: 0,
    }}>
      <div>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: 'var(--mint)' }}>
          Viikkoruoka
        </div>
        <div style={{ fontSize: 11, color: 'var(--sage)', marginTop: 2, opacity: 0.85 }}>
          Weekly Grocery Planner
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 13, color: 'var(--mint)', fontWeight: 500 }}>{have}/{total} stocked</div>
        {need > 0 && (
          <div style={{ fontSize: 11, color: 'var(--sage)', marginTop: 2 }}>{need} items needed</div>
        )}
      </div>
    </header>
  );
}
