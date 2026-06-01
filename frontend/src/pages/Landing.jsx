import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Globe, Plus, Trash2, RefreshCw } from 'lucide-react';

export default function Landing() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');

  const load = () => {
    api.landingPages().then(setPages).catch(e => setError(e.message));
  };
  useEffect(load, []);

  const add = async () => {
    if (!newUrl.trim()) return;
    try {
      await api.addLandingPage(newUrl, newName);
      setNewUrl(''); setNewName('');
      load();
    } catch (e) { setError(e.message); }
  };

  const remove = async (id) => {
    try { await api.deleteLandingPage(id); load(); } catch (e) { setError(e.message); }
  };

  const checkAll = async () => {
    setLoading(true); setError('');
    try {
      const results = await api.checkLandingPages();
      setPages(results);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const statusBadge = (status) => {
    if (status === 'up') return <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300">🟢 Up</span>;
    if (status === 'slow') return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900 text-yellow-300">🟡 Slow</span>;
    return <span className="text-xs px-2 py-0.5 rounded-full bg-red-900 text-red-300">🔴 Down</span>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2"><Globe size={20} className="text-teal-400" /> Landing Page Monitor</h1>
        <button onClick={checkAll} disabled={loading} className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-3 py-1.5 rounded-lg text-sm transition-colors">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Check ngay
        </button>
      </div>

      {error && <p className="text-sm mb-4 text-red-400">{error}</p>}

      {/* Add page */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Thêm trang theo dõi</p>
        <div className="flex gap-2">
          <input className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" placeholder="https://example.com/landing" value={newUrl} onChange={e => setNewUrl(e.target.value)} />
          <input className="w-40 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" placeholder="Tên (tùy chọn)" value={newName} onChange={e => setNewName(e.target.value)} />
          <button onClick={add} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-lg text-sm transition-colors">
            <Plus size={14} /> Thêm
          </button>
        </div>
      </div>

      {/* Pages list */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
            <th className="text-left px-4 py-3">Trang</th>
            <th className="text-left px-4 py-3">URL</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-right px-4 py-3">Response</th>
            <th className="text-left px-4 py-3">Check cuối</th>
            <th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {pages.map(p => (
              <tr key={p.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 text-gray-400 text-xs max-w-[200px] truncate">{p.url}</td>
                <td className="px-4 py-3">{p.last_status ? statusBadge(p.last_status) : <span className="text-xs text-gray-500">—</span>}</td>
                <td className="px-4 py-3 text-right">
                  {p.last_response_time ? (
                    <span className={`text-xs ${p.last_response_time > 3000 ? 'text-red-400' : p.last_response_time > 1000 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {p.last_response_time}ms
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{p.last_check ? new Date(p.last_check).toLocaleString('vi-VN') : '—'}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(p.id)} className="text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {pages.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-500">Chưa có trang nào</td></tr>}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-600 mt-4">* Tự động check mỗi 15 phút. Alert qua Telegram khi trang down hoặc response &gt;3s</p>
    </div>
  );
}
