import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __dir = path.dirname(fileURLToPath(import.meta.url));
const USERS_FILE = path.join(__dir, '../data/users.json');

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveUsers(users) {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Seed default admin on first run
function ensureAdmin() {
  const users = loadUsers();
  if (!users.find(u => u.role === 'admin')) {
    users.push({
      id: '1',
      username: 'admin',
      password: bcrypt.hashSync('admin123', 10),
      role: 'admin',
      name: 'Admin',
    });
    saveUsers(users);
  }
}
ensureAdmin();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();
  const user = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    process.env.JWT_SECRET || 'ads_secret_2026',
    { expiresIn: '7d' }
  );
  res.json({ token, user: { id: user.id, username: user.username, role: user.role, name: user.name } });
});

// POST /api/auth/register  (admin only)
router.post('/register', requireAdmin, async (req, res) => {
  const { username, password, name, role = 'member' } = req.body;
  const users = loadUsers();
  if (users.find(u => u.username === username))
    return res.status(400).json({ error: 'Username đã tồn tại' });

  const newUser = {
    id: Date.now().toString(),
    username,
    password: bcrypt.hashSync(password, 10),
    role,
    name: name || username,
  };
  users.push(newUser);
  saveUsers(users);
  res.json({ ok: true, user: { id: newUser.id, username, role, name: newUser.name } });
});

// GET /api/auth/users  (admin only)
router.get('/users', requireAdmin, (req, res) => {
  const users = loadUsers().map(({ password, ...u }) => u);
  res.json(users);
});

// DELETE /api/auth/users/:id  (admin only)
router.delete('/users/:id', requireAdmin, (req, res) => {
  let users = loadUsers();
  users = users.filter(u => u.id !== req.params.id);
  saveUsers(users);
  res.json({ ok: true });
});

export function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Chưa đăng nhập' });
  try {
    req.user = jwt.verify(h.slice(7), process.env.JWT_SECRET || 'ads_secret_2026');
    next();
  } catch {
    res.status(401).json({ error: 'Token không hợp lệ' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Không có quyền' });
    next();
  });
}

export default router;
