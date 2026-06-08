import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from './auth.js';
import { del as cacheDel } from '../cache.js';
import { sendMessage } from './telegram.js';

const router = express.Router();
const __dir = path.dirname(fileURLToPath(import.meta.url));
const SCHEDULES_FILE = path.join(__dir, '../data/livestream_schedules.json');
const HISTORY_FILE = path.join(__dir, '../data/livestream_history.json');
const FB_API = 'https://graph.facebook.com/v19.0';

function loadSchedules() {
  if (!fs.existsSync(SCHEDULES_FILE)) return [];
  return JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf8'));
}
function saveSchedules(s) {
  fs.mkdirSync(path.dirname(SCHEDULES_FILE), { recursive: true });
  fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(s, null, 2));
}
function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
}
function saveHistory(h) {
  fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(h.slice(-200), null, 2));
}

// GET /api/livestream/live?page_id=X — detect current live videos
router.get('/live', requireAuth, async (req, res) => {
  const fbToken = res.locals.fbToken;
  const pageId = req.query.page_id;
  if (!fbToken) return res.status(400).json({ error: 'FB token required' });
  if (!pageId) return res.status(400).json({ error: 'page_id required' });

  try {
    const fields = 'id,title,description,status,permalink_url,live_views,created_time';
    const r = await fetch(`${FB_API}/${pageId}/live_videos?fields=${fields}&status=live&access_token=${fbToken}`);
    const data = await r.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    res.json({ live_videos: data.data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/livestream/metrics/:video_id — real-time metrics
router.get('/metrics/:video_id', requireAuth, async (req, res) => {
  const fbToken = res.locals.fbToken;
  if (!fbToken) return res.status(400).json({ error: 'FB token required' });

  try {
    const fields = 'id,title,live_views,status,permalink_url';
    const r = await fetch(`${FB_API}/${req.params.video_id}?fields=${fields}&access_token=${fbToken}`);
    const data = await r.json();
    if (data.error) return res.status(400).json({ error: data.error.message });

    // Get comments/reactions count
    const engR = await fetch(`${FB_API}/${req.params.video_id}?fields=comments.limit(0).summary(true),reactions.limit(0).summary(true),shares&access_token=${fbToken}`);
    const engData = await engR.json();

    res.json({
      ...data,
      comments_count: engData.comments?.summary?.total_count || 0,
      reactions_count: engData.reactions?.summary?.total_count || 0,
      shares_count: engData.shares?.count || 0,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/livestream/boost — create boost ad for live video
router.post('/boost', requireAuth, async (req, res) => {
  const fbToken = res.locals.fbToken;
  const fbAccount = res.locals.fbAccountId;
  if (!fbToken || !fbAccount) return res.status(400).json({ error: 'FB credentials required' });

  const { page_id, video_id, budget, age_min = 18, age_max = 65, genders, geo_countries = ['VN'] } = req.body;
  if (!page_id || !video_id) return res.status(400).json({ error: 'page_id and video_id required' });
  if (!budget || budget < 50000) return res.status(400).json({ error: 'Budget tối thiểu 50,000đ' });

  try {
    // 1. Create campaign
    const campR = await fetch(`${FB_API}/${fbAccount}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `[Live Boost] ${new Date().toLocaleString('vi-VN')}`,
        objective: 'OUTCOME_ENGAGEMENT',
        status: 'ACTIVE',
        special_ad_categories: [],
        access_token: fbToken,
      }),
    });
    const campData = await campR.json();
    if (campData.error) throw new Error(campData.error.message);

    // 2. Create ad set
    const targeting = {
      geo_locations: { countries: geo_countries },
      age_min,
      age_max,
    };
    if (genders?.length) targeting.genders = genders;

    const adsetR = await fetch(`${FB_API}/${fbAccount}/adsets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Live Boost Adset`,
        campaign_id: campData.id,
        daily_budget: Math.round(budget * 100), // VND to cents
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'POST_ENGAGEMENT',
        targeting,
        promoted_object: { page_id },
        status: 'ACTIVE',
        access_token: fbToken,
      }),
    });
    const adsetData = await adsetR.json();
    if (adsetData.error) throw new Error(adsetData.error.message);

    // 3. Create ad with live video as creative
    const adR = await fetch(`${FB_API}/${fbAccount}/ads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Live Boost Ad`,
        adset_id: adsetData.id,
        creative: { object_story_id: video_id },
        status: 'ACTIVE',
        access_token: fbToken,
      }),
    });
    const adData = await adR.json();
    if (adData.error) throw new Error(adData.error.message);

    cacheDel(`campaigns:${fbAccount}:campaign`);

    // Save to history
    const history = loadHistory();
    history.push({
      id: Date.now().toString(),
      page_id,
      video_id,
      campaign_id: campData.id,
      adset_id: adsetData.id,
      ad_id: adData.id,
      budget,
      status: 'active',
      started_at: new Date().toISOString(),
      stopped_at: null,
    });
    saveHistory(history);

    res.json({
      ok: true,
      campaign_id: campData.id,
      adset_id: adsetData.id,
      ad_id: adData.id,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/livestream/stop/:campaign_id — pause boost campaign
router.post('/stop/:campaign_id', requireAuth, async (req, res) => {
  const fbToken = res.locals.fbToken;
  if (!fbToken) return res.status(400).json({ error: 'FB token required' });

  try {
    const r = await fetch(`${FB_API}/${req.params.campaign_id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAUSED', access_token: fbToken }),
    });
    const data = await r.json();
    if (data.error) return res.status(400).json({ error: data.error.message });

    // Update history
    const history = loadHistory();
    const entry = history.find(h => h.campaign_id === req.params.campaign_id);
    if (entry) {
      entry.status = 'stopped';
      entry.stopped_at = new Date().toISOString();
      saveHistory(history);
    }

    res.json({ ok: true, status: 'PAUSED' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/livestream/schedules
router.get('/schedules', requireAuth, (req, res) => res.json(loadSchedules()));

// POST /api/livestream/schedules
router.post('/schedules', requireAuth, (req, res) => {
  const schedules = loadSchedules();
  const schedule = {
    id: Date.now().toString(),
    enabled: true,
    active_campaign_id: null,
    last_check: null,
    ...req.body,
  };
  schedules.push(schedule);
  saveSchedules(schedules);
  res.json(schedule);
});

// PUT /api/livestream/schedules/:id
router.put('/schedules/:id', requireAuth, (req, res) => {
  const schedules = loadSchedules().map(s => s.id === req.params.id ? { ...s, ...req.body } : s);
  saveSchedules(schedules);
  res.json({ ok: true });
});

// DELETE /api/livestream/schedules/:id
router.delete('/schedules/:id', requireAuth, (req, res) => {
  saveSchedules(loadSchedules().filter(s => s.id !== req.params.id));
  res.json({ ok: true });
});

// GET /api/livestream/history
router.get('/history', requireAuth, (req, res) => res.json(loadHistory().reverse().slice(0, 50)));

// Cron: check schedules every 2 minutes
export async function checkLivestreamSchedules(fbToken, fbAccount) {
  if (!fbToken || !fbAccount) return;

  const schedules = loadSchedules().filter(s => s.enabled);
  if (!schedules.length) return;

  const tgChatId = process.env.TELEGRAM_ALERT_CHAT_ID;

  for (const schedule of schedules) {
    try {
      // Check if page is live
      const fields = 'id,title,live_views,created_time';
      const r = await fetch(`${FB_API}/${schedule.page_id}/live_videos?fields=${fields}&status=live&access_token=${fbToken}`);
      const data = await r.json();
      const isLive = data.data?.length > 0;
      const liveVideo = data.data?.[0];

      if (isLive && !schedule.active_campaign_id) {
        // Page just went live → create boost
        const campR = await fetch(`${FB_API}/${fbAccount}/campaigns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `[Auto Live Boost] ${liveVideo.title || new Date().toLocaleString('vi-VN')}`,
            objective: 'OUTCOME_ENGAGEMENT',
            status: 'ACTIVE',
            special_ad_categories: [],
            access_token: fbToken,
          }),
        });
        const campData = await campR.json();
        if (campData.error) continue;

        const targeting = {
          geo_locations: { countries: schedule.geo_countries || ['VN'] },
          age_min: schedule.age_min || 18,
          age_max: schedule.age_max || 65,
        };
        if (schedule.genders?.length) targeting.genders = schedule.genders;

        const adsetR = await fetch(`${FB_API}/${fbAccount}/adsets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Auto Live Boost Adset',
            campaign_id: campData.id,
            daily_budget: Math.round((schedule.budget || 200000) * 100),
            billing_event: 'IMPRESSIONS',
            optimization_goal: 'POST_ENGAGEMENT',
            targeting,
            promoted_object: { page_id: schedule.page_id },
            status: 'ACTIVE',
            access_token: fbToken,
          }),
        });
        const adsetData = await adsetR.json();
        if (adsetData.error) continue;

        await fetch(`${FB_API}/${fbAccount}/ads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Auto Live Boost Ad',
            adset_id: adsetData.id,
            creative: { object_story_id: liveVideo.id },
            status: 'ACTIVE',
            access_token: fbToken,
          }),
        });

        // Update schedule
        schedule.active_campaign_id = campData.id;
        schedule.last_check = new Date().toISOString();
        saveSchedules(loadSchedules().map(s => s.id === schedule.id ? schedule : s));

        // Save history
        const history = loadHistory();
        history.push({
          id: Date.now().toString(),
          page_id: schedule.page_id,
          video_id: liveVideo.id,
          video_title: liveVideo.title,
          campaign_id: campData.id,
          budget: schedule.budget || 200000,
          status: 'active',
          started_at: new Date().toISOString(),
          stopped_at: null,
          auto: true,
        });
        saveHistory(history);

        if (tgChatId) {
          await sendMessage(tgChatId, `🔴 <b>Auto Live Boost Started!</b>\n\n📺 ${liveVideo.title || 'Live Stream'}\n💰 Budget: ${(schedule.budget || 200000).toLocaleString('vi-VN')}đ\n👁 Viewers: ${liveVideo.live_views || 0}\n\n🕐 ${new Date().toLocaleString('vi-VN')}`);
        }

      } else if (!isLive && schedule.active_campaign_id) {
        // Page stopped live → pause campaign
        await fetch(`${FB_API}/${schedule.active_campaign_id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'PAUSED', access_token: fbToken }),
        });

        // Update history
        const history = loadHistory();
        const entry = history.find(h => h.campaign_id === schedule.active_campaign_id && h.status === 'active');
        if (entry) {
          entry.status = 'stopped';
          entry.stopped_at = new Date().toISOString();
          saveHistory(history);
        }

        if (tgChatId) {
          await sendMessage(tgChatId, `⏹ <b>Live Boost Stopped</b>\n\nLivestream kết thúc — đã tắt campaign boost.\n🕐 ${new Date().toLocaleString('vi-VN')}`);
        }

        schedule.active_campaign_id = null;
        schedule.last_check = new Date().toISOString();
        saveSchedules(loadSchedules().map(s => s.id === schedule.id ? schedule : s));
      }
    } catch (e) {
      // Skip errors for individual schedules
    }
  }
}

export default router;
