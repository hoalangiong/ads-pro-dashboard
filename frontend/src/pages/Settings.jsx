import { useState } from 'react';
import { api } from '../lib/api.js';
import { useAccount } from '../context/AccountContext.jsx';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';

export default function Settings() {
  const { refresh } = useAccount();
  const [token, setToken] = useState(localStorage.getItem('fb_token') || '');
  const [accountId, setAccountId] = useState(localStorage.getItem('fb_account_id') || '');
  const [saved, setSaved] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState(null);
  const [cacheMsg, setCacheMsg] = useState('');

  const save = () => {
    localStorage.setItem('fb_token', token);
    localStorage.setItem('fb_account_id', accountId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    refresh();
  };

  const validate = async () => {
    if (!token) return;
    setValidating(true);
    setValidation(null);
    try {
      const result = await api.validateToken(token);
      setValidation(result);
      if (result.valid && result.expires_at != null) {
        localStorage.setItem('fb_token_expires_at', result.expires_at);
        window.dispatchEvent(new Event('storage'));
      }
      // Auto-fill account if only one
      if (result.adAccounts?.length === 1 && !accountId) {
        setAccountId(result.adAccounts[0].id);
        localStorage.setItem('fb_account_id', result.adAccounts[0].id);
      }
    } catch (e) {
      setValidation({ valid: false, errors: [e.message] });
    } finally {
      setValidating(false);
    }
  };

  const clearCache = async () => {
    try {
      await api.clearCache();
      setCacheMsg('Cache đã xóa!');
    } catch (e) {
      setCacheMsg('Lỗi: ' + e.message);
    }
    setTimeout(() => setCacheMsg(''), 3000);
  };

  const REQUIRED_PERMS = ['ads_read', 'ads_management', 'business_management'];

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-xl font-bold">Cài đặt</h1>

      {/* Token config */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <p className="text-xs text-gray-400 uppercase tracking-wide">Facebook Ads</p>
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">Access Token</label>
          <textarea
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono resize-none"
            rows={3}
            value={token}
            onChange={e => { setToken(e.target.value); setValidation(null); }}
            placeholder="EAAa..."
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">Ad Account ID</label>
          <input
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            placeholder="act_XXXXXXXXX"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={save} className="bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            {saved ? 'Đã lưu!' : 'Lưu'}
          </button>
          <button onClick={validate} disabled={validating || !token} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded-lg text-sm transition-colors">
            <RefreshCw size={14} className={validating ? 'animate-spin' : ''} />
            {validating ? 'Đang kiểm tra...' : 'Kiểm tra token'}
          </button>
        </div>
      </div>

      {/* Validation result */}
      {validation && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            {validation.valid
              ? <CheckCircle size={18} className="text-green-400" />
              : <XCircle size={18} className="text-red-400" />}
            <p className="font-medium">{validation.valid ? `Token hợp lệ — ${validation.user?.name}` : 'Token không hợp lệ'}</p>
          </div>

          {validation.errors?.length > 0 && (
            <div className="space-y-1">
              {validation.errors.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-red-400">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" /> {e}
                </div>
              ))}
            </div>
          )}

          {validation.permissions?.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Quyền</p>
              <div className="flex flex-wrap gap-2">
                {REQUIRED_PERMS.map(p => (
                  <span key={p} className={`text-xs px-2 py-0.5 rounded-full ${validation.permissions.includes(p) ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                    {validation.permissions.includes(p) ? '✓' : '✗'} {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {validation.adAccounts?.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Ad Accounts ({validation.adAccounts.length})</p>
              <div className="space-y-2">
                {validation.adAccounts.map(a => (
                  <div key={a.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{a.name}</p>
                      <p className="text-xs text-gray-500">{a.id} · {a.currency}</p>
                    </div>
                    <button
                      onClick={() => { setAccountId(a.id); localStorage.setItem('fb_account_id', a.id); refresh(); setSaved(true); setTimeout(() => setSaved(false), 1500); }}
                      className="text-xs bg-brand-600 hover:bg-brand-700 px-2 py-1 rounded transition-colors"
                    >
                      Chọn
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Cách lấy token đúng quyền</p>
        <ol className="space-y-2 text-sm text-gray-300 list-decimal list-inside">
          <li>Vào <b>Facebook Business Manager</b> → Settings → System Users</li>
          <li>Tạo System User với role <b>Admin</b></li>
          <li>Nhấn <b>Generate New Token</b> → chọn App của bạn</li>
          <li>Tick các quyền: <code className="bg-gray-800 px-1 rounded text-xs">ads_read</code>, <code className="bg-gray-800 px-1 rounded text-xs">ads_management</code>, <code className="bg-gray-800 px-1 rounded text-xs">business_management</code></li>
          <li>Copy token và dán vào ô trên → nhấn <b>Kiểm tra token</b></li>
        </ol>
      </div>

      {/* Cache */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Cache</p>
          <p className="text-sm text-gray-300 mt-1">Xóa dữ liệu cache phía server để tải lại từ Facebook API</p>
          {cacheMsg && <p className="text-xs text-green-400 mt-1">{cacheMsg}</p>}
        </div>
        <button onClick={clearCache} className="flex items-center gap-2 bg-gray-700 hover:bg-red-800 px-4 py-2 rounded-lg text-sm transition-colors shrink-0">
          <Trash2 size={14} /> Xóa cache
        </button>
      </div>
    </div>
  );
}
