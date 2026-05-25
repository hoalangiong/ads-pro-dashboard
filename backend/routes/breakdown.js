import express from 'express';
import { requireAuth } from './auth.js';
import { get as cacheGet, set as cacheSet } from '../cache.js';
const router = express.Router();

const FB_API = 'https://graph.facebook.com/v19.0';
function token(res) { return res.locals.fbToken; }

const BASE_FIELDS = 'impressions,reach,clicks,ctr,cpc,cpm,spend,purchase_roas,conversions,cost_per_conversion';

// GET /api/breakdown?account_id=act_xxx&breakdown=age|gender|publisher_platform|device_platform&date_preset=last_7d
router.get('/', requireAuth, async (req, res) => {
  const { account_id, breakdown = 'age', date_preset = 'last_7d', since, until } = req.query;
  const acct = account_id || res.locals.fbAccountId;
  if (!acct) return res.status(400).json({ error: 'account_id required' });

  let timeRange = since && until
    ? `&time_range={"since":"${since}","until":"${until}"}`
    : `&date_preset=${date_preset}`;

  const url = `${FB_API}/${acct}/insights?fields=${BASE_FIELDS}&breakdowns=${breakdown}&level=account${timeRange}&limit=100&access_token=${token(res)}`;
  const cacheKey = `breakdown:${acct}:${breakdown}:${timeRange}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);

  try {
    const r = await fetch(url);
    const data = await r.json();
    if (data.error) return res.status(400).json(data.error);
    const result = { data: data.data || [], breakdown };
    cacheSet(cacheKey, result, 300);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/breakdown/compare?account_id=act_xxx&current_since=...&current_until=...&prev_since=...&prev_until=...
router.get('/compare', requireAuth, async (req, res) => {
  const { account_id, current_since, current_until, prev_since, prev_until, level = 'campaign' } = req.query;
  const acct = account_id || res.locals.fbAccountId;
  if (!acct) return res.status(400).json({ error: 'account_id required' });

  const FIELDS = `${BASE_FIELDS},frequency,campaign_name,adset_name`;

  const fetchPeriod = async (since, until) => {
    const url = `${FB_API}/${acct}/insights?fields=${FIELDS}&level=${level}&time_range={"since":"${since}","until":"${until}"}&limit=100&access_token=${token(res)}`;
    const r = await fetch(url);
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    return d.data || [];
  };

  try {
    const [current, previous] = await Promise.all([
      fetchPeriod(current_since, current_until),
      fetchPeriod(prev_since, prev_until),
    ]);

    // Aggregate totals for each period
    const aggregate = (rows) => rows.reduce((acc, row) => {
      const spend = parseFloat(row.spend || 0);
      const roas = parseFloat(row.purchase_roas?.[0]?.value || 0);
      return {
        spend: acc.spend + spend,
        impressions: acc.impressions + parseInt(row.impressions || 0),
        clicks: acc.clicks + parseInt(row.clicks || 0),
        conversions: acc.conversions + parseInt(row.conversions || 0),
        revenue: acc.revenue + spend * roas,
        ctr: 0, cpc: 0, roas: 0,
      };
    }, { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, ctr: 0, cpc: 0, roas: 0 });

    const calcDerived = (agg) => ({
      ...agg,
      ctr: agg.impressions > 0 ? (agg.clicks / agg.impressions * 100) : 0,
      cpc: agg.clicks > 0 ? (agg.spend / agg.clicks) : 0,
      roas: agg.spend > 0 ? (agg.revenue / agg.spend) : 0,
    });

    const pct = (curr, prev) => prev === 0 ? null : ((curr - prev) / prev * 100);

    const currAgg = calcDerived(aggregate(current));
    const prevAgg = calcDerived(aggregate(previous));

    const comparison = {
      spend: { current: currAgg.spend, previous: prevAgg.spend, change: pct(currAgg.spend, prevAgg.spend) },
      impressions: { current: currAgg.impressions, previous: prevAgg.impressions, change: pct(currAgg.impressions, prevAgg.impressions) },
      clicks: { current: currAgg.clicks, previous: prevAgg.clicks, change: pct(currAgg.clicks, prevAgg.clicks) },
      ctr: { current: currAgg.ctr, previous: prevAgg.ctr, change: pct(currAgg.ctr, prevAgg.ctr) },
      cpc: { current: currAgg.cpc, previous: prevAgg.cpc, change: pct(currAgg.cpc, prevAgg.cpc) },
      roas: { current: currAgg.roas, previous: prevAgg.roas, change: pct(currAgg.roas, prevAgg.roas) },
      conversions: { current: currAgg.conversions, previous: prevAgg.conversions, change: pct(currAgg.conversions, prevAgg.conversions) },
    };

    res.json({ comparison, current, previous });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
