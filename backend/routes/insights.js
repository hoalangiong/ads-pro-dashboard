import express from 'express';
import { requireAuth } from './auth.js';
import { get as cacheGet, set as cacheSet } from '../cache.js';
const router = express.Router();

const FB_API = 'https://graph.facebook.com/v19.0';

function token(res) { return res.locals.fbToken; }

// Core metrics for orchid/fertilizer ecom optimization
const FIELDS = [
  'impressions', 'reach', 'frequency',
  'clicks', 'unique_clicks', 'ctr', 'unique_ctr',
  'cpc', 'cpm', 'cpp',
  'spend', 'actions', 'action_values',
  'cost_per_action_type', 'cost_per_unique_click',
  'purchase_roas', 'website_purchase_roas',
  'conversions', 'conversion_values', 'cost_per_conversion',
  'video_play_actions', 'video_avg_time_watched_actions',
  'outbound_clicks', 'outbound_clicks_ctr',
  'quality_ranking', 'engagement_rate_ranking', 'conversion_rate_ranking',
].join(',');

// GET /api/insights?account_id=act_xxx&level=account|campaign|adset|ad&date_preset=last_7d&since=YYYY-MM-DD&until=YYYY-MM-DD
router.get('/', requireAuth, async (req, res) => {
  const { account_id, level = 'campaign', date_preset, since, until } = req.query;
  const acct = account_id || res.locals.fbAccountId;
  if (!acct) return res.status(400).json({ error: 'account_id required' });

  let timeRange = '';
  if (since && until) {
    timeRange = `&time_range={"since":"${since}","until":"${until}"}`;
  } else {
    timeRange = `&date_preset=${date_preset || 'last_7d'}`;
  }

  const { time_increment } = req.query;
  const tiParam = time_increment ? `&time_increment=${time_increment}` : '';
  const url = `${FB_API}/${acct}/insights?fields=${FIELDS}&level=${level}${timeRange}${tiParam}&limit=100&access_token=${token(res)}`;
  const cacheKey = `insights:${acct}:${level}:${timeRange}${tiParam}`;

  // Use cache for non-today presets (today data changes frequently)
  const isToday = date_preset === 'today';
  if (!isToday) {
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
  }

  try {
    const r = await fetch(url);
    const data = await r.json();
    if (data.error) return res.status(400).json(data.error);

    let rows = data.data || [];

    // Follow pagination cursors (up to 5 pages = 500 rows)
    let next = data.paging?.cursors?.after;
    let page = 1;
    while (next && page < 5) {
      const r2 = await fetch(url + `&after=${next}`);
      const d2 = await r2.json();
      if (d2.error || !d2.data?.length) break;
      rows = rows.concat(d2.data);
      next = d2.paging?.cursors?.after;
      page++;
    }

    // Enrich with computed metrics
    const enriched = rows.map(row => ({
      ...row,
      roas: row.purchase_roas?.[0]?.value || 0,
      ctr_pct: parseFloat(row.ctr || 0).toFixed(2),
      frequency_num: parseFloat(row.frequency || 0).toFixed(2),
    }));

    const result = { data: enriched, paging: data.paging };
    if (!isToday) cacheSet(cacheKey, result, 300); // cache 5 min for non-today
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
