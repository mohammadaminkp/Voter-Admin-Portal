/**
 * Minimal GitHub OAuth example (demo only)
 * Steps:
 * - Register a GitHub OAuth App and set CLIENT_ID and CLIENT_SECRET in server/.env
 * - Run: node oauth-example.js
 * - Visit /auth to start
 */
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const app = express();
const CLIENT_ID = process.env.GH_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GH_OAUTH_CLIENT_SECRET;
if(!CLIENT_ID || !CLIENT_SECRET) console.warn('Set GH_OAUTH_CLIENT_ID and GH_OAUTH_CLIENT_SECRET in .env');

app.get('/auth', (req,res)=>{
  const redirect = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo`;
  res.redirect(redirect);
});

app.get('/callback', async (req,res)=>{
  const code = req.query.code;
  if(!code) return res.send('No code');
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST', headers: { 'Accept':'application/json','Content-Type':'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code })
  });
  const data = await tokenRes.json();
  // data.access_token contains the token
  res.send(`Access token (store securely): ${data.access_token}`);
});

app.listen(3001, ()=>console.log('OAuth demo listening on http://localhost:3001'));
