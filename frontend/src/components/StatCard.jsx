import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({ label, value, sub, color = 'text-white', change, lowerIsBetter = false }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value ?? '—'}</p>
      <div className="flex items-center justify-between mt-1">
        {sub && <p className="text-xs text-gray-500">{sub}</p>}
        {change !== undefined && change !== null && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ml-auto ${
            change === 0 ? 'text-gray-500'
            : (lowerIsBetter ? change < 0 : change > 0) ? 'text-green-400' : 'text-red-400'
          }`}>
            {change > 0 ? <TrendingUp size={11} /> : change < 0 ? <TrendingDown size={11} /> : null}
            {change > 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}
