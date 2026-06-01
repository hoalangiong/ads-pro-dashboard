import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LayoutDashboard, BarChart2, TrendingUp, Lightbulb, PlusCircle, Settings, Bell, DollarSign, LogOut, Users, GitCompare, PieChart, FileText, Image, Target, Zap, AlertTriangle, Clock, Users2, Filter, FlaskConical, Eye, Globe, MessageCircle } from 'lucide-react';
import { api } from '../lib/api.js';

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Tổng quan' },
  { to: '/campaigns', icon: BarChart2, label: 'Campaigns' },
  { to: '/insights', icon: TrendingUp, label: 'Chỉ số' },
  { to: '/creatives', icon: Image, label: 'Creative' },
  { to: '/breakdown', icon: PieChart, label: 'Phân tích' },
  { to: '/compare', icon: GitCompare, label: 'So sánh kỳ' },
  { to: '/optimize', icon: Lightbulb, label: 'Tối ưu AI' },
  { to: '/wizard', icon: PlusCircle, label: 'Lên Camp' },
  { to: '/budget', icon: DollarSign, label: 'Budget' },
  { to: '/alerts', icon: Bell, label: 'Alerts', badge: true },
  { to: '/autorules', icon: Zap, label: 'Auto Rules' },
  { to: '/fatigue', icon: AlertTriangle, label: 'Fatigue' },
  { to: '/dayparting', icon: Clock, label: 'Dayparting' },
  { to: '/overlap', icon: Users2, label: 'Overlap' },
  { to: '/funnel', icon: Filter, label: 'Funnel' },
  { to: '/abtest', icon: FlaskConical, label: 'A/B Test' },
  { to: '/spy', icon: Eye, label: 'Ad Spy' },
  { to: '/predict', icon: TrendingUp, label: 'Predict' },
  { to: '/landing', icon: Globe, label: 'Landing' },
  { to: '/autoreply', icon: MessageCircle, label: 'Auto Reply' },
  { to: '/reports', icon: FileText, label: 'Báo cáo TG' },
  { to: '/goals', icon: Target, label: 'Mục tiêu KPI' },
  { to: '/users', icon: Users, label: 'Thành viên' },
  { to: '/settings', icon: Settings, label: 'Cài đặt' },
];

export default function Layout({ children }) {
  const nav2 = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    api.alertLog()
      .then(log => {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const recent = log.filter(l => new Date(l.time).getTime() > cutoff);
        setAlertCount(recent.length);
      })
      .catch(() => {});
  }, []);

  const logout = () => {
    localStorage.removeItem('jwt');
    localStorage.removeItem('user');
    nav2('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-gray-800">
          <span className="text-lg font-bold text-brand-500">Ads Pro</span>
          <p className="text-xs text-gray-500 mt-0.5">Hoa Lan & Phân Bón</p>
        </div>
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {nav.map(({ to, icon: Icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              {badge && alertCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-300">{user.name || user.username}</p>
            <p className="text-xs text-gray-500">{user.role}</p>
          </div>
          <button onClick={logout} className="text-gray-500 hover:text-red-400 transition-colors">
            <LogOut size={15} />
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-gray-950 p-6">{children}</main>
    </div>
  );
}
