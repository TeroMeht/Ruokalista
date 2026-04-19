import React, { useState, useEffect, useCallback } from 'react';
import Header    from './components/Header.jsx';
import TabBar    from './components/TabBar.jsx';
import PantryScreen  from './pages/PantryScreen.jsx';
import RecipesScreen from './pages/RecipesScreen.jsx';
import ShopScreen    from './pages/ShopScreen.jsx';
import { api } from './lib/api.js';
import { useToast } from './hooks/useToast.js';

export default function App() {
  const [tab, setTab]             = useState('pantry');
  const [categories, setCategories] = useState([]);
  const [recipes, setRecipes]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const { msg: toastMsg, visible: toastVisible, show: toast } = useToast();

  const loadAll = useCallback(async () => {
    try {
      const [cats, recs] = await Promise.all([api.getCategories(), api.getRecipes()]);
      setCategories(cats);
      setRecipes(recs);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, []);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--forest)' }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: 'var(--mint)', marginBottom: 16 }}>Viikkoruoka</div>
        <div style={{ width: 32, height: 32, border: '2.5px solid rgba(184,221,200,0.3)', borderTopColor: 'var(--mint)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--forest)', color: 'var(--mint)', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, marginBottom: 8 }}>Cannot connect to server</div>
        <div style={{ fontSize: 13, color: 'var(--sage)', marginBottom: 24, lineHeight: 1.6 }}>
          Make sure the server is running and DATABASE_URL is set in server/.env
        </div>
        <div style={{ fontSize: 12, background: 'rgba(0,0,0,0.3)', color: 'var(--mint)', padding: '8px 14px', borderRadius: 8, fontFamily: 'monospace', marginBottom: 24 }}>
          {error}
        </div>
        <button onClick={loadAll} style={{ padding: '10px 24px', borderRadius: 8, background: 'var(--mint)', color: 'var(--forest)', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header categories={categories} />

      {/* Screens - all mounted, only active one is visible */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, display: tab === 'pantry' ? 'flex' : 'none', flexDirection: 'column' }}>
          <PantryScreen categories={categories} setCategories={setCategories} toast={toast} />
        </div>
        <div style={{ position: 'absolute', inset: 0, display: tab === 'recipes' ? 'flex' : 'none', flexDirection: 'column' }}>
          <RecipesScreen recipes={recipes} setRecipes={setRecipes} categories={categories} toast={toast} />
        </div>
        <div style={{ position: 'absolute', inset: 0, display: tab === 'shop' ? 'flex' : 'none', flexDirection: 'column' }}>
          <ShopScreen categories={categories} recipes={recipes} toast={toast} />
        </div>
      </div>

      <TabBar active={tab} onChange={setTab} />

      {/* Toast */}
      <div className={`toast ${toastVisible ? 'show' : ''}`}>{toastMsg}</div>
    </div>
  );
}
