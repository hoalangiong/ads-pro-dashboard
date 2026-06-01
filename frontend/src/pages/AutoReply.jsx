import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAccount } from '../context/AccountContext.jsx';
import { MessageCircle, Plus, Trash2, Play, RefreshCw } from 'lucide-react';

export default function AutoReply() {
  const { selected } = useAccount();
  const [templates, setTemplates] = useState([]);
  const [log, setLog] = useState([]);
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState('templates');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [newTpl, setNewTpl] = useState({ keywords: '', reply_text: '' });

  const load = () => {
    api.autoReplyTemplates().then(setTemplates).catch(e => setError(e.message));
    api.autoReplyLog().then(setLog).catch(() => {});
    api.autoReplyStats().then(setStats).catch(() => {});
  };
  useEffect(load, []);

  const addTemplate = async () => {
    if (!newTpl.keywords || !newTpl.reply_text) return setError('Điền keywords và nội dung reply');
    try {
      await api.createAutoReply(newTpl);
      setNewTpl({ keywords: '', reply_text: '' });
      load();
    } catch (e) { setError(e.message); }
  };

  const toggleTemplate = async (tpl) => {
    try {
      await api.updateAutoReply(tpl.id, { enabled: !tpl.enabled });
      load();
    } catch (e) { setError(e.message); }
  };

  const deleteTemplate = async (id) => {
    try { await api.deleteAutoReply(id); load(); } catch (e) { setError(e.message); }
  };

  const scan = async () => {
    setScanning(true); setMsg(''); setError('');
    try {
      const result = await api.scanAutoReply();
      setMsg(`Đã reply ${result.replied} comment, escalate ${result.escalated} câu hỏi`);
      load();
    } catch (e) { setError(e.message); }
    setScanning(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2"><MessageCircle size={20} className="text-sky-400" /> Auto Reply</h1>
        <div className="flex gap-2">
          <button onClick={scan} disabled={scanning} className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 px-3 py-1.5 rounded-lg text-sm transition-colors">
            <Play size={13} className={scanning ? 'animate-pulse' : ''} />
            {scanning ? 'Đang scan...' : 'Scan & Reply'}
          </button>
          {['templates', 'log'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${tab === t ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {t === 'templates' ? 'Templates' : 'Lịch sử'}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm mb-4 text-red-400">{error}</p>}
      {msg && <p className="text-sm mb-4 text-green-400">{msg}</p>}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-sky-400">{stats.today}</p>
            <p className="text-xs text-gray-400 mt-1">Hôm nay</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-gray-300">{stats.last_7d}</p>
            <p className="text-xs text-gray-400 mt-1">7 ngày</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-gray-500">{stats.total}</p>
            <p className="text-xs text-gray-400 mt-1">Tổng</p>
          </div>
        </div>
      )}

      {tab === 'templates' && (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Thêm template</p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
              <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" placeholder="Keywords (phân cách bằng dấu phẩy): giá, bao nhiêu, ship" value={newTpl.keywords} onChange={e => setNewTpl(t => ({ ...t, keywords: e.target.value }))} />
              <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" placeholder="Nội dung reply: Dạ anh/chị inbox em để tư vấn giá ạ" value={newTpl.reply_text} onChange={e => setNewTpl(t => ({ ...t, reply_text: e.target.value }))} />
              <button onClick={addTemplate} className="flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm px-3 py-2 transition-colors">
                <Plus size={14} /> Thêm
              </button>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
                <th className="text-left px-4 py-3">Keywords</th>
                <th className="text-left px-4 py-3">Reply</th>
                <th className="text-right px-4 py-3">Đã reply</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr></thead>
              <tbody>
                {templates.map(t => (
                  <tr key={t.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-medium text-xs">{t.keywords}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-[250px] truncate">{t.reply_text}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{t.reply_count || 0}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleTemplate(t)} className={`text-xs px-2 py-0.5 rounded-full ${t.enabled ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                        {t.enabled ? 'Bật' : 'Tắt'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deleteTemplate(t.id)} className="text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
                {templates.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-500">Chưa có template nào</td></tr>}
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
              <th className="text-left px-4 py-3">Người comment</th>
              <th className="text-left px-4 py-3">Comment</th>
              <th className="text-left px-4 py-3">Reply</th>
            </tr></thead>
            <tbody>
              {log.map((l, i) => (
                <tr key={i} className="border-b border-gray-800">
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(l.time).toLocaleString('vi-VN')}</td>
                  <td className="px-4 py-3 font-medium text-xs">{l.from}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-w-[200px] truncate">{l.comment_text}</td>
                  <td className="px-4 py-3 text-green-400 text-xs max-w-[200px] truncate">{l.reply_text}</td>
                </tr>
              ))}
              {log.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-500">Chưa có log nào</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-600 mt-4">* Tự động scan mỗi 5 phút (7h-22h). Comment phức tạp sẽ escalate qua Telegram.</p>
    </div>
  );
}
