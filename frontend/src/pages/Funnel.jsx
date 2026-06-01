import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAccount } from '../context/AccountContext.jsx';
import { Filter, RefreshCw } from 'lucide-react';

export default function Funnel() {
  const { selected } = useAccount();
  const [data, setData] = useState(null);
  const [datePreset, setDatePreset] = useState('last_7d');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!selected?.id) return;
    setLoading(true); setError('');
    try {
      const result = await api.funnel(selected.id, datePreset);
      setData(result);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [selected, datePreset]);

  const funnel = data?.summary || data?.funnels?.[0];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2"><Filter size={20} className="text-cyan-400" /> Funnel Tracking</h1>
        <div className="flex gap-2">
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" value={datePreset} onChange={e => setDatePreset(e.target.value)}>
            <option value="today">Hôm nay</option>
            <option value="last_7d">7 ngày</option>
            <option value="last_14d">14 ngày</option>
            <option value="last_30d">30 ngày</option>
          </select>
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-3 py-1.5 rounded-lg text-sm transition-colors">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && <p className="text-sm mb-4 text-red-400">{error}</p>}

      {/* Funnel visualization */}
      {funnel && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-4">Funnel tổng quan</p>
          <div className="space-y-3">
            {funnel.steps.map((step, i) => {
              const maxVal = funnel.steps[0].value || 1;
              const width = Math.max(5, (step.value / maxVal) * 100);
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-28 text-xs text-gray-400 text-right flex-shrink-0">{step.name}</div>
                  <div className="flex-1 relative">
                    <div className="h-8 bg-gray-800 rounded-lg overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-800 rounded-lg flex items-center px-3 transition-all" style={{ width: `${width}%` }}>
                        <span className="text-xs text-white font-medium">{step.value.toLocaleString('vi-VN')}</span>
                      </div>
                    </div>
                  </div>
                  {i > 0 && (
                    <div className="w-20 text-right flex-shrink-0">
                      <span className={`text-xs ${step.dropoff_pct > 80 ? 'text-red-400' : step.dropoff_pct > 50 ? 'text-yellow-400' : 'text-green-400'}`}>
                        ↓{step.dropoff_pct}%
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-4">Conversion rate tổng: <span className="text-cyan-400 font-medium">{funnel.overall_conversion}%</span></p>
        </div>
      )}

      {/* Campaign funnels */}
      {data?.funnels?.length > 1 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="text-left px-4 py-3">Campaign</th>
              <th className="text-right px-4 py-3">Impressions</th>
              <th className="text-right px-4 py-3">Clicks</th>
              <th className="text-right px-4 py-3">Purchases</th>
              <th className="text-right px-4 py-3">Conv. Rate</th>
              <th className="text-right px-4 py-3">Spend</th>
            </tr></thead>
            <tbody>
              {data.funnels.map(f => (
                <tr key={f.campaign_id} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium">{f.campaign_name}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{f.steps[0]?.value.toLocaleString('vi-VN')}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{f.steps[1]?.value.toLocaleString('vi-VN')}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{f.steps[f.steps.length - 1]?.value.toLocaleString('vi-VN')}</td>
                  <td className="px-4 py-3 text-right text-cyan-400">{f.overall_conversion}%</td>
                  <td className="px-4 py-3 text-right text-gray-400">{f.spend.toLocaleString('vi-VN')}đ</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!funnel && !loading && (
        <div className="text-center py-12 text-gray-500">Chưa có dữ liệu — chọn tài khoản có ads đang chạy</div>
      )}
    </div>
  );
}
