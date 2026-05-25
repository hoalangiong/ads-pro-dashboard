import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from './auth.js';

const router = express.Router();
const __dir = path.dirname(fileURLToPath(import.meta.url));
const NOTES_FILE = path.join(__dir, '../data/notes.json');

function load() {
  if (!fs.existsSync(NOTES_FILE)) return [];
  return JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
}
function save(notes) {
  fs.mkdirSync(path.dirname(NOTES_FILE), { recursive: true });
  fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2));
}

// GET /api/notes?object_id=xxx  — all notes or filtered by object
router.get('/', requireAuth, (req, res) => {
  const { object_id } = req.query;
  const notes = load();
  res.json(object_id ? notes.filter(n => n.object_id === object_id) : notes);
});

// POST /api/notes  body: { object_id, text }
router.post('/', requireAuth, (req, res) => {
  const { object_id, text } = req.body;
  if (!object_id || !text?.trim()) return res.status(400).json({ error: 'object_id and text required' });
  const notes = load();
  const note = { id: Date.now().toString() + Math.random().toString(36).slice(2, 7), object_id, text: text.trim(), created_at: new Date().toISOString() };
  notes.push(note);
  save(notes);
  res.json(note);
});

// DELETE /api/notes/:id
router.delete('/:id', requireAuth, (req, res) => {
  save(load().filter(n => n.id !== req.params.id));
  res.json({ ok: true });
});

export default router;
