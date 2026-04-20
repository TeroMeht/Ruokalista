import React from 'react';

export default function Header({ categories, onSignOut }) {
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <div style={{ fontSize: 13, color: 'var(--mint)', fontWeight: 500 }}>{have}/{total} stocked</div>
        {need > 0 && (
          <div style={{ fontSize: 11, color: 'var(--sage)' }}>{need} items needed</div>
        )}
        {onSignOut && (
          <button
            onClick={onSignOut}
            aria-label="Sign out"
            style={{
              marginTop: 2,
              background: 'transparent',
              color: 'var(--sage)',
              border: '1px solid rgba(184,221,200,0.25)',
              borderRadius: 6,
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '3px 8px',
            }}
          >
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}
