import React from 'react';

const TABS = [
  {
    id: 'pantry', label: 'Pantry',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3"/>
        <path d="M9 8h6M9 12h6M9 16h4"/>
      </svg>
    ),
  },
  {
    id: 'recipes', label: 'Recipes',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a7 7 0 0 1 7 7c0 4-3 6-4 9H9c-1-3-4-5-4-9a7 7 0 0 1 7-7z"/>
        <path d="M9 21h6M10 17h4"/>
      </svg>
    ),
  },
  {
    id: 'shop', label: 'Shop',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>
      </svg>
    ),
  },
];

export default function TabBar({ active, onChange }) {
  return (
    <nav style={{
      height: 'var(--tab-h)',
      background: 'var(--forest)',
      display: 'flex',
      borderTop: '1px solid rgba(255,255,255,0.07)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      flexShrink: 0,
    }}>
      {TABS.map(tab => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 4, border: 'none', background: 'none',
              color: isActive ? 'var(--mint)' : 'rgba(184,221,200,0.38)',
              fontSize: 11, fontWeight: 500,
              padding: '8px 0',
              transition: 'color 0.18s',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              position: 'relative',
            }}
          >
            {isActive && (
              <span style={{
                position: 'absolute', top: 0, left: '50%',
                transform: 'translateX(-50%)',
                width: 28, height: 2,
                background: 'var(--mint)',
                borderRadius: '0 0 2px 2px',
              }} />
            )}
            <span style={{
              width: 24, height: 24,
              transform: isActive ? 'scale(1.1)' : 'scale(1)',
              transition: 'transform 0.18s',
            }}>
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
