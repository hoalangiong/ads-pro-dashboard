const BASE = '/api';

function authHeaders() {
  return {
    'x-fb-token': localStorage.getItem('fb_token') || '',
    'x-fb-account': localStorage.getItem('fb_account_id') || '',
    'Authorization': `Bearer ${localStorage.getItem('jwt') || ''}`,
  };
}

async function req(path, opts = {}) {
  const r = await fetch(BASE + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(opts.headers || {}) },
  });
  if (r.status === 401) {
    localStorage.removeItem('jwt');
    localStorage.removeItem('user');
    window.location.href = '/login';
    return;
  }
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(err.error?.message || err.error || r.statusText);
  }
  return r.json();
}

async function reqBlob(path, opts = {}) {
  const r = await fetch(BASE + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(opts.headers || {}) },
  });
  return r.blob();
}

export const api = {
  login: (username, password) =>
    req('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  users: () => req('/auth/users'),
  registerUser: (data) => req('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  deleteUser: (id) => req(`/auth/users/${id}`, { method: 'DELETE' }),

  accounts: () => req('/accounts'),
  campaigns: (accountId, level = 'campaign') =>
    req(`/campaigns?account_id=${accountId}&level=${level}`),
  insights: (accountId, level = 'campaign', datePreset = 'last_7d', since, until, timeIncrement) => {
    let qs = `/insights?account_id=${accountId}&level=${level}`;
    if (since && until) qs += `&since=${since}&until=${until}`;
    else qs += `&date_preset=${datePreset}`;
    if (timeIncrement) qs += `&time_increment=${timeIncrement}`;
    return req(qs);
  },

  aiOptimize: (insights) =>
    req('/ai/optimize', { method: 'POST', body: JSON.stringify({ insights }) }),
  aiTemplate: (objective, budget, product) =>
    req('/ai/campaign-template', { method: 'POST', body: JSON.stringify({ objective, budget, product }) }),

  export: async (data, filename, format) => {
    const blob = await reqBlob('/export', { method: 'POST', body: JSON.stringify({ data, filename, format }) });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}.${format}`; a.click();
    URL.revokeObjectURL(url);
  },

  alertRules: () => req('/alerts/rules'),
  createRule: (rule) => req('/alerts/rules', { method: 'POST', body: JSON.stringify(rule) }),
  updateRule: (id, data) => req(`/alerts/rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRule: (id) => req(`/alerts/rules/${id}`, { method: 'DELETE' }),
  checkAlerts: (insights) => req('/alerts/check', { method: 'POST', body: JSON.stringify({ insights }) }),
  alertLog: () => req('/alerts/log'),

  tgMe: () => req('/telegram/me'),
  tgSend: (chatId, message) => req('/telegram/send', { method: 'POST', body: JSON.stringify({ chatId, message }) }),
  tgAlert: (chatId, triggered) => req('/telegram/alert', { method: 'POST', body: JSON.stringify({ chatId, triggered }) }),

  pauseCampaign: (objectId, level) => req('/budget/pause', { method: 'POST', body: JSON.stringify({ objectId, level }) }),
  resumeCampaign: (objectId, level) => req('/budget/resume', { method: 'POST', body: JSON.stringify({ objectId, level }) }),
  adjustBudget: (objectId, daily_budget) => req('/budget/adjust', { method: 'POST', body: JSON.stringify({ objectId, daily_budget }) }),

  breakdown: (accountId, breakdown, datePreset) =>
    req(`/breakdown?account_id=${accountId}&breakdown=${breakdown}&date_preset=${datePreset}`),
  compare: (accountId, curr_since, curr_until, prev_since, prev_until) =>
    req(`/breakdown/compare?account_id=${accountId}&current_since=${curr_since}&current_until=${curr_until}&prev_since=${prev_since}&prev_until=${prev_until}`),

  reportSchedules: () => req('/reports/schedules'),
  createReportSchedule: (data) => req('/reports/schedules', { method: 'POST', body: JSON.stringify(data) }),
  updateReportSchedule: (id, data) => req(`/reports/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteReportSchedule: (id) => req(`/reports/schedules/${id}`, { method: 'DELETE' }),
  sendReportNow: (chatId, accountId, datePreset = 'yesterday') => req('/reports/send-now', { method: 'POST', body: JSON.stringify({ chatId, accountId, datePreset }) }),

  creatives: (accountId, datePreset) =>
    req(`/creatives?account_id=${accountId}&date_preset=${datePreset}`),

  goals: () => req('/goals'),
  createGoal: (data) => req('/goals', { method: 'POST', body: JSON.stringify(data) }),
  updateGoal: (id, data) => req(`/goals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteGoal: (id) => req(`/goals/${id}`, { method: 'DELETE' }),

  validateToken: (fbToken) =>
    req('/token/validate', { headers: { 'x-fb-token': fbToken } }),

  notes: (objectId) => req(`/notes?object_id=${objectId}`),
  addNote: (objectId, text) => req('/notes', { method: 'POST', body: JSON.stringify({ object_id: objectId, text }) }),
  deleteNote: (id) => req(`/notes/${id}`, { method: 'DELETE' }),

  searchInterests: (q) => req(`/launch/search-interests?q=${encodeURIComponent(q)}`),
  launchCampaign: (data) => req('/launch/create', { method: 'POST', body: JSON.stringify(data) }),

  clearCache: () => req('/cache/clear', { method: 'POST' }),

  // Auto Rules
  autoRules: () => req('/autorules'),
  createAutoRule: (rule) => req('/autorules', { method: 'POST', body: JSON.stringify(rule) }),
  updateAutoRule: (id, data) => req(`/autorules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAutoRule: (id) => req(`/autorules/${id}`, { method: 'DELETE' }),
  autoRulesLog: () => req('/autorules/log'),
  executeAutoRules: () => req('/autorules/execute', { method: 'POST' }),

  // Creative Fatigue
  fatigue: (accountId) => req(`/fatigue?account_id=${accountId}`),

  // Dayparting
  dayparting: (accountId, datePreset = 'last_7d') => req(`/dayparting?account_id=${accountId}&date_preset=${datePreset}`),

  // Overlap
  overlap: (accountId) => req(`/overlap?account_id=${accountId}`),
  overlapCheck: (adsetA, adsetB) => req('/overlap/check', { method: 'POST', body: JSON.stringify({ adset_a: adsetA, adset_b: adsetB }) }),

  // Funnel
  funnel: (accountId, datePreset = 'last_7d', campaignId) => {
    let qs = `/funnel?account_id=${accountId}&date_preset=${datePreset}`;
    if (campaignId) qs += `&campaign_id=${campaignId}`;
    return req(qs);
  },

  // A/B Test
  abTests: () => req('/abtest'),
  createABTest: (data) => req('/abtest', { method: 'POST', body: JSON.stringify(data) }),
  deleteABTest: (id) => req(`/abtest/${id}`, { method: 'DELETE' }),
  abTestResults: (id) => req(`/abtest/${id}/results`),

  // Ad Spy
  spySearch: (q, country = 'VN') => req(`/spy/search?q=${encodeURIComponent(q)}&country=${country}`),
  spyWatched: () => req('/spy/watched'),
  spyWatch: (pageId, pageName) => req('/spy/watch', { method: 'POST', body: JSON.stringify({ page_id: pageId, page_name: pageName }) }),
  spyUnwatch: (pageId) => req(`/spy/watch/${pageId}`, { method: 'DELETE' }),

  // Predict
  predict: (accountId) => req(`/predict?account_id=${accountId}`),

  // Landing Page Monitor
  landingPages: () => req('/landing'),
  addLandingPage: (url, name) => req('/landing/add', { method: 'POST', body: JSON.stringify({ url, name }) }),
  deleteLandingPage: (id) => req(`/landing/${id}`, { method: 'DELETE' }),
  checkLandingPages: () => req('/landing/status'),

  // Auto Reply
  autoReplyTemplates: () => req('/autoreply'),
  createAutoReply: (data) => req('/autoreply', { method: 'POST', body: JSON.stringify(data) }),
  updateAutoReply: (id, data) => req(`/autoreply/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAutoReply: (id) => req(`/autoreply/${id}`, { method: 'DELETE' }),
  autoReplyLog: () => req('/autoreply/log'),
  autoReplyStats: () => req('/autoreply/stats'),
  scanAutoReply: () => req('/autoreply/scan', { method: 'POST' }),

  // Livestream
  livestreamLive: (pageId) => req(`/livestream/live?page_id=${pageId}`),
  livestreamMetrics: (videoId) => req(`/livestream/metrics/${videoId}`),
  livestreamBoost: (data) => req('/livestream/boost', { method: 'POST', body: JSON.stringify(data) }),
  livestreamStop: (campaignId) => req(`/livestream/stop/${campaignId}`, { method: 'POST' }),
  livestreamSchedules: () => req('/livestream/schedules'),
  createLivestreamSchedule: (data) => req('/livestream/schedules', { method: 'POST', body: JSON.stringify(data) }),
  updateLivestreamSchedule: (id, data) => req(`/livestream/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLivestreamSchedule: (id) => req(`/livestream/schedules/${id}`, { method: 'DELETE' }),
  livestreamHistory: () => req('/livestream/history'),
};
