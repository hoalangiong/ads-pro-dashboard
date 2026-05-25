import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { CheckCircle, ChevronRight, RefreshCw, Send } from 'lucide-react';

const STEPS = ['Chào mừng', 'FB Token', 'Ad Account', 'Telegram', 'Hoàn tất'];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [token, setToken] = useState('');
  const [validation, setValidation] = useState(null);
  const [validating, setValidating] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [chatId, setChatId] = useState('');
  const [tgTested, setTgTested] = useState(false);
  const [tgLoading, setTgLoading] = useState(false);
  const [tgError, setTgError] = useState('');
  const nav = useNavigate();

  const validateToken = async () => {
    if (!token) return;
    setValidating(true);
    try {
      const r = await api.validateToken(token);
      setValidation(r);
      if (r.valid && r.adAccounts?.length === 1) setSelectedAccount(r.adAccounts[0].id);
      if (r.valid && r.expires_at != null) localStorage.setItem('fb_token_expires_at', r.expires_at);
    } catch (e) {
      setValidation({ valid: false, errors: [e.message] });
    } finally {
      setValidating(false);
    }
  };

  const testTelegram = async () => {
    if (!chatId) return;
    setTgLoading(true); setTgError('');
    try {
      await api.tgSend(chatId, '✅ Ads Pro đã kết nối thành công! Bạn sẽ nhận báo cáo và alert tại đây.');
      setTgTested(true);
      localStorage.setItem('tg_chat_id', chatId);
    } catch (e) {
      setTgError(e.message);
    } finally {
      setTgLoading(false);
    }
  };

  const finish = () => {
    localStorage.setItem('fb_token', token);
    localStorage.setItem('fb_account_id', selectedAccount);
    if (chatId) localStorage.setItem('tg_chat_id', chatId);
    localStorage.setItem('onboarding_done', '1');
    nav('/dashboard');
  };

  const canNext = () => {
    if (step === 1) return validation?.valid && token;
    if (step === 2) return !!selectedAccount;
    return true;
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i < step ? 'bg-green-500 text-white' : i === step ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-500'
              }`}>
                {i < step ? <CheckCircle size={14} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-8 mx-1 transition-colors ${i < step ? 'bg-green-500' : 'bg-gray-800'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center space-y-4">
              <div className="text-5xl mb-2">🌸</div>
              <h1 className="text-2xl font-bold">Chào mừng đến Ads Pro</h1>
              <p className="text-gray-400">Dashboard quảng cáo chuyên biệt cho ngành <b className="text-white">Hoa Lan & Phân Bón</b></p>
              <div className="grid grid-cols-2 gap-3 text-left mt-4">
                {[
                  ['📊', 'Đọc 25+ chỉ số FB Ads'],
                  ['🤖', 'AI phân tích & gợi ý tối ưu'],
                  ['📱', 'Alert & báo cáo Telegram'],
                  ['👥', 'Quản lý team nhiều người'],
                  ['💰', 'Kiểm soát budget trực tiếp'],
                  ['📈', 'So sánh kỳ & phân tích creative'],
                ].map(([icon, text]) => (
                  <div key={text} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 text-sm">
                    <span>{icon}</span> {text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: FB Token */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Kết nối Facebook Ads</h2>
              <p className="text-sm text-gray-400">Nhập Access Token có quyền <code className="bg-gray-800 px-1 rounded text-xs">ads_read</code> và <code className="bg-gray-800 px-1 rounded text-xs">ads_management</code></p>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono resize-none"
                rows={3}
                value={token}
                onChange={e => { setToken(e.target.value); setValidation(null); }}
                placeholder="EAAa..."
              />
              <button onClick={validateToken} disabled={validating || !token} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded-lg text-sm transition-colors">
                <RefreshCw size={14} className={validating ? 'animate-spin' : ''} />
                {validating ? 'Đang kiểm tra...' : 'Kiểm tra token'}
              </button>
              {validation && (
                <div className={`rounded-lg p-3 text-sm ${validation.valid ? 'bg-green-900/30 border border-green-800' : 'bg-red-900/30 border border-red-800'}`}>
                  {validation.valid
                    ? <p className="text-green-300">✓ Token hợp lệ — {validation.user?.name} · {validation.adAccounts?.length} ad account(s)</p>
                    : <p className="text-red-300">✗ {validation.errors?.[0]}</p>}
                  {validation.valid && validation.errors?.length > 0 && (
                    <p className="text-yellow-300 mt-1">⚠ {validation.errors.join(', ')}</p>
                  )}
                </div>
              )}
              <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-400 space-y-1">
                <p className="font-medium text-gray-300">Cách lấy token:</p>
                <p>1. Business Manager → Settings → System Users</p>
                <p>2. Tạo System User Admin → Generate Token</p>
                <p>3. Tick: ads_read, ads_management, business_management</p>
              </div>
            </div>
          )}

          {/* Step 2: Ad Account */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Chọn tài khoản quảng cáo</h2>
              <p className="text-sm text-gray-400">Chọn tài khoản bạn muốn theo dõi</p>
              <div className="space-y-2">
                {validation?.adAccounts?.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAccount(a.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                      selectedAccount === a.id ? 'border-brand-500 bg-brand-600/10' : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-sm">{a.name}</p>
                      <p className="text-xs text-gray-500">{a.id} · {a.currency}</p>
                    </div>
                    {selectedAccount === a.id && <CheckCircle size={16} className="text-brand-500" />}
                  </button>
                ))}
                {!validation?.adAccounts?.length && (
                  <p className="text-gray-500 text-sm">Không tìm thấy ad account. Kiểm tra lại quyền token.</p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Telegram */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Kết nối Telegram <span className="text-gray-500 text-sm font-normal">(tuỳ chọn)</span></h2>
              <p className="text-sm text-gray-400">Nhận alert và báo cáo tự động qua Telegram</p>
              <div>
                <label className="text-xs text-gray-400 block mb-1.5">Chat ID của bạn</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                  value={chatId}
                  onChange={e => { setChatId(e.target.value); setTgTested(false); }}
                  placeholder="123456789"
                />
              </div>
              <button onClick={testTelegram} disabled={tgLoading || !chatId} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded-lg text-sm transition-colors">
                <Send size={14} /> {tgLoading ? 'Đang gửi...' : 'Gửi tin nhắn test'}
              </button>
              {tgTested && <p className="text-green-400 text-sm">✓ Kết nối thành công!</p>}
              {tgError && <p className="text-red-400 text-sm">{tgError}</p>}
              <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-400 space-y-1">
                <p className="font-medium text-gray-300">Cách lấy Chat ID:</p>
                <p>1. Tìm @userinfobot trên Telegram</p>
                <p>2. Gửi /start — bot trả về ID của bạn</p>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
            <div className="text-center space-y-4">
              <div className="text-5xl mb-2">🎉</div>
              <h2 className="text-xl font-bold">Thiết lập hoàn tất!</h2>
              <p className="text-gray-400 text-sm">Mọi thứ đã sẵn sàng. Nhấn bắt đầu để vào dashboard.</p>
              <div className="bg-gray-800 rounded-lg p-4 text-left space-y-2 text-sm">
                <div className="flex items-center gap-2 text-green-400"><CheckCircle size={14} /> FB Token đã kết nối</div>
                <div className="flex items-center gap-2 text-green-400"><CheckCircle size={14} /> Ad Account: {selectedAccount}</div>
                {chatId && <div className="flex items-center gap-2 text-green-400"><CheckCircle size={14} /> Telegram: {chatId}</div>}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <button
              onClick={() => setStep(s => s - 1)}
              className={`px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors ${step === 0 ? 'invisible' : ''}`}
            >
              Quay lại
            </button>
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canNext() && step !== 3}
                className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {step === 3 && !tgTested ? 'Bỏ qua' : 'Tiếp theo'} <ChevronRight size={14} />
              </button>
            ) : (
              <button onClick={finish} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 px-5 py-2 rounded-lg text-sm font-medium transition-colors">
                Bắt đầu <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
