import { useState, useRef } from 'react';
import { api } from '../lib/api.js';
import { Search, X, ChevronRight, ChevronLeft, Rocket, CheckCircle, AlertTriangle } from 'lucide-react';

const DEFAULT_ADSETS = [
  { name: 'Target 1 - Nữ 25-44', age_min: 25, age_max: 44, genders: [2], interests: [] },
  { name: 'Target 2 - Nam 25-44', age_min: 25, age_max: 44, genders: [1], interests: [] },
  { name: 'Target 3 - Tất cả 18-34', age_min: 18, age_max: 34, genders: [], interests: [] },
  { name: 'Target 4 - Tất cả 35-54', age_min: 35, age_max: 54, genders: [], interests: [] },
  { name: 'Target 5 - Tất cả 55-65', age_min: 55, age_max: 65, genders: [], interests: [] },
];

function InterestSearch({ interests, onChange }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef(null);

  const search = (val) => {
    setQ(val);
    clearTimeout(timer.current);
    if (!val.trim()) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.searchInterests(val);
        setResults(data || []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 400);
  };

  const add = (item) => {
    if (!interests.find(i => i.id === item.id)) {
      onChange([...interests, { id: item.id, name: item.name }]);
    }
    setQ(''); setResults([]);
  };

  const remove = (id) => onChange(interests.filter(i => i.id !== id));

  return (
    <div className="relative">
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-sm"
          placeholder="Tìm sở thích..."
          value={q}
          onChange={e => search(e.target.value)}
        />
        {searching && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-500">...</span>}
      </div>
      {results.length > 0 && (
        <div className="absolute mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg overflow-hidden max-h-40 overflow-y-auto z-50 shadow-xl">
          {results.map(r => (
            <button
              key={r.id}
              onClick={() => add(r)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 flex items-center justify-between gap-2"
            >
              <span className="truncate">{r.name}</span>
              {r.audience_size_lower_bound && (
                <span className="text-xs text-gray-500 shrink-0">
                  {(r.audience_size_lower_bound / 1000000).toFixed(1)}M+
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {interests.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {interests.map(i => (
            <span key={i.id} className="flex items-center gap-1 bg-brand-900/50 border border-brand-700 text-brand-300 text-xs px-2 py-0.5 rounded-full">
              {i.name}
              <button onClick={() => remove(i.id)} className="hover:text-white"><X size={10} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function AdsetCard({ adset, index, onChange }) {
  const update = (field, val) => onChange({ ...adset, [field]: val });

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="bg-brand-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">{index + 1}</span>
        <input
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm font-medium"
          value={adset.name}
          onChange={e => update('name', e.target.value)}
          placeholder="Tên adset"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Tuổi từ</label>
          <input
            type="number" min={18} max={65}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
            value={adset.age_min}
            onChange={e => update('age_min', parseInt(e.target.value) || 18)}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Tuổi đến</label>
          <input
            type="number" min={18} max={65}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
            value={adset.age_max}
            onChange={e => update('age_max', parseInt(e.target.value) || 65)}
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1.5">Giới tính</label>
        <div className="flex gap-2">
          {[{ label: 'Tất cả', val: [] }, { label: 'Nam', val: [1] }, { label: 'Nữ', val: [2] }].map(opt => {
            const active = JSON.stringify(adset.genders) === JSON.stringify(opt.val);
            return (
              <button
                key={opt.label}
                onClick={() => update('genders', opt.val)}
                className={`px-3 py-1 rounded-lg text-xs transition-colors ${active ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1.5">Sở thích (tùy chọn)</label>
        <InterestSearch interests={adset.interests} onChange={val => update('interests', val)} />
      </div>
    </div>
  );
}

export default function CampaignWizard() {
  const [step, setStep] = useState(1);
  const [basics, setBasics] = useState({ page_id: '', post_id: '', campaign_name: '', total_budget: 1000000, pixel_id: '' });
  const [adsets, setAdsets] = useState(DEFAULT_ADSETS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const updateAdset = (i, val) => setAdsets(a => a.map((x, idx) => idx === i ? val : x));

  const budgetPerAdset = Math.floor(basics.total_budget / adsets.length);

  const canProceed1 = basics.page_id.trim() && basics.post_id.trim() && basics.campaign_name.trim() && basics.total_budget >= adsets.length * 50000;

  const launch = async () => {
    setLoading(true); setError('');
    try {
      const data = await api.launchCampaign({
        page_id: basics.page_id.trim(),
        post_id: basics.post_id.trim(),
        campaign_name: basics.campaign_name.trim(),
        total_budget: basics.total_budget,
        pixel_id: basics.pixel_id.trim() || undefined,
        adsets,
      });
      setResult(data);
      setStep(4);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 4 && result) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-bold mb-6">Kết quả tạo Campaign</h1>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle size={18} className="text-green-400" />
            <p className="font-medium text-green-400">Campaign đã được tạo (PAUSED)</p>
          </div>
          <p className="text-sm text-gray-400 mb-1">Campaign ID: <span className="text-white font-mono">{result.campaign_id}</span></p>
          <p className="text-xs text-gray-500 mt-2">Vào Facebook Ads Manager để review và bật campaign.</p>
        </div>

        {result.adsets?.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Adsets đã tạo ({result.adsets.length})</p>
            <div className="space-y-2">
              {result.adsets.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">{s.name}</span>
                  <span className="text-gray-500 font-mono text-xs">{s.id}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.errors?.length > 0 && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} className="text-red-400" />
              <p className="text-sm text-red-400 font-medium">Một số lỗi xảy ra</p>
            </div>
            {result.errors.map((e, i) => <p key={i} className="text-xs text-red-300 mt-1">{e}</p>)}
          </div>
        )}

        <button
          onClick={() => { setStep(1); setResult(null); setBasics({ page_id: '', post_id: '', campaign_name: '', total_budget: 1000000, pixel_id: '' }); setAdsets(DEFAULT_ADSETS); }}
          className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Tạo campaign mới
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-xl font-bold">Lên Campaign</h1>
        <div className="flex items-center gap-1 ml-auto">
          {[1, 2, 3].map(s => (
            <div key={s} className={`flex items-center gap-1`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step >= s ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-500'}`}>{s}</div>
              {s < 3 && <div className={`w-8 h-0.5 ${step > s ? 'bg-brand-600' : 'bg-gray-700'}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Bài viết & ngân sách */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Bước 1 — Bài viết & Ngân sách</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">Page ID <span className="text-red-400">*</span></label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                  placeholder="123456789"
                  value={basics.page_id}
                  onChange={e => setBasics(b => ({ ...b, page_id: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">Post ID <span className="text-red-400">*</span></label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                  placeholder="987654321"
                  value={basics.post_id}
                  onChange={e => setBasics(b => ({ ...b, post_id: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">Lấy Page ID và Post ID từ URL bài viết trên Facebook.</p>
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">Pixel ID <span className="text-gray-600">(khuyến nghị cho OUTCOME_SALES)</span></label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                placeholder="123456789012345"
                value={basics.pixel_id}
                onChange={e => setBasics(b => ({ ...b, pixel_id: e.target.value }))}
              />
              <p className="text-xs text-gray-600 mt-1">Không có pixel thì adset vẫn tạo được nhưng tối ưu kém hơn.</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">Tên Campaign <span className="text-red-400">*</span></label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                placeholder="Hoa Lan - Test Target - Tháng 6"
                value={basics.campaign_name}
                onChange={e => setBasics(b => ({ ...b, campaign_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">Tổng ngân sách/ngày (VNĐ) <span className="text-red-400">*</span></label>
              <input
                type="number"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                value={basics.total_budget}
                onChange={e => setBasics(b => ({ ...b, total_budget: parseInt(e.target.value) || 0 }))}
              />
              <p className="text-xs text-gray-500 mt-1">
                Chia đều cho {adsets.length} adsets → <span className="text-white">{budgetPerAdset.toLocaleString('vi-VN')}đ/adset/ngày</span>
                {basics.total_budget < adsets.length * 50000 && (
                  <span className="text-red-400 ml-2">Tối thiểu {(adsets.length * 50000).toLocaleString('vi-VN')}đ</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => setStep(2)}
            disabled={!canProceed1}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Tiếp theo — Cấu hình targeting <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* Step 2: Adsets */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Bước 2 — Cấu hình {adsets.length} Adsets</p>
          <p className="text-xs text-gray-500">Mỗi adset sẽ dùng cùng bài viết nhưng target khác nhau để so sánh hiệu quả.</p>
          {adsets.map((a, i) => (
            <AdsetCard key={i} adset={a} index={i} onChange={val => updateAdset(i, val)} />
          ))}
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 px-4 py-2.5 rounded-lg text-sm transition-colors">
              <ChevronLeft size={15} /> Quay lại
            </button>
            <button onClick={() => setStep(3)} className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 py-2.5 rounded-lg text-sm font-medium transition-colors">
              Xem lại & Tạo campaign <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Bước 3 — Xem lại & Tạo</p>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2 text-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Campaign</p>
            <div className="flex justify-between"><span className="text-gray-400">Tên</span><span className="font-medium">{basics.campaign_name}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Bài viết</span><span className="font-mono text-xs">{basics.page_id}_{basics.post_id}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Mục tiêu</span><span>OUTCOME_SALES</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Tổng budget/ngày</span><span className="text-white font-medium">{basics.total_budget.toLocaleString('vi-VN')}đ</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Budget/adset</span><span>{budgetPerAdset.toLocaleString('vi-VN')}đ</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Trạng thái</span><span className="text-yellow-400">PAUSED (cần bật thủ công)</span></div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Adsets ({adsets.length})</p>
            <div className="space-y-2">
              {adsets.map((a, i) => (
                <div key={i} className="flex items-start justify-between gap-3 text-sm py-1.5 border-b border-gray-800 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="bg-brand-600 text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="truncate text-gray-300">{a.name}</span>
                  </div>
                  <div className="text-right text-xs text-gray-500 shrink-0">
                    <p>{a.age_min}–{a.age_max} · {a.genders.length === 0 ? 'Tất cả' : a.genders[0] === 1 ? 'Nam' : 'Nữ'}</p>
                    {a.interests.length > 0 && <p className="text-brand-400">{a.interests.map(i => i.name).join(', ')}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-900/20 border border-red-800 rounded-xl px-4 py-3 text-red-300 text-sm">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} disabled={loading} className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 px-4 py-2.5 rounded-lg text-sm transition-colors">
              <ChevronLeft size={15} /> Quay lại
            </button>
            <button
              onClick={launch}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Rocket size={15} />
              {loading ? 'Đang tạo campaign...' : 'Tạo Campaign trên Facebook'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
