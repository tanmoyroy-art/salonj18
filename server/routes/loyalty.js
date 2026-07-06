const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getSettings(client) {
  const r = await (client || pool).query('SELECT key, value FROM system_settings');
  const s = {};
  r.rows.forEach(row => { s[row.key] = row.value; });
  return s;
}

async function ensureWallet(client, customerId) {
  await client.query(
    `INSERT INTO customer_points (customer_id, total_points, lifetime_points)
     VALUES ($1, 0, 0) ON CONFLICT (customer_id) DO NOTHING`,
    [customerId]
  );
}

// Calculate points earned for an amount based on membership tier
async function calcPointsEarned(client, customerId, amountPaid) {
  // Get active membership tier
  const mem = await client.query(`
    SELECT mp.points_per_100
    FROM customer_memberships cm
    JOIN membership_plans mp ON cm.plan_id = mp.id
    WHERE cm.customer_id = $1 AND cm.status = 'active' AND cm.end_date >= CURRENT_DATE
    ORDER BY mp.points_per_100 DESC LIMIT 1
  `, [customerId]);

  if (!mem.rows.length) return 0; // no membership = no points
  const rate = parseFloat(mem.rows[0].points_per_100 || 1);
  return Math.floor((amountPaid / 100) * rate * 100) / 100;
}

// ── System Settings ───────────────────────────────────────────────────────────

