import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from './auth.js';
import { del as cacheDel } from '../cache.js';
import { sendMessage } from './telegram.js';

const router = express.Router();
const __dir = path.dirname(fileURLToPath(import.meta.url));
const RULES_FILE = path.join(__dir, '../data/autorules.json');
const LOG_FILE = path.join(__dir, '../data/autorules_log.json');
const FB_API = 'https://graph.facebook.com/v19.0';

function loadRules() {
  if (!fs.existsSync(RULES_FILE)) return [];
  return JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
}
function saveRules(r) {
  fs.mkdirSync(path.dirname(RULES_FILE), { recursive: true });
  fs.writeFileSync(RULES_FILE, JSON.stringify(r, null, 2));
}
function loadLog() {
  if (!fs.existsSync(LOG_FILE)) return [];
  return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
}
function saveLog(l) {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify(l.slice(-500), null, 2));
}

// GET /api/autorules
router.get('/', requireAuth, (req, res) => res.json(loadRules()));

// POST /api/autorules
router.post('/', requireAuth, (req, res) => {
  const rules = loadRules();
  const rule = { id: Date.now().toString(), enabled: true, last_triggered: null, ...req.body };
  rules.push(rule);
  saveRules(rules);
  res.json(rule);
});

// PUT /api/autorules/:id
router.put('/:id', requireAuth, (req, res) => {
  const rules = loadRules().map(r => r.id === req.params.id ? { ...r, ...req.body } : r);
  saveRules(rules);
  res.json({ ok: true });
});

// DELETE /api/autorules/:id
router.delete('/:id', requireAuth, (req, res) => {
  saveRules(loadRules().filter(r => r.id !== req.params.id));
  res.json({ ok: true });
});

// GET /api/autorules/log
router.get('/log', requireAuth, (req, res) => res.json(loadLog().reverse().slice(0, 100)));

// POST /api/autorules/execute — run all enabled rules against current data
router.post('/execute', requireAuth, async (req, res) => {
  const fbToken = res.locals.fbToken;
  const fbAccount = res.locals.fbAccountId;
  if (!fbToken || !fbAccount) return res.status(400).json({ error: 'FB credentials required' });

  try {
    const result = await executeAutoRules(fbToken, fbAccount);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Core execution logic (also called by cron)
export async function executeAutoRules(fbToken, fbAccount) {
  const rules = loadRules().filter(r => r.enabled);
  if (!rules.length) return { triggered: [] };

  // Fetch today's insights
  const FIELDS = 'campaign_id,campaign_name,impressions,clicks,ctr,cpc,cpm,spend,purchase_roas,conversions,frequency';
  const r = await fetch(`${FB_API}/${fbAccount}/insights?fields=${FIELDS}&level=campaign&date_preset=today&limit=100&access_token=${fbToken}`);
  const { data } = await r.json();
  if (!data?.length) return { triggered: [] };

  // Fetch campaign budgets
  const campR = await fetch(`${FB_API}/${fbAccount}/campaigns?fields=id,name,daily_budget,status&limit=100&access_token=${fbToken}`);
  const campData = await campR.json();
  const campaigns = campData.data || [];

  const now = Date.now();
  const triggered = [];
  const log = loadLog();
  const allRules = loadRules();

  for (const row of data) {
    const vals = {
      ctr: parseFloat(row.ctr || 0),
      frequency: parseFloat(row.frequency || 0),
      roas: parseFloat(row.purchase_roas?.[0]?.value || 0),
      cpc: parseFloat(row.cpc || 0),
      cpm: parseFloat(row.cpm || 0),
      spend: parseFloat(row.spend || 0),
      conversions: parseInt(row.conversions || 0),
    };
    const campName = row.campaign_name || 'Unknown';
    const campId = row.campaign_id;

    for (const rule of rules) {
      // Check cooldown
      const cooldownMs = (rule.cooldown_hours || 1) * 3600000;
      if (rule.last_triggered && (now - new Date(rule.last_triggered).getTime()) < cooldownMs) continue;

      const val = vals[rule.metric];
      if (val === undefined) continue;

      const hit = rule.operator === '>' ? val > rule.threshold
        : rule.operator === '<' ? (val > 0 && val < rule.threshold)
        : false;

      if (!hit) continue;

      // Execute action
      let actionResult = '';
      try {
        if (rule.action === 'pause') {
          await fetch(`${FB_API}/${campId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'PAUSED', access_token: fbToken }),
          });
          actionResult = 'Đã tắt campaign';
          cacheDel(`campaigns:${fbAccount}:campaign`);
        } else if (rule.action === 'resume') {
          await fetch(`${FB_API}/${campId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'ACTIVE', access_token: fbToken }),
          });
          actionResult = 'Đã bật campaign';
          cacheDel(`campaigns:${fbAccount}:campaign`);
        } else if (rule.action === 'scale_budget') {
          const camp = campaigns.find(c => c.id === campId);
          if (camp?.daily_budget) {
            const currentBudget = parseInt(camp.daily_budget);
            const pct = rule.scale_percent || 20;
            const newBudget = Math.round(currentBudget * (1 + pct / 100));
            await fetch(`${FB_API}/${campId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ daily_budget: newBudget, access_token: fbToken }),
            });
            actionResult = `Tăng budget ${pct}% → ${(newBudget / 100).toLocaleString('vi-VN')}đ`;
            cacheDel(`campaigns:${fbAccount}:campaign`);
          }
        } else {
          actionResult = 'Notify only';
        }
      } catch (e) {
        actionResult = `Error: ${e.message}`;
      }

      const entry = {
        rule_id: rule.id,
        rule_name: rule.name,
        campaign: campName,
        campaign_id: campId,
        metric: rule.metric,
        value: val,
        threshold: rule.threshold,
        action: rule.action,
        action_result: actionResult,
        time: new Date().toISOString(),
      };
      triggered.push(entry);
      log.push(entry);

      // Update last_triggered
      const idx = allRules.findIndex(r => r.id === rule.id);
      if (idx >= 0) allRules[idx].last_triggered = new Date().toISOString();
    }
  }

  saveRules(allRules);
  if (triggered.length) saveLog(log);

  // Telegram notify
  const tgChatId = process.env.TELEGRAM_ALERT_CHAT_ID;
  if (triggered.length && tgChatId) {
    const lines = triggered.map(t =>
      `🤖 <b>${t.rule_name}</b>\n📌 ${t.campaign}\n📊 ${t.metric}: ${typeof t.value === 'number' ? t.value.toFixed(2) : t.value}\n⚡ ${t.action_result}`
    ).join('\n\n');
    await sendMessage(tgChatId, `🔄 <b>Auto Rules Triggered</b>\n\n${lines}\n\n🕐 ${new Date().toLocaleString('vi-VN')}`);
  }

  return { triggered };
}

export { loadRules };
export default router;
