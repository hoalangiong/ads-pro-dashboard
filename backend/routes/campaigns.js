import express from 'express';
import { requireAuth } from './auth.js';
import { get as cacheGet, set as cacheSet } from '../cache.js';
const router = express.Router();

const FB_API = 'https://graph.facebook.com/v19.0';

function token(res) { return res.locals.fbToken; }

// GET /api/campaigns?account_id=act_xxx&level=campaign|adset|ad
router.get('/', requireAuth, async (req, res) => {
  const { account_id, level = 'campaign' } = req.query;
  const acct = account_id || res.locals.fbAccountId;
  if (!acct) return res.status(400).json({ error: 'account_id required' });

  const t = token(res);
  const endpoints = {
    campaign: `${FB_API}/${acct}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time&access_token=${t}`,
    adset: `${FB_API}/${acct}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget,targeting,optimization_goal,billing_event&access_token=${t}`,
    ad: `${FB_API}/${acct}/ads?fields=id,name,status,adset_id,campaign_id,creative{id,name,thumbnail_url}&access_token=${t}`,
  };

  const cacheKey = `campaigns:${acct}:${level}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);

  try {
    const r = await fetch(endpoints[level] || endpoints.campaign);
    const data = await r.json();
    if (data.error) return res.status(400).json(data.error);

    let rows = data.data || [];

    // Follow pagination (up to 5 pages = 500 rows)
    let next = data.paging?.cursors?.after;
    let page = 1;
    while (next && page < 5) {
      const url2 = (endpoints[level] || endpoints.campaign) + `&after=${next}`;
      const r2 = await fetch(url2);
      const d2 = await r2.json();
      if (d2.error || !d2.data?.length) break;
      rows = rows.concat(d2.data);
      next = d2.paging?.cursors?.after;
      page++;
    }

    cacheSet(cacheKey, rows, 120); // cache 2 min
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
