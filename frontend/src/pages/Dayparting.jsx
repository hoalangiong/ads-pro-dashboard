import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAccount } from '../context/AccountContext.jsx';
import { Clock, RefreshCw, Sun, Moon } from 'lucide-react';

export default function Dayparting() {
  const { selected } = useAccount();
  const [data, setData] = useState(null);
  const [metric, setMetric] = useState('cpc');
  const [datePreset, setDatePreset] = useState('last_7d');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!selected?.id) return;
    setLoading(true); setError('');
    try {
      const result = await api.dayparting(selected.id, datePreset);
      setData(result);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [selected, datePreset]);

  const getColor = (value, min, max) => {
    if (!value || max === min) return 'bg-gray-800';
    const pct = (value - min) / (max - min);
    if (metric === 'ctr' || metric === 'roas') {
      // Higher is better — green
      if (pct > 0.7) return 'bg-green-700';
      if (pct > 0.4) return 'bg-green-900';
      if (pct > 0.2) return 'bg-yellow-900';
      return 'bg-red-900';
    }
    // Lower is better (CPC, CPM, Spend)
    if (pct < 0.3) return 'bg-green-700';
    if (pct < 0.5) return 'bg-green-900';
    if (pct < 0.7) return 'bg-yellow-900';
    return 'bg-red-900';
  };

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const heatmap = data?.heatmap || [];
  const values = heatmap.map(h => h[metric] || 0).filter(v => v > 0);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2"><Clock size={20} className="text-blue-400" /> Dayparting</h1>
        <div className="flex gap-2">
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" value={datePreset} onChange={e => setDatePreset(e.target.value)}>
            <option value="last_7d">7 ngày</option>
            <option value="last_14d">14 ngày</option>
            <option value="last_30d">30 ngày</option>
          </select>
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" value={metric} onChange={e => setMetric(e.target.value)}>
            <option value="cpc">CPC</option>
            <option value="ctr">CTR</option>
            <option value="roas">ROAS</option>
            <option value="spend">Spend</option>
            <option value="cpm">CPM</option>
          </select>
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-3 py-1.5 rounded-lg text-sm transition-colors">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && <p className="text-sm mb-4 text-red-400">{error}</p>}

      {/* Heatmap */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Performance theo giờ — {metric.toUpperCase()}</p>
        <div className="grid grid-cols-24 gap-1">
          {hours.map(h => (
            <div key={h} className="text-center text-[10px] text-gray-500 mb-1">{h}</div>
          ))}
          {hours.map(h => {
            const row = heatmap.find(r => r.hour === h);
            const val = row ? row[metric] : 0;
            return (
              <div key={`v-${h}`} className={`aspect-square rounded ${getColor(val, min, max)} flex items-center justify-center cursor-default group relative`} title={`${h}:00 — ${metric}: ${val?.toFixed(2) || 0}`}>
                <span className="text-[8px] text-white/70">{val > 0 ? (val > 100 ? Math.round(val / 1000) + 'k' : val.toFixed(1)) : ''}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-700"></div> Tốt</span>
          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-yellow-900"></div> Trung bình</span>
          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-900"></div> Kém</span>
        </div>
      </div>

      {/* Recommendations */}
      {data?.recommend && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-900/20 border border-green-800/30 rounded-xl p-4">
            <p className="text-sm font-medium text-green-400 flex items-center gap-2 mb-2"><Sun size={14} /> Giờ vàng</p>
            {data.recommend.golden?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {data.recommend.golden.map(h => (
                  <span key={h} className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded">{h}:00</span>
                ))}
              </div>
            ) : <p className="text-xs text-gray-500">Chưa đủ data</p>}
            <p className="text-xs text-gray-500 mt-2">CPC thấp + CTR cao — nên tăng budget</p>
          </div>
          <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4">
            <p className="text-sm font-medium text-red-400 flex items-center gap-2 mb-2"><Moon size={14} /> Giờ nên tránh</p>
            {data.recommend.avoid?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {data.recommend.avoid.map(h => (
                  <span key={h} className="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded">{h}:00</span>
                ))}
              </div>
            ) : <p className="text-xs text-gray-500">Chưa đủ data</p>}
            <p className="text-xs text-gray-500 mt-2">CPC cao + CTR thấp — nên giảm hoặc tắt</p>
          </div>
        </div>
      )}
    </div>
  );
}
