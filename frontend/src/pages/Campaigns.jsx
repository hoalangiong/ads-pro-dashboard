import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAccount } from '../context/AccountContext.jsx';
import { Download, Pause, Play } from 'lucide-react';

const STATUS_COLOR = { ACTIVE: 'text-green-400', PAUSED: 'text-yellow-400', ARCHIVED: 'text-gray-500' };

export default function Campaigns() {
  const { accounts, selected, select } = useAccount();
  const [level, setLevel] = useState('campaign');
  const [datePreset, setDatePreset] = useState('last_7d');
  const [rows, setRows] = useState([]);
  const [insightsMap, setInsightsMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

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
