import { useState } from 'react';
import { api } from '../lib/api.js';
import { useAccount } from '../context/AccountContext.jsx';
import { TrendingUp, TrendingDown, Minus, Download } from 'lucide-react';

function getDefaultDates() {
  const today = new Date();
  const fmt = d => d.toISOString().split('T')[0];
  const curr_until = fmt(today);
  const curr_since = fmt(new Date(today - 7 * 86400000));
  const prev_until = fmt(new Date(today - 8 * 86400000));
  const prev_since = fmt(new Date(today - 15 * 86400000));
  return { curr_since, curr_until, prev_since, prev_until };
}

const METRIC_LABELS = {
  spend: { label: 'Chi tiêu', fmt: v => `${parseFloat(v).toLocaleString('vi-VN')}đ`, lowerIsBetter: true },
  impressions: { label: 'Impressions', fmt: v => parseInt(v).toLocaleString('vi-VN') },
  clicks: { label: 'Clicks', fmt: v => parseInt(v).toLocaleString('vi-VN') },
  ctr: { label: 'CTR', fmt: v => `${parseFloat(v).toFixed(2)}%` },
  cpc: { label: 'CPC', fmt: v => `${parseFloat(v).toLocaleString('vi-VN')}đ`, lowerIsBetter: true },
  roas: { label: 'ROAS', fmt: v => `${parseFloat(v).toFixed(2)}x` },
  conversions: { label: 'Conversions', fmt: v => parseInt(v).toLocaleString('vi-VN') },
};

function ChangeChip({ change, lowerIsBetter }) {
  if (change === null) return <span className="text-gray-500 text-xs">—</span>;
  const good = lowerIsBetter ? change < 0 : change > 0;
  const color = good ? 'text-green-400' : change === 0 ? 'text-gray-400' : 'text-red-400';
  const Icon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon size={12} /> {change > 0 ? '+' : ''}{change.toFixed(1)}%
    </span>
  );
}

function pct(curr, prev) {
  return prev === 0 ? null : ((curr - prev) / prev * 100);
}

