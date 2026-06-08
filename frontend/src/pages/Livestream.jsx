import { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api.js';
import { useAccount } from '../context/AccountContext.jsx';
import { Radio, Play, Square, Plus, Trash2, RefreshCw, Eye, MessageCircle, Heart, Users } from 'lucide-react';

export default function Livestream() {
  const { selected } = useAccount();
  const [tab, setTab] = useState('live');
  const [pageId, setPageId] = useState(localStorage.getItem('ls_page_id') || '');
  const [liveVideos, setLiveVideos] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [boosting, setBoosting] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [boostForm, setBoostForm] = useState({ budget: 200000, age_min: 18, age_max: 65 });
  const [newSchedule, setNewSchedule] = useState({ page_id: '', budget: 200000, age_min: 18, age_max: 65 });
  const pollRef = useRef(null);

  // Check live videos
  const checkLive = async () => {
    if (!pageId.trim()) return setError('Nhập Page ID');
    localStorage.setItem('ls_page_id', pageId);
    setLoading(true); setError('');
    try {
      const data = await api.livestreamLive(pageId);
      setLiveVideos(data.live_videos || []);
      if (!data.live_videos?.length) setMsg('Không có video nào đang live');
      else setMsg('');
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  // Boost live video
  const boost = async (videoId) => {
    setBoosting(true); setError(''); setMsg('');
    try {
      const result = await api.livestreamBoost({
        page_id: pageId,
        video_id: videoId,
        ...boostForm,
      });
      setMsg(`Đã tạo boost campaign! ID: ${result.campaign_id}`);
      checkLive();
      loadHistory();
    } catch (e) { setError(e.message); }
    setBoosting(false);
  };

  // Stop boost
  const stopBoost = async (campaignId) => {
    try {
      await api.livestreamStop(campaignId);
      setMsg('Đã tắt campaign boost');
      loadHistory();
    } catch (e) { setError(e.message); }
  };

  // Get real-time metrics
  const fetchMetrics = async (videoId) => {
    try {
      const data = await api.livestreamMetrics(videoId);
      setMetrics(data);
    } catch (e) { /* silent */ }
  };

  // Start polling metrics
  const startPolling = (videoId) => {
    if (pollRef.current) clearInterval(pollRef.current);
    fetchMetrics(videoId);
    pollRef.current = setInterval(() => fetchMetrics(videoId), 30000);
  };
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // Schedules
  const loadSchedules = () => {
    api.livestreamSchedules().then(setSchedules).catch(() => {});
  };
  const addSchedule = async () => {
    if (!newSchedule.page_id) return setError('Nhập Page ID cho lịch trình');
    try {
      await api.createLivestreamSchedule(newSchedule);
      setNewSchedule({ page_id: '', budget: 200000, age_min: 18, age_max: 65 });
      loadSchedules();
    } catch (e) { setError(e.message); }
  };
  const toggleSchedule = async (s) => {
    try {
      await api.updateLivestreamSchedule(s.id, { enabled: !s.enabled });
      loadSchedules();
    } catch (e) { setError(e.message); }
  };
  const deleteSchedule = async (id) => {
    try { await api.deleteLivestreamSchedule(id); loadSchedules(); } catch (e) { setError(e.message); }
  };

  // History
  const loadHistory = () => {
    api.livestreamHistory().then(setHistory).catch(() => {});
  };

  useEffect(() => { loadSchedules(); loadHistory(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2"><Radio size={20} className="text-red-400" /> Livestream Ads</h1>
        <div className="flex gap-2">
          {['live', 'schedules', 'history'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${tab === t ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {t === 'live' ? '🔴 Live Now' : t === 'schedules' ? '📅 Lịch trình' : '📋 Lịch sử'}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm mb-4 text-red-400">{error}</p>}
      {msg && <p className="text-sm mb-4 text-green-400">{msg}</p>}

      {/* ===== LIVE TAB ===== */}
      {tab === 'live' && (
        <div className="space-y-4">
          {/* Page ID input */}
          <div className="flex gap-2">
            <input className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" placeholder="Page ID (VD: 123456789)" value={pageId} onChange={e => setPageId(e.target.value)} />
            <button onClick={checkLive} disabled={loading} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 px-4 py-2 rounded-lg text-sm transition-colors">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Check Live
            </button>
          </div>

          {/* Live videos */}
          {liveVideos.map(v => (
            <div key={v.id} className="bg-gray-900 border border-red-800/30 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    <span className="text-sm font-medium text-red-300">LIVE</span>
                  </div>
                  <p className="text-white font-medium mt-1">{v.title || 'Livestream'}</p>
                  <p className="text-xs text-gray-500 mt-1">ID: {v.id}</p>
                  {v.live_views && <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Eye size={11} /> {v.live_views} viewers</p>}
                </div>
                <button onClick={() => startPolling(v.id)} className="text-xs bg-gray-700 hover:bg-gray-600 px-2.5 py-1.5 rounded-lg transition-colors">
                  📊 Metrics
                </button>
              </div>

              {/* Real-time metrics */}
              {metrics && metrics.id === v.id && (
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-gray-800 rounded-lg p-2.5 text-center">
                    <Eye size={14} className="mx-auto text-blue-400 mb-1" />
                    <p className="text-sm font-bold">{metrics.live_views || 0}</p>
                    <p className="text-[10px] text-gray-500">Viewers</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-2.5 text-center">
                    <MessageCircle size={14} className="mx-auto text-green-400 mb-1" />
                    <p className="text-sm font-bold">{metrics.comments_count || 0}</p>
                    <p className="text-[10px] text-gray-500">Comments</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-2.5 text-center">
                    <Heart size={14} className="mx-auto text-pink-400 mb-1" />
                    <p className="text-sm font-bold">{metrics.reactions_count || 0}</p>
                    <p className="text-[10px] text-gray-500">Reactions</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-2.5 text-center">
                    <Users size={14} className="mx-auto text-purple-400 mb-1" />
                    <p className="text-sm font-bold">{metrics.shares_count || 0}</p>
                    <p className="text-[10px] text-gray-500">Shares</p>
                  </div>
                </div>
              )}

              {/* Boost form */}
              <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Boost Settings</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Budget (đ/ngày)</label>
                    <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-sm" value={boostForm.budget} onChange={e => setBoostForm(f => ({ ...f, budget: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Tuổi min</label>
                    <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-sm" value={boostForm.age_min} onChange={e => setBoostForm(f => ({ ...f, age_min: parseInt(e.target.value) || 18 }))} />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Tuổi max</label>
                    <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-sm" value={boostForm.age_max} onChange={e => setBoostForm(f => ({ ...f, age_max: parseInt(e.target.value) || 65 }))} />
                  </div>
                </div>
                <button onClick={() => boost(v.id)} disabled={boosting} className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors">
                  <Play size={14} /> {boosting ? 'Đang tạo...' : `Boost ngay — ${boostForm.budget.toLocaleString('vi-VN')}đ/ngày`}
                </button>
              </div>
            </div>
          ))}

          {liveVideos.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-500">
              <Radio size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nhập Page ID và bấm Check Live để kiểm tra</p>
              <p className="text-xs text-gray-600 mt-1">Khi page đang livestream, video sẽ hiện ở đây</p>
            </div>
          )}
        </div>
      )}

      {/* ===== SCHEDULES TAB ===== */}
      {tab === 'schedules' && (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Thêm lịch auto-boost</p>
            <p className="text-xs text-gray-500 mb-3">Khi page bắt đầu live → tự động tạo ad boost. Khi kết thúc live → tự tắt.</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" placeholder="Page ID" value={newSchedule.page_id} onChange={e => setNewSchedule(s => ({ ...s, page_id: e.target.value }))} />
              <input type="number" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" placeholder="Budget (đ)" value={newSchedule.budget} onChange={e => setNewSchedule(s => ({ ...s, budget: parseInt(e.target.value) || 200000 }))} />
              <input type="number" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" placeholder="Tuổi min" value={newSchedule.age_min} onChange={e => setNewSchedule(s => ({ ...s, age_min: parseInt(e.target.value) || 18 }))} />
              <button onClick={addSchedule} className="flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm px-3 py-2 transition-colors">
                <Plus size={14} /> Thêm
              </button>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
                <th className="text-left px-4 py-3">Page ID</th>
                <th className="text-left px-4 py-3">Budget</th>
                <th className="text-left px-4 py-3">Targeting</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Active Campaign</th>
                <th className="px-4 py-3"></th>
              </tr></thead>
              <tbody>
                {schedules.map(s => (
                  <tr key={s.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-medium font-mono text-xs">{s.page_id}</td>
                    <td className="px-4 py-3 text-gray-400">{(s.budget || 200000).toLocaleString('vi-VN')}đ</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{s.age_min || 18}-{s.age_max || 65} tuổi</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleSchedule(s)} className={`text-xs px-2 py-0.5 rounded-full ${s.enabled ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                        {s.enabled ? 'Bật' : 'Tắt'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {s.active_campaign_id ? (
                        <span className="text-red-400 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span> Đang boost</span>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deleteSchedule(s.id)} className="text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
                {schedules.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-500">Chưa có lịch trình nào</td></tr>}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-600">* Hệ thống check mỗi 2 phút (7h-23h). Khi phát hiện live → tự tạo boost. Khi kết thúc live → tự tắt.</p>
        </div>
      )}

      {/* ===== HISTORY TAB ===== */}
      {tab === 'history' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="text-left px-4 py-3">Video</th>
              <th className="text-left px-4 py-3">Budget</th>
              <th className="text-left px-4 py-3">Bắt đầu</th>
              <th className="text-left px-4 py-3">Kết thúc</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium text-xs">
                    {h.video_title || h.video_id}
                    {h.auto && <span className="ml-1.5 text-[10px] bg-blue-900 text-blue-300 px-1.5 py-0.5 rounded">Auto</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{h.budget?.toLocaleString('vi-VN')}đ</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{h.started_at ? new Date(h.started_at).toLocaleString('vi-VN') : '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{h.stopped_at ? new Date(h.stopped_at).toLocaleString('vi-VN') : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${h.status === 'active' ? 'bg-red-900 text-red-300' : 'bg-gray-700 text-gray-400'}`}>
                      {h.status === 'active' ? '🔴 Active' : '⏹ Stopped'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {h.status === 'active' && h.campaign_id && (
                      <button onClick={() => stopBoost(h.campaign_id)} className="text-xs bg-gray-700 hover:bg-red-900 text-gray-400 hover:text-red-300 px-2.5 py-1 rounded-lg transition-colors">
                        <Square size={10} className="inline mr-1" /> Stop
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {history.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-500">Chưa có lịch sử boost</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
