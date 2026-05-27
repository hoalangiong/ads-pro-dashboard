import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';
import campaignRoutes from './routes/campaigns.js';
import insightRoutes from './routes/insights.js';
import exportRoutes from './routes/export.js';
import accountRoutes from './routes/accounts.js';
import aiRoutes from './routes/ai.js';
import authRoutes from './routes/auth.js';
import alertRoutes, { loadRules } from './routes/alerts.js';
import telegramRoutes, { sendMessage } from './routes/telegram.js';
import budgetRoutes from './routes/budget.js';
import breakdownRoutes from './routes/breakdown.js';
import reportsRoutes from './routes/reports.js';
import creativesRoutes from './routes/creatives.js';
import tokenRoutes from './routes/token.js';
import goalsRoutes, { loadGoals } from './routes/goals.js';
import notesRoutes from './routes/notes.js';
import launchRoutes from './routes/launch.js';
import { clear as cacheClear } from './cache.js';

dotenv.config();

const __dir = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  res.locals.fbToken = req.headers['x-fb-token'] || process.env.FB_ACCESS_TOKEN || '';
  res.locals.fbAccountId = req.headers['x-fb-account'] || process.env.FB_AD_ACCOUNT_ID || '';
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/insights', insightRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/breakdown', breakdownRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/creatives', creativesRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/launch', launchRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/cache/clear', (req, res) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  cacheClear();
  res.json({ ok: true, message: 'Cache cleared' });
});

// Serve frontend build from backend (single port)
const frontendDist = path.join(__dir, '../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendDist, 'index.html'));
  }
});

// Auto-check alerts every hour 8h-22h
cron.schedule('0 8-22 * * *', async () => {
  const fbToken = process.env.FB_ACCESS_TOKEN;
  const fbAccount = process.env.FB_AD_ACCOUNT_ID;
  const tgChatId = process.env.TELEGRAM_ALERT_CHAT_ID;
  if (!fbToken || !fbAccount) return;

  try {
    const FB_API = 'https://graph.facebook.com/v19.0';
    const FIELDS = 'campaign_id,campaign_name,impressions,reach,frequency,clicks,ctr,cpc,cpm,spend,purchase_roas,conversions';
    const r = await fetch(`${FB_API}/${fbAccount}/insights?fields=${FIELDS}&level=campaign&date_preset=today&limit=100&access_token=${fbToken}`);
    const { data } = await r.json();
    if (!data?.length) return;

    const rules = loadRules().filter(r => r.enabled);
    const triggered = [];

    for (const row of data) {
      const vals = {
        ctr: parseFloat(row.ctr || 0),
        frequency: parseFloat(row.frequency || 0),
        roas: parseFloat(row.purchase_roas?.[0]?.value || 0),
        cpc: parseFloat(row.cpc || 0),
        spend_no_conversion: parseFloat(row.spend || 0) > 0 && !row.conversions ? parseFloat(row.spend || 0) : 0,
      };
      const name = row.campaign_name || 'Unknown';
      for (const rule of rules) {
        const val = vals[rule.metric];
        if (val === undefined) continue;
        const hit = rule.operator === '>' ? val > rule.threshold : (val > 0 && val < rule.threshold);
        if (hit) triggered.push({ rule: rule.name, name, metric: rule.metric, value: val, threshold: rule.threshold });
      }
    }

    if (triggered.length && tgChatId) {
      const lines = triggered.map(t =>
        `⚠️ <b>${t.rule}</b>\n📌 ${t.name}\n📊 ${t.metric}: <b>${typeof t.value === 'number' ? t.value.toFixed(2) : t.value}</b>`
      ).join('\n\n');
      await sendMessage(tgChatId, `🔔 <b>Ads Alert tự động</b>\n\n${lines}\n\n🕐 ${new Date().toLocaleString('vi-VN')}`);
    }

    // Budget pacing alert — warn if >85% spent before 14:00
    const now = new Date();
    if (now.getHours() < 14 && tgChatId) {
      const campR = await fetch(`${FB_API}/${fbAccount}/campaigns?fields=id,name,daily_budget,status&limit=100&access_token=${fbToken}`);
      const campData = await campR.json();
      const activeCamps = (campData.data || []).filter(c => c.status === 'ACTIVE' && c.daily_budget);
      const spendMap = {};
      for (const row of data) {
        if (row.campaign_id) spendMap[row.campaign_id] = parseFloat(row.spend || 0);
      }
      const pacingAlerts = activeCamps.filter(c => {
        const budget = parseInt(c.daily_budget) / 100;
        const spent = spendMap[c.id] || 0;
        return budget > 0 && spent / budget > 0.85;
      });
      if (pacingAlerts.length) {
        const lines = pacingAlerts.map(c => {
          const budget = parseInt(c.daily_budget) / 100;
          const spent = spendMap[c.id] || 0;
          const pct = Math.round(spent / budget * 100);
          return `💸 <b>${c.name}</b>\n   Đã tiêu: ${spent.toLocaleString('vi-VN')}đ / ${budget.toLocaleString('vi-VN')}đ (${pct}%)`;
        }).join('\n\n');
        await sendMessage(tgChatId, `⚡ <b>Budget sắp hết trước 14:00</b>\n\n${lines}\n\n🕐 ${new Date().toLocaleString('vi-VN')}`);
      }
    }

    // KPI goals check (account-level today)
    const goals = loadGoals();
    if (goals.length && tgChatId) {
      const accR = await fetch(`${FB_API}/${fbAccount}/insights?fields=spend,ctr,cpc,cpm,frequency,purchase_roas,conversions&level=account&date_preset=today&access_token=${fbToken}`);
      const { data: accData } = await accR.json();
      const acc = accData?.[0];
      if (acc) {
        const vals = {
          roas: parseFloat(acc.purchase_roas?.[0]?.value || 0),
          ctr: parseFloat(acc.ctr || 0),
          cpc: parseFloat(acc.cpc || 0),
          cpm: parseFloat(acc.cpm || 0),
          frequency: parseFloat(acc.frequency || 0),
          spend: parseFloat(acc.spend || 0),
          conversions: parseFloat(acc.conversions || 0),
        };
        const missed = goals.filter(g => {
          const v = vals[g.metric];
          if (!v) return false;
          return g.higherIsBetter ? v < g.target : v > g.target;
        });
        if (missed.length) {
          const lines = missed.map(g => {
            const v = vals[g.metric];
            const fmt = ['cpc','cpm','spend'].includes(g.metric) ? `${v.toLocaleString('vi-VN')}${g.unit}` : `${v.toFixed(2)}${g.unit}`;
            return `🎯 <b>${g.name}</b>: ${fmt} (mục tiêu ${g.higherIsBetter ? '≥' : '≤'} ${g.target}${g.unit})`;
          }).join('\n');
          await sendMessage(tgChatId, `📉 <b>KPI chưa đạt hôm nay</b>\n\n${lines}\n\n🕐 ${new Date().toLocaleString('vi-VN')}`);
        }
      }
    }
  } catch (e) {
    console.error('Cron alert error:', e.message);
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Ads backend running on port ${PORT} — http://localhost:${PORT}`));


