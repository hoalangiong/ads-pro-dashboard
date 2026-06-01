import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAccount } from '../context/AccountContext.jsx';
import { TrendingUp, RefreshCw, Zap } from 'lucide-react';

export default function Predict() {
  const { selected } = useAccount();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!selected?.id) return;
    setLoading(true); setError('');
    try {
      const result = await api.predict(selected.id);
      setData(result);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [selected]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2"><TrendingUp size={20} className="text-emerald-400" /> Budget Prediction</h1>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-3 py-1.5 rounded-lg text-sm transition-colors">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Phân tích
        </button>
      </div>

      {error && <p className="text-sm mb-4 text-red-400">{error}</p>}

      {data && (
        <div className="mb-6 bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400">Tổng budget hiện tại: <span className="text-white font-medium">{data.total_budget?.toLocaleString('vi-VN')}đ/ngày</span></p>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
            <th className="text-left px-4 py-3">Campaign</th>
            <th className="text-right px-4 py-3">Budget hiện tại</th>
            <th className="text-right px-4 py-3">ROAS</th>
            <th className="text-right px-4 py-3">CPC</th>
            <th className="text-right px-4 py-3">Efficiency</th>
            <th className="text-right px-4 py-3">Budget gợi ý</th>
            <th className="text-right px-4 py-3">Thay đổi</th>
            <th className="text-left px-4 py-3">Gợi ý</th>
          </tr></thead>
          <tbody>
            {(data?.campaigns || []).map(c => (
              <tr key={c.campaign_id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="px-4 py-3 font-medium max-w-[200px] truncate">{c.campaign_name}</td>
                <td className="px-4 py-3 text-right text-gray-400">{c.current_budget?.toLocaleString('vi-VN')}đ</td>
                <td className="px-4 py-3 text-right">
                  <span className={c.roas >= 2 ? 'text-green-400' : c.roas >= 1 ? 'text-yellow-400' : 'text-red-400'}>{c.roas?.toFixed(2)}</span>
                </td>
                <td className="px-4 py-3 text-right text-gray-400">{c.cpc?.toLocaleString('vi-VN')}đ</td>
                <td className="px-4 py-3 text-right">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700">{c.efficiency_score?.toFixed(1)}</span>
                </td>
                <td className="px-4 py-3 text-right font-medium text-white">{c.recommended_budget?.toLocaleString('vi-VN')}đ</td>
                <td className="px-4 py-3 text-right">
                  <span className={`text-xs ${c.budget_change_pct > 0 ? 'text-green-400' : c.budget_change_pct < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                    {c.budget_change_pct > 0 ? '+' : ''}{c.budget_change_pct}%
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.recommendation === 'Tăng budget' ? 'bg-green-900 text-green-300' : c.recommendation === 'Giảm budget' ? 'bg-red-900 text-red-300' : 'bg-gray-700 text-gray-400'}`}>
                    {c.recommendation}
                  </span>
                </td>
              </tr>
            ))}
            {!data?.campaigns?.length && (
              <tr><td colSpan={8} className="text-center py-8 text-gray-500">
                {loading ? 'Đang phân tích...' : 'Chưa có dữ liệu'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-600 mt-4">* Dựa trên data 14 ngày gần nhất. Efficiency = ROAS × (1/CPC) × Conv Rate</p>
    </div>
  );
}
