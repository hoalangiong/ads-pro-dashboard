import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Campaigns from './pages/Campaigns.jsx';
import Insights from './pages/Insights.jsx';
import Optimize from './pages/Optimize.jsx';
import CampaignWizard from './pages/CampaignWizard.jsx';
import Settings from './pages/Settings.jsx';
import Login from './pages/Login.jsx';
import Alerts from './pages/Alerts.jsx';
import BudgetControl from './pages/BudgetControl.jsx';

import Users from './pages/Users.jsx';
import Compare from './pages/Compare.jsx';
import Breakdown from './pages/Breakdown.jsx';
import Reports from './pages/Reports.jsx';
import Creatives from './pages/Creatives.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Goals from './pages/Goals.jsx';

import AutoRules from './pages/AutoRules.jsx';
import Fatigue from './pages/Fatigue.jsx';
import Dayparting from './pages/Dayparting.jsx';
import Overlap from './pages/Overlap.jsx';
import Funnel from './pages/Funnel.jsx';
import ABTest from './pages/ABTest.jsx';
import Spy from './pages/Spy.jsx';
import Predict from './pages/Predict.jsx';
import Landing from './pages/Landing.jsx';
import AutoReply from './pages/AutoReply.jsx';
import Livestream from './pages/Livestream.jsx';

function RequireAuth({ children }) {
  const jwt = localStorage.getItem('jwt');
  if (!jwt) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/*" element={
        <RequireAuth>
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/optimize" element={<Optimize />} />
              <Route path="/wizard" element={<CampaignWizard />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/budget" element={<BudgetControl />} />
              <Route path="/users" element={<Users />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/breakdown" element={<Breakdown />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/creatives" element={<Creatives />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/autorules" element={<AutoRules />} />
              <Route path="/fatigue" element={<Fatigue />} />
              <Route path="/dayparting" element={<Dayparting />} />
              <Route path="/overlap" element={<Overlap />} />
              <Route path="/funnel" element={<Funnel />} />
              <Route path="/abtest" element={<ABTest />} />
              <Route path="/spy" element={<Spy />} />
              <Route path="/predict" element={<Predict />} />
              <Route path="/landing" element={<Landing />} />
              <Route path="/autoreply" element={<AutoReply />} />
              <Route path="/livestream" element={<Livestream />} />
            </Routes>
          </Layout>
        </RequireAuth>
      } />
    </Routes>
  );
}
