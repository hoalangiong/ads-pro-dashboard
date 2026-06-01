import express from 'express';
import { requireAuth } from './auth.js';

const router = express.Router();
const FB_API = 'https://graph.facebook.com/v19.0';

// GET /api/funnel?account_id=X&date_preset=last_7d&campaign_id=X
router.get('/', requireAuth, async (req, res) => {
  const fbToken = res.locals.fbToken;
  const fbAccount = req.query.account_id || res.locals.fbAccountId;
  const datePreset = req.query.date_preset || 'last_7d';
  const campaignId = req.query.campaign_id;
  if (!fbToken || !fbAccount) return res.status(400).json({ error: 'FB credentials required' });

  try {
    const FIELDS = 'campaign_id,campaign_name,impressions,clicks,actions,cost_per_action_type,spend';
    const level = campaignId ? 'campaign' : 'account';
    let url = `${FB_API}/${campaignId || fbAccount}/insights?fields=${FIELDS}&level=${level}&date_preset=${datePreset}&limit=100&access_token=${fbToken}`;

    const r = await fetch(url);
    const { data } = await r.json();
    if (!data?.length) return res.json({ funnels: [], summary: null });

    const funnels = data.map(row => {
      const actions = row.actions || [];
      const getAction = (type) => {
        const a = actions.find(a => a.action_type === type);
        return a ? parseInt(a.value) : 0;
      };

      const impressions = parseInt(row.impressions || 0);
      const clicks = parseInt(row.clicks || 0);
      const landingViews = getAction('landing_page_view');
      const addToCart = getAction('add_to_cart') || getAction('offsite_conversion.fb_pixel_add_to_cart');
      const purchases = getAction('purchase') || getAction('offsite_conversion.fb_pixel_purchase');
      const leads = getAction('lead') || getAction('offsite_conversion.fb_pixel_lead');

      const steps = [
        { name: 'Impressions', value: impressions },
        { name: 'Clicks', value: clicks },
        { name: 'Landing Page', value: landingViews || Math.round(clicks * 0.85) },
        { name: 'Add to Cart', value: addToCart },
        { name: 'Purchase', value: purchases },
      ];

      // Add leads if present
      if (leads && !purchases) {
        steps[3] = { name: 'Lead', value: leads };
        steps.splice(4, 1);
      }

      // Calculate drop-off
      for (let i = 1; i < steps.length; i++) {
        const prev = steps[i - 1].value;
        steps[i].dropoff_pct = prev > 0 ? Math.round((1 - steps[i].value / prev) * 100) : 0;
        steps[i].conversion_pct = prev > 0 ? ((steps[i].value / prev) * 100).toFixed(1) : '0';
      }

      return {
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name || 'Account Total',
        spend: parseFloat(row.spend || 0),
        steps,
        overall_conversion: impressions > 0 ? ((purchases || leads) / impressions * 100).toFixed(3) : '0',
      };
    });

    // Summary (account level)
    const summary = funnels.length === 1 ? funnels[0] : null;

    res.json({ funnels, summary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/funnel/compare?account_id=X&campaign_ids=id1,id2&date_preset=last_7d
router.get('/compare', requireAuth, async (req, res) => {
  const fbToken = res.locals.fbToken;
  const fbAccount = req.query.account_id || res.locals.fbAccountId;
  const campaignIds = (req.query.campaign_ids || '').split(',').filter(Boolean);
  const datePreset = req.query.date_preset || 'last_7d';
  if (!fbToken || !fbAccount) return res.status(400).json({ error: 'FB credentials required' });
  if (campaignIds.length < 2) return res.status(400).json({ error: 'Need at least 2 campaign_ids' });

  try {
    const FIELDS = 'campaign_id,campaign_name,impressions,clicks,actions,spend';
    const r = await fetch(
      `${FB_API}/${fbAccount}/insights?fields=${FIELDS}&level=campaign&date_preset=${datePreset}&filtering=[{"field":"campaign.id","operator":"IN","value":${JSON.stringify(campaignIds)}}]&limit=100&access_token=${fbToken}`
    );
    const { data } = await r.json();
    if (!data?.length) return res.json({ campaigns: [] });

    const campaigns = data.map(row => {
      const actions = row.actions || [];
      const getAction = (type) => {
        const a = actions.find(a => a.action_type === type);
        return a ? parseInt(a.value) : 0;
      };
      const impressions = parseInt(row.impressions || 0);
      const clicks = parseInt(row.clicks || 0);
      const purchases = getAction('purchase') || getAction('offsite_conversion.fb_pixel_purchase');
      return {
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name,
        impressions,
        clicks,
        ctr: impressions > 0 ? (clicks / impressions * 100).toFixed(2) : '0',
        purchases,
        conversion_rate: clicks > 0 ? (purchases / clicks * 100).toFixed(2) : '0',
        spend: parseFloat(row.spend || 0),
        cpa: purchases > 0 ? (parseFloat(row.spend || 0) / purchases).toFixed(0) : 'N/A',
      };
    });

    res.json({ campaigns });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
