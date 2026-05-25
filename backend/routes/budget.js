import express from 'express';
import { requireAuth } from './auth.js';
import { del as cacheDel } from '../cache.js';

const router = express.Router();
const FB_API = 'https://graph.facebook.com/v19.0';

function token(res) { return res.locals.fbToken; }

// POST /api/budget/pause  body: { objectId, level: 'campaign'|'adset'|'ad' }
router.post('/pause', requireAuth, async (req, res) => {
  const { objectId, level = 'campaign' } = req.body;
  if (!objectId) return res.status(400).json({ error: 'objectId required' });
  try {
    const r = await fetch(`${FB_API}/${objectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAUSED', access_token: token(res) }),
    });
    const data = await r.json();
    if (data.error) return res.status(400).json(data.error);
    cacheDel(`campaigns:${res.locals.fbAccountId}:campaign`);
    cacheDel(`campaigns:${res.locals.fbAccountId}:adset`);
    res.json({ ok: true, objectId, status: 'PAUSED' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/budget/resume
router.post('/resume', requireAuth, async (req, res) => {
  const { objectId } = req.body;
  if (!objectId) return res.status(400).json({ error: 'objectId required' });
  try {
    const r = await fetch(`${FB_API}/${objectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE', access_token: token(res) }),
    });
    const data = await r.json();
    if (data.error) return res.status(400).json(data.error);
    cacheDel(`campaigns:${res.locals.fbAccountId}:campaign`);
    cacheDel(`campaigns:${res.locals.fbAccountId}:adset`);
    res.json({ ok: true, objectId, status: 'ACTIVE' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/budget/adjust  body: { objectId, daily_budget (in VND, will convert to cents) }
router.post('/adjust', requireAuth, async (req, res) => {
  const { objectId, daily_budget } = req.body;
  if (!objectId || !daily_budget) return res.status(400).json({ error: 'objectId and daily_budget required' });
  const budgetVal = parseFloat(daily_budget);
  if (isNaN(budgetVal) || budgetVal <= 0) return res.status(400).json({ error: 'daily_budget phải là số dương' });
  // FB API expects budget in cents (VND * 100)
  const budgetCents = Math.round(budgetVal * 100);
  try {
    const r = await fetch(`${FB_API}/${objectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ daily_budget: budgetCents, access_token: token(res) }),
    });
    const data = await r.json();
    if (data.error) return res.status(400).json(data.error);
    cacheDel(`campaigns:${res.locals.fbAccountId}:campaign`);
    cacheDel(`campaigns:${res.locals.fbAccountId}:adset`);
    res.json({ ok: true, objectId, daily_budget: budgetCents });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
