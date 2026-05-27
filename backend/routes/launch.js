import express from 'express';
import { requireAuth } from './auth.js';

const router = express.Router();
const FB_API = 'https://graph.facebook.com/v19.0';
function fbToken(res) { return res.locals.fbToken; }

// GET /api/launch/search-interests?q=hoa+lan
router.get('/search-interests', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q required' });
  const acct = res.locals.fbAccountId;
  try {
    const r = await fetch(
      `${FB_API}/${acct}/targetingsearch?type=adinterest&q=${encodeURIComponent(q)}&limit=10&access_token=${fbToken(res)}`
    );
    const data = await r.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    res.json(data.data || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/launch/create
// body: { page_id, post_id, campaign_name, total_budget (VND/day), pixel_id (optional), adsets: [{name, age_min, age_max, genders, interests}] }
router.post('/create', requireAuth, async (req, res) => {
  const { page_id, post_id, campaign_name, total_budget, pixel_id, adsets } = req.body;
  const acct = res.locals.fbAccountId;
  const tok = fbToken(res);

  if (!page_id || !post_id || !campaign_name || !total_budget || !adsets?.length) {
    return res.status(400).json({ error: 'Thiếu thông tin: page_id, post_id, campaign_name, total_budget, adsets' });
  }
  if (total_budget < adsets.length * 50000) {
    return res.status(400).json({ error: `Budget tối thiểu ${(adsets.length * 50000).toLocaleString('vi-VN')}đ (50k/adset)` });
  }

  const results = { campaign_id: null, adsets: [], ads: [], errors: [] };
  const budgetPerAdset = Math.floor(total_budget / adsets.length);

  try {
    // 1. Create campaign (PAUSED — user activates after review)
    const campR = await fetch(`${FB_API}/${acct}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: campaign_name,
        objective: 'OUTCOME_SALES',
        special_ad_categories: [],
        status: 'PAUSED',
        access_token: tok,
      }),
    });
    const campData = await campR.json();
    if (campData.error) return res.status(400).json({ error: campData.error.message });
    results.campaign_id = campData.id;

    // 2. Create adsets + ads
    for (const adset of adsets) {
      const targeting = {
        geo_locations: { countries: ['VN'] },
        age_min: adset.age_min || 18,
        age_max: adset.age_max || 65,
      };
      if (adset.genders?.length) targeting.genders = adset.genders;
      if (adset.interests?.length) {
        targeting.flexible_spec = [{ interests: adset.interests.map(i => ({ id: String(i.id), name: i.name })) }];
      }

      const adsetBody = {
        name: adset.name,
        campaign_id: results.campaign_id,
        daily_budget: budgetPerAdset * 100, // FB API expects VND * 100
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'OFFSITE_CONVERSIONS',
        targeting,
        status: 'PAUSED',
        access_token: tok,
      };
      if (pixel_id) {
        adsetBody.promoted_object = { pixel_id: String(pixel_id), custom_event_type: 'PURCHASE' };
      }

      const adsetR = await fetch(`${FB_API}/${acct}/adsets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adsetBody),
      });
      const adsetData = await adsetR.json();
      if (adsetData.error) {
        results.errors.push(`Adset "${adset.name}": ${adsetData.error.message}`);
        continue;
      }
      results.adsets.push({ id: adsetData.id, name: adset.name });

      // 3. Create ad using existing post as creative
      const adR = await fetch(`${FB_API}/${acct}/ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Ad - ${adset.name}`,
          adset_id: adsetData.id,
          creative: { object_story_id: `${page_id}_${post_id}` },
          status: 'PAUSED',
          access_token: tok,
        }),
      });
      const adData = await adR.json();
      if (adData.error) {
        results.errors.push(`Ad "${adset.name}": ${adData.error.message}`);
      } else {
        results.ads.push({ id: adData.id, name: `Ad - ${adset.name}` });
      }
    }

    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
