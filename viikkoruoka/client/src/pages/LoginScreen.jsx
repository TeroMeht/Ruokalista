import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { auth } from '../lib/auth.js';

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState(null);
  const [busy, setBusy]         = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { token } = await api.login(username.trim(), password);
      auth.setToken(token);
      onLogin?.();
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={brand}>Viikkoruoka</div>
        <div style={tagline}>Sign in to the family pantry</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={label}>
            <span style={labelText}>Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
              style={input}
            />
          </label>

          <label style={label}>
            <span style={labelText}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={input}
            />
          </label>

          {error && <div style={errorBox}>{error}</div>}

          <button type="submit" disabled={busy} style={{ ...button, opacity: busy ? 0.7 : 1 }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

const wrap = {
  height: '100%',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  background: 'var(--forest)',
};

const card = {
  width: '100%',
  maxWidth: 360,
  background: 'var(--parchment)',
  borderRadius: 'var(--r-lg)',
  padding: '32px 24px 28px',
  boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
};

const brand = {
  fontFamily: "'DM Serif Display', serif",
  fontSize: 30,
  color: 'var(--forest)',
  textAlign: 'center',
};

const tagline = {
  fontSize: 13,
  color: 'var(--ink-soft)',
  textAlign: 'center',
  marginTop: 4,
  marginBottom: 22,
};

const label = { display: 'flex', flexDirection: 'column', gap: 6 };

const labelText = {
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ink-soft)',
};

const input = {
  padding: '10px 12px',
  border: '1px solid var(--cream-dark)',
  borderRadius: 'var(--r-sm)',
  fontSize: 15,
  background: 'white',
  color: 'var(--ink)',
  outline: 'none',
};

const button = {
  marginTop: 6,
  padding: '11px 14px',
  border: 'none',
  borderRadius: 'var(--r-sm)',
  background: 'var(--forest)',
  color: 'var(--mint)',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
};

const errorBox = {
  background: 'var(--rust-light)',
  color: 'var(--rust)',
  border: '1px solid rgba(196,81,42,0.2)',
  borderRadius: 'var(--r-sm)',
  padding: '8px 10px',
  fontSize: 13,
};
