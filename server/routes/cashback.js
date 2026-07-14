const express = require('express');
const router = express.Router();
const { pool } = require('../db/index');
const { authenticate, authorize } = require('../middleware/auth');

// ── Helper: ensure wallet exists ──────────────────────────────────────────────
// async function ensureWallet(client, customerId) {
//   await client.query(
//     `INSERT INTO cashback_wallet (customer_id, balance, lifetime_earned)
//      VALUES ($1, 0, 0) ON CONFLICT (customer_id) DO NOTHING`,
//     [customerId]
//   );
// }
async function ensureWallet(client, customerId) {
  const result = await client.query(
    `INSERT INTO cashback_wallet (customer_id, balance, lifetime_earned)
     VALUES ($1, 0, 0)
     ON CONFLICT (customer_id) DO NOTHING
     RETURNING *`,
    [customerId]
  );

  if (result.rowCount > 0) {
    console.log(`✅ Cashback wallet created for customer ${customerId}`);
    console.log(result.rows[0]);
  } else {
    console.log(`ℹ️ Cashback wallet already exists for customer ${customerId}`);
  }
}

// ── Helper: check if first visit ──────────────────────────────────────────────
// async function isFirstVisit(client, customerId) {
//   const result = await client.query(
//     `SELECT COUNT(*) FROM appointments 
//      WHERE customer_id = $1`,
//     [customerId]
//   );
//   console.log("first visit result: ", result.rows[0].count);
//   return parseInt(result.rows[0].count) === 0;
// }
async function isFirstVisit(client, customerId) {
  const result = await client.query(
    `SELECT COUNT(*)
     FROM appointments
     WHERE customer_id = $1`,
    [customerId]
  );
  const count = parseInt(result.rows[0].count);
  console.log("Customer appointment count:", count);
  return count === 1;
}

// ── Award cashback after first visit payment ──────────────────────────────────
async function awardFirstVisitCashback(client, appointmentId, customerId, amountPaid, performedBy) {
  try {
    // Get settings
    const settings = await client.query(
      `SELECT key, value FROM system_settings 
       WHERE key IN ('cashback_enabled','cashback_percent','cashback_expiry_days')`
    );
    const s = {};
    settings.rows.forEach(r => s[r.key] = r.value);
    console.log("settings: ", s);
    if (s.cashback_enabled !== 'true') return 0;

    // Check first visit
    const first = await isFirstVisit(client, customerId);
    if (!first) return 0;

    const percent = parseFloat(s.cashback_percent || 20);
    const expiryDays = parseInt(s.cashback_expiry_days || 90);
    const cashbackAmount = (amountPaid * percent) / 100;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    await ensureWallet(client, customerId);

    // Add to wallet
    await client.query(
      `UPDATE cashback_wallet 
       SET balance = balance + $1, lifetime_earned = lifetime_earned + $1, updated_at = NOW()
       WHERE customer_id = $2`,
      [cashbackAmount, customerId]
    );

    // Log transaction
    await client.query(
      `INSERT INTO cashback_transactions 
         (customer_id, appointment_id, type, amount, expires_at, description)
       VALUES ($1, $2, 'earned', $3, $4, $5)`,
      [customerId, appointmentId, cashbackAmount, expiresAt.toISOString().split('T')[0],
       `${percent}% first-visit cashback on appointment #${appointmentId}`]
    );

    // Update appointment
    await client.query(
      `UPDATE appointments SET cashback_earned = $1 WHERE id = $2`,
      [cashbackAmount, appointmentId]
    );

    return cashbackAmount;
  } catch (err) {
    console.error('Cashback award error:', err.message);
    return 0;
  }
}



// ── Get customer cashback wallet ──────────────────────────────────────────────
router.get('/wallet/:customerId', authenticate, async (req, res) => {
  try {
    const [wallet, txns, settings] = await Promise.all([
      pool.query(
        `SELECT cw.*, c.name, c.phone
         FROM cashback_wallet cw
         JOIN customers c ON c.id = cw.customer_id
         WHERE cw.customer_id = $1`,
        [req.params.customerId]
      ),
      pool.query(
        `SELECT * FROM cashback_transactions
         WHERE customer_id = $1
         ORDER BY created_at DESC LIMIT 30`,
        [req.params.customerId]
      ),
      pool.query(
        `SELECT key, value FROM system_settings
         WHERE key IN ('cashback_enabled','cashback_percent','cashback_expiry_days')`
      )
    ]);

    const s = {};
    settings.rows.forEach(r => s[r.key] = r.value);

    res.json({
      wallet: wallet.rows[0] || { balance: 0, lifetime_earned: 0 },
      transactions: txns.rows,
      settings: s
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Lookup wallet by phone (for payment screen) ───────────────────────────────
router.get('/lookup/:phone', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.name, c.phone,
         COALESCE(cw.balance, 0) as cashback_balance,
         COALESCE(cw.lifetime_earned, 0) as lifetime_earned
       FROM customers c
       LEFT JOIN cashback_wallet cw ON c.id = cw.customer_id
       WHERE c.phone = $1`,
      [req.params.phone]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Redeem cashback at payment ────────────────────────────────────────────────
async function redeemCashback(client, appointmentId, customerId, redeemAmount, performedBy) {
  // Check balance
  const wallet = await client.query(
    'SELECT balance FROM cashback_wallet WHERE customer_id = $1',
    [customerId]
  );
  const available = parseFloat(wallet.rows[0]?.balance || 0);
  if (redeemAmount > available) throw new Error('Insufficient cashback balance');

  // Deduct from wallet
  await client.query(
    `UPDATE cashback_wallet 
     SET balance = balance - $1, updated_at = NOW()
     WHERE customer_id = $2`,
    [redeemAmount, customerId]
  );

  // Log
  await client.query(
    `INSERT INTO cashback_transactions
       (customer_id, appointment_id, type, amount, description)
     VALUES ($1, $2, 'redeemed', $3, $4)`,
    [customerId, appointmentId, -redeemAmount,
     `Cashback redeemed on appointment #${appointmentId}`]
  );

  // Update appointment
  await client.query(
    'UPDATE appointments SET cashback_redeemed = $1 WHERE id = $2',
    [redeemAmount, appointmentId]
  );

  return redeemAmount;
}



// ── Admin: get all cashback settings ─────────────────────────────────────────
router.get('/settings', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT key, value, description FROM system_settings
       WHERE key IN ('cashback_enabled','cashback_percent','cashback_expiry_days')`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Admin: update cashback settings ──────────────────────────────────────────
router.put('/settings', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { cashback_enabled, cashback_percent, cashback_expiry_days } = req.body;
    const updates = [
      ['cashback_enabled', cashback_enabled],
      ['cashback_percent', cashback_percent],
      ['cashback_expiry_days', cashback_expiry_days]
    ];
    for (const [key, value] of updates) {
      await pool.query(
        `INSERT INTO system_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, String(value)]
      );
    }
    res.json({ message: 'Cashback settings updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Admin: overview of all cashback wallets ───────────────────────────────────
router.get('/overview', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.name, c.phone,
         COALESCE(cw.balance, 0) as balance,
         COALESCE(cw.lifetime_earned, 0) as lifetime_earned,
         cw.updated_at
       FROM customers c
       LEFT JOIN cashback_wallet cw ON c.id = cw.customer_id
       WHERE cw.balance > 0
       ORDER BY cw.balance DESC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
module.exports.awardFirstVisitCashback = awardFirstVisitCashback;
module.exports.redeemCashback = redeemCashback;