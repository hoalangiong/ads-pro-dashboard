import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAccount } from '../context/AccountContext.jsx';
import { Download, Pause, Play, StickyNote, X, Plus } from 'lucide-react';

const STATUS_COLOR = { ACTIVE: 'text-green-400', PAUSED: 'text-yellow-400', ARCHIVED: 'text-gray-500' };

function NotesPanel({ objectId, onClose }) {
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [noteError, setNoteError] = useState('');

  useEffect(() => {
    setLoadingNotes(true);
    api.notes(objectId)
      .then(setNotes)
      .catch(e => setNoteError(e.message))
      .finally(() => setLoadingNotes(false));
  }, [objectId]);

  const add = async () => {
    if (!text.trim()) return;
    try {
      const note = await api.addNote(objectId, text);
      setNotes(n => [...n, note]);
      setText('');
    } catch (e) { setNoteError(e.message); }
  };

  const remove = async (id) => {
    try {
      await api.deleteNote(id);
      setNotes(n => n.filter(x => x.id !== id));
    } catch (e) { setNoteError(e.message); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-sm">Ghi chú</p>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16} /></button>
        </div>
        {noteError && <p className="text-red-400 text-xs mb-2">{noteError}</p>}
        <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
          {loadingNotes && <p className="text-gray-500 text-sm text-center py-4">Đang tải...</p>}
          {!loadingNotes && notes.length === 0 && <p className="text-gray-500 text-sm text-center py-4">Chưa có ghi chú</p>}
          {notes.map(n => (
            <div key={n.id} className="flex items-start gap-2 bg-gray-800 rounded-lg px-3 py-2 text-sm">
              <div className="flex-1 min-w-0">
                <p className="text-gray-200 break-words">{n.text}</p>
                <p className="text-xs text-gray-500 mt-0.5">{new Date(n.created_at).toLocaleString('vi-VN')}</p>
              </div>
              <button onClick={() => remove(n.id)} className="text-gray-600 hover:text-red-400 shrink-0 mt-0.5"><X size={12} /></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
            placeholder="Thêm ghi chú..."
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
          />
          <button onClick={add} className="bg-brand-600 hover:bg-brand-700 px-3 py-2 rounded-lg text-sm transition-colors">
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Campaigns() {
  const { accounts, selected, select } = useAccount();
  const [level, setLevel] = useState('campaign');
  const [datePreset, setDatePreset] = useState('last_7d');
  const [rows, setRows] = useState([]);
  const [insightsMap, setInsightsMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [notesFor, setNotesFor] = useState(null);

  useEffect(() => {
    if (!selected?.id) return;
    setLoading(true);
    Promise.all([
      api.campaigns(selected.id, level),
      api.insights(selected.id, level, datePreset),
    ])
      .then(([camps, ins]) => {
        setRows(camps);
        const map = {};
        for (const r of ins.data || []) {
          const key = r.campaign_id || r.adset_id || r.ad_id;
          if (key) map[key] = r;
        }
        setInsightsMap(map);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [selected?.id, level, datePreset]);

  const toggleStatus = async (r) => {
    try {
      if (r.status === 'ACTIVE') {
        await api.pauseCampaign(r.id, level);
        setRows(rs => rs.map(x => x.id === r.id ? { ...x, status: 'PAUSED' } : x));
        setMsg(`Đã tạm dừng: ${r.name}`); setError('');
      } else {
        await api.resumeCampaign(r.id, level);
        setRows(rs => rs.map(x => x.id === r.id ? { ...x, status: 'ACTIVE' } : x));
        setMsg(`Đã bật lại: ${r.name}`); setError('');
      }
    } catch (e) { setError(e.message); }
  };

  const enriched = rows.map(r => ({ ...r, ins: insightsMap[r.id] || null }));

  return (
    <div>
      {notesFor && <NotesPanel objectId={notesFor} onClose={() => setNotesFor(null)} />}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-xl font-bold">Campaigns</h1>
        <div className="flex gap-2 flex-wrap">
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" value={selected?.id || ''} onChange={e => select(e.target.value)}>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" value={level} onChange={e => setLevel(e.target.value)}>
            <option value="campaign">Campaign</option>
            <option value="adset">Ad Set</option>
            <option value="ad">Ad</option>
          </select>
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" value={datePreset} onChange={e => setDatePreset(e.target.value)}>
            <option value="today">Hôm nay</option>
            <option value="yesterday">Hôm qua</option>
            <option value="last_7d">7 ngày</option>
            <option value="last_14d">14 ngày</option>
            <option value="last_30d">30 ngày</option>
            <option value="this_month">Tháng này</option>
          </select>
          <button
            onClick={() => api.export(enriched.map(r => ({
              name: r.name, status: r.status, objective: r.objective,
              daily_budget: r.daily_budget ? parseInt(r.daily_budget / 100) : 0,
              spend: r.ins?.spend || 0, roas: r.ins?.roas || 0,
              ctr: r.ins?.ctr || 0, cpc: r.ins?.cpc || 0,
              impressions: r.ins?.impressions || 0, clicks: r.ins?.clicks || 0,
            })), `campaigns_${datePreset}`, 'xlsx')}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-lg text-sm transition-colors"
          >
            <Download size={14} /> Excel
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      {msg && <p className="text-green-400 text-sm mb-4">{msg}</p>}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="text-left px-4 py-3 min-w-48">Tên</th>
              <th className="text-left px-4 py-3">Trạng thái</th>
              <th className="text-left px-4 py-3">Mục tiêu</th>
              <th className="text-right px-4 py-3">Budget/ngày</th>
              <th className="text-right px-4 py-3">Chi tiêu</th>
              <th className="text-right px-4 py-3">ROAS</th>
              <th className="text-right px-4 py-3">CTR</th>
              <th className="text-right px-4 py-3">CPC</th>
              <th className="text-right px-4 py-3">Clicks</th>
              <th className="text-right px-4 py-3">Impressions</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={11} className="text-center py-8 text-gray-500">Đang tải...</td></tr>
            )}
            {!loading && enriched.map(r => {
              const ins = r.ins;
              const roas = parseFloat(ins?.roas || ins?.purchase_roas?.[0]?.value || 0);
              const ctr = parseFloat(ins?.ctr || 0);
              return (
                <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium max-w-xs truncate">{r.name}</td>
                  <td className={`px-4 py-3 ${STATUS_COLOR[r.status] || 'text-gray-400'}`}>{r.status}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{r.objective || '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {r.daily_budget ? `${parseInt(r.daily_budget / 100).toLocaleString('vi-VN')}đ` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {ins?.spend ? `${parseFloat(ins.spend).toLocaleString('vi-VN')}đ` : '—'}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${roas >= 3 ? 'text-green-400' : roas > 0 && roas < 1.5 ? 'text-red-400' : 'text-gray-300'}`}>
                    {roas > 0 ? `${roas.toFixed(2)}x` : '—'}
                  </td>
                  <td className={`px-4 py-3 text-right ${ctr >= 2 ? 'text-green-400' : ctr >= 1 ? 'text-yellow-400' : ctr > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                    {ctr > 0 ? `${ctr.toFixed(2)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {ins?.cpc ? `${parseFloat(ins.cpc).toLocaleString('vi-VN')}đ` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {ins?.clicks ? parseInt(ins.clicks).toLocaleString('vi-VN') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {ins?.impressions ? parseInt(ins.impressions).toLocaleString('vi-VN') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {r.status !== 'ARCHIVED' && (
                        <button
                          onClick={() => toggleStatus(r)}
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                            r.status === 'ACTIVE'
                              ? 'bg-yellow-900 text-yellow-300 hover:bg-yellow-800'
                              : 'bg-green-900 text-green-300 hover:bg-green-800'
                          }`}
                        >
                          {r.status === 'ACTIVE' ? <><Pause size={11} /> Dừng</> : <><Play size={11} /> Bật</>}
                        </button>
                      )}
                      <button
                        onClick={() => setNotesFor(r.id)}
                        className="p-1 text-gray-500 hover:text-brand-400 transition-colors"
                        title="Ghi chú"
                      >
                        <StickyNote size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={11} className="text-center py-8 text-gray-500">Không có dữ liệu</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
