import express from 'express';
import { requireAuth } from './auth.js';
import { get as cacheGet, set as cacheSet } from '../cache.js';
const router = express.Router();

const FB_API = 'https://graph.facebook.com/v19.0';

// Get all ad accounts for the token
router.get('/', requireAuth, async (req, res) => {
  const token = res.locals.fbToken;
  const cacheKey = `accounts:${token.slice(-16)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);

  try {
    const r = await fetch(`${FB_API}/me/adaccounts?fields=id,name,account_status,currency,timezone_name,amount_spent,balance&access_token=${token}`);
    const data = await r.json();
    if (data.error) return res.status(400).json(data.error);
    cacheSet(cacheKey, data.data, 600); // cache 10 min
    res.json(data.data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