export default function Compare() {
  const def = getDefaultDates();
  const { accounts, selected, select } = useAccount();
  const [dates, setDates] = useState(def);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const compare = async () => {
    if (!selected?.id) return;
    setLoading(true); setError('');
    try {
      const r = await api.compare(
        selected.id,
        dates.curr_since, dates.curr_until,
        dates.prev_since, dates.prev_until
      );
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Build per-campaign comparison from raw current/previous arrays
  const campaignRows = (() => {
    if (!result) return [];
    const prevMap = {};
    for (const r of result.previous) {
      const key = r.campaign_name || r.adset_name || r.ad_name;
      if (key) prevMap[key] = r;
    }
    return result.current.map(r => {
      const name = r.campaign_name || r.adset_name || r.ad_name || '?';
      const prev = prevMap[name];
      const currSpend = parseFloat(r.spend || 0);
      const prevSpend = parseFloat(prev?.spend || 0);
      const currRoas = parseFloat(r.purchase_roas?.[0]?.value || 0);
      const prevRoas = parseFloat(prev?.purchase_roas?.[0]?.value || 0);
      const currCtr = parseFloat(r.ctr || 0);
      const prevCtr = parseFloat(prev?.ctr || 0);
      const currConv = parseInt(r.conversions || 0);
      const prevConv = parseInt(prev?.conversions || 0);
      return {
        name,
        spend: { curr: currSpend, prev: prevSpend, change: pct(currSpend, prevSpend) },
        roas: { curr: currRoas, prev: prevRoas, change: pct(currRoas, prevRoas) },
        ctr: { curr: currCtr, prev: prevCtr, change: pct(currCtr, prevCtr) },
        conversions: { curr: currConv, prev: prevConv, change: pct(currConv, prevConv) },
      };
    }).sort((a, b) => b.spend.curr - a.spend.curr);
  })();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">So sánh kỳ</h1>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Tài khoản</label>
            <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={selected?.id || ''} onChange={e => select(e.target.value)}>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Kỳ hiện tại — từ</label>
            <input type="date" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={dates.curr_since} onChange={e => setDates(d => ({ ...d, curr_since: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">đến</label>
            <input type="date" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={dates.curr_until} onChange={e => setDates(d => ({ ...d, curr_until: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Kỳ trước — từ</label>
            <input type="date" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={dates.prev_since} onChange={e => setDates(d => ({ ...d, prev_since: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">đến</label>
            <input type="date" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={dates.prev_until} onChange={e => setDates(d => ({ ...d, prev_until: e.target.value }))} />
          </div>
        </div>
        <button onClick={compare} disabled={loading} className="mt-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 px-5 py-2 rounded-lg text-sm font-medium transition-colors">
          {loading ? 'Đang so sánh...' : 'So sánh'}
        </button>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </div>

      {result && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {Object.entries(result.comparison).map(([key, val]) => {
              const meta = METRIC_LABELS[key];
              if (!meta) return null;
              return (
                <div key={key} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{meta.label}</p>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xl font-bold">{meta.fmt(val.current)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Trước: {meta.fmt(val.previous)}</p>
                    </div>
                    <ChangeChip change={val.change} lowerIsBetter={meta.lowerIsBetter} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Per-campaign breakdown */}
          {campaignRows.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Chi tiết theo Campaign</p>
                <button
                  onClick={() => api.export(campaignRows.map(r => ({
                    campaign: r.name,
                    spend_curr: r.spend.curr, spend_prev: r.spend.prev, spend_change_pct: r.spend.change?.toFixed(1),
                    roas_curr: r.roas.curr, roas_prev: r.roas.prev, roas_change_pct: r.roas.change?.toFixed(1),
                    ctr_curr: r.ctr.curr, ctr_prev: r.ctr.prev, ctr_change_pct: r.ctr.change?.toFixed(1),
                    conv_curr: r.conversions.curr, conv_prev: r.conversions.prev,
                  })), `compare_${dates.curr_since}_vs_${dates.prev_since}`, 'xlsx')}
                  className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs transition-colors"
                >
                  <Download size={12} /> Excel
                </button>
              </div>
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
                    <th className="text-left px-4 py-3 min-w-48">Campaign</th>
                    <th className="text-right px-4 py-3">Chi tiêu</th>
                    <th className="text-right px-4 py-3">Δ Chi tiêu</th>
                    <th className="text-right px-4 py-3">ROAS</th>
                    <th className="text-right px-4 py-3">Δ ROAS</th>
                    <th className="text-right px-4 py-3">CTR</th>
                    <th className="text-right px-4 py-3">Δ CTR</th>
                    <th className="text-right px-4 py-3">Conversions</th>
                    <th className="text-right px-4 py-3">Δ Conv</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignRows.map((r, i) => (
                    <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-medium max-w-xs truncate">{r.name}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{r.spend.curr ? `${r.spend.curr.toLocaleString('vi-VN')}đ` : '—'}</td>
                      <td className="px-4 py-3 text-right"><ChangeChip change={r.spend.change} lowerIsBetter={true} /></td>
                      <td className={`px-4 py-3 text-right font-medium ${r.roas.curr >= 3 ? 'text-green-400' : r.roas.curr > 0 && r.roas.curr < 1.5 ? 'text-red-400' : 'text-gray-300'}`}>
                        {r.roas.curr > 0 ? `${r.roas.curr.toFixed(2)}x` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right"><ChangeChip change={r.roas.change} lowerIsBetter={false} /></td>
                      <td className="px-4 py-3 text-right text-gray-300">{r.ctr.curr > 0 ? `${r.ctr.curr.toFixed(2)}%` : '—'}</td>
                      <td className="px-4 py-3 text-right"><ChangeChip change={r.ctr.change} lowerIsBetter={false} /></td>
                      <td className="px-4 py-3 text-right text-gray-300">{r.conversions.curr || '—'}</td>
                      <td className="px-4 py-3 text-right"><ChangeChip change={r.conversions.change} lowerIsBetter={false} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!result && !loading && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-3">📊</p>
          <p>Chọn 2 kỳ và nhấn So sánh để xem hiệu quả thay đổi thế nào</p>
        </div>
      )}
    </div>
  );
}
