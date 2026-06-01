import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from './auth.js';
import { sendMessage } from './telegram.js';

const router = express.Router();
const __dir = path.dirname(fileURLToPath(import.meta.url));
const PAGES_FILE = path.join(__dir, '../data/landing_pages.json');
const HISTORY_FILE = path.join(__dir, '../data/landing_history.json');

function loadPages() {
  if (!fs.existsSync(PAGES_FILE)) return [];
  return JSON.parse(fs.readFileSync(PAGES_FILE, 'utf8'));
}
function savePages(p) {
  fs.mkdirSync(path.dirname(PAGES_FILE), { recursive: true });
  fs.writeFileSync(PAGES_FILE, JSON.stringify(p, null, 2));
}
function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
}
function saveHistory(h) {
  fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(h.slice(-1000), null, 2));
}

// GET /api/landing
router.get('/', requireAuth, (req, res) => res.json(loadPages()));

// POST /api/landing/add
router.post('/add', requireAuth, (req, res) => {
  const { url, name } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });
  const pages = loadPages();
  if (pages.find(p => p.url === url)) return res.json({ ok: true, message: 'Already monitoring' });
  pages.push({
    id: Date.now().toString(),
    url,
    name: name || url,
    added_at: new Date().toISOString(),
    last_check: null,
    last_status: null,
    last_response_time: null,
  });
  savePages(pages);
  res.json({ ok: true });
});

// DELETE /api/landing/:id
router.delete('/:id', requireAuth, (req, res) => {
  savePages(loadPages().filter(p => p.id !== req.params.id));
  res.json({ ok: true });
});

// GET /api/landing/status — check all pages now
router.get('/status', requireAuth, async (req, res) => {
  const pages = loadPages();
  const results = await checkAllPages(pages);
  res.json(results);
});

// GET /api/landing/history
router.get('/history', requireAuth, (req, res) => {
  const id = req.query.id;
  const history = loadHistory();
  if (id) return res.json(history.filter(h => h.page_id === id).slice(-50));
  res.json(history.slice(-100));
});

async function checkAllPages(pages) {
  const results = [];
  const history = loadHistory();

  for (const page of pages) {
    const start = Date.now();
    let status = 'up';
    let statusCode = 0;
    let responseTime = 0;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const r = await fetch(page.url, { signal: controller.signal, redirect: 'follow' });
      clearTimeout(timeout);
      statusCode = r.status;
      responseTime = Date.now() - start;

      if (statusCode >= 500) status = 'down';
      else if (statusCode >= 400) status = 'error';
      else if (responseTime > 3000) status = 'slow';
    } catch (e) {
      responseTime = Date.now() - start;
      status = 'down';
      statusCode = 0;
    }

    page.last_check = new Date().toISOString();
    page.last_status = status;
    page.last_response_time = responseTime;
    page.status_code = statusCode;

    history.push({
      page_id: page.id,
      url: page.url,
      status,
      status_code: statusCode,
      response_time: responseTime,
      checked_at: page.last_check,
    });

    results.push({ ...page, status, statusCode, responseTime });
  }

  savePages(pages);
  saveHistory(history);
  return results;
}

// Cron check + alert (called from server.js)
export async function checkLandingPages() {
  const pages = loadPages();
  if (!pages.length) return;

  const results = await checkAllPages(pages);
  const problems = results.filter(r => r.status === 'down' || r.status === 'slow');

  const tgChatId = process.env.TELEGRAM_ALERT_CHAT_ID;
  if (problems.length && tgChatId) {
    const lines = problems.map(p => {
      const icon = p.status === 'down' ? '🔴' : '🟡';
      return `${icon} <b>${p.name}</b>\n   ${p.url}\n   Status: ${p.status} (${p.responseTime}ms)`;
    }).join('\n\n');
    await sendMessage(tgChatId, `🌐 <b>Landing Page Alert</b>\n\n${lines}\n\n🕐 ${new Date().toLocaleString('vi-VN')}`);
  }
}

export default router;
