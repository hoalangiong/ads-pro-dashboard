import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAccount } from '../context/AccountContext.jsx';
import { Eye, Search, Plus, Trash2, RefreshCw } from 'lucide-react';

export default function Spy() {
  const { selected } = useAccount();
  const [tab, setTab] = useState('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadWatchlist = () => {
    api.spyWatched().then(setWatchlist).catch(() => {});
  };
  useEffect(loadWatchlist, []);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true); setError('');
    try {
      const data = await api.spySearch(query);
      setResults(data.ads || []);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const watch = async (pageId, pageName) => {
    try {
      await api.spyWatch(pageId, pageName);
      loadWatchlist();
    } catch (e) { setError(e.message); }
  };

  const unwatch = async (pageId) => {
    try {
      await api.spyUnwatch(pageId);
      loadWatchlist();
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2"><Eye size={20} className="text-pink-400" /> Ad Spy</h1>
        <div className="flex gap-2">
          {['search', 'watchlist'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${tab === t ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {t === 'search' ? 'Tìm kiếm' : `Theo dõi (${watchlist.length})`}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm mb-4 text-red-400">{error}</p>}

      {tab === 'search' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" placeholder="Tìm ads đối thủ (VD: hoa lan, phân bón...)" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} />
            <button onClick={search} disabled={loading} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm transition-colors">
              <Search size={14} /> {loading ? 'Đang tìm...' : 'Tìm'}
            </button>
          </div>

          <div className="space-y-3">
            {results.map(ad => (
              <div key={ad.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{ad.page_name}</p>
                    {ad.title && <p className="text-xs text-gray-300 mt-1 font-medium">{ad.title}</p>}
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ad.body}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span>📅 {ad.start_date ? new Date(ad.start_date).toLocaleDateString('vi-VN') : 'N/A'}</span>
                      <span>📱 {ad.platforms?.join(', ') || 'N/A'}</span>
                    </div>
                  </div>
                  <button onClick={() => watch(ad.page_id, ad.page_name)} className="flex items-center gap-1 text-xs bg-gray-700 hover:bg-gray-600 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0 ml-3">
                    <Plus size={12} /> Theo dõi
                  </button>
                </div>
                {ad.snapshot_url && (
                  <a href={ad.snapshot_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline mt-2 inline-block">Xem preview →</a>
                )}
              </div>
            ))}
            {results.length === 0 && !loading && query && <p className="text-center py-8 text-gray-500">Không tìm thấy ads nào</p>}
          </div>
        </div>
      )}

      {tab === 'watchlist' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="text-left px-4 py-3">Page</th>
              <th className="text-left px-4 py-3">Ads hiện tại</th>
              <th className="text-left px-4 py-3">Check cuối</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody>
              {watchlist.map(w => (
                <tr key={w.page_id} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium">{w.page_name}</td>
                  <td className="px-4 py-3 text-gray-400">{w.last_ad_count || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{w.last_check ? new Date(w.last_check).toLocaleString('vi-VN') : 'Chưa check'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => unwatch(w.page_id)} className="text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {watchlist.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-500">Chưa theo dõi page nào</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
