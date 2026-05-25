import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAccount } from '../context/AccountContext.jsx';
import Badge from '../components/Badge.jsx';
import { Trash2, Plus, Send, Play } from 'lucide-react';

const METRICS = [
  { value: 'ctr', label: 'CTR (%)' },
  { value: 'frequency', label: 'Frequency' },
  { value: 'roas', label: 'ROAS' },
  { value: 'cpc', label: 'CPC (đ)' },
  { value: 'spend_no_conversion', label: 'Chi tiêu không có conversion (đ)' },
];

export default function Alerts() {
  const { selected } = useAccount();
  const [rules, setRules] = useState([]);
  const [log, setLog] = useState([]);
  const [chatId, setChatId] = useState(localStorage.getItem('tg_chat_id') || '');
  const [newRule, setNewRule] = useState({ name: '', metric: 'ctr', operator: '<', threshold: 1 });
  const [tab, setTab] = useState('rules');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    api.alertRules().then(setRules).catch(e => setError(e.message));
    api.alertLog().then(setLog).catch(() => {});
  };
  useEffect(load, []);

  const addRule = async () => {
    if (!newRule.name) return;
    try {
      await api.createRule({ ...newRule, threshold: parseFloat(newRule.threshold) });
      setNewRule({ name: '', metric: 'ctr', operator: '<', threshold: 1 });
      load();
    } catch (e) { setError(e.message); }
  };

  const toggleRule = async (rule) => {
    try {
      await api.updateRule(rule.id, { enabled: !rule.enabled });
      load();
    } catch (e) { setError(e.message); }
  };

  const deleteRule = async (id) => {
    try {
      await api.deleteRule(id);
      load();
    } catch (e) { setError(e.message); }
  };

  const testTelegram = async () => {
    if (!chatId) return setError('Nhập Chat ID trước');
    localStorage.setItem('tg_chat_id', chatId);
    setLoading(true);
    try {
      await api.tgSend(chatId, '✅ Ads Pro kết nối thành công! Bạn sẽ nhận thông báo tại đây.');
      setMsg('Gửi thành công!'); setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const testAlerts = async () => {
    if (!selected?.id) return setError('Chọn tài khoản trước');
    setTesting(true); setMsg(''); setError('');
    try {
      const { data } = await api.insights(selected.id, 'campaign', 'today');
      if (!data?.length) { setError('Không có dữ liệu hôm nay'); return; }
      const { triggered } = await api.checkAlerts(data);
      if (triggered.length === 0) {
        setMsg('Không có alert nào được kích hoạt');
      } else {
        setMsg(`${triggered.length} alert kích hoạt — xem tab Lịch sử`);
        if (chatId) await api.tgAlert(chatId, triggered);
        load();
        setTab('log');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Alerts & Thông báo</h1>
        <div className="flex gap-2">
          <button onClick={testAlerts} disabled={testing} className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-3 py-1.5 rounded-lg text-sm transition-colors">
            <Play size={13} className={testing ? 'animate-pulse' : ''} />
            {testing ? 'Đang kiểm tra...' : 'Test ngay'}
          </button>
          {['rules', 'log', 'telegram'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${tab === t ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {t === 'rules' ? 'Quy tắc' : t === 'log' ? 'Lịch sử' : 'Telegram'}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm mb-4 text-red-400">{error}</p>}
      {msg && <p className="text-sm mb-4 text-green-400">{msg}</p>}

      {tab === 'rules' && (
        <div className="space-y-4">
          {/* Add rule */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Thêm quy tắc mới</p>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
              <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm col-span-2 lg:col-span-1" placeholder="Tên quy tắc" value={newRule.name} onChange={e => setNewRule(r => ({ ...r, name: e.target.value }))} />
              <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={newRule.metric} onChange={e => setNewRule(r => ({ ...r, metric: e.target.value }))}>
                {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={newRule.operator} onChange={e => setNewRule(r => ({ ...r, operator: e.target.value }))}>
                <option value="<">Nhỏ hơn</option>
                <option value=">">Lớn hơn</option>
              </select>
              <input type="number" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={newRule.threshold} onChange={e => setNewRule(r => ({ ...r, threshold: e.target.value }))} />
              <button onClick={addRule} className="flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm px-3 py-2 transition-colors">
                <Plus size={14} /> Thêm
              </button>
            </div>
          </div>

          {/* Rules list */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
                <th className="text-left px-4 py-3">Tên</th>
                <th className="text-left px-4 py-3">Điều kiện</th>
                <th className="text-left px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3"></th>
              </tr></thead>
              <tbody>
                {rules.map(r => (
                  <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-gray-400">{r.metric} {r.operator} {r.threshold}</td>
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
              <th className="text-left px-4 py-3">Quy tắc</th>
              <th className="text-left px-4 py-3">Campaign</th>
              <th className="text-left px-4 py-3">Giá trị</th>
            </tr></thead>
            <tbody>
              {log.map((l, i) => (
                <tr key={i} className="border-b border-gray-800">
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(l.time).toLocaleString('vi-VN')}</td>
                  <td className="px-4 py-3"><Badge level="warning" /><span className="ml-2">{l.rule}</span></td>
                  <td className="px-4 py-3 text-gray-300">{l.name}</td>
                  <td className="px-4 py-3 text-yellow-400">{typeof l.value === 'number' ? l.value.toFixed(2) : l.value}</td>
                </tr>
              ))}
              {log.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-500">Chưa có alert nào</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'telegram' && (
        <div className="max-w-md space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Kết nối Telegram</p>
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Chat ID của bạn</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={chatId} onChange={e => setChatId(e.target.value)} placeholder="123456789" />
            </div>
            <button onClick={testTelegram} disabled={loading} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm transition-colors">
              <Send size={14} /> Test kết nối
            </button>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Cách lấy Chat ID</p>
            <ol className="space-y-2 text-sm text-gray-300 list-decimal list-inside">
              <li>Tìm bot <b>@userinfobot</b> trên Telegram</li>
              <li>Gửi /start — bot sẽ trả về ID của bạn</li>
              <li>Dán ID vào ô trên và test</li>
              <li>Thêm <b>TELEGRAM_ALERT_CHAT_ID=your_id</b> vào backend .env để nhận alert tự động</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
