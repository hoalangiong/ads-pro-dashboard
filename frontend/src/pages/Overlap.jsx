import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAccount } from '../context/AccountContext.jsx';
import { Users, RefreshCw, AlertTriangle } from 'lucide-react';

export default function Overlap() {
  const { selected } = useAccount();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!selected?.id) return;
    setLoading(true); setError('');
    try {
      const result = await api.overlap(selected.id);
      setData(result);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [selected]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2"><Users size={20} className="text-purple-400" /> Audience Overlap</h1>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-3 py-1.5 rounded-lg text-sm transition-colors">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Phân tích
        </button>
      </div>

      {error && <p className="text-sm mb-4 text-red-400">{error}</p>}

      {/* Warnings */}
      {data?.warnings?.length > 0 && (
        <div className="mb-6 space-y-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide">⚠️ Cảnh báo Overlap</p>
          {data.warnings.map((w, i) => (
            <div key={i} className="bg-yellow-900/20 border border-yellow-800/30 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-300">Overlap {w.overlap_pct}%</p>
                <p className="text-xs text-gray-400 mt-1">
                  <span className="text-white">{w.adset_a.name}</span> ↔ <span className="text-white">{w.adset_b.name}</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">{w.suggestion}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ad Sets list */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
            <th className="text-left px-4 py-3">Ad Set</th>
            <th className="text-left px-4 py-3">Campaign</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-left px-4 py-3">Targeting</th>
          </tr></thead>
          <tbody>
            {(data?.adsets || []).map(a => (
              <tr key={a.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="px-4 py-3 font-medium">{a.name}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{a.campaign_name}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === 'ACTIVE' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                    {a.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{a.targeting_summary}</td>
              </tr>
            ))}
            {!data?.adsets?.length && (
              <tr><td colSpan={4} className="text-center py-8 text-gray-500">
                {loading ? 'Đang phân tích...' : 'Chưa có dữ liệu'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
