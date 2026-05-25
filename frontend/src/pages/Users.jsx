import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Trash2, Plus, UserCheck } from 'lucide-react';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'member' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const me = JSON.parse(localStorage.getItem('user') || '{}');

  const load = () => api.users().then(setUsers).catch(e => setError(e.message));
  useEffect(load, []);

  const add = async () => {
    if (!form.username || !form.password) return setError('Cần nhập username và password');
    setError('');
    try {
      await api.registerUser(form);
      setForm({ username: '', password: '', name: '', role: 'member' });
      setMsg('Đã thêm thành viên');
      load();
    } catch (e) { setError(e.message); }
  };

  const remove = async (id) => {
    if (id === me.id) return setError('Không thể xóa chính mình');
    try {
      await api.deleteUser(id);
      setMsg('Đã xóa');
      load();
    } catch (e) { setError(e.message); }
  };

  const ROLE_COLOR = { admin: 'bg-purple-900 text-purple-300', member: 'bg-blue-900 text-blue-300' };

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold mb-6">Quản lý thành viên</h1>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      {msg && <p className="text-green-400 text-sm mb-4">{msg}</p>}

      {/* Add user */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 space-y-3">
        <p className="text-xs text-gray-400 uppercase tracking-wide">Thêm thành viên mới</p>
        <div className="grid grid-cols-2 gap-3">
          <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" placeholder="Username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
          <input type="password" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" placeholder="Mật khẩu" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" placeholder="Tên hiển thị" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button onClick={add} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-lg text-sm transition-colors">
          <Plus size={14} /> Thêm thành viên
        </button>
      </div>

      {/* Users list */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
            <th className="text-left px-4 py-3">Tên</th>
            <th className="text-left px-4 py-3">Username</th>
            <th className="text-left px-4 py-3">Vai trò</th>
            <th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="px-4 py-3 font-medium flex items-center gap-2">
                  {u.id === me.id && <UserCheck size={14} className="text-brand-500" />}
                  {u.name}
                </td>
                <td className="px-4 py-3 text-gray-400">{u.username}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLOR[u.role] || 'bg-gray-700 text-gray-300'}`}>{u.role}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {u.id !== me.id && (
                    <button onClick={() => remove(u.id)} className="text-gray-500 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
