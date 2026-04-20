const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const express = require('express');

/**
 * Shared-password auth for Viikkoruoka.
 *
 * Every family member signs in with the same AUTH_USERNAME / AUTH_PASSWORD
 * set in server/.env. A successful login gets back a JWT that the client
 * attaches to every /api request as an `Authorization: Bearer <token>` header.
 */

const {
  JWT_SECRET,
  JWT_EXPIRES_IN = '30d',
  AUTH_USERNAME,
  AUTH_PASSWORD,
} = process.env;

if (!JWT_SECRET || !AUTH_USERNAME || !AUTH_PASSWORD) {
  console.error(
    '❌ Missing auth env vars. Set JWT_SECRET, AUTH_USERNAME and AUTH_PASSWORD in server/.env'
  );
  // Don't hard-exit here — let the server boot so dev can see a clearer error
  // at request time. But log loudly.
}

/**
 * Constant-time string compare to avoid timing side-channels on password check.
 */
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) {
    // Still run a compare to keep timing roughly constant.
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

function signToken(payload = {}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Express middleware that rejects requests without a valid Bearer token.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/.exec(header);
  if (!match) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    req.user = jwt.verify(match[1], JWT_SECRET);
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── Router ────────────────────────────────────────────────────────
const router = express.Router();

// POST /api/auth/login  { username, password }  →  { token, user }
router.post('/login', (req, res) => {
  if (!JWT_SECRET || !AUTH_USERNAME || !AUTH_PASSWORD) {
    return res.status(500).json({
      error: 'Server auth is not configured. Check JWT_SECRET, AUTH_USERNAME and AUTH_PASSWORD in server/.env',
    });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const userOk = safeEqual(username, AUTH_USERNAME);
  const passOk = safeEqual(password, AUTH_PASSWORD);
  if (!userOk || !passOk) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = signToken({ sub: AUTH_USERNAME });
  return res.json({ token, user: { username: AUTH_USERNAME } });
});

// GET /api/auth/me  — cheap endpoint so the client can verify a stored token.
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: { username: req.user.sub } });
});

module.exports = { router, requireAuth };
