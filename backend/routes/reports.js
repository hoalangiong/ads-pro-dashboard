import express from 'express';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from './auth.js';
import { sendMessage } from './telegram.js';

const router = express.Router();
const __dir = path.dirname(fileURLToPath(import.meta.url));
const SCHEDULES_FILE = path.join(__dir, '../data/report_schedules.json');

function loadSchedules() {
  if (!fs.existsSync(SCHEDULES_FILE)) return [];
  return JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf8'));
}
function saveSchedules(s) {
  fs.mkdirSync(path.dirname(SCHEDULES_FILE), { recursive: true });
  fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(s, null, 2));
}

// Active cron jobs map
const activeJobs = new Map();

async function buildReport(fbToken, fbAccount, label, datePreset = 'yesterday') {
  const FB_API = 'https://graph.facebook.com/v19.0';
  const FIELDS = 'impressions,reach,frequency,clicks,ctr,cpc,cpm,spend,purchase_roas,conversions';
  const r = await fetch(`${FB_API}/${fbAccount}/insights?fields=${FIELDS}&level=account&date_preset=${datePreset}&access_token=${fbToken}`);
  const { data } = await r.json();
  if (!data?.length) return null;

  const row = data[0];
  const spend = parseFloat(row.spend || 0);
  const roas = parseFloat(row.purchase_roas?.[0]?.value || 0);
  const ctr = parseFloat(row.ctr || 0);
  const cpc = parseFloat(row.cpc || 0);
  const freq = parseFloat(row.frequency || 0);
  const conv = parseInt(row.conversions || 0);

  const roasEmoji = roas >= 3 ? '🟢' : roas >= 1.5 ? '🟡' : roas > 0 ? '🔴' : '⚪';
  const ctrEmoji = ctr >= 2 ? '🟢' : ctr >= 1 ? '🟡' : '🔴';

  return `📊 <b>Báo cáo ${label}</b>\n` +
    `📅 ${new Date().toLocaleDateString('vi-VN')}\n\n` +
    `💰 Chi tiêu: <b>${spend.toLocaleString('vi-VN')}đ</b>\n` +
    `${roasEmoji} ROAS: <b>${roas > 0 ? roas.toFixed(2) + 'x' : 'N/A'}</b>\n` +
    `${ctrEmoji} CTR: <b>${ctr.toFixed(2)}%</b>\n` +
    `💵 CPC: <b>${cpc.toLocaleString('vi-VN')}đ</b>\n` +
    `🔁 Frequency: <b>${freq.toFixed(2)}</b>\n` +
    `👁 Impressions: <b>${parseInt(row.impressions || 0).toLocaleString('vi-VN')}</b>\n` +
    `🖱 Clicks: <b>${parseInt(row.clicks || 0).toLocaleString('vi-VN')}</b>\n` +
    `✅ Conversions: <b>${conv}</b>`;
}

function startJob(schedule) {
  if (activeJobs.has(schedule.id)) {
    activeJobs.get(schedule.id).stop();
  }
  if (!schedule.enabled) return;

  const job = cron.schedule(schedule.cronExpr, async () => {
    const fbToken = process.env.FB_ACCESS_TOKEN;
    const fbAccount = schedule.accountId || process.env.FB_AD_ACCOUNT_ID;
    if (!fbToken || !fbAccount || !schedule.chatId) return;
    try {
      const msg = await buildReport(fbToken, fbAccount, schedule.label || 'hàng ngày');
      if (msg) await sendMessage(schedule.chatId, msg);
    } catch (e) {
      console.error('Report schedule error:', e.message);
    }
  });
  activeJobs.set(schedule.id, job);
}

// Boot: start all saved schedules
loadSchedules().forEach(startJob);

// GET /api/reports/schedules
router.get('/schedules', requireAuth, (req, res) => res.json(loadSchedules()));

// POST /api/reports/schedules
router.post('/schedules', requireAuth, (req, res) => {
  const { chatId, cronExpr, label, accountId, enabled = true } = req.body;
  if (!chatId || !cronExpr) return res.status(400).json({ error: 'chatId and cronExpr required' });
  if (!cron.validate(cronExpr)) return res.status(400).json({ error: 'cronExpr không hợp lệ' });

  const schedules = loadSchedules();
  const s = { id: Date.now().toString(), chatId, cronExpr, label: label || 'Báo cáo', accountId, enabled };
  schedules.push(s);
  saveSchedules(schedules);
  startJob(s);
  res.json(s);
});

// PUT /api/reports/schedules/:id
router.put('/schedules/:id', requireAuth, (req, res) => {
  const schedules = loadSchedules().map(s => s.id === req.params.id ? { ...s, ...req.body } : s);
  saveSchedules(schedules);
  const updated = schedules.find(s => s.id === req.params.id);
  if (updated) startJob(updated);
  res.json({ ok: true });
});

// DELETE /api/reports/schedules/:id
router.delete('/schedules/:id', requireAuth, (req, res) => {
  if (activeJobs.has(req.params.id)) {
    activeJobs.get(req.params.id).stop();
    activeJobs.delete(req.params.id);
  }
  saveSchedules(loadSchedules().filter(s => s.id !== req.params.id));
  res.json({ ok: true });
});

// POST /api/reports/send-now  — manual trigger
router.post('/send-now', requireAuth, async (req, res) => {
  const { chatId, accountId, label = 'thủ công', datePreset = 'yesterday' } = req.body;
  const fbToken = req.headers['x-fb-token'] || process.env.FB_ACCESS_TOKEN;
  const fbAccount = accountId || req.headers['x-fb-account'] || process.env.FB_AD_ACCOUNT_ID;
  if (!chatId || !fbToken || !fbAccount) return res.status(400).json({ error: 'chatId, fbToken, accountId required' });
  try {
    const msg = await buildReport(fbToken, fbAccount, label, datePreset);
    if (!msg) return res.status(404).json({ error: `Không có dữ liệu ${datePreset}` });
    await sendMessage(chatId, msg);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
