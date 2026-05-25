import express from 'express';
import { requireAuth } from './auth.js';
import { get as cacheGet, set as cacheSet } from '../cache.js';

const router = express.Router();
const FB_API = 'https://graph.facebook.com/v19.0';
function token(res) { return res.locals.fbToken; }

// GET /api/creatives?account_id=act_xxx&date_preset=last_7d
router.get('/', requireAuth, async (req, res) => {
  const { account_id, date_preset = 'last_7d' } = req.query;
  const acct = account_id || res.locals.fbAccountId;
  if (!acct) return res.status(400).json({ error: 'account_id required' });

  const FIELDS = [
    'ad_name', 'adset_name', 'campaign_name',
    'impressions', 'reach', 'frequency',
    'clicks', 'ctr', 'cpc', 'cpm', 'spend',
    'purchase_roas', 'conversions', 'cost_per_conversion',
    'video_play_actions', 'video_avg_time_watched_actions',
    'video_p25_watched_actions', 'video_p50_watched_actions',
    'video_p75_watched_actions', 'video_p100_watched_actions',
    'outbound_clicks', 'outbound_clicks_ctr',
    'quality_ranking', 'engagement_rate_ranking', 'conversion_rate_ranking',
  ].join(',');

  const url = `${FB_API}/${acct}/insights?fields=${FIELDS}&level=ad&date_preset=${date_preset}&limit=50&access_token=${token(res)}`;
  const cacheKey = `creatives:${acct}:${date_preset}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);

  try {
    const r = await fetch(url);
    const data = await r.json();
    if (data.error) return res.status(400).json(data.error);

    const enriched = (data.data || []).map(row => ({
      ...row,
      roas: parseFloat(row.purchase_roas?.[0]?.value || 0),
      video_retention_pct: row.video_p100_watched_actions?.[0]?.value && parseFloat(row.video_play_actions?.[0]?.value) > 0
        ? (parseFloat(row.video_p100_watched_actions[0].value) / parseFloat(row.video_play_actions[0].value) * 100).toFixed(1)
        : null,
      hook_rate: row.video_p25_watched_actions?.[0]?.value && parseFloat(row.video_play_actions?.[0]?.value) > 0
        ? (parseFloat(row.video_p25_watched_actions[0].value) / parseFloat(row.video_play_actions[0].value) * 100).toFixed(1)
        : null,
    }));

    // Sort by spend desc
    enriched.sort((a, b) => parseFloat(b.spend || 0) - parseFloat(a.spend || 0));

    const result = { data: enriched };
    cacheSet(cacheKey, result, 300);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
