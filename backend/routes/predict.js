import express from 'express';
import { requireAuth } from './auth.js';

const router = express.Router();
const FB_API = 'https://graph.facebook.com/v19.0';

// GET /api/predict?account_id=X
router.get('/', requireAuth, async (req, res) => {
  const fbToken = res.locals.fbToken;
  const fbAccount = req.query.account_id || res.locals.fbAccountId;
  if (!fbToken || !fbAccount) return res.status(400).json({ error: 'FB credentials required' });

  try {
    // Get campaign insights for last 14 days
    const FIELDS = 'campaign_id,campaign_name,spend,purchase_roas,cpc,impressions,clicks,conversions';
    const r = await fetch(
      `${FB_API}/${fbAccount}/insights?fields=${FIELDS}&level=campaign&date_preset=last_14d&limit=100&access_token=${fbToken}`
    );
    const { data } = await r.json();
    if (!data?.length) return res.json({ campaigns: [], total_budget: 0 });

    // Get current budgets
    const campR = await fetch(
      `${FB_API}/${fbAccount}/campaigns?fields=id,name,daily_budget,status&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE"]}]&limit=100&access_token=${fbToken}`
    );
    const campData = await campR.json();
    const budgetMap = {};
    for (const c of (campData.data || [])) {
      budgetMap[c.id] = parseInt(c.daily_budget || 0) / 100; // cents to VND
    }

    // Calculate efficiency score for each campaign
    const campaigns = data
      .filter(row => budgetMap[row.campaign_id] > 0)
      .map(row => {
        const roas = parseFloat(row.purchase_roas?.[0]?.value || 0);
        const cpc = parseFloat(row.cpc || 0);
        const spend = parseFloat(row.spend || 0);
        const conversions = parseInt(row.conversions || 0);
        const clicks = parseInt(row.clicks || 0);

        // Efficiency score: weighted combination
        // Higher ROAS = better, Lower CPC = better, Higher conversion rate = better
        const convRate = clicks > 0 ? conversions / clicks : 0;
        const cpcScore = cpc > 0 ? 1 / cpc * 10000 : 0;
        const efficiency = (roas * 40) + (cpcScore * 30) + (convRate * 100 * 30);

        return {
          campaign_id: row.campaign_id,
          campaign_name: row.campaign_name,
          current_budget: budgetMap[row.campaign_id] || 0,
          spend_14d: spend,
          roas,
          cpc,
          conversions,
          conv_rate: (convRate * 100).toFixed(2),
          efficiency_score: Math.round(efficiency * 100) / 100,
        };
      })
      .sort((a, b) => b.efficiency_score - a.efficiency_score);

    // Calculate recommended budget allocation
    const totalBudget = campaigns.reduce((s, c) => s + c.current_budget, 0);
    const totalEfficiency = campaigns.reduce((s, c) => s + Math.max(c.efficiency_score, 0.1), 0);

    for (const camp of campaigns) {
      const share = totalEfficiency > 0 ? Math.max(camp.efficiency_score, 0.1) / totalEfficiency : 1 / campaigns.length;
      camp.recommended_budget = Math.round(totalBudget * share);
      camp.budget_change_pct = camp.current_budget > 0
        ? Math.round((camp.recommended_budget - camp.current_budget) / camp.current_budget * 100)
        : 0;
      camp.recommendation = camp.budget_change_pct > 20 ? 'Tăng budget'
        : camp.budget_change_pct < -20 ? 'Giảm budget'
        : 'Giữ nguyên';
    }

    res.json({ campaigns, total_budget: totalBudget });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/predict/simulate — simulate budget change
router.post('/simulate', requireAuth, (req, res) => {
  const { campaign, change_pct } = req.body;
  if (!campaign || change_pct === undefined) return res.status(400).json({ error: 'campaign and change_pct required' });

  // Simple linear projection (real-world would use ML)
  const currentRoas = campaign.roas || 0;
  const currentSpend = campaign.current_budget || 0;
  const newBudget = Math.round(currentSpend * (1 + change_pct / 100));

  // Diminishing returns model: ROAS decreases slightly as budget increases
  const diminishingFactor = change_pct > 0 ? 1 - (change_pct / 500) : 1 + (Math.abs(change_pct) / 300);
  const projectedRoas = Math.max(0, currentRoas * diminishingFactor);
  const projectedRevenue = newBudget * projectedRoas;

  res.json({
    current: { budget: currentSpend, roas: currentRoas, revenue: currentSpend * currentRoas },
    projected: { budget: newBudget, roas: Math.round(projectedRoas * 100) / 100, revenue: Math.round(projectedRevenue) },
    change_pct,
    note: change_pct > 50 ? '⚠️ Tăng >50% có thể gây diminishing returns' : null,
  });
});

export default router;