router.get('/settings', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM system_settings ORDER BY key');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/settings', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { settings } = req.body; // [{ key, value }]
    for (const s of settings) {
      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [s.key, s.value]
      );
    }
    res.json({ message: 'Settings updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Plan points config ────────────────────────────────────────────────────────

router.get('/plan-rates', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, tier, discount_percent, points_per_100, price, duration_days, color, benefits, is_active FROM membership_plans ORDER BY price ASC'
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/plan-rates/:id', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { points_per_100 } = req.body;
    const result = await pool.query(
      'UPDATE membership_plans SET points_per_100=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [points_per_100, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Customer Points ───────────────────────────────────────────────────────────

// Get customer points balance + history
router.get('/customer/:customerId', authenticate, async (req, res) => {
  try {
    const [wallet, txns, settings] = await Promise.all([
      pool.query(
        `SELECT cp.*, 
           c.name as customer_name, c.phone as customer_phone,
           mp.name as membership_name, mp.tier, mp.points_per_100, mp.color
         FROM customer_points cp
         JOIN customers c ON cp.customer_id = c.id
         LEFT JOIN customer_memberships cm ON c.id = cm.customer_id AND cm.status='active' AND cm.end_date >= CURRENT_DATE
         LEFT JOIN membership_plans mp ON cm.plan_id = mp.id
         WHERE cp.customer_id = $1`,
        [req.params.customerId]
      ),
      pool.query(
        `SELECT pt.*, u.name as performed_by_name, a.appointment_date
         FROM points_transactions pt
         LEFT JOIN users u ON pt.performed_by = u.id
         LEFT JOIN appointments a ON pt.appointment_id = a.id
         WHERE pt.customer_id = $1
         ORDER BY pt.created_at DESC LIMIT 50`,
        [req.params.customerId]
      ),
      getSettings()
    ]);

    res.json({
      wallet: wallet.rows[0] || { total_points: 0, lifetime_points: 0 },
      transactions: txns.rows,
      redemption_rate: parseFloat(settings.points_redemption_rate || 100),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Lookup customer points by phone (for payment screen)
router.get('/lookup/:phone', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.phone,
        COALESCE(cp.total_points, 0) as total_points,
        COALESCE(cp.lifetime_points, 0) as lifetime_points,
        mp.name as membership_name, mp.tier, mp.points_per_100, mp.color,
        cm.end_date as membership_end
      FROM customers c
      LEFT JOIN customer_points cp ON c.id = cp.customer_id
      LEFT JOIN customer_memberships cm ON c.id = cm.customer_id AND cm.status='active' AND cm.end_date >= CURRENT_DATE
      LEFT JOIN membership_plans mp ON cm.plan_id = mp.id
      WHERE c.phone = $1
    `, [req.params.phone]);

    if (!result.rows.length) return res.status(404).json({ error: 'Customer not found' });

    const settings = await getSettings();
    const row = result.rows[0];
    const pointsValue = parseFloat(row.total_points || 0) / parseFloat(settings.points_redemption_rate || 100);

    res.json({
      ...row,
      points_value_rupees: pointsValue.toFixed(2),
      redemption_rate: parseFloat(settings.points_redemption_rate || 100),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Add bonus points manually (admin)
router.post('/bonus', authenticate, authorize('super_admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { customer_id, points, description } = req.body;

    await ensureWallet(client, customer_id);
    await client.query(
      `UPDATE customer_points
       SET total_points = total_points + $1,
           lifetime_points = lifetime_points + $1,
           updated_at = NOW()
       WHERE customer_id = $2`,
      [points, customer_id]
    );
    await client.query(
      `INSERT INTO points_transactions (customer_id, transaction_type, points, description, performed_by)
       VALUES ($1, 'bonus', $2, $3, $4)`,
      [customer_id, points, description || 'Bonus points added by admin', req.user.id]
    );

    await client.query('COMMIT');
    res.json({ message: `${points} bonus points added` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// Get all customers with points (admin overview)
router.get('/overview', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.phone,
        COALESCE(cp.total_points, 0) as total_points,
        COALESCE(cp.lifetime_points, 0) as lifetime_points,
        mp.name as membership_name, mp.tier, mp.color, mp.points_per_100
      FROM customers c
      LEFT JOIN customer_points cp ON c.id = cp.customer_id
      LEFT JOIN customer_memberships cm ON c.id = cm.customer_id AND cm.status='active' AND cm.end_date >= CURRENT_DATE
      LEFT JOIN membership_plans mp ON cm.plan_id = mp.id
      WHERE cp.total_points > 0 OR cm.id IS NOT NULL
      ORDER BY COALESCE(cp.total_points, 0) DESC
    `);
    const settings = await getSettings();
    res.json({ customers: result.rows, settings });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Core: Award points after payment (called from appointments route) ─────────
// Exported so appointments.js can call it
async function awardPointsAfterPayment(client, appointmentId, customerId, amountPaid, performedBy) {
  try {
    const pointsEarned = await calcPointsEarned(client, customerId, amountPaid);
    if (pointsEarned <= 0) return 0;

    await ensureWallet(client, customerId);

    await client.query(
      `UPDATE customer_points
       SET total_points = total_points + $1,
           lifetime_points = lifetime_points + $1,
           updated_at = NOW()
       WHERE customer_id = $2`,
      [pointsEarned, customerId]
    );

    await client.query(
      `UPDATE appointments SET points_earned = $1 WHERE id = $2`,
      [pointsEarned, appointmentId]
    );

    await client.query(
      `INSERT INTO points_transactions
         (customer_id, appointment_id, transaction_type, points, amount_spent, description, performed_by)
       VALUES ($1, $2, 'earned', $3, $4, $5, $6)`,
      [customerId, appointmentId, pointsEarned, amountPaid,
       `Earned from appointment #${appointmentId}`, performedBy]
    );

    return pointsEarned;
  } catch (err) {
    console.error('Points award error:', err.message);
    return 0;
  }
}

// ── Core: Redeem points (called from appointments payment) ────────────────────
async function redeemPoints(client, appointmentId, customerId, pointsToRedeem, performedBy) {
  try {
    const settings = await getSettings(client);
    const rate = parseFloat(settings.points_redemption_rate || 100);
    const discountRupees = pointsToRedeem / rate;

    // Verify customer has enough points
    const wallet = await client.query(
      'SELECT total_points FROM customer_points WHERE customer_id = $1',
      [customerId]
    );
    const available = parseFloat(wallet.rows[0]?.total_points || 0);
    if (available < pointsToRedeem) throw new Error('Insufficient points');

    // Deduct from wallet
    await client.query(
      `UPDATE customer_points
       SET total_points = total_points - $1, updated_at = NOW()
       WHERE customer_id = $2`,
      [pointsToRedeem, customerId]
    );

    // Record on appointment
    await client.query(
      `UPDATE appointments SET points_redeemed = $1, points_discount = $2 WHERE id = $3`,
      [pointsToRedeem, discountRupees, appointmentId]
    );

    // Log transaction
    await client.query(
      `INSERT INTO points_transactions
         (customer_id, appointment_id, transaction_type, points, description, performed_by)
       VALUES ($1, $2, 'redeemed', $3, $4, $5)`,
      [customerId, appointmentId, -pointsToRedeem,
       `Redeemed ${pointsToRedeem} pts = ₹${discountRupees.toFixed(2)} off appointment #${appointmentId}`,
       performedBy]
    );

    return discountRupees;
  } catch (err) {
    throw err;
  }
}

module.exports = router;
module.exports.awardPointsAfterPayment = awardPointsAfterPayment;
module.exports.redeemPoints = redeemPoints;
