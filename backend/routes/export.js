import express from 'express';
import * as XLSX from 'xlsx';
import { requireAuth } from './auth.js';
const router = express.Router();

// POST /api/export  body: { data: [...], filename: 'report', format: 'csv'|'xlsx' }
router.post('/', requireAuth, (req, res) => {
  const { data, filename = 'ads_report', format = 'xlsx' } = req.body;
  if (!data || !Array.isArray(data)) return res.status(400).json({ error: 'data array required' });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');

  if (format === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(ws);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.send(csv);
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
  res.send(buf);
});

export default router;
