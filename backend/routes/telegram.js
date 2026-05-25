import express from 'express';
import { requireAuth } from './auth.js';

const router = express.Router();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8646148532:AAF6Kw0Z_jf5yNGMFIsaRsz_L-8LEHxNxS0';
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendMessage(chatId, text) {
  const r = await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  return r.json();
}

// GET /api/telegram/me — verify bot
router.get('/me', requireAuth, async (req, res) => {
  try {
    const r = await fetch(`${TG_API}/getMe`);
    res.json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/telegram/send  body: { chatId, message }
router.post('/send', requireAuth, async (req, res) => {
  const { chatId, message } = req.body;
  if (!chatId || !message) return res.status(400).json({ error: 'chatId and message required' });
  try {
    const result = await sendMessage(chatId, message);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/telegram/alert  body: { chatId, triggered: [...] }
router.post('/alert', requireAuth, async (req, res) => {
  const { chatId, triggered } = req.body;
  if (!chatId || !triggered?.length) return res.status(400).json({ error: 'chatId and triggered required' });

  const lines = triggered.map(t =>
    `⚠️ <b>${t.rule}</b>\n📌 ${t.name}\n📊 ${t.metric}: <b>${typeof t.value === 'number' ? t.value.toFixed(2) : t.value}</b> (ngưỡng: ${t.threshold})`
  ).join('\n\n');

  const msg = `🔔 <b>Ads Alert - Hoa Lan & Phân Bón</b>\n\n${lines}\n\n🕐 ${new Date().toLocaleString('vi-VN')}`;

  try {
    const result = await sendMessage(chatId, msg);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export { sendMessage };
export default router;
