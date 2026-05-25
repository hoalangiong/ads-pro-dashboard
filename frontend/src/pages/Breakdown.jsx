import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAccount } from '../context/AccountContext.jsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Download } from 'lucide-react';

const BREAKDOWNS = [
  { value: 'age', label: 'Độ tuổi' },
  { value: 'gender', label: 'Giới tính' },
  { value: 'publisher_platform', label: 'Nền tảng' },
  { value: 'device_platform', label: 'Thiết bị' },
  { value: 'impression_device', label: 'Loại thiết bị' },
];

const COLORS = ['#4f6ef7', '#34d399', '#f59e0b', '#f87171', '#a78bfa', '#38bdf8'];

export default function Breakdown() {
  const { accounts, selected, select } = useAccount();
  const [breakdown, setBreakdown] = useState('age');
  const [datePreset, setDatePreset] = useState('last_7d');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [metric, setMetric] = useState('spend');

  useEffect(() => {
    if (!selected?.id) return;
    setLoading(true);
    api.breakdown(selected.id, breakdown, datePreset)
      .then(d => setData(d.data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [selected?.id, breakdown, datePreset]);

  const METRICS = [
    { key: 'spend', label: 'Chi tiêu', fmt: v => `${parseFloat(v).toLocaleString('vi-VN')}đ` },
    { key: 'impressions', label: 'Impressions', fmt: v => parseInt(v).toLocaleString('vi-VN') },
    { key: 'clicks', label: 'Clicks', fmt: v => parseInt(v).toLocaleString('vi-VN') },
    { key: 'ctr', label: 'CTR %', fmt: v => `${parseFloat(v).toFixed(2)}%` },
    { key: 'cpc', label: 'CPC', fmt: v => `${parseFloat(v).toLocaleString('vi-VN')}đ` },
    { key: 'roas', label: 'ROAS', fmt: v => `${parseFloat(v).toFixed(2)}x` },
    { key: 'conversions', label: 'Conversions', fmt: v => parseInt(v).toLocaleString('vi-VN') },
  ];

  const chartData = data.map(row => ({
    name: row[breakdown] || row.age || row.gender || row.publisher_platform || row.device_platform || row.impression_device || '?',
    value: metric === 'roas'
      ? parseFloat(row.purchase_roas?.[0]?.value || 0)
      : parseFloat(row[metric] || 0),
    raw: row,
  }));

  const fmtFn = METRICS.find(m => m.key === metric)?.fmt || (v => v);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-xl font-bold">Phân tích chi tiết</h1>
        <div className="flex gap-2 flex-wrap">
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" value={selected?.id || ''} onChange={e => select(e.target.value)}>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" value={breakdown} onChange={e => setBreakdown(e.target.value)}>
            {BREAKDOWNS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" value={datePreset} onChange={e => setDatePreset(e.target.value)}>
            <option value="today">Hôm nay</option>
            <option value="last_7d">7 ngày</option>
            <option value="last_14d">14 ngày</option>
            <option value="last_30d">30 ngày</option>
            <option value="this_month">Tháng này</option>
          </select>
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" value={metric} onChange={e => setMetric(e.target.value)}>
            {METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          <button onClick={() => api.export(data, `breakdown_${breakdown}`, 'xlsx')} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-lg text-sm transition-colors">
            <Download size={14} /> Excel
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-gray-500 text-sm">Đang tải...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-sm font-medium mb-4">{METRICS.find(m => m.key === metric)?.label} theo {BREAKDOWNS.find(b => b.value === breakdown)?.label}</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} width={80} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151' }}
                  formatter={(v) => [fmtFn(v), METRICS.find(m => m.key === metric)?.label]}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
                <th className="text-left px-4 py-3">{BREAKDOWNS.find(b => b.value === breakdown)?.label}</th>
                <th className="text-right px-4 py-3">Chi tiêu</th>
                <th className="text-right px-4 py-3">ROAS</th>
                <th className="text-right px-4 py-3">CTR</th>
                <th className="text-right px-4 py-3">CPC</th>
                <th className="text-right px-4 py-3">Clicks</th>
                <th className="text-right px-4 py-3">Conv</th>
              </tr></thead>
              <tbody>
                {data.map((row, i) => {
                  const roas = parseFloat(row.purchase_roas?.[0]?.value || 0);
                  return (
                    <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-medium">{row[breakdown] || '?'}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{row.spend ? `${parseFloat(row.spend).toLocaleString('vi-VN')}đ` : '—'}</td>
                      <td className={`px-4 py-3 text-right font-medium ${roas >= 3 ? 'text-green-400' : roas > 0 && roas < 1.5 ? 'text-red-400' : 'text-gray-300'}`}>
                        {roas > 0 ? `${roas.toFixed(2)}x` : '—'}
                      </td>
                      <td className={`px-4 py-3 text-right ${parseFloat(row.ctr) >= 2 ? 'text-green-400' : parseFloat(row.ctr) >= 1 ? 'text-yellow-400' : parseFloat(row.ctr) > 0 ? 'text-red-400' : 'text-gray-300'}`}>{row.ctr ? `${parseFloat(row.ctr).toFixed(2)}%` : '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{row.cpc ? `${parseFloat(row.cpc).toLocaleString('vi-VN')}đ` : '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{row.clicks ? parseInt(row.clicks).toLocaleString('vi-VN') : '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{row.conversions ? parseInt(row.conversions).toLocaleString('vi-VN') : '—'}</td>
                    </tr>
                  );
                })}
                {data.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-500">Không có dữ liệu</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
