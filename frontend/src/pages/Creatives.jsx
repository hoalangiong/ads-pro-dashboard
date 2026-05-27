import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAccount } from '../context/AccountContext.jsx';
import { Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const RANK_COLOR = {
  ABOVE_AVERAGE: 'text-green-400',
  AVERAGE: 'text-yellow-400',
  BELOW_AVERAGE: 'text-red-400',
};
const RANK_LABEL = {
  ABOVE_AVERAGE: 'Tốt',
  AVERAGE: 'TB',
  BELOW_AVERAGE: 'Kém',
};

export default function Creatives() {
  const { accounts, selected, select } = useAccount();
  const [datePreset, setDatePreset] = useState('last_7d');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sort, setSort] = useState('spend');

  useEffect(() => {
    if (!selected?.id) return;
    setLoading(true);
    api.creatives(selected.id, datePreset)
      .then(d => setData(d.data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [selected?.id, datePreset]);

  const sorted = [...data].sort((a, b) => {
    if (sort === 'roas') return parseFloat(b.roas || 0) - parseFloat(a.roas || 0);
    if (sort === 'ctr') return parseFloat(b.ctr || 0) - parseFloat(a.ctr || 0);
    if (sort === 'hook_rate') return parseFloat(b.hook_rate || 0) - parseFloat(a.hook_rate || 0);
    return parseFloat(b.spend || 0) - parseFloat(a.spend || 0);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-xl font-bold">Hiệu quả Creative</h1>
        <div className="flex gap-2 flex-wrap">
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" value={selected?.id || ''} onChange={e => select(e.target.value)}>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" value={datePreset} onChange={e => setDatePreset(e.target.value)}>
            <option value="today">Hôm nay</option>
            <option value="last_7d">7 ngày</option>
            <option value="last_14d">14 ngày</option>
            <option value="last_30d">30 ngày</option>
            <option value="this_month">Tháng này</option>
          </select>
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="spend">Sắp xếp: Chi tiêu</option>
            <option value="roas">Sắp xếp: ROAS</option>
            <option value="ctr">Sắp xếp: CTR</option>
            <option value="hook_rate">Sắp xếp: Hook Rate</option>
          </select>
          <button onClick={() => api.export(data, `creatives_${datePreset}`, 'xlsx')} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-lg text-sm transition-colors">
            <Download size={14} /> Excel
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {sorted.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-sm font-medium mb-3">Top 8 — Chi tiêu</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sorted.slice(0, 8).map(r => ({ name: (r.ad_name || '').slice(0, 20), spend: parseFloat(r.spend || 0) }))} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} width={120} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151' }} formatter={v => [`${parseFloat(v).toLocaleString('vi-VN')}đ`, 'Chi tiêu']} />
                <Bar dataKey="spend" fill="#4f6ef7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-sm font-medium mb-3">Top 8 — ROAS</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={[...sorted].sort((a, b) => parseFloat(b.roas || 0) - parseFloat(a.roas || 0)).slice(0, 8).map(r => ({ name: (r.ad_name || '').slice(0, 20), roas: parseFloat(r.roas || 0) }))} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} width={120} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151' }} formatter={v => [`${parseFloat(v).toFixed(2)}x`, 'ROAS']} />
                <Bar dataKey="roas" radius={[0, 4, 4, 0]}>
                  {[...sorted].sort((a, b) => parseFloat(b.roas || 0) - parseFloat(a.roas || 0)).slice(0, 8).map((r, i) => (
                    <Cell key={i} fill={parseFloat(r.roas) >= 3 ? '#34d399' : parseFloat(r.roas) >= 1.5 ? '#f59e0b' : '#f87171'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="text-left px-4 py-3 min-w-48">Ad</th>
              <th className="text-right px-4 py-3">Chi tiêu</th>
              <th className="text-right px-4 py-3">ROAS</th>
              <th className="text-right px-4 py-3">CTR</th>
              <th className="text-right px-4 py-3">CPC</th>
              <th className="text-right px-4 py-3">Freq</th>
              <th className="text-right px-4 py-3">Hook%</th>
              <th className="text-right px-4 py-3">Retention%</th>
              <th className="text-center px-4 py-3">Quality</th>
              <th className="text-center px-4 py-3">Engagement</th>
              <th className="text-center px-4 py-3">Conversion</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={11} className="text-center py-8 text-gray-500">Đang tải...</td></tr>}
            {!loading && sorted.map((row, i) => {
              const roas = parseFloat(row.roas || 0);
              const ctr = parseFloat(row.ctr || 0);
              return (
                <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <p className="font-medium truncate max-w-xs">{row.ad_name}</p>
                    <p className="text-xs text-gray-500 truncate max-w-xs">{row.campaign_name}</p>
                  </td>
                  <td className="px-4 py-3 text-right">{row.spend ? `${parseFloat(row.spend).toLocaleString('vi-VN')}đ` : '—'}</td>
                  <td className={`px-4 py-3 text-right font-medium ${roas >= 3 ? 'text-green-400' : roas > 0 && roas < 1.5 ? 'text-red-400' : 'text-gray-300'}`}>
                    {roas > 0 ? `${roas.toFixed(2)}x` : '—'}
                  </td>
                  <td className={`px-4 py-3 text-right ${ctr >= 2 ? 'text-green-400' : ctr >= 1 ? 'text-yellow-400' : ctr > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                    {ctr > 0 ? `${ctr.toFixed(2)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">{row.cpc ? `${parseFloat(row.cpc).toLocaleString('vi-VN')}đ` : '—'}</td>
                  <td className={`px-4 py-3 text-right ${parseFloat(row.frequency) > 3.5 ? 'text-yellow-400' : 'text-gray-300'}`}>
                    {row.frequency ? parseFloat(row.frequency).toFixed(2) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">{row.hook_rate ? `${row.hook_rate}%` : '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{row.video_retention_pct ? `${row.video_retention_pct}%` : '—'}</td>
                  <td className={`px-4 py-3 text-center text-xs ${RANK_COLOR[row.quality_ranking] || 'text-gray-500'}`}>
                    {RANK_LABEL[row.quality_ranking] || '—'}
                  </td>
                  <td className={`px-4 py-3 text-center text-xs ${RANK_COLOR[row.engagement_rate_ranking] || 'text-gray-500'}`}>
                    {RANK_LABEL[row.engagement_rate_ranking] || '—'}
                  </td>
                  <td className={`px-4 py-3 text-center text-xs ${RANK_COLOR[row.conversion_rate_ranking] || 'text-gray-500'}`}>
                    {RANK_LABEL[row.conversion_rate_ranking] || '—'}
                  </td>
                </tr>
              );
            })}
            {!loading && sorted.length === 0 && <tr><td colSpan={11} className="text-center py-8 text-gray-500">Không có dữ liệu</td></tr>}
          </tbody>
        </table>
      </div>

      {sorted.length > 0 && (
        <div className="mt-4 bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Ghi chú chỉ số video</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-gray-400">
            <p><span className="text-white">Hook Rate:</span> % người xem qua 25% video — nên &gt;30%</p>
            <p><span className="text-white">Retention:</span> % người xem hết video — nên &gt;15%</p>
            <p><span className="text-white">Quality:</span> Xếp hạng chất lượng ad so với ads cùng audience</p>
            <p><span className="text-white">Engagement:</span> Xếp hạng tương tác so với ads cùng loại</p>
          </div>
        </div>
      )}
    </div>
  );
}
