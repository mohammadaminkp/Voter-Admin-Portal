require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Server-level token (optional fallback) - keep it secret in .env for admin ops
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || null;

// OAuth client config (for full OAuth flow)
const OAUTH_CLIENT_ID = process.env.GH_OAUTH_CLIENT_ID || null;
const OAUTH_CLIENT_SECRET = process.env.GH_OAUTH_CLIENT_SECRET || null;
// Session store (SQLite) - for demo/persisted sessions. Not production-grade without config.
app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: './server' }),
  secret: process.env.SESSION_SECRET || 'change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true }
}));

// Helper: perform request to GitHub API using either session token or server token
async function forwardToGitHub(req, res){
  const ghPath = req.params[0];
  const url = `https://api.github.com/${ghPath}`;
  const method = req.method;
  const headers = { 'Accept': 'application/vnd.github+json' };
  // Prefer per-session token (from OAuth), fall back to server token if available
  const sessionToken = req.session && req.session.access_token;
  if(sessionToken) headers['Authorization'] = `token ${sessionToken}`;
  else if(GITHUB_TOKEN) headers['Authorization'] = `token ${GITHUB_TOKEN}`;
  try{
    const opts = { method, headers };
  if(['POST','PUT','PATCH','DELETE'].includes(method) && req.body) opts.body = JSON.stringify(req.body);
  const r = await fetch(url, opts);
  const text = await r.text();
    res.status(r.status).set('content-type', r.headers.get('content-type') || 'application/json').send(text);
  }catch(e){ res.status(500).send({ error: String(e) }); }
}

// Proxy endpoint
app.all('/gh/*', forwardToGitHub);

// OAuth routes
app.get('/auth', (req, res) => {
  if(!OAUTH_CLIENT_ID) return res.status(500).send('OAuth client not configured on server');
  const state = Math.random().toString(36).slice(2);
  req.session.oauth_state = state;
  const redirectUri = `${req.protocol}://${req.get('host')}/callback`;
  const url = `https://github.com/login/oauth/authorize?client_id=${OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=repo`;
  res.redirect(url);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code; const state = req.query.state;
  if(!code || !state || state !== req.session.oauth_state) return res.status(400).send('Invalid OAuth callback');
  // Exchange code for access token
  try{
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
  method: 'POST',
  headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
  body: JSON.stringify({ client_id: OAUTH_CLIENT_ID, client_secret: OAUTH_CLIENT_SECRET, code })
  });
  const tokenJson = await tokenRes.json();
  if(tokenJson.error) return res.status(400).send('OAuth token error: ' + tokenJson.error);
  // Save token into session
  req.session.access_token = tokenJson.access_token;
  res.send('OAuth successful. You can close this window and return to the Admin UI.');
  }catch(e){ res.status(500).send('OAuth exchange failed: ' + String(e)); }
});

// Session info
app.get('/session', (req, res) => {
  res.json({ logged_in: !!(req.session && req.session.access_token) });
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(err=>{ if(err) return res.status(500).send('Logout failed'); res.send('Logged out'); });
});

app.listen(PORT, ()=>console.log(`Proxy+OAuth server listening on http://localhost:${PORT}`));
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

// Set GITHUB_TOKEN as environment variable on the server for safety.
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if(!GITHUB_TOKEN) console.warn('Warning: GITHUB_TOKEN not set. Proxy requests will fail.');

// Proxy endpoint: forward requests to GitHub API with server-side token
app.all('/gh/*', async (req, res) => {
  const ghPath = req.params[0];
  const url = `https://api.github.com/${ghPath}`;
  const method = req.method;
  const headers = { 'Accept': 'application/vnd.github+json' };
  if(GITHUB_TOKEN) headers['Authorization'] = `token ${GITHUB_TOKEN}`;
  try{
    const opts = { method, headers };
    if(['POST','PUT','PATCH','DELETE'].includes(method) && req.body) opts.body = JSON.stringify(req.body);
    const r = await fetch(url, opts);
    const text = await r.text();
    res.status(r.status).set('content-type', r.headers.get('content-type') || 'application/json').send(text);
  }catch(e){ res.status(500).send({ error: String(e) }); }
});

app.listen(3000, ()=>console.log('Proxy server listening on http://localhost:3000'));
