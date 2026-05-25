import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from './auth.js';

const router = express.Router();
const __dir = path.dirname(fileURLToPath(import.meta.url));
const RULES_FILE = path.join(__dir, '../data/alert_rules.json');
const ALERTS_FILE = path.join(__dir, '../data/alerts_log.json');

function loadRules() {
  if (!fs.existsSync(RULES_FILE)) return [];
  return JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
}
function saveRules(r) {
  fs.mkdirSync(path.dirname(RULES_FILE), { recursive: true });
  fs.writeFileSync(RULES_FILE, JSON.stringify(r, null, 2));
}
function loadAlerts() {
  if (!fs.existsSync(ALERTS_FILE)) return [];
  return JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8'));
}
function saveAlerts(a) {
  fs.mkdirSync(path.dirname(ALERTS_FILE), { recursive: true });
  fs.writeFileSync(ALERTS_FILE, JSON.stringify(a.slice(-500), null, 2)); // keep last 500
}

// Default rules for orchid/fertilizer
function seedDefaultRules() {
  if (loadRules().length === 0) {
    saveRules([
      { id: '1', name: 'CTR thấp', metric: 'ctr', operator: '<', threshold: 1, action: 'notify', enabled: true },
      { id: '2', name: 'Frequency cao', metric: 'frequency', operator: '>', threshold: 3.5, action: 'notify', enabled: true },
      { id: '3', name: 'ROAS thấp', metric: 'roas', operator: '<', threshold: 1.5, action: 'notify', enabled: true },
      { id: '4', name: 'CPC quá cao', metric: 'cpc', operator: '>', threshold: 10000, action: 'notify', enabled: true },
      { id: '5', name: 'Chi tiêu 0 conversion', metric: 'spend_no_conversion', operator: '>', threshold: 100000, action: 'notify', enabled: true },
    ]);
  }
}
seedDefaultRules();

// GET /api/alerts/rules
router.get('/rules', requireAuth, (req, res) => res.json(loadRules()));

// POST /api/alerts/rules
router.post('/rules', requireAuth, (req, res) => {
  const rules = loadRules();
  const rule = { id: Date.now().toString(), enabled: true, ...req.body };
  rules.push(rule);
  saveRules(rules);
  res.json(rule);
});

// PUT /api/alerts/rules/:id
router.put('/rules/:id', requireAuth, (req, res) => {
  const rules = loadRules().map(r => r.id === req.params.id ? { ...r, ...req.body } : r);
  saveRules(rules);
  res.json({ ok: true });
});

// DELETE /api/alerts/rules/:id
router.delete('/rules/:id', requireAuth, (req, res) => {
  saveRules(loadRules().filter(r => r.id !== req.params.id));
  res.json({ ok: true });
});

// GET /api/alerts/log
router.get('/log', requireAuth, (req, res) => res.json(loadAlerts().reverse().slice(0, 100)));

// POST /api/alerts/check  — called by cron or manually
router.post('/check', requireAuth, async (req, res) => {
  const { insights } = req.body;
  if (!insights?.length) return res.status(400).json({ error: 'insights required' });

  const rules = loadRules().filter(r => r.enabled);
  const triggered = [];

  for (const row of insights) {
    const vals = {
      ctr: parseFloat(row.ctr || 0),
      frequency: parseFloat(row.frequency || 0),
      roas: parseFloat(row.purchase_roas?.[0]?.value || row.roas || 0),
      cpc: parseFloat(row.cpc || 0),
      spend_no_conversion: parseFloat(row.spend || 0) > 0 && !row.conversions ? parseFloat(row.spend || 0) : 0,
    };
    const name = row.campaign_name || row.adset_name || row.ad_name || 'Unknown';

    for (const rule of rules) {
      const val = vals[rule.metric];
      if (val === undefined) continue;
      const hit =
        rule.operator === '>' ? val > rule.threshold :
        rule.operator === '<' ? val > 0 && val < rule.threshold :
        false;

      if (hit) {
        triggered.push({ rule: rule.name, name, metric: rule.metric, value: val, threshold: rule.threshold, time: new Date().toISOString() });
      }
    }
  }

  if (triggered.length) {
    const log = loadAlerts();
    log.push(...triggered);
    saveAlerts(log);
  }

  res.json({ triggered });
});

export { loadRules, loadAlerts, saveAlerts };
export default router;
