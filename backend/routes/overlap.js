import express from 'express';
import { requireAuth } from './auth.js';

const router = express.Router();
const FB_API = 'https://graph.facebook.com/v19.0';

// GET /api/overlap?account_id=X
router.get('/', requireAuth, async (req, res) => {
  const fbToken = res.locals.fbToken;
  const fbAccount = req.query.account_id || res.locals.fbAccountId;
  if (!fbToken || !fbAccount) return res.status(400).json({ error: 'FB credentials required' });

  try {
    // Get ad sets with targeting info
    const r = await fetch(
      `${FB_API}/${fbAccount}/adsets?fields=id,name,targeting,status,campaign{name}&limit=100&access_token=${fbToken}`
    );
    const { data } = await r.json();
    if (!data?.length) return res.json({ adsets: [], warnings: [] });

    const adsets = data.map(a => ({
      id: a.id,
      name: a.name,
      status: a.status,
      campaign_name: a.campaign?.name || '',
      targeting_summary: summarizeTargeting(a.targeting),
      targeting: a.targeting,
    }));

    // Find potential overlaps based on targeting similarity
    const warnings = [];
    for (let i = 0; i < adsets.length; i++) {
      for (let j = i + 1; j < adsets.length; j++) {
        if (adsets[i].status !== 'ACTIVE' || adsets[j].status !== 'ACTIVE') continue;
        const overlap = estimateOverlap(adsets[i].targeting, adsets[j].targeting);
        if (overlap > 30) {
          warnings.push({
            adset_a: { id: adsets[i].id, name: adsets[i].name },
            adset_b: { id: adsets[j].id, name: adsets[j].name },
            overlap_pct: overlap,
            suggestion: overlap > 60
              ? 'Overlap rất cao — nên gộp hoặc thêm exclusion'
              : 'Overlap trung bình — cân nhắc exclusion audience',
          });
        }
      }
    }

    warnings.sort((a, b) => b.overlap_pct - a.overlap_pct);
    res.json({ adsets, warnings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/overlap/check — compare 2 specific ad sets
router.post('/check', requireAuth, async (req, res) => {
  const fbToken = res.locals.fbToken;
  const { adset_a, adset_b } = req.body;
  if (!adset_a || !adset_b) return res.status(400).json({ error: 'adset_a and adset_b required' });

  try {
    // Try FB audience overlap endpoint (requires ads_management permission)
    const r = await fetch(
      `${FB_API}/${adset_a}/delivery_estimate?targeting_spec={"custom_audiences":[{"id":"${adset_b}"}]}&optimization_goal=REACH&access_token=${fbToken}`
    );
    const data = await r.json();

    // Fallback: compare targeting specs
    const [aRes, bRes] = await Promise.all([
      fetch(`${FB_API}/${adset_a}?fields=targeting,name&access_token=${fbToken}`).then(r => r.json()),
      fetch(`${FB_API}/${adset_b}?fields=targeting,name&access_token=${fbToken}`).then(r => r.json()),
    ]);

    const overlap = estimateOverlap(aRes.targeting, bRes.targeting);
    res.json({
      adset_a: { id: adset_a, name: aRes.name, targeting: summarizeTargeting(aRes.targeting) },
      adset_b: { id: adset_b, name: bRes.name, targeting: summarizeTargeting(bRes.targeting) },
      overlap_pct: overlap,
      suggestion: overlap > 60 ? 'Overlap cao — thêm exclusion hoặc gộp' : overlap > 30 ? 'Overlap trung bình' : 'Overlap thấp — OK',
      fb_estimate: data.data || null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function summarizeTargeting(t) {
  if (!t) return 'N/A';
  const parts = [];
  if (t.age_min || t.age_max) parts.push(`${t.age_min || 18}-${t.age_max || 65} tuổi`);
  if (t.genders?.length) parts.push(t.genders.includes(1) ? 'Nam' : t.genders.includes(2) ? 'Nữ' : 'Tất cả');
  if (t.geo_locations?.countries?.length) parts.push(t.geo_locations.countries.join(', '));
  if (t.interests?.length) parts.push(`${t.interests.length} interests`);
  if (t.custom_audiences?.length) parts.push(`${t.custom_audiences.length} custom audiences`);
  return parts.join(' | ') || 'Broad';
}

function estimateOverlap(tA, tB) {
  if (!tA || !tB) return 0;
  let score = 0;
  let factors = 0;

  // Age overlap
  const aMin = tA.age_min || 18, aMax = tA.age_max || 65;
  const bMin = tB.age_min || 18, bMax = tB.age_max || 65;
  const overlapRange = Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin));
  const totalRange = Math.max(aMax, bMax) - Math.min(aMin, bMin);
  if (totalRange > 0) { score += (overlapRange / totalRange) * 100; factors++; }

  // Gender overlap
  const gA = tA.genders || [0], gB = tB.genders || [0];
  if (gA.includes(0) || gB.includes(0) || gA.some(g => gB.includes(g))) { score += 100; }
  factors++;

  // Location overlap
  const locA = tA.geo_locations?.countries || [];
  const locB = tB.geo_locations?.countries || [];
  if (!locA.length || !locB.length || locA.some(l => locB.includes(l))) { score += 100; }
  else { score += 0; }
  factors++;

  // Interest overlap
  const intA = (tA.interests || []).map(i => i.id || i);
  const intB = (tB.interests || []).map(i => i.id || i);
  if (intA.length && intB.length) {
    const common = intA.filter(i => intB.includes(i)).length;
    const total = new Set([...intA, ...intB]).size;
    score += total > 0 ? (common / total) * 100 : 0;
    factors++;
  } else if (!intA.length && !intB.length) {
    score += 100; factors++; // Both broad
  }

  return factors > 0 ? Math.round(score / factors) : 0;
}

export default router;
