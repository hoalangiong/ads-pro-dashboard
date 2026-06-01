import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from './auth.js';
import { sendMessage } from './telegram.js';

const router = express.Router();
const __dir = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_FILE = path.join(__dir, '../data/autoreply_templates.json');
const LOG_FILE = path.join(__dir, '../data/autoreply_log.json');
const FB_API = 'https://graph.facebook.com/v19.0';

function loadTemplates() {
  if (!fs.existsSync(TEMPLATES_FILE)) return [];
  return JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf8'));
}
function saveTemplates(t) {
  fs.mkdirSync(path.dirname(TEMPLATES_FILE), { recursive: true });
  fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(t, null, 2));
}
function loadLog() {
  if (!fs.existsSync(LOG_FILE)) return [];
  return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
}
function saveLog(l) {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify(l.slice(-500), null, 2));
}

// GET /api/autoreply
router.get('/', requireAuth, (req, res) => res.json(loadTemplates()));

// POST /api/autoreply
router.post('/', requireAuth, (req, res) => {
  const templates = loadTemplates();
  const tpl = { id: Date.now().toString(), enabled: true, reply_count: 0, ...req.body };
  templates.push(tpl);
  saveTemplates(templates);
  res.json(tpl);
});

// PUT /api/autoreply/:id
router.put('/:id', requireAuth, (req, res) => {
  const templates = loadTemplates().map(t => t.id === req.params.id ? { ...t, ...req.body } : t);
  saveTemplates(templates);
  res.json({ ok: true });
});

// DELETE /api/autoreply/:id
router.delete('/:id', requireAuth, (req, res) => {
  saveTemplates(loadTemplates().filter(t => t.id !== req.params.id));
  res.json({ ok: true });
});

// GET /api/autoreply/log
router.get('/log', requireAuth, (req, res) => res.json(loadLog().reverse().slice(0, 100)));

// GET /api/autoreply/stats
router.get('/stats', requireAuth, (req, res) => {
  const log = loadLog();
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = log.filter(l => l.time?.startsWith(today)).length;
  const totalCount = log.length;
  const last7d = log.filter(l => {
    const d = new Date(l.time);
    return (Date.now() - d.getTime()) < 7 * 86400000;
  }).length;
  res.json({ today: todayCount, last_7d: last7d, total: totalCount });
});

// POST /api/autoreply/scan — scan and reply to comments
router.post('/scan', requireAuth, async (req, res) => {
  const fbToken = res.locals.fbToken;
  const fbAccount = res.locals.fbAccountId;
  if (!fbToken || !fbAccount) return res.status(400).json({ error: 'FB credentials required' });

  try {
    const result = await scanAndReply(fbToken, fbAccount);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export async function scanAndReply(fbToken, fbAccount) {
  const templates = loadTemplates().filter(t => t.enabled);
  if (!templates.length) return { replied: 0, escalated: 0 };

  // Get recent ad posts
  const r = await fetch(
    `${FB_API}/${fbAccount}/ads?fields=id,creative{effective_object_story_id}&effective_status=["ACTIVE"]&limit=20&access_token=${fbToken}`
  );
  const { data: ads } = await r.json();
  if (!ads?.length) return { replied: 0, escalated: 0 };

  const log = loadLog();
  const repliedIds = new Set(log.map(l => l.comment_id));
  let replied = 0;
  let escalated = 0;

  for (const ad of ads) {
    const postId = ad.creative?.effective_object_story_id;
    if (!postId) continue;

    // Get comments on this post
    try {
      const commR = await fetch(
        `${FB_API}/${postId}/comments?fields=id,message,from,created_time&limit=25&access_token=${fbToken}`
      );
      const commData = await commR.json();
      const comments = commData.data || [];

      for (const comment of comments) {
        if (repliedIds.has(comment.id)) continue;
        const msg = (comment.message || '').toLowerCase();

        // Find matching template
        let matched = null;
        for (const tpl of templates) {
          const keywords = (tpl.keywords || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
          if (keywords.some(k => msg.includes(k))) {
            matched = tpl;
            break;
          }
        }

        if (matched) {
          // Reply to comment
          try {
            await fetch(`${FB_API}/${comment.id}/comments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: matched.reply_text, access_token: fbToken }),
            });
            replied++;
            log.push({
              comment_id: comment.id,
              comment_text: comment.message,
              from: comment.from?.name || 'Unknown',
              reply_text: matched.reply_text,
              template_id: matched.id,
              time: new Date().toISOString(),
            });
            // Update template reply count
            const allTpl = loadTemplates();
            const idx = allTpl.findIndex(t => t.id === matched.id);
            if (idx >= 0) { allTpl[idx].reply_count = (allTpl[idx].reply_count || 0) + 1; saveTemplates(allTpl); }
          } catch (e) {
            // Reply failed — skip
          }
        } else if (msg.length > 20) {
          // Escalate complex comments via Telegram
          const tgChatId = process.env.TELEGRAM_ALERT_CHAT_ID;
          if (tgChatId) {
            await sendMessage(tgChatId, `💬 <b>Comment cần trả lời</b>\n\n👤 ${comment.from?.name || 'Unknown'}\n📝 ${comment.message}\n\n🔗 Post: ${postId}`);
            escalated++;
          }
        }
      }
    } catch (e) {
      // Skip errors for individual posts
    }
  }

  if (log.length) saveLog(log);
  return { replied, escalated };
}

export default router;
