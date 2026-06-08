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

// Vietnam provinces/cities for FB targeting (region keys)
const VN_PROVINCES = [
  { key: '3866', name: 'Hà Nội' },
  { key: '3867', name: 'TP. Hồ Chí Minh' },
  { key: '3868', name: 'Đà Nẵng' },
  { key: '3869', name: 'Hải Phòng' },
  { key: '3870', name: 'Cần Thơ' },
  { key: '3871', name: 'An Giang' },
  { key: '3872', name: 'Bà Rịa - Vũng Tàu' },
  { key: '3873', name: 'Bắc Giang' },
  { key: '3874', name: 'Bắc Kạn' },
  { key: '3875', name: 'Bạc Liêu' },
  { key: '3876', name: 'Bắc Ninh' },
  { key: '3877', name: 'Bến Tre' },
  { key: '3878', name: 'Bình Định' },
  { key: '3879', name: 'Bình Dương' },
  { key: '3880', name: 'Bình Phước' },
  { key: '3881', name: 'Bình Thuận' },
  { key: '3882', name: 'Cà Mau' },
  { key: '3883', name: 'Cao Bằng' },
  { key: '3884', name: 'Đắk Lắk' },
  { key: '3885', name: 'Đắk Nông' },
  { key: '3886', name: 'Điện Biên' },
  { key: '3887', name: 'Đồng Nai' },
  { key: '3888', name: 'Đồng Tháp' },
  { key: '3889', name: 'Gia Lai' },
  { key: '3890', name: 'Hà Giang' },
  { key: '3891', name: 'Hà Nam' },
  { key: '3892', name: 'Hà Tĩnh' },
  { key: '3893', name: 'Hải Dương' },
  { key: '3894', name: 'Hậu Giang' },
  { key: '3895', name: 'Hòa Bình' },
  { key: '3896', name: 'Hưng Yên' },
  { key: '3897', name: 'Khánh Hòa' },
  { key: '3898', name: 'Kiên Giang' },
  { key: '3899', name: 'Kon Tum' },
  { key: '3900', name: 'Lai Châu' },
  { key: '3901', name: 'Lâm Đồng' },
  { key: '3902', name: 'Lạng Sơn' },
  { key: '3903', name: 'Lào Cai' },
  { key: '3904', name: 'Long An' },
  { key: '3905', name: 'Nam Định' },
  { key: '3906', name: 'Nghệ An' },
  { key: '3907', name: 'Ninh Bình' },
  { key: '3908', name: 'Ninh Thuận' },
  { key: '3909', name: 'Phú Thọ' },
  { key: '3910', name: 'Phú Yên' },
  { key: '3911', name: 'Quảng Bình' },
  { key: '3912', name: 'Quảng Nam' },
  { key: '3913', name: 'Quảng Ngãi' },
  { key: '3914', name: 'Quảng Ninh' },
  { key: '3915', name: 'Quảng Trị' },
  { key: '3916', name: 'Sóc Trăng' },
  { key: '3917', name: 'Sơn La' },
  { key: '3918', name: 'Tây Ninh' },
  { key: '3919', name: 'Thái Bình' },
  { key: '3920', name: 'Thái Nguyên' },
  { key: '3921', name: 'Thanh Hóa' },
  { key: '3922', name: 'Thừa Thiên Huế' },
  { key: '3923', name: 'Tiền Giang' },
  { key: '3924', name: 'Trà Vinh' },
  { key: '3925', name: 'Tuyên Quang' },
  { key: '3926', name: 'Vĩnh Long' },
  { key: '3927', name: 'Vĩnh Phúc' },
  { key: '3928', name: 'Yên Bái' },
];

// Pick random province for today (seeded by date so consistent within a day)
function getRandomProvinceForToday(excludeKeys = []) {
  const available = VN_PROVINCES.filter(p => !excludeKeys.includes(p.key));
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let hash = 0;
  for (let i = 0; i < today.length; i++) hash = ((hash << 5) - hash) + today.charCodeAt(i);
  const idx = Math.abs(hash) % available.length;
  return available[idx];
}

// GET /api/livestream/provinces — list all VN provinces
router.get('/provinces', requireAuth, (req, res) => res.json(VN_PROVINCES));

// GET /api/livestream/today-province — get today's random province
router.get('/today-province', requireAuth, (req, res) => {
  const province = getRandomProvinceForToday();
  res.json(province);
});
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

  const { page_id, video_id, budget, age_min = 18, age_max = 65, genders, geo_countries = ['VN'], regions } = req.body;
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
      geo_locations: regions?.length
        ? { regions: regions.map(r => ({ key: r.key || r })), country_groups: [] }
        : { countries: geo_countries },
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
          age_min: schedule.age_min || 18,
          age_max: schedule.age_max || 65,
        };
        if (schedule.genders?.length) targeting.genders = schedule.genders;

        // Use random province if schedule has random_province enabled, else use specified regions or country
        let targetProvince = null;
        if (schedule.random_province) {
          targetProvince = getRandomProvinceForToday();
          targeting.geo_locations = { regions: [{ key: targetProvince.key }] };
        } else if (schedule.regions?.length) {
          targeting.geo_locations = { regions: schedule.regions.map(r => ({ key: r.key || r })) };
        } else {
          targeting.geo_locations = { countries: schedule.geo_countries || ['VN'] };
        }

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
          province: targetProvince?.name || null,
          status: 'active',
          started_at: new Date().toISOString(),
          stopped_at: null,
          auto: true,
        });
        saveHistory(history);

        if (tgChatId) {
          const provinceInfo = targetProvince ? `\n📍 Tỉnh: ${targetProvince.name}` : '';
          await sendMessage(tgChatId, `🔴 <b>Auto Live Boost Started!</b>\n\n📺 ${liveVideo.title || 'Live Stream'}\n💰 Budget: ${(schedule.budget || 200000).toLocaleString('vi-VN')}đ${provinceInfo}\n👁 Viewers: ${liveVideo.live_views || 0}\n\n🕐 ${new Date().toLocaleString('vi-VN')}`);
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
