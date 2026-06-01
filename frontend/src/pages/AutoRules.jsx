import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAccount } from '../context/AccountContext.jsx';
import { Trash2, Plus, Play, Zap, Pause, TrendingUp } from 'lucide-react';

const METRICS = [
  { value: 'ctr', label: 'CTR (%)' },
  { value: 'frequency', label: 'Frequency' },
  { value: 'roas', label: 'ROAS' },
  { value: 'cpc', label: 'CPC (đ)' },
  { value: 'cpm', label: 'CPM (đ)' },
  { value: 'spend', label: 'Chi tiêu (đ)' },
  { value: 'conversions', label: 'Conversions' },
];

const ACTIONS = [
  { value: 'pause', label: '⏸ Tắt campaign' },
  { value: 'resume', label: '▶ Bật campaign' },
  { value: 'scale_budget', label: '📈 Tăng budget' },
  { value: 'notify', label: '🔔 Chỉ thông báo' },
];

export default function AutoRules() {
  const { selected } = useAccount();
  const [rules, setRules] = useState([]);
  const [log, setLog] = useState([]);
  const [tab, setTab] = useState('rules');
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [newRule, setNewRule] = useState({
    name: '', metric: 'ctr', operator: '<', threshold: 1, action: 'pause', cooldown_hours: 6, scale_percent: 20,
  });

  const load = () => {
    api.autoRules().then(setRules).catch(e => setError(e.message));
    api.autoRulesLog().then(setLog).catch(() => {});
  };
  useEffect(load, []);

  const addRule = async () => {
    if (!newRule.name) return;
    try {
      await api.createAutoRule({ ...newRule, threshold: parseFloat(newRule.threshold) });
      setNewRule({ name: '', metric: 'ctr', operator: '<', threshold: 1, action: 'pause', cooldown_hours: 6, scale_percent: 20 });
      load();
    } catch (e) { setError(e.message); }
  };

  const toggleRule = async (rule) => {
    try {
      await api.updateAutoRule(rule.id, { enabled: !rule.enabled });
      load();
    } catch (e) { setError(e.message); }
  };

  const deleteRule = async (id) => {
    try {
      await api.deleteAutoRule(id);
      load();
    } catch (e) { setError(e.message); }
  };

  const execute = async () => {
    setExecuting(true); setMsg(''); setError('');
    try {
      const result = await api.executeAutoRules();
      if (result.triggered?.length) {
        setMsg(`${result.triggered.length} rules triggered — xem tab Lịch sử`);
        setTab('log');
      } else {
        setMsg('Không có rule nào kích hoạt');
      }
      load();
    } catch (e) { setError(e.message); }
    setExecuting(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2"><Zap size={20} className="text-yellow-400" /> Auto Rules</h1>
        <div className="flex gap-2">
          <button onClick={execute} disabled={executing} className="flex items-center gap-1.5 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 px-3 py-1.5 rounded-lg text-sm transition-colors">
            <Play size={13} className={executing ? 'animate-pulse' : ''} />
            {executing ? 'Đang chạy...' : 'Chạy ngay'}
          </button>
          {['rules', 'log'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${tab === t ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {t === 'rules' ? 'Quy tắc' : 'Lịch sử'}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm mb-4 text-red-400">{error}</p>}
      {msg && <p className="text-sm mb-4 text-green-400">{msg}</p>}

      {tab === 'rules' && (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Thêm Auto Rule</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-2">
              <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" placeholder="Tên rule" value={newRule.name} onChange={e => setNewRule(r => ({ ...r, name: e.target.value }))} />
              <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={newRule.metric} onChange={e => setNewRule(r => ({ ...r, metric: e.target.value }))}>
                {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={newRule.operator} onChange={e => setNewRule(r => ({ ...r, operator: e.target.value }))}>
                <option value="<">Nhỏ hơn</option>
                <option value=">">Lớn hơn</option>
              </select>
              <input type="number" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" placeholder="Ngưỡng" value={newRule.threshold} onChange={e => setNewRule(r => ({ ...r, threshold: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={newRule.action} onChange={e => setNewRule(r => ({ ...r, action: e.target.value }))}>
                {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
              <input type="number" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" placeholder="Cooldown (giờ)" value={newRule.cooldown_hours} onChange={e => setNewRule(r => ({ ...r, cooldown_hours: parseInt(e.target.value) || 1 }))} />
              {newRule.action === 'scale_budget' && (
                <input type="number" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" placeholder="Tăng %" value={newRule.scale_percent} onChange={e => setNewRule(r => ({ ...r, scale_percent: parseInt(e.target.value) || 20 }))} />
              )}
              <button onClick={addRule} className="flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm px-3 py-2 transition-colors">
                <Plus size={14} /> Thêm
              </button>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
                <th className="text-left px-4 py-3">Tên</th>
                <th className="text-left px-4 py-3">Điều kiện</th>
                <th className="text-left px-4 py-3">Hành động</th>
                <th className="text-left px-4 py-3">Cooldown</th>
                <th className="text-left px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3"></th>
              </tr></thead>
              <tbody>
                {rules.map(r => (
                  <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-gray-400">{r.metric} {r.operator} {r.threshold}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700">
                        {ACTIONS.find(a => a.value === r.action)?.label || r.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{r.cooldown_hours || 1}h</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleRule(r)} className={`text-xs px-2 py-0.5 rounded-full ${r.enabled ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                        {r.enabled ? 'Bật' : 'Tắt'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deleteRule(r.id)} className="text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
                {rules.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-500">Chưa có rule nào</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'log' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="text-left px-4 py-3">Thời gian</th>
              <th className="text-left px-4 py-3">Rule</th>
              <th className="text-left px-4 py-3">Campaign</th>
              <th className="text-left px-4 py-3">Giá trị</th>
              <th className="text-left px-4 py-3">Kết quả</th>
            </tr></thead>
            <tbody>
              {log.map((l, i) => (
                <tr key={i} className="border-b border-gray-800">
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(l.time).toLocaleString('vi-VN')}</td>
                  <td className="px-4 py-3 font-medium">{l.rule_name}</td>
                  <td className="px-4 py-3 text-gray-300">{l.campaign}</td>
                  <td className="px-4 py-3 text-yellow-400">{l.metric}: {typeof l.value === 'number' ? l.value.toFixed(2) : l.value}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{l.action_result}</td>
                </tr>
              ))}
              {log.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-500">Chưa có log nào</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
