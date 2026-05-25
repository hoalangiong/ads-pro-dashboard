import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAccount } from '../context/AccountContext.jsx';
import { Trash2, Plus, Target, CheckCircle, XCircle } from 'lucide-react';

const METRICS = [
  { value: 'roas', label: 'ROAS', unit: 'x' },
  { value: 'ctr', label: 'CTR', unit: '%' },
  { value: 'cpc', label: 'CPC', unit: 'đ' },
  { value: 'cpm', label: 'CPM', unit: 'đ' },
  { value: 'frequency', label: 'Frequency', unit: '' },
  { value: 'spend', label: 'Chi tiêu/ngày', unit: 'đ' },
  { value: 'conversions', label: 'Conversions', unit: '' },
];

function fmtVal(metric, val, unit) {
  if (!val) return '—';
  if (['cpc', 'cpm', 'spend'].includes(metric)) return `${val.toLocaleString('vi-VN')}${unit}`;
  if (['conversions'].includes(metric)) return `${parseInt(val)}${unit}`;
  return `${parseFloat(val).toFixed(2)}${unit}`;
}

export default function Goals() {
  const { accounts, selected, select } = useAccount();
  const [goals, setGoals] = useState([]);
  const [actuals, setActuals] = useState({});
  const [datePreset, setDatePreset] = useState('last_7d');
  const [form, setForm] = useState({ name: '', metric: 'roas', target: '', unit: 'x', higherIsBetter: true });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = () => api.goals().then(setGoals).catch(e => setError(e.message));
  useEffect(load, []);

  useEffect(() => {
    if (!selected?.id) return;
    api.insights(selected.id, 'account', datePreset)
      .then(d => {
        const row = d.data?.[0];
        if (!row) return;
        setActuals({
          roas: parseFloat(row.purchase_roas?.[0]?.value || 0),
          ctr: parseFloat(row.ctr || 0),
          cpc: parseFloat(row.cpc || 0),
          cpm: parseFloat(row.cpm || 0),
          frequency: parseFloat(row.frequency || 0),
          spend: parseFloat(row.spend || 0),
          conversions: parseFloat(row.conversions || 0),
        });
      })
      .catch(() => {});
  }, [selected?.id, datePreset]);

  const add = async () => {
    if (!form.name || !form.target) return;
    try {
      await api.createGoal({ ...form, target: parseFloat(form.target) });
      setForm({ name: '', metric: 'roas', target: '', unit: 'x', higherIsBetter: true });
      setMsg('Đã thêm mục tiêu'); setError('');
      load();
    } catch (e) { setError(e.message); }
  };

  const remove = async (id) => {
    try {
      await api.deleteGoal(id);
      load();
    } catch (e) { setError(e.message); }
  };

  const onMetricChange = (metric) => {
    const m = METRICS.find(x => x.value === metric);
    setForm(f => ({ ...f, metric, unit: m?.unit || '', higherIsBetter: !['cpc', 'cpm', 'frequency'].includes(metric) }));
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Target size={20} className="text-brand-500" />
          <h1 className="text-xl font-bold">Mục tiêu KPI</h1>
        </div>
        <div className="flex gap-2">
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" value={selected?.id || ''} onChange={e => select(e.target.value)}>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" value={datePreset} onChange={e => setDatePreset(e.target.value)}>
            <option value="today">Hôm nay</option>
            <option value="yesterday">Hôm qua</option>
            <option value="last_7d">7 ngày</option>
            <option value="last_30d">30 ngày</option>
            <option value="this_month">Tháng này</option>
          </select>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      {msg && <p className="text-green-400 text-sm mb-4">{msg}</p>}

      {/* Goals with progress */}
      <div className="space-y-3 mb-6">
        {goals.map(g => {
          const actual = actuals[g.metric];
          const hasData = actual > 0;
          const met = hasData && (g.higherIsBetter ? actual >= g.target : actual <= g.target);
          const missed = hasData && !met;

          // Progress bar: for higherIsBetter, fill = actual/target; for lowerIsBetter, fill = target/actual (inverted)
          let pct = 0;
          if (hasData && g.target > 0) {
            pct = g.higherIsBetter
              ? Math.min((actual / g.target) * 100, 100)
              : Math.min((g.target / actual) * 100, 100);
          }

          return (
            <div key={g.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  {hasData
                    ? met
                      ? <CheckCircle size={16} className="text-green-400 shrink-0" />
                      : <XCircle size={16} className="text-red-400 shrink-0" />
                    : <span className="w-4 h-4 rounded-full border border-gray-600 shrink-0" />
                  }
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{g.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {METRICS.find(m => m.value === g.metric)?.label} {g.higherIsBetter ? '≥' : '≤'} <span className="text-white">{g.target}{g.unit}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className={`text-lg font-bold ${met ? 'text-green-400' : missed ? 'text-red-400' : 'text-gray-400'}`}>
                      {hasData ? fmtVal(g.metric, actual, g.unit) : '—'}
                    </p>
                    <p className="text-xs text-gray-500">mục tiêu: {g.target}{g.unit}</p>
                  </div>
                  <button onClick={() => remove(g.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {hasData && (
                <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${met ? 'bg-green-400' : pct > 70 ? 'bg-yellow-400' : 'bg-red-400'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
        {goals.length === 0 && <p className="text-gray-500 text-sm text-center py-8">Chưa có mục tiêu nào</p>}
      </div>

      {/* Add goal */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
        <p className="text-xs text-gray-400 uppercase tracking-wide">Thêm mục tiêu mới</p>
        <div className="grid grid-cols-2 gap-3">
          <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" placeholder="Tên mục tiêu" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={form.metric} onChange={e => onMetricChange(e.target.value)}>
            {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <input type="number" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" placeholder="Giá trị mục tiêu" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} />
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={form.higherIsBetter ? '1' : '0'} onChange={e => setForm(f => ({ ...f, higherIsBetter: e.target.value === '1' }))}>
            <option value="1">Càng cao càng tốt</option>
            <option value="0">Càng thấp càng tốt</option>
          </select>
        </div>
        <button onClick={add} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-lg text-sm transition-colors">
          <Plus size={14} /> Thêm mục tiêu
        </button>
      </div>
    </div>
  );
}
