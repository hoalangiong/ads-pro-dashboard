import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAccount } from '../context/AccountContext.jsx';
import Badge from '../components/Badge.jsx';
import { RefreshCw } from 'lucide-react';

export default function Optimize() {
  const { accounts, selected, select } = useAccount();
  const [level, setLevel] = useState('campaign');
  const [datePreset, setDatePreset] = useState('last_7d');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const analyze = async (acctId, lvl, preset) => {
    const id = acctId || selected?.id;
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.insights(id, lvl || level, preset || datePreset);
      if (!data?.length) { setError('Không có dữ liệu để phân tích'); setSuggestions([]); return; }
      const { suggestions: s } = await api.aiOptimize(data);
      setSuggestions(s);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selected?.id) analyze(selected.id, level, datePreset);
  }, [selected?.id, level, datePreset]);

  const allTips = suggestions.flatMap(s => s.tips);
  const counts = {
    danger: allTips.filter(t => t.level === 'danger').length,
    warning: allTips.filter(t => t.level === 'warning').length,
    good: allTips.filter(t => t.level === 'good').length,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Tối ưu AI</h1>
        <div className="flex gap-2">
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" value={selected?.id || ''} onChange={e => select(e.target.value)}>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" value={level} onChange={e => setLevel(e.target.value)}>
            <option value="campaign">Campaign</option>
            <option value="adset">Ad Set</option>
            <option value="ad">Ad</option>
          </select>
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" value={datePreset} onChange={e => setDatePreset(e.target.value)}>
            <option value="last_7d">7 ngày</option>
            <option value="last_14d">14 ngày</option>
            <option value="last_30d">30 ngày</option>
          </select>
          <button onClick={() => analyze()} disabled={loading} className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-3 py-1.5 rounded-lg text-sm transition-colors">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Đang phân tích...' : 'Làm mới'}
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {suggestions.length > 0 && (
        <div className="flex gap-3 mb-5">
          {counts.danger > 0 && (
            <div className="flex items-center gap-2 bg-red-950 border border-red-900 rounded-lg px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
              <span className="text-sm text-red-300 font-medium">{counts.danger} vấn đề nghiêm trọng</span>
            </div>
          )}
          {counts.warning > 0 && (
            <div className="flex items-center gap-2 bg-yellow-950 border border-yellow-900 rounded-lg px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
              <span className="text-sm text-yellow-300 font-medium">{counts.warning} cảnh báo</span>
            </div>
          )}
          {counts.good > 0 && (
            <div className="flex items-center gap-2 bg-green-950 border border-green-900 rounded-lg px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
              <span className="text-sm text-green-300 font-medium">{counts.good} chỉ số tốt</span>
            </div>
          )}
        </div>
      )}

      {loading && suggestions.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-sm">Đang phân tích...</p>
        </div>
      )}

      {!loading && suggestions.length === 0 && !error && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-3">🔍</p>
          <p>Chọn tài khoản để xem gợi ý tối ưu</p>
        </div>
      )}

      <div className="space-y-4">
        {suggestions.map((s, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="font-medium text-sm mb-3 text-gray-200">{s.name}</p>
            <div className="space-y-2">
              {s.tips.map((t, j) => (
                <div key={j} className="flex items-start gap-3">
                  <Badge level={t.level} />
                  <p className="text-sm text-gray-300">{t.msg}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
