import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAccount } from '../context/AccountContext.jsx';
import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

export default function Fatigue() {
  const { selected } = useAccount();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!selected?.id) return;
    setLoading(true); setError('');
    try {
      const result = await api.fatigue(selected.id);
      setData(result);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [selected]);

  const statusBadge = (status) => {
    if (status === 'fatigued') return <span className="text-xs px-2 py-0.5 rounded-full bg-red-900 text-red-300">😴 Mệt</span>;
    if (status === 'warning') return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900 text-yellow-300">⚠️ Cảnh báo</span>;
    return <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300">✅ Tốt</span>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2"><AlertTriangle size={20} className="text-orange-400" /> Creative Fatigue</h1>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-3 py-1.5 rounded-lg text-sm transition-colors">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && <p className="text-sm mb-4 text-red-400">{error}</p>}

      {data && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{data.fatigued}</p>
            <p className="text-xs text-gray-400 mt-1">Mệt mỏi</p>
          </div>
          <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-yellow-400">{data.warning}</p>
            <p className="text-xs text-gray-400 mt-1">Cảnh báo</p>
          </div>
          <div className="bg-green-900/20 border border-green-800/30 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{data.fresh}</p>
            <p className="text-xs text-gray-400 mt-1">Tốt</p>
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
            <th className="text-left px-4 py-3">Creative</th>
            <th className="text-left px-4 py-3">Campaign</th>
            <th className="text-left px-4 py-3">CTR đầu</th>
            <th className="text-left px-4 py-3">CTR hiện tại</th>
            <th className="text-left px-4 py-3">Giảm</th>
            <th className="text-left px-4 py-3">Frequency</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-left px-4 py-3">Gợi ý</th>
          </tr></thead>
          <tbody>
            {(data?.creatives || []).map(c => (
              <tr key={c.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="px-4 py-3 font-medium max-w-[200px] truncate">{c.name}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{c.campaign}</td>
                <td className="px-4 py-3 text-green-400">{c.ctr_first.toFixed(2)}%</td>
                <td className="px-4 py-3 text-gray-300">{c.ctr_current.toFixed(2)}%</td>
                <td className="px-4 py-3">
                  <span className={c.ctr_decline_pct > 20 ? 'text-red-400' : 'text-gray-400'}>↓{c.ctr_decline_pct}%</span>
                </td>
                <td className="px-4 py-3">{c.frequency.toFixed(1)}</td>
                <td className="px-4 py-3">{statusBadge(c.status)}</td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px]">{c.suggestion}</td>
              </tr>
            ))}
            {!data?.creatives?.length && (
              <tr><td colSpan={8} className="text-center py-8 text-gray-500">
                {loading ? 'Đang phân tích...' : 'Chưa có dữ liệu — chọn tài khoản có ads đang chạy'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
