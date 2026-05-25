import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAccount } from '../context/AccountContext.jsx';
import { Play, Pause, DollarSign } from 'lucide-react';

const STATUS_COLOR = { ACTIVE: 'text-green-400', PAUSED: 'text-yellow-400', ARCHIVED: 'text-gray-500' };

// How much of the day has passed (0-1)
function dayProgress() {
  const now = new Date();
  return (now.getHours() * 60 + now.getMinutes()) / (24 * 60);
}

export default function BudgetControl() {
  const { accounts, selected, select } = useAccount();
  const [level, setLevel] = useState('campaign');
  const [rows, setRows] = useState([]);
  const [spendMap, setSpendMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [budgetEdit, setBudgetEdit] = useState({});
  const progress = dayProgress();

  useEffect(() => {
    if (!selected?.id) return;
    setLoading(true);
    Promise.all([
      api.campaigns(selected.id, level),
      api.insights(selected.id, level, 'today'),
    ])
      .then(([camps, ins]) => {
        setRows(camps);
        const map = {};
        for (const r of ins.data || []) {
          const key = r.campaign_id || r.adset_id || r.ad_id;
          if (key) map[key] = parseFloat(r.spend || 0);
        }
        setSpendMap(map);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [selected?.id, level]);

  const pause = async (id, name) => {
    try {
      await api.pauseCampaign(id, level);
      setMsg(`Đã tạm dừng: ${name}`); setError('');
      setRows(r => r.map(x => x.id === id ? { ...x, status: 'PAUSED' } : x));
    } catch (e) { setError(e.message); }
  };

  const resume = async (id, name) => {
    try {
      await api.resumeCampaign(id, level);
      setMsg(`Đã bật lại: ${name}`); setError('');
      setRows(r => r.map(x => x.id === id ? { ...x, status: 'ACTIVE' } : x));
    } catch (e) { setError(e.message); }
  };

  const adjustBudget = async (id) => {
    const val = budgetEdit[id];
    if (!val) return;
    try {
      await api.adjustBudget(id, val);
      const budgetCents = Math.round(parseFloat(val) * 100);
      setRows(r => r.map(x => x.id === id ? { ...x, daily_budget: budgetCents } : x));
      setMsg(`Đã cập nhật budget ${parseInt(val).toLocaleString('vi-VN')}đ`); setError('');
      setBudgetEdit(b => ({ ...b, [id]: '' }));
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Kiểm soát Budget</h1>
        <div className="flex gap-2">
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" value={selected?.id || ''} onChange={e => select(e.target.value)}>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" value={level} onChange={e => setLevel(e.target.value)}>
            <option value="campaign">Campaign</option>
            <option value="adset">Ad Set</option>
          </select>
        </div>
      </div>

      {error && <p className="text-sm mb-4 text-red-400">{error}</p>}
      {msg && <p className="text-sm mb-4 text-green-400">{msg}</p>}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
            <th className="text-left px-4 py-3">Tên</th>
            <th className="text-left px-4 py-3">Trạng thái</th>
            <th className="text-right px-4 py-3">Budget/ngày</th>
            <th className="text-right px-4 py-3">Pacing hôm nay</th>
            <th className="text-right px-4 py-3">Điều chỉnh budget</th>
            <th className="text-right px-4 py-3">Hành động</th>
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="text-center py-8 text-gray-500">Đang tải...</td></tr>}
            {!loading && rows.map(r => {
              const budget = r.daily_budget ? parseInt(r.daily_budget / 100) : 0;
              const spent = spendMap[r.id] || 0;
              const expected = budget * progress;
              const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
              const ahead = budget > 0 && spent > expected * 1.1;
              const behind = budget > 0 && spent < expected * 0.7 && progress > 0.2;
              return (
              <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="px-4 py-3 font-medium max-w-xs truncate">{r.name}</td>
                <td className={`px-4 py-3 ${STATUS_COLOR[r.status] || 'text-gray-400'}`}>{r.status}</td>
                <td className="px-4 py-3 text-right text-gray-300">
                  {budget ? `${budget.toLocaleString('vi-VN')}đ` : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  {budget > 0 ? (
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-xs font-medium ${ahead ? 'text-yellow-400' : behind ? 'text-red-400' : 'text-green-400'}`}>
                        {spent.toLocaleString('vi-VN')}đ ({pct.toFixed(0)}%)
                        {ahead ? ' ↑' : behind ? ' ↓' : ''}
                      </span>
                      <div className="w-24 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${ahead ? 'bg-yellow-400' : behind ? 'bg-red-400' : 'bg-green-400'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <input
                      type="number"
                      className="w-28 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-right"
                      placeholder="VNĐ mới"
                      value={budgetEdit[r.id] || ''}
                      onChange={e => setBudgetEdit(b => ({ ...b, [r.id]: e.target.value }))}
                    />
                    <button onClick={() => adjustBudget(r.id)} className="p-1 text-brand-500 hover:text-brand-400 transition-colors">
                      <DollarSign size={14} />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {r.status === 'ACTIVE' ? (
                      <button onClick={() => pause(r.id, r.name)} className="flex items-center gap-1 text-xs bg-yellow-900 text-yellow-300 hover:bg-yellow-800 px-2 py-1 rounded transition-colors">
                        <Pause size={12} /> Tạm dừng
                      </button>
                    ) : r.status !== 'ARCHIVED' ? (
                      <button onClick={() => resume(r.id, r.name)} className="flex items-center gap-1 text-xs bg-green-900 text-green-300 hover:bg-green-800 px-2 py-1 rounded transition-colors">
                        <Play size={12} /> Bật lại
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );})}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-500">Không có dữ liệu</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
