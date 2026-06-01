import express from 'express';
import { requireAuth } from './auth.js';
import { sendMessage } from './telegram.js';

const router = express.Router();
const FB_API = 'https://graph.facebook.com/v19.0';

// GET /api/fatigue?account_id=X
router.get('/', requireAuth, async (req, res) => {
  const fbToken = res.locals.fbToken;
  const fbAccount = req.query.account_id || res.locals.fbAccountId;
  if (!fbToken || !fbAccount) return res.status(400).json({ error: 'FB credentials required' });

  try {
    const result = await analyzeFatigue(fbToken, fbAccount);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export async function analyzeFatigue(fbToken, fbAccount) {
  // Get active ads with daily insights for last 7 days
  const FIELDS = 'ad_id,ad_name,campaign_name,impressions,clicks,ctr,frequency,date_start,date_stop';
  const r = await fetch(
    `${FB_API}/${fbAccount}/insights?fields=${FIELDS}&level=ad&date_preset=last_7d&time_increment=1&limit=500&access_token=${fbToken}`
  );
  const { data } = await r.json();
  if (!data?.length) return { creatives: [], fatigued: 0, warning: 0 };

  // Group by ad_id
  const byAd = {};
  for (const row of data) {
    const id = row.ad_id;
    if (!byAd[id]) byAd[id] = { id, name: row.ad_name, campaign: row.campaign_name, days: [] };
    byAd[id].days.push({
      date: row.date_start,
      ctr: parseFloat(row.ctr || 0),
      frequency: parseFloat(row.frequency || 0),
      impressions: parseInt(row.impressions || 0),
    });
  }

  const creatives = [];
  for (const ad of Object.values(byAd)) {
    const days = ad.days.sort((a, b) => a.date.localeCompare(b.date));
    if (days.length < 4) continue; // Need at least 4 days of data

    // First 3 days avg CTR
    const first3 = days.slice(0, 3);
    const ctrFirst = first3.reduce((s, d) => s + d.ctr, 0) / first3.length;

    // Last 3 days avg CTR
    const last3 = days.slice(-3);
    const ctrLast = last3.reduce((s, d) => s + d.ctr, 0) / last3.length;

    // Current frequency (last day)
    const freqCurrent = days[days.length - 1].frequency;

    // Calculate decline
    const decline = ctrFirst > 0 ? ((ctrFirst - ctrLast) / ctrFirst) * 100 : 0;

    let status = 'fresh';
    let suggestion = '';
    if (decline > 30 && freqCurrent > 3) {
      status = 'fatigued';
      suggestion = 'Thay creative mới ngay — CTR giảm mạnh + frequency cao';
    } else if (decline > 20 || freqCurrent > 3) {
      status = 'warning';
      suggestion = decline > 20 ? 'CTR đang giảm — chuẩn bị creative thay thế' : 'Frequency cao — mở rộng audience hoặc thay creative';
    }

    creatives.push({
      id: ad.id,
      name: ad.name,
      campaign: ad.campaign,
      ctr_first: ctrFirst,
      ctr_current: ctrLast,
      ctr_decline_pct: Math.round(decline),
      frequency: freqCurrent,
      days_running: days.length,
      status,
      suggestion,
    });
  }

  // Sort: fatigued first, then warning, then fresh
  const order = { fatigued: 0, warning: 1, fresh: 2 };
  creatives.sort((a, b) => order[a.status] - order[b.status]);

  return {
    creatives,
    fatigued: creatives.filter(c => c.status === 'fatigued').length,
    warning: creatives.filter(c => c.status === 'warning').length,
    fresh: creatives.filter(c => c.status === 'fresh').length,
  };
}

// Telegram alert for fatigued creatives (called by cron)
export async function alertFatigue(fbToken, fbAccount) {
  const tgChatId = process.env.TELEGRAM_ALERT_CHAT_ID;
  if (!tgChatId || !fbToken || !fbAccount) return;

  const result = await analyzeFatigue(fbToken, fbAccount);
  const fatigued = result.creatives.filter(c => c.status === 'fatigued');
  if (!fatigued.length) return;

  const lines = fatigued.slice(0, 5).map(c =>
    `😴 <b>${c.name}</b>\n   CTR: ${c.ctr_first.toFixed(2)}% → ${c.ctr_current.toFixed(2)}% (↓${c.ctr_decline_pct}%)\n   Frequency: ${c.frequency.toFixed(1)}`
  ).join('\n\n');
  await sendMessage(tgChatId, `🎨 <b>Creative Fatigue Alert</b>\n\n${lines}\n\n💡 Nên thay creative mới\n🕐 ${new Date().toLocaleString('vi-VN')}`);
}

export default router;
