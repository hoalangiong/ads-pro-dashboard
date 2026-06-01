import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from './auth.js';

const router = express.Router();
const __dir = path.dirname(fileURLToPath(import.meta.url));
const TESTS_FILE = path.join(__dir, '../data/abtests.json');
const FB_API = 'https://graph.facebook.com/v19.0';

function loadTests() {
  if (!fs.existsSync(TESTS_FILE)) return [];
  return JSON.parse(fs.readFileSync(TESTS_FILE, 'utf8'));
}
function saveTests(t) {
  fs.mkdirSync(path.dirname(TESTS_FILE), { recursive: true });
  fs.writeFileSync(TESTS_FILE, JSON.stringify(t, null, 2));
}

// GET /api/abtest
router.get('/', requireAuth, (req, res) => res.json(loadTests()));

// POST /api/abtest
router.post('/', requireAuth, (req, res) => {
  const tests = loadTests();
  const test = {
    id: Date.now().toString(),
    status: 'running',
    created_at: new Date().toISOString(),
    winner: null,
    ...req.body,
  };
  tests.push(test);
  saveTests(tests);
  res.json(test);
});

// PUT /api/abtest/:id
router.put('/:id', requireAuth, (req, res) => {
  const tests = loadTests().map(t => t.id === req.params.id ? { ...t, ...req.body } : t);
  saveTests(tests);
  res.json({ ok: true });
});

// DELETE /api/abtest/:id
router.delete('/:id', requireAuth, (req, res) => {
  saveTests(loadTests().filter(t => t.id !== req.params.id));
  res.json({ ok: true });
});

// GET /api/abtest/:id/results
router.get('/:id/results', requireAuth, async (req, res) => {
  const fbToken = res.locals.fbToken;
  const test = loadTests().find(t => t.id === req.params.id);
  if (!test) return res.status(404).json({ error: 'Test not found' });

  try {
    const metric = test.metric || 'ctr';
    const FIELDS = 'campaign_id,campaign_name,impressions,clicks,ctr,cpc,spend,purchase_roas,conversions';
    const ids = [test.variant_a, test.variant_b].filter(Boolean);

    const results = await Promise.all(ids.map(async (id) => {
      const r = await fetch(
        `${FB_API}/${id}/insights?fields=${FIELDS}&date_preset=last_7d&access_token=${fbToken}`
      );
      const { data } = await r.json();
      return { id, data: data?.[0] || null };
    }));

    const [a, b] = results;
    if (!a.data || !b.data) return res.json({ test, results: { a: a.data, b: b.data }, significance: null });

    // Calculate statistical significance (z-test for proportions)
    const getMetricValue = (row) => {
      if (metric === 'ctr') return parseFloat(row.ctr || 0) / 100;
      if (metric === 'roas') return parseFloat(row.purchase_roas?.[0]?.value || 0);
      if (metric === 'cpc') return parseFloat(row.cpc || 0);
      if (metric === 'conversions') return parseInt(row.conversions || 0);
      return parseFloat(row[metric] || 0);
    };

    const valA = getMetricValue(a.data);
    const valB = getMetricValue(b.data);
    const nA = parseInt(a.data.impressions || 0);
    const nB = parseInt(b.data.impressions || 0);

    let confidence = 0;
    if (nA > 100 && nB > 100 && (metric === 'ctr' || metric === 'conversions')) {
      // Z-test for proportions
      const pA = metric === 'ctr' ? valA : (parseInt(a.data.conversions || 0) / nA);
      const pB = metric === 'ctr' ? valB : (parseInt(b.data.conversions || 0) / nB);
      const pPool = (pA * nA + pB * nB) / (nA + nB);
      const se = Math.sqrt(pPool * (1 - pPool) * (1 / nA + 1 / nB));
      if (se > 0) {
        const z = Math.abs(pA - pB) / se;
        // Approximate p-value from z-score
        confidence = Math.min(99.9, (1 - Math.exp(-0.717 * z - 0.416 * z * z)) * 100);
      }
    }

    const winner = confidence > 95
      ? (valA > valB ? 'A' : 'B')
      : null;

    // Auto-update test status
    if (winner && test.status === 'running') {
      const tests = loadTests().map(t => t.id === test.id ? { ...t, status: 'winner_found', winner } : t);
      saveTests(tests);
    }

    res.json({
      test,
      results: {
        a: { ...a.data, metric_value: valA },
        b: { ...b.data, metric_value: valB },
      },
      significance: {
        confidence: Math.round(confidence * 10) / 10,
        winner,
        metric,
        value_a: valA,
        value_b: valB,
        sample_a: nA,
        sample_b: nB,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
