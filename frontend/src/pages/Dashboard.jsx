import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAccount } from '../context/AccountContext.jsx';
import StatCard from '../components/StatCard.jsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { CheckCircle, XCircle, Pause, Play, RefreshCw } from 'lucide-react';

function prevPeriodRange(preset) {
  const now = new Date();
  const fmt = d => d.toISOString().slice(0, 10);
  const sub = (d, n) => { const r = new Date(d); r.setDate(r.getDate() - n); return r; };
  if (preset === 'today') { const d = sub(now, 1); return { since: fmt(d), until: fmt(d) }; }
  if (preset === 'yesterday') { const d = sub(now, 2); return { since: fmt(d), until: fmt(d) }; }
  if (preset === 'last_7d') return { since: fmt(sub(now, 14)), until: fmt(sub(now, 8)) };
  if (preset === 'last_14d') return { since: fmt(sub(now, 28)), until: fmt(sub(now, 15)) };
  if (preset === 'last_30d') return { since: fmt(sub(now, 60)), until: fmt(sub(now, 31)) };
  if (preset === 'this_month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevFirst = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { since: fmt(prevFirst), until: fmt(new Date(first - 1)) };
  }
  if (preset === 'last_month') {
    const prevFirst = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const prevLast = new Date(now.getFullYear(), now.getMonth() - 1, 0);
    return { since: fmt(prevFirst), until: fmt(prevLast) };
  }
  return null;
}

