import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from './auth.js';

const router = express.Router();
const __dir = path.dirname(fileURLToPath(import.meta.url));
const GOALS_FILE = path.join(__dir, '../data/goals.json');

export function loadGoals() {
  if (!fs.existsSync(GOALS_FILE)) return [];
  return JSON.parse(fs.readFileSync(GOALS_FILE, 'utf8'));
}
function saveGoals(g) {  fs.mkdirSync(path.dirname(GOALS_FILE), { recursive: true });
  fs.writeFileSync(GOALS_FILE, JSON.stringify(g, null, 2));
}

// Seed defaults for orchid/fertilizer
function seedDefaults() {
  if (loadGoals().length === 0) {
    saveGoals([
      { id: '1', name: 'ROAS mục tiêu', metric: 'roas', target: 3, unit: 'x', higherIsBetter: true },
      { id: '2', name: 'CTR mục tiêu', metric: 'ctr', target: 2, unit: '%', higherIsBetter: true },
      { id: '3', name: 'CPC tối đa', metric: 'cpc', target: 5000, unit: 'đ', higherIsBetter: false },
      { id: '4', name: 'Frequency tối đa', metric: 'frequency', target: 3, unit: '', higherIsBetter: false },
    ]);
  }
}
seedDefaults();

router.get('/', requireAuth, (req, res) => res.json(loadGoals()));

router.post('/', requireAuth, (req, res) => {
  const goals = loadGoals();
  const g = { id: Date.now().toString(), ...req.body };
  goals.push(g);
  saveGoals(goals);
  res.json(g);
});

router.put('/:id', requireAuth, (req, res) => {
  saveGoals(loadGoals().map(g => g.id === req.params.id ? { ...g, ...req.body } : g));
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  saveGoals(loadGoals().filter(g => g.id !== req.params.id));
  res.json({ ok: true });
});

export default router;
