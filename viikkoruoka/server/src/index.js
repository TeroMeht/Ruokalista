require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { testConnection } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CLIENT_ORIGIN || true
    : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// ── API Routes ─────────────────────────────────────────────
app.use('/api/pantry',   require('./routes/pantry'));
app.use('/api/recipes',  require('./routes/recipes'));
app.use('/api/shopping', require('./routes/shopping'));

// ── Health check ───────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, env: process.env.NODE_ENV }));

// ── Serve React build in production ────────────────────────
if (process.env.NODE_ENV === 'production') {
  const clientBuild = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientBuild));
  app.get('*', (req, res) => res.sendFile(path.join(clientBuild, 'index.html')));
}

// ── Start ──────────────────────────────────────────────────
async function start() {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`\n🌿 Viikkoruoka server running`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`   ENV: ${process.env.NODE_ENV}\n`);
  });
}

start();
