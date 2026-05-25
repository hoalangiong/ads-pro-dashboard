import { useState } from 'react';
import { api } from '../lib/api.js';

export default function CampaignWizard() {
  const [form, setForm] = useState({ objective: 'CONVERSIONS', budget: 200000, product: 'hoa lan' });
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const t = await api.aiTemplate(form.objective, form.budget, form.product);
      setTemplate(t);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold mb-6">Lên Campaign</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 space-y-4">
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1.5">Sản phẩm</label>
          <input
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
            value={form.product}
            onChange={e => setForm(f => ({ ...f, product: e.target.value }))}
            placeholder="hoa lan, phân bón, ..."
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1.5">Mục tiêu</label>
          <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={form.objective} onChange={e => setForm(f => ({ ...f, objective: e.target.value }))}>
            <option value="CONVERSIONS">Conversions (mua hàng)</option>
            <option value="LEAD_GENERATION">Lead Generation</option>
            <option value="MESSAGES">Messages (nhắn tin)</option>
            <option value="REACH">Reach (tiếp cận)</option>
            <option value="VIDEO_VIEWS">Video Views</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1.5">Budget/ngày (VNĐ)</label>
          <input
            type="number"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
            value={form.budget}
            onChange={e => setForm(f => ({ ...f, budget: parseInt(e.target.value) || 0 }))}
          />
        </div>
        <button onClick={generate} disabled={loading} className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 py-2 rounded-lg text-sm font-medium transition-colors">
          {loading ? 'Đang tạo...' : 'Tạo template campaign'}
        </button>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>

      {template && (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Campaign</p>
            <p className="font-medium">{template.campaign.name}</p>
            <p className="text-sm text-gray-400 mt-1">Objective: {template.campaign.objective} · Status: {template.campaign.status}</p>
          </div>

          {template.adsets.map((s, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Ad Set {i + 1}</p>
              <p className="font-medium">{s.name}</p>
              <p className="text-sm text-gray-400 mt-1">Budget: {s.daily_budget.toLocaleString('vi-VN')}đ/ngày · Goal: {s.optimization_goal}</p>
            </div>
          ))}

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Gợi ý creative</p>
            <ul className="space-y-2">
              {template.tips.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-brand-500 mt-0.5">•</span> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