export default function Dashboard() {
  const { accounts, selected, select } = useAccount();
  const [insights, setInsights] = useState([]);
  const [prevInsights, setPrevInsights] = useState([]);
  const [daily, setDaily] = useState([]);
  const [goals, setGoals] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [campInsights, setCampInsights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [datePreset, setDatePreset] = useState('last_7d');
  const [actionMsg, setActionMsg] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    api.goals().then(setGoals).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected?.id) return;
    setLoading(true);
    const prev = prevPeriodRange(datePreset);
    const prevFetch = prev
      ? api.insights(selected.id, 'account', null, prev.since, prev.until)
      : Promise.resolve({ data: [] });
    Promise.all([
      api.insights(selected.id, 'account', datePreset),
      api.campaigns(selected.id, 'campaign'),
      api.insights(selected.id, 'campaign', datePreset),
      api.insights(selected.id, 'account', datePreset, null, null, 1),
      prevFetch,
    ])
      .then(([ins, camps, campIns, dailyIns, prevIns]) => {
        setInsights(ins.data || []);
        setCampaigns(camps.slice(0, 6));
        setCampInsights(campIns.data || []);
        setDaily(dailyIns.data || []);
        setPrevInsights(prevIns.data || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [selected?.id, datePreset]);

  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      if (!selected?.id) return;
      const prev = prevPeriodRange(datePreset);
      const prevFetch = prev
        ? api.insights(selected.id, 'account', null, prev.since, prev.until)
        : Promise.resolve({ data: [] });
      Promise.all([
        api.insights(selected.id, 'account', datePreset),
        api.campaigns(selected.id, 'campaign'),
        api.insights(selected.id, 'campaign', datePreset),
        api.insights(selected.id, 'account', datePreset, null, null, 1),
        prevFetch,
      ]).then(([ins, camps, campIns, dailyIns, prevIns]) => {
        setInsights(ins.data || []);
        setCampaigns(camps.slice(0, 6));
        setCampInsights(campIns.data || []);
        setDaily(dailyIns.data || []);
        setPrevInsights(prevIns.data || []);
      }).catch(() => {});
    }, 60000);
    return () => clearInterval(id);
  }, [autoRefresh, selected?.id, datePreset]);

  const toggleCampaign = async (c) => {
    try {
      if (c.status === 'ACTIVE') {
        await api.pauseCampaign(c.id, 'campaign');
        setCampaigns(cs => cs.map(x => x.id === c.id ? { ...x, status: 'PAUSED' } : x));
        setActionMsg(`Đã tạm dừng: ${c.name}`); setActionError('');
      } else {
        await api.resumeCampaign(c.id, 'campaign');
        setCampaigns(cs => cs.map(x => x.id === c.id ? { ...x, status: 'ACTIVE' } : x));
        setActionMsg(`Đã bật lại: ${c.name}`); setActionError('');
      }
    } catch (e) { setActionError(e.message); }
  };

  const row = insights[0] || {};
  const spend = parseFloat(row.spend || 0);
  const roas = parseFloat(row.purchase_roas?.[0]?.value || 0);

  const metricValues = {
    roas,
    ctr: parseFloat(row.ctr || 0),
    cpc: parseFloat(row.cpc || 0),
    cpm: parseFloat(row.cpm || 0),
    frequency: parseFloat(row.frequency || 0),
    spend,
    conversions: parseFloat(row.conversions || 0),
  };

  const prevRow = prevInsights[0] || {};
  const pct = (curr, prev) => {
    if (!prev || prev === 0) return null;
    return ((curr - prev) / Math.abs(prev)) * 100;
  };
  const deltas = {
    spend: pct(spend, parseFloat(prevRow.spend || 0)),
    roas: pct(roas, parseFloat(prevRow.purchase_roas?.[0]?.value || 0)),
    ctr: pct(parseFloat(row.ctr || 0), parseFloat(prevRow.ctr || 0)),
    cpc: pct(parseFloat(row.cpc || 0), parseFloat(prevRow.cpc || 0)),
    impressions: pct(parseFloat(row.impressions || 0), parseFloat(prevRow.impressions || 0)),
    reach: pct(parseFloat(row.reach || 0), parseFloat(prevRow.reach || 0)),
    frequency: pct(parseFloat(row.frequency || 0), parseFloat(prevRow.frequency || 0)),
    conversions: pct(parseFloat(row.conversions || 0), parseFloat(prevRow.conversions || 0)),
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Tổng quan</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setAutoRefresh(r => !r)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${autoRefresh ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            title="Tự động làm mới mỗi 60 giây"
          >
            <RefreshCw size={13} className={autoRefresh ? 'animate-spin' : ''} />
            {autoRefresh ? 'Auto: Bật' : 'Auto: Tắt'}
          </button>
          <select
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
            value={selected?.id || ''}
            onChange={e => select(e.target.value)}
          >
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
            value={datePreset}
            onChange={e => setDatePreset(e.target.value)}
          >
            <option value="today">Hôm nay</option>
            <option value="yesterday">Hôm qua</option>
            <option value="last_7d">7 ngày qua</option>
            <option value="last_14d">14 ngày qua</option>
            <option value="last_30d">30 ngày qua</option>
            <option value="this_month">Tháng này</option>
            <option value="last_month">Tháng trước</option>
          </select>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      {loading && <p className="text-gray-400 text-sm mb-4">Đang tải...</p>}
      {actionError && <p className="text-red-400 text-sm mb-4">{actionError}</p>}
      {actionMsg && <p className="text-green-400 text-sm mb-4">{actionMsg}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Chi tiêu" value={`${spend.toLocaleString('vi-VN')}đ`} change={deltas.spend} lowerIsBetter />
        <StatCard label="ROAS" value={roas ? `${roas.toFixed(2)}x` : '—'} color={roas >= 3 ? 'text-green-400' : roas > 0 && roas < 1.5 ? 'text-red-400' : 'text-white'} change={deltas.roas} />
        <StatCard label="CTR" value={row.ctr ? `${parseFloat(row.ctr).toFixed(2)}%` : '—'} change={deltas.ctr} />
        <StatCard label="CPC" value={row.cpc ? `${parseFloat(row.cpc).toLocaleString('vi-VN')}đ` : '—'} change={deltas.cpc} lowerIsBetter />
        <StatCard label="Impressions" value={row.impressions ? parseInt(row.impressions).toLocaleString('vi-VN') : '—'} change={deltas.impressions} />
        <StatCard label="Reach" value={row.reach ? parseInt(row.reach).toLocaleString('vi-VN') : '—'} change={deltas.reach} />
        <StatCard label="Frequency" value={row.frequency ? parseFloat(row.frequency).toFixed(2) : '—'} color={parseFloat(row.frequency) > 3.5 ? 'text-yellow-400' : 'text-white'} change={deltas.frequency} lowerIsBetter />
        <StatCard label="Conversions" value={row.conversions ? parseInt(row.conversions).toLocaleString('vi-VN') : '—'} color="text-brand-400" change={deltas.conversions} />
      </div>

      {/* KPI Goals */}
      {goals.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Mục tiêu KPI</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {goals.map(g => {
              const actual = metricValues[g.metric];
              const met = actual > 0 && (g.higherIsBetter ? actual >= g.target : actual <= g.target);
              const missed = actual > 0 && !met;
              return (
                <div key={g.id} className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2.5">
                  {actual > 0
                    ? met
                      ? <CheckCircle size={16} className="text-green-400 shrink-0" />
                      : <XCircle size={16} className="text-red-400 shrink-0" />
                    : <span className="w-4 h-4 rounded-full border border-gray-600 shrink-0" />
                  }
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 truncate">{g.name}</p>
                    <p className={`text-sm font-medium ${met ? 'text-green-400' : missed ? 'text-red-400' : 'text-gray-300'}`}>
                      {actual > 0
                        ? ['cpc','cpm','spend'].includes(g.metric)
                          ? `${actual.toLocaleString('vi-VN')}${g.unit}`
                          : `${actual.toFixed(2)}${g.unit}`
                        : '—'
                      }
                      <span className="text-gray-500 font-normal text-xs ml-1">/ {g.target}{g.unit}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      {campaigns.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Hành động nhanh — Campaigns</p>
          <div className="space-y-2">
            {campaigns.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-3">
                <p className="text-sm truncate flex-1 text-gray-300">{c.name}</p>
                <span className={`text-xs shrink-0 ${c.status === 'ACTIVE' ? 'text-green-400' : 'text-yellow-400'}`}>{c.status}</span>
                <button
                  onClick={() => toggleCampaign(c)}
                  className={`shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                    c.status === 'ACTIVE'
                      ? 'bg-yellow-900 text-yellow-300 hover:bg-yellow-800'
                      : 'bg-green-900 text-green-300 hover:bg-green-800'
                  }`}
                >
                  {c.status === 'ACTIVE' ? <><Pause size={11} /> Dừng</> : <><Play size={11} /> Bật</>}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top/Bottom performers */}
      {campInsights.length > 1 && (() => {
        const withRoas = campInsights.filter(r => parseFloat(r.roas || 0) > 0).sort((a, b) => parseFloat(b.roas) - parseFloat(a.roas));
        const top = withRoas.slice(0, 3);
        const bottom = withRoas.slice(-3).reverse();
        if (!top.length) return null;
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Top ROAS</p>
              <div className="space-y-2">
                {top.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <p className="text-sm truncate flex-1 text-gray-300">{r.campaign_name}</p>
                    <span className="text-green-400 text-sm font-medium shrink-0">{parseFloat(r.roas).toFixed(2)}x</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">ROAS thấp nhất</p>
              <div className="space-y-2">
                {bottom.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <p className="text-sm truncate flex-1 text-gray-300">{r.campaign_name}</p>
                    <span className="text-red-400 text-sm font-medium shrink-0">{parseFloat(r.roas).toFixed(2)}x</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {daily.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-sm font-medium mb-3">Chi tiêu theo ngày</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={daily.map(r => ({ ...r, spend: parseFloat(r.spend || 0), label: r.date_start?.slice(5).replace('-', '/') }))}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151' }} formatter={v => [`${parseFloat(v).toLocaleString('vi-VN')}đ`, 'Chi tiêu']} />
                <Bar dataKey="spend" fill="#4f6ef7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-sm font-medium mb-3">CTR theo ngày</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={daily.map(r => ({ ...r, ctr: parseFloat(r.ctr || 0), label: r.date_start?.slice(5).replace('-', '/') }))}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151' }} formatter={v => [`${parseFloat(v).toFixed(2)}%`, 'CTR']} />
                <Line type="monotone" dataKey="ctr" stroke="#34d399" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-sm font-medium mb-3">ROAS theo ngày</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={daily.map(r => ({ ...r, roas_val: parseFloat(r.roas || r.purchase_roas?.[0]?.value || 0), label: r.date_start?.slice(5).replace('-', '/') }))}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151' }} formatter={v => [`${parseFloat(v).toFixed(2)}x`, 'ROAS']} />
                <Line type="monotone" dataKey="roas_val" stroke="#f59e0b" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
