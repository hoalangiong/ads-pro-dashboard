import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from './auth.js';
import { sendMessage } from './telegram.js';

const router = express.Router();
const __dir = path.dirname(fileURLToPath(import.meta.url));
const WATCH_FILE = path.join(__dir, '../data/spy_watchlist.json');
const FB_API = 'https://graph.facebook.com/v19.0';

function loadWatchlist() {
  if (!fs.existsSync(WATCH_FILE)) return [];
  return JSON.parse(fs.readFileSync(WATCH_FILE, 'utf8'));
}
function saveWatchlist(w) {
  fs.mkdirSync(path.dirname(WATCH_FILE), { recursive: true });
  fs.writeFileSync(WATCH_FILE, JSON.stringify(w, null, 2));
}

// GET /api/spy/search?q=keyword&country=VN
router.get('/search', requireAuth, async (req, res) => {
  const fbToken = res.locals.fbToken;
  const { q, country = 'VN' } = req.query;
  if (!q) return res.status(400).json({ error: 'q (search query) required' });
  if (!fbToken) return res.status(400).json({ error: 'FB token required' });

  try {
    const params = new URLSearchParams({
      search_terms: q,
      ad_reached_countries: `["${country}"]`,
      ad_active_status: 'ACTIVE',
      fields: 'id,ad_creation_time,ad_creative_bodies,ad_creative_link_titles,ad_delivery_start_time,ad_snapshot_url,page_id,page_name,publisher_platforms',
      limit: '25',
      access_token: fbToken,
    });
    const r = await fetch(`${FB_API}/ads_archive?${params}`);
    const data = await r.json();
    if (data.error) return res.status(400).json({ error: data.error.message });

    const ads = (data.data || []).map(ad => ({
      id: ad.id,
      page_id: ad.page_id,
      page_name: ad.page_name,
      body: ad.ad_creative_bodies?.[0] || '',
      title: ad.ad_creative_link_titles?.[0] || '',
      start_date: ad.ad_delivery_start_time || ad.ad_creation_time,
      platforms: ad.publisher_platforms || [],
      snapshot_url: ad.ad_snapshot_url,
    }));

    res.json({ ads, total: ads.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/spy/watched
router.get('/watched', requireAuth, (req, res) => res.json(loadWatchlist()));

// POST /api/spy/watch — add page to watchlist
router.post('/watch', requireAuth, (req, res) => {
  const { page_id, page_name } = req.body;
  if (!page_id) return res.status(400).json({ error: 'page_id required' });
  const list = loadWatchlist();
  if (list.find(w => w.page_id === page_id)) return res.json({ ok: true, message: 'Already watching' });
  list.push({ page_id, page_name: page_name || page_id, added_at: new Date().toISOString(), last_check: null, last_ad_count: 0 });
  saveWatchlist(list);
  res.json({ ok: true });
});

// DELETE /api/spy/watch/:page_id
router.delete('/watch/:page_id', requireAuth, (req, res) => {
  saveWatchlist(loadWatchlist().filter(w => w.page_id !== req.params.page_id));
  res.json({ ok: true });
});

// Check watched pages for new ads (called by cron)
export async function checkWatchedPages(fbToken) {
  const tgChatId = process.env.TELEGRAM_ALERT_CHAT_ID;
  if (!fbToken || !tgChatId) return;

  const list = loadWatchlist();
  if (!list.length) return;

  for (const page of list) {
    try {
      const params = new URLSearchParams({
        search_page_ids: `["${page.page_id}"]`,
        ad_active_status: 'ACTIVE',
        fields: 'id,ad_creative_bodies,ad_delivery_start_time,page_name',
        limit: '10',
        access_token: fbToken,
      });
      const r = await fetch(`${FB_API}/ads_archive?${params}`);
      const data = await r.json();
      const count = data.data?.length || 0;

      if (page.last_ad_count && count > page.last_ad_count) {
        const newCount = count - page.last_ad_count;
        await sendMessage(tgChatId, `🕵️ <b>Đối thủ có creative mới!</b>\n\n📌 ${page.page_name}\n🆕 ${newCount} ads mới\n\n🕐 ${new Date().toLocaleString('vi-VN')}`);
      }

      page.last_check = new Date().toISOString();
      page.last_ad_count = count;
    } catch (e) {
      // Skip errors for individual pages
    }
  }
  saveWatchlist(list);
}

export default router;
