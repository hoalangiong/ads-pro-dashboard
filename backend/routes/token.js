import express from 'express';
import { requireAuth } from './auth.js';

const router = express.Router();
const FB_API = 'https://graph.facebook.com/v19.0';

// GET /api/token/validate — check token permissions and ad accounts
router.get('/validate', requireAuth, async (req, res) => {
  const token = req.headers['x-fb-token'] || process.env.FB_ACCESS_TOKEN;
  if (!token) return res.status(400).json({ valid: false, error: 'Chưa có token' });

  const results = { valid: false, user: null, adAccounts: [], permissions: [], errors: [] };

  try {
    // Check token info
    const meR = await fetch(`${FB_API}/me?fields=id,name,email&access_token=${token}`);
    const me = await meR.json();
    if (me.error) {
      results.errors.push(`Token lỗi: ${me.error.message}`);
      return res.json(results);
    }
    results.user = me;
    results.valid = true;

    // Check permissions
    const permR = await fetch(`${FB_API}/me/permissions?access_token=${token}`);
    const permData = await permR.json();
    results.permissions = (permData.data || [])
      .filter(p => p.status === 'granted')
      .map(p => p.permission);

    const required = ['ads_read', 'ads_management', 'business_management'];
    const missing = required.filter(p => !results.permissions.includes(p));
    if (missing.length) {
      results.errors.push(`Thiếu quyền: ${missing.join(', ')}`);
    }

    // Get ad accounts
    const acctR = await fetch(`${FB_API}/me/adaccounts?fields=id,name,account_status,currency,amount_spent&access_token=${token}`);
    const acctData = await acctR.json();
    if (!acctData.error) {
      results.adAccounts = acctData.data || [];
    } else {
      results.errors.push(`Không lấy được ad accounts: ${acctData.error.message}`);
    }

  } catch (e) {
    results.errors.push(e.message);
  }

  res.json(results);
});

export default router;
