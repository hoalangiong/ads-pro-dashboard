import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAccount } from '../context/AccountContext.jsx';
import { FlaskConical, Plus, Trash2, RefreshCw } from 'lucide-react';

export default function ABTest() {
  const { selected } = useAccount();
  const [tests, setTests] = useState([]);
  const [results, setResults] = useState(null);
  const [selectedTest, setSelectedTest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newTest, setNewTest] = useState({ name: '', variant_a: '', variant_b: '', metric: 'ctr' });

  const load = () => {
    api.abTests().then(setTests).catch(e => setError(e.message));
  };
  useEffect(load, []);

  const addTest = async () => {
    if (!newTest.name || !newTest.variant_a || !newTest.variant_b) return setError('Điền đầy đủ thông tin');
    try {
      await api.createABTest(newTest);
      setNewTest({ name: '', variant_a: '', variant_b: '', metric: 'ctr' });
      load();
    } catch (e) { setError(e.message); }
  };

  const deleteTest = async (id) => {
    try { await api.deleteABTest(id); load(); } catch (e) { setError(e.message); }
  };

  const viewResults = async (test) => {
    setSelectedTest(test); setLoading(true); setError('');
    try {
      const r = await api.abTestResults(test.id);
      setResults(r);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2"><FlaskConical size={20} className="text-indigo-400" /> A/B Test Manager</h1>
      </div>

      {error && <p className="text-sm mb-4 text-red-400">{error}</p>}

      {/* Create test */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Tạo A/B Test mới</p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" placeholder="Tên test" value={newTest.name} onChange={e => setNewTest(t => ({ ...t, name: e.target.value }))} />
          <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" placeholder="Campaign ID A" value={newTest.variant_a} onChange={e => setNewTest(t => ({ ...t, variant_a: e.target.value }))} />
          <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" placeholder="Campaign ID B" value={newTest.variant_b} onChange={e => setNewTest(t => ({ ...t, variant_b: e.target.value }))} />
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={newTest.metric} onChange={e => setNewTest(t => ({ ...t, metric: e.target.value }))}>
            <option value="ctr">CTR</option>
            <option value="roas">ROAS</option>
            <option value="cpc">CPC</option>
            <option value="conversions">Conversions</option>
          </select>
          <button onClick={addTest} className="flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm px-3 py-2 transition-colors">
            <Plus size={14} /> Tạo
          </button>
        </div>
      </div>

      {/* Tests list */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
            <th className="text-left px-4 py-3">Tên</th>
            <th className="text-left px-4 py-3">Metric</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-left px-4 py-3">Winner</th>
            <th className="text-left px-4 py-3">Ngày tạo</th>
            <th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {tests.map(t => (
              <tr key={t.id} className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer" onClick={() => viewResults(t)}>
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3 text-gray-400">{t.metric}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === 'winner_found' ? 'bg-green-900 text-green-300' : t.status === 'ended' ? 'bg-gray-700 text-gray-400' : 'bg-blue-900 text-blue-300'}`}>
                    {t.status === 'winner_found' ? '🏆 Winner' : t.status === 'ended' ? 'Kết thúc' : '🔄 Running'}
                  </span>
                </td>
                <td className="px-4 py-3 text-yellow-400 font-medium">{t.winner || '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(t.created_at).toLocaleDateString('vi-VN')}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={(e) => { e.stopPropagation(); deleteTest(t.id); }} className="text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {tests.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-500">Chưa có test nào</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Results */}
      {results && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-sm font-medium mb-4">Kết quả: {selectedTest?.name}</p>
          {results.significance ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl border ${results.significance.winner === 'A' ? 'border-green-500 bg-green-900/20' : 'border-gray-700'}`}>
                  <p className="text-xs text-gray-400 mb-1">Variant A {results.significance.winner === 'A' && '🏆'}</p>
                  <p className="text-xl font-bold">{typeof results.significance.value_a === 'number' ? results.significance.value_a.toFixed(4) : results.significance.value_a}</p>
                  <p className="text-xs text-gray-500 mt-1">n = {results.significance.sample_a?.toLocaleString('vi-VN')}</p>
                </div>
                <div className={`p-4 rounded-xl border ${results.significance.winner === 'B' ? 'border-green-500 bg-green-900/20' : 'border-gray-700'}`}>
                  <p className="text-xs text-gray-400 mb-1">Variant B {results.significance.winner === 'B' && '🏆'}</p>
                  <p className="text-xl font-bold">{typeof results.significance.value_b === 'number' ? results.significance.value_b.toFixed(4) : results.significance.value_b}</p>
                  <p className="text-xs text-gray-500 mt-1">n = {results.significance.sample_b?.toLocaleString('vi-VN')}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-400">Confidence:</span>
                <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${results.significance.confidence > 95 ? 'bg-green-500' : results.significance.confidence > 80 ? 'bg-yellow-500' : 'bg-gray-600'}`} style={{ width: `${results.significance.confidence}%` }}></div>
                </div>
                <span className={`text-sm font-medium ${results.significance.confidence > 95 ? 'text-green-400' : 'text-gray-400'}`}>{results.significance.confidence}%</span>
              </div>
              {results.significance.confidence < 95 && <p className="text-xs text-gray-500">Cần thêm data — chưa đủ statistical significance (cần &gt;95%)</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Chưa đủ data để phân tích</p>
          )}
        </div>
      )}
    </div>
  );
}
