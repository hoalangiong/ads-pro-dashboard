import express from 'express';
import { requireAuth } from './auth.js';
import { loadGoals } from './goals.js';
const router = express.Router();

// POST /api/ai/optimize  body: { insights: [...] }
router.post('/optimize', requireAuth, (req, res) => {
  const { insights } = req.body;
  if (!insights?.length) return res.status(400).json({ error: 'insights required' });

  const goals = loadGoals();
  const goalMap = {};
  for (const g of goals) goalMap[g.metric] = g;

  const suggestions = [];

  for (const row of insights) {
    const ctr = parseFloat(row.ctr || 0);
    const cpc = parseFloat(row.cpc || 0);
    const freq = parseFloat(row.frequency || 0);
    const roas = parseFloat(row.purchase_roas?.[0]?.value || row.roas || 0);
    const spend = parseFloat(row.spend || 0);
    const name = row.campaign_name || row.adset_name || row.ad_name || row.account_id || 'Unknown';

    const tips = [];

    // Goal-aware checks
    const roasGoal = goalMap['roas'];
    const ctrGoal = goalMap['ctr'];
    const cpcGoal = goalMap['cpc'];
    const freqGoal = goalMap['frequency'];

    if (roas > 0 && roasGoal) {
      if (roas < roasGoal.target) tips.push({ level: roas < roasGoal.target * 0.5 ? 'danger' : 'warning', msg: `ROAS ${roas.toFixed(2)}x thấp hơn mục tiêu ${roasGoal.target}x — xem xét tối ưu landing page hoặc tắt nhóm kém` });
      else tips.push({ level: 'good', msg: `ROAS ${roas.toFixed(2)}x đạt mục tiêu ${roasGoal.target}x — có thể tăng budget để scale` });
    } else if (roas > 0 && roas < 1.5) {
      tips.push({ level: 'danger', msg: `ROAS thấp (${roas.toFixed(2)}x) — xem xét tắt hoặc tối ưu landing page` });
    } else if (roas >= 3) {
      tips.push({ level: 'good', msg: `ROAS tốt (${roas.toFixed(2)}x) — tăng budget để scale` });
    }

    if (ctr > 0 && ctrGoal) {
      if (ctr < ctrGoal.target) tips.push({ level: 'warning', msg: `CTR ${ctr.toFixed(2)}% thấp hơn mục tiêu ${ctrGoal.target}% — thử thay creative, headline hoặc thu hẹp audience` });
      else if (ctr > ctrGoal.target * 2) tips.push({ level: 'good', msg: `CTR ${ctr.toFixed(2)}% vượt mục tiêu ${ctrGoal.target}% — nhân rộng creative này` });
    } else if (ctr < 1) {
      tips.push({ level: 'warning', msg: `CTR thấp (${ctr.toFixed(2)}%) — thử thay creative, headline hoặc thu hẹp audience` });
    } else if (ctr > 5) {
      tips.push({ level: 'good', msg: `CTR tốt (${ctr.toFixed(2)}%) — có thể scale budget` });
    }

    if (freq > 0 && freqGoal) {
      if (freq > freqGoal.target) tips.push({ level: 'warning', msg: `Frequency ${freq.toFixed(1)} vượt mục tiêu ${freqGoal.target} — audience bị mệt mỏi, cần refresh creative hoặc mở rộng audience` });
    } else if (freq > 3.5) {
      tips.push({ level: 'warning', msg: `Frequency cao (${freq.toFixed(1)}) — audience bị mệt mỏi, cần refresh creative hoặc mở rộng audience` });
    }

    if (cpc > 0 && cpcGoal) {
      if (cpc > cpcGoal.target) tips.push({ level: 'warning', msg: `CPC ${Number(cpc).toLocaleString('vi-VN')}đ vượt mục tiêu ${Number(cpcGoal.target).toLocaleString('vi-VN')}đ — thử broad audience hoặc Advantage+ targeting` });
    } else if (cpc > 5000) {
      tips.push({ level: 'warning', msg: `CPC cao (${Number(cpc).toLocaleString('vi-VN')}đ) — thử broad audience hoặc Advantage+ targeting` });
    }

    if (spend > 0 && roas === 0) tips.push({ level: 'danger', msg: `Đã chi ${Number(spend).toLocaleString('vi-VN')}đ nhưng chưa có conversion — kiểm tra pixel và sự kiện` });

    if (tips.length === 0) tips.push({ level: 'info', msg: 'Chỉ số ổn định, tiếp tục theo dõi' });

    suggestions.push({ name, tips });
  }

  res.json({ suggestions });
});

// POST /api/ai/campaign-template  body: { objective, budget, product }
router.post('/campaign-template', requireAuth, (req, res) => {
  const { objective = 'CONVERSIONS', budget = 200000, product = 'hoa lan' } = req.body;

  const template = {
    campaign: {
      name: `[${product.toUpperCase()}] ${objective} - ${new Date().toLocaleDateString('vi-VN')}`,
      objective,
      status: 'PAUSED',
      special_ad_categories: [],
    },
    adsets: [
      {
        name: 'Audience - Sở thích hoa lan & cây cảnh',
        daily_budget: Math.round(budget * 0.5),
        targeting: {
          age_min: 25, age_max: 55,
          genders: [1, 2],
          interests: ['hoa lan', 'cây cảnh', 'làm vườn', 'nông nghiệp'],
          geo_locations: { countries: ['VN'] },
        },
        optimization_goal: 'OFFSITE_CONVERSIONS',
        billing_event: 'IMPRESSIONS',
      },
      {
        name: 'Audience - Retargeting website visitors',
        daily_budget: Math.round(budget * 0.3),
        targeting: { custom_audiences: ['website_visitors_30d'] },
        optimization_goal: 'OFFSITE_CONVERSIONS',
        billing_event: 'IMPRESSIONS',
      },
      {
        name: 'Audience - Lookalike buyers 1%',
        daily_budget: Math.round(budget * 0.2),
        targeting: { lookalike_audiences: ['buyers_lookalike_1pct'] },
        optimization_goal: 'OFFSITE_CONVERSIONS',
        billing_event: 'IMPRESSIONS',
      },
    ],
    tips: [
      'Dùng video 15-30s cho hoa lan — show màu sắc và kích thước thực tế',
      'Headline nên có giá hoặc ưu đãi cụ thể (VD: "Lan Hồ Điệp 5 cành chỉ 299k")',
      'Chạy A/B test ít nhất 3 creative trước khi scale',
      'Pixel phải track sự kiện Purchase và AddToCart',
    ],
  };

  res.json(template);
});

export default router;
