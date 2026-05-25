import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAccount } from '../context/AccountContext.jsx';
import { Download, Search } from 'lucide-react';

const COLS = [
  { key: 'campaign_name', label: 'Campaign' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'reach', label: 'Reach' },
  { key: 'frequency', label: 'Frequency' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'ctr', label: 'CTR %' },
  { key: 'cpc', label: 'CPC' },
  { key: 'cpm', label: 'CPM' },
  { key: 'spend', label: 'Chi tiêu' },
  { key: 'conversions', label: 'Conversions' },
  { key: 'roas', label: 'ROAS' },
];

export default function Insights() {
  const { accounts, selected, select } = useAccount();
  const [level, setLevel] = useState('campaign');
  const [datePreset, setDatePreset] = useState('last_7d');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sort, setSort] = useState({ key: 'spend', dir: 'desc' });
  const [search, setSearch] = useState('');
  const [customSince, setCustomSince] = useState('');
  const [customUntil, setCustomUntil] = useState('');

  const load = () => {
    if (!selected?.id) return;
    setLoading(true);
    const isCustom = datePreset === 'custom';
    api.insights(selected.id, level, isCustom ? null : datePreset, isCustom ? customSince : null, isCustom ? customUntil : null)
      .then(d => setRows(d.data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [selected?.id, level, datePreset, customSince, customUntil]);

  const handleExport = (format) => {
    if (!rows.length) return;
    api.export(rows, `insights_${datePreset}`, format);
  };

  const toggleSort = (key) => {
    setSort(s => s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' });
  };

  const sorted = [...rows]
    .filter(r => !search || (r.campaign_name || r.adset_name || r.ad_name || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
    const av = parseFloat(a[sort.key] || a.purchase_roas?.[0]?.value || 0);
    const bv = parseFloat(b[sort.key] || b.purchase_roas?.[0]?.value || 0);
    if (sort.key === 'campaign_name') return sort.dir === 'asc' ? (a.campaign_name || '').localeCompare(b.campaign_name || '') : (b.campaign_name || '').localeCompare(a.campaign_name || '');
    return sort.dir === 'desc' ? bv - av : av - bv;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Chỉ số chi tiết</h1>
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input className="bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-1.5 text-sm w-40" placeholder="Tìm kiếm..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" value={selected?.id || ''} onChange={e => select(e.target.value)}>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" value={level} onChange={e => setLevel(e.target.value)}>
            <option value="account">Account</option>
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
            <option value="last_month">Tháng trước</option>
            <option value="custom">Tùy chỉnh...</option>
          </select>
          {datePreset === 'custom' && <>
            <input type="date" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" value={customSince} onChange={e => setCustomSince(e.target.value)} />
            <input type="date" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" value={customUntil} onChange={e => setCustomUntil(e.target.value)} />
          </>}
          <button onClick={() => handleExport('xlsx')} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-lg text-sm transition-colors">
            <Download size={14} /> Excel
          </button>
          <button onClick={() => handleExport('csv')} className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-sm transition-colors">
            <Download size={14} /> CSV
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              {COLS.map(c => (
                <th key={c.key} className="text-left px-4 py-3 cursor-pointer hover:text-white select-none" onClick={() => toggleSort(c.key)}>
                  {c.label}{sort.key === c.key ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={COLS.length} className="text-center py-8 text-gray-500">Đang tải...</td></tr>}
            {!loading && sorted.map((r, i) => (
              <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50">
                {COLS.map(c => {
                  let val = r[c.key];
                  let cls = 'text-gray-300';
                  if (c.key === 'ctr') {
                    const n = parseFloat(val || 0);
                    cls = n >= 2 ? 'text-green-400' : n >= 1 ? 'text-yellow-400' : n > 0 ? 'text-red-400' : 'text-gray-500';
                    val = n > 0 ? `${n.toFixed(2)}%` : '—';
                  } else if (['cpc', 'cpm', 'spend'].includes(c.key)) {
                    val = val ? `${parseFloat(val).toLocaleString('vi-VN')}đ` : '—';
                  } else if (c.key === 'roas') {
                    const n = parseFloat(val || 0);
                    cls = n >= 3 ? 'text-green-400 font-medium' : n > 0 && n < 1.5 ? 'text-red-400 font-medium' : 'text-gray-300';
                    val = n > 0 ? `${n.toFixed(2)}x` : '—';
                  } else if (c.key === 'frequency') {
                    const n = parseFloat(val || 0);
                    cls = n > 3.5 ? 'text-yellow-400' : 'text-gray-300';
                    val = n > 0 ? n.toFixed(2) : '—';
                  } else if (['impressions', 'reach', 'clicks', 'conversions'].includes(c.key)) {
                    val = val ? parseInt(val).toLocaleString('vi-VN') : '—';
                  }
                  return <td key={c.key} className={`px-4 py-3 ${cls}`}>{val ?? '—'}</td>;
                })}
              </tr>
            ))}
            {!loading && rows.length === 0 && <tr><td colSpan={COLS.length} className="text-center py-8 text-gray-500">Không có dữ liệu</td></tr>}
          </tbody>
          {!loading && sorted.length > 1 && (() => {
            const n = sorted.length;
            const sum = (key) => sorted.reduce((acc, r) => acc + parseFloat(r[key] || 0), 0);
            const avgNonZero = (key) => {
              const nonZero = sorted.filter(r => parseFloat(r[key] || 0) > 0);
              return nonZero.length ? nonZero.reduce((acc, r) => acc + parseFloat(r[key]), 0) / nonZero.length : 0;
            };
            const totals = {
              campaign_name: `Tổng (${n})`,
              impressions: sum('impressions'),
              reach: sum('reach'),
              frequency: avgNonZero('frequency'),
              clicks: sum('clicks'),
              ctr: avgNonZero('ctr'),
              cpc: avgNonZero('cpc'),
              cpm: avgNonZero('cpm'),
              spend: sum('spend'),
              conversions: sum('conversions'),
              roas: avgNonZero('roas'),
            };
            return (
              <tfoot>
                <tr className="border-t-2 border-gray-600 bg-gray-800/60 font-medium text-sm">
                  {COLS.map(c => {
                    let val = totals[c.key];
                    let cls = 'text-white';
                    if (c.key === 'campaign_name') return <td key={c.key} className="px-4 py-3 text-gray-300">{val}</td>;
                    if (c.key === 'ctr') {
                      cls = val >= 2 ? 'text-green-400' : val >= 1 ? 'text-yellow-400' : val > 0 ? 'text-red-400' : 'text-white';
                      val = val ? `${val.toFixed(2)}%` : '—';
                    } else if (['cpc', 'cpm', 'spend'].includes(c.key)) {
                      val = val ? `${val.toLocaleString('vi-VN')}đ` : '—';
                    } else if (c.key === 'roas') {
                      cls = val >= 3 ? 'text-green-400' : val > 0 && val < 1.5 ? 'text-red-400' : 'text-white';
                      val = val ? `${val.toFixed(2)}x` : '—';
                    } else if (c.key === 'frequency') {
                      cls = val > 3.5 ? 'text-yellow-400' : 'text-white';
                      val = val ? val.toFixed(2) : '—';
                    } else if (['impressions', 'reach', 'clicks', 'conversions'].includes(c.key)) {
                      val = val ? parseInt(val).toLocaleString('vi-VN') : '—';
                    }
                    return <td key={c.key} className={`px-4 py-3 ${cls}`}>{val ?? '—'}</td>;
                  })}
                </tr>
              </tfoot>
            );
          })()}
        </table>
      </div>
    </div>
  );
}
