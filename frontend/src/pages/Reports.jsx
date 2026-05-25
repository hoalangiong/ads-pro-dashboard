import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAccount } from '../context/AccountContext.jsx';
import { Trash2, Plus, Send } from 'lucide-react';

const PRESETS = [
  { label: 'Hàng ngày 8:00 sáng', cron: '0 8 * * *' },
  { label: 'Hàng ngày 9:00 sáng', cron: '0 9 * * *' },
  { label: 'Hàng ngày 10:00 tối', cron: '0 22 * * *' },
  { label: 'Thứ 2 hàng tuần 8:00', cron: '0 8 * * 1' },
];

export default function Reports() {
  const { accounts, selected } = useAccount();
  const [schedules, setSchedules] = useState([]);
  const [form, setForm] = useState({ chatId: localStorage.getItem('tg_chat_id') || '', cronExpr: '0 8 * * *', label: 'Báo cáo hàng ngày', accountId: '', datePreset: 'yesterday' });
  const [customCron, setCustomCron] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const load = () => api.reportSchedules().then(setSchedules).catch(e => setError(e.message));
  useEffect(() => {
    load();
    if (selected?.id) setForm(f => ({ ...f, accountId: selected.id }));
  }, [selected?.id]);

  const add = async () => {
    if (!form.chatId || !form.cronExpr) return setError('Cần nhập Chat ID và lịch');
    setError('');
    try {
      await api.createReportSchedule(form);
      setMsg('Đã tạo lịch báo cáo');
      load();
    } catch (e) { setError(e.message); }
  };

  const remove = async (id) => {
    try {
      await api.deleteReportSchedule(id);
      load();
    } catch (e) { setError(e.message); }
  };

  const toggle = async (s) => {
    try {
      await api.updateReportSchedule(s.id, { enabled: !s.enabled });
      load();
    } catch (e) { setError(e.message); }
  };

  const sendNow = async () => {
    if (!form.chatId || !form.accountId) return setError('Cần Chat ID và tài khoản');
    setSending(true); setError('');
    try {
      await api.sendReportNow(form.chatId, form.accountId, form.datePreset);
      setMsg('Đã gửi báo cáo!');
    } catch (e) { setError(e.message); }
    finally { setSending(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Báo cáo tự động</h1>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      {msg && <p className="text-green-400 text-sm mb-4">{msg}</p>}

      {/* Add schedule */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 space-y-3">
        <p className="text-xs text-gray-400 uppercase tracking-wide">Tạo lịch báo cáo mới</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Telegram Chat ID</label>
            <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={form.chatId} onChange={e => setForm(f => ({ ...f, chatId: e.target.value }))} placeholder="123456789" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Tài khoản quảng cáo</label>
            <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Lịch gửi</label>
            <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={form.cronExpr === customCron && customCron ? 'custom' : form.cronExpr} onChange={e => {
              if (e.target.value === 'custom') { setForm(f => ({ ...f, cronExpr: customCron || '' })); }
              else { setForm(f => ({ ...f, cronExpr: e.target.value })); setCustomCron(''); }
            }}>
              {PRESETS.map(p => <option key={p.cron} value={p.cron}>{p.label}</option>)}
              <option value="custom">Tùy chỉnh...</option>
            </select>
          </div>
          {(form.cronExpr === customCron && customCron) || (!PRESETS.find(p => p.cron === form.cronExpr) && form.cronExpr !== '') ? (
            <div>
              <label className="text-xs text-gray-400 block mb-1">Cron expression</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono" placeholder="0 8 * * *" value={customCron} onChange={e => { setCustomCron(e.target.value); setForm(f => ({ ...f, cronExpr: e.target.value })); }} />
            </div>
          ) : null}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Tên báo cáo</label>
            <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <button onClick={add} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-lg text-sm transition-colors">
            <Plus size={14} /> Tạo lịch
          </button>
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={form.datePreset} onChange={e => setForm(f => ({ ...f, datePreset: e.target.value }))}>
            <option value="today">Hôm nay</option>
            <option value="yesterday">Hôm qua</option>
            <option value="last_7d">7 ngày qua</option>
            <option value="this_month">Tháng này</option>
          </select>
          <button onClick={sendNow} disabled={sending} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded-lg text-sm transition-colors">
            <Send size={14} /> {sending ? 'Đang gửi...' : 'Gửi ngay'}
          </button>
        </div>
      </div>

      {/* Schedules list */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
            <th className="text-left px-4 py-3">Tên</th>
            <th className="text-left px-4 py-3">Lịch (cron)</th>
            <th className="text-left px-4 py-3">Chat ID</th>
            <th className="text-left px-4 py-3">Trạng thái</th>
            <th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {schedules.map(s => (
              <tr key={s.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="px-4 py-3 font-medium">{s.label}</td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{s.cronExpr}</td>
                <td className="px-4 py-3 text-gray-400">{s.chatId}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggle(s)} className={`text-xs px-2 py-0.5 rounded-full ${s.enabled ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                    {s.enabled ? 'Bật' : 'Tắt'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(s.id)} className="text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {schedules.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-500">Chưa có lịch báo cáo nào</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
