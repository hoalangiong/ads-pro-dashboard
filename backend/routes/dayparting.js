import express from 'express';
import { requireAuth } from './auth.js';

const router = express.Router();
const FB_API = 'https://graph.facebook.com/v19.0';

// GET /api/dayparting?account_id=X&date_preset=last_7d
router.get('/', requireAuth, async (req, res) => {
  const fbToken = res.locals.fbToken;
  const fbAccount = req.query.account_id || res.locals.fbAccountId;
  const datePreset = req.query.date_preset || 'last_7d';
  if (!fbToken || !fbAccount) return res.status(400).json({ error: 'FB credentials required' });

  try {
    const FIELDS = 'impressions,clicks,ctr,cpc,cpm,spend,purchase_roas';
    const r = await fetch(
      `${FB_API}/${fbAccount}/insights?fields=${FIELDS}&level=account&date_preset=${datePreset}&breakdowns=hourly_stats_aggregated_by_advertiser_time_zone&limit=500&access_token=${fbToken}`
    );
    const { data } = await r.json();
    if (!data?.length) return res.json({ heatmap: [], recommend: { golden: [], avoid: [] } });

    // Parse hourly data
    const heatmap = data.map(row => ({
      hour: row.hourly_stats_aggregated_by_advertiser_time_zone,
      impressions: parseInt(row.impressions || 0),
      clicks: parseInt(row.clicks || 0),
      ctr: parseFloat(row.ctr || 0),
      cpc: parseFloat(row.cpc || 0),
      cpm: parseFloat(row.cpm || 0),
      spend: parseFloat(row.spend || 0),
      roas: parseFloat(row.purchase_roas?.[0]?.value || 0),
    }));

    // Recommendations
    const avgCpc = heatmap.reduce((s, h) => s + h.cpc, 0) / heatmap.length;
    const avgCtr = heatmap.reduce((s, h) => s + h.ctr, 0) / heatmap.length;

    const golden = heatmap
      .filter(h => h.cpc < avgCpc * 0.8 && h.ctr > avgCtr * 1.2 && h.impressions > 0)
      .map(h => h.hour)
      .sort();

    const avoid = heatmap
      .filter(h => h.cpc > avgCpc * 1.3 && h.ctr < avgCtr * 0.7 && h.impressions > 0)
      .map(h => h.hour)
      .sort();

    res.json({ heatmap, recommend: { golden, avoid, avgCpc, avgCtr } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/dayparting/recommend
router.get('/recommend', requireAuth, async (req, res) => {
  const fbToken = res.locals.fbToken;
  const fbAccount = req.query.account_id || res.locals.fbAccountId;
  if (!fbToken || !fbAccount) return res.status(400).json({ error: 'FB credentials required' });

  try {
    const FIELDS = 'ctr,cpc,spend,purchase_roas';
    const r = await fetch(
      `${FB_API}/${fbAccount}/insights?fields=${FIELDS}&level=account&date_preset=last_14d&breakdowns=hourly_stats_aggregated_by_advertiser_time_zone&limit=500&access_token=${fbToken}`
    );
    const { data } = await r.json();
    if (!data?.length) return res.json({ golden: [], avoid: [], summary: 'Chưa đủ data' });

    const hours = {};
    for (const row of data) {
      const h = row.hourly_stats_aggregated_by_advertiser_time_zone;
      if (!hours[h]) hours[h] = { cpc: [], ctr: [], spend: 0, roas: [] };
      hours[h].cpc.push(parseFloat(row.cpc || 0));
      hours[h].ctr.push(parseFloat(row.ctr || 0));
      hours[h].spend += parseFloat(row.spend || 0);
      hours[h].roas.push(parseFloat(row.purchase_roas?.[0]?.value || 0));
    }

    const avg = (arr) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
    const hourStats = Object.entries(hours).map(([h, v]) => ({
      hour: h,
      avg_cpc: avg(v.cpc),
      avg_ctr: avg(v.ctr),
      avg_roas: avg(v.roas),
      total_spend: v.spend,
    }));

    const overallCpc = avg(hourStats.map(h => h.avg_cpc));
    const golden = hourStats.filter(h => h.avg_cpc < overallCpc * 0.8).map(h => h.hour).sort();
    const avoid = hourStats.filter(h => h.avg_cpc > overallCpc * 1.3).map(h => h.hour).sort();

    res.json({ golden, avoid, hourStats, summary: `${golden.length} giờ vàng, ${avoid.length} giờ nên tránh` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
