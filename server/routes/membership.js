const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { generateMembershipId } = require('../utils/membershipId');
const { awardMembershipPoints } = require('./loyalty');

// ── Plans ────────────────────────────────────────────────────────────────────

// Get all plans (public — needed for booking page)
router.get('/plans', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM membership_plans WHERE is_active = true ORDER BY price ASC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update plan (admin only)
router.put('/plans/:id', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { name, discount_percent, price, duration_days, color, benefits, is_active } = req.body;
    const result = await pool.query(
      `UPDATE membership_plans SET name=$1, discount_percent=$2, price=$3, duration_days=$4,
       color=$5, benefits=$6, is_active=$7, updated_at=NOW() WHERE id=$8 RETURNING *`,
      [name, discount_percent, price, duration_days, color, benefits, is_active, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Customer Memberships ─────────────────────────────────────────────────────

// Get membership for a customer
router.get('/customer/:customerId', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cm.*, mp.name as plan_name, mp.tier, mp.discount_percent, mp.color, mp.benefits
      FROM customer_memberships cm
      JOIN membership_plans mp ON cm.plan_id = mp.id
      WHERE cm.customer_id = $1 AND cm.status = 'active' AND cm.end_date >= CURRENT_DATE
      ORDER BY cm.end_date DESC LIMIT 1
    `, [req.params.customerId]);
    res.json(result.rows[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get all memberships (admin)
router.get('/all', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cm.*, mp.name as plan_name, mp.tier, mp.discount_percent, mp.color,
             c.name as customer_name, c.phone as customer_phone, c.membership_card_id
      FROM customer_memberships cm
      JOIN membership_plans mp ON cm.plan_id = mp.id
      JOIN customers c ON cm.customer_id = c.id
      ORDER BY cm.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// router.post('/assign', authenticate, authorize('super_admin', 'receptionist'), async (req, res) => {
//     const client = await pool.connect();
//     try {
//       await client.query('BEGIN');
//       const { customer_id, customer, plan_id, amount_paid, start_date } = req.body;
//       let customerId = customer_id;
//       if (!customerId) {
//         if (!customer || !customer.phone || !customer.name) {
//           throw new Error('Customer name and phone are required');
//         }
//         const existing = await client.query(`SELECT id, membership_card_id FROM customers WHERE phone = $1`, [customer.phone]);
//         if (existing.rows.length) {
//           customerId = existing.rows[0].id;
//           if (!existing.rows[0].membership_card_id) {
//             const memberId = await generateMembershipId(client);
//             await client.query(`UPDATE customers SET membership_card_id = $1 WHERE id = $2`, [memberId, customerId]);
//           }
//         } else {
//           const memberId = await generateMembershipId(client);
//           const newCustomer = await client.query(` INSERT INTO customers
//             (name, phone, email, whatsapp_number, date_of_birth, membership_card_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
//             [customer.name, customer.phone, customer.email || null, customer.whatsapp_number, customer.date_of_birth, memberId]
//           );
//           customerId = newCustomer.rows[0].id;
//         }
//       }
//       const plan = await client.query(`SELECT * FROM membership_plans WHERE id=$1`, [plan_id]);
//       if (!plan.rows.length) {
//         throw new Error('Plan not found');
//       }
//       const sd = start_date ? new Date(start_date) : new Date();
//       const ed = new Date(sd);
//       ed.setDate(ed.getDate() + plan.rows[0].duration_days);
//       await client.query(`UPDATE customer_memberships SET status='cancelled' WHERE customer_id=$1 AND status='active'`, [customerId]);
//       const membership = await client.query(`
//         INSERT INTO customer_memberships
//         (customer_id, plan_id, start_date, end_date, purchased_by, amount_paid) VALUES ($1,$2,$3,$4,$5,$6)
//         RETURNING *`,
//         [customerId, plan_id, sd.toISOString().split('T')[0], ed.toISOString().split('T')[0], req.user.id, amount_paid || plan.rows[0].price]
//       );
//       const customerInfo = await client.query(`SELECT id, name, phone, email, membership_card_id FROM customers WHERE id=$1`, [customerId]);
//       await client.query('COMMIT');
//       res.status(201).json({
//         success: true,
//         membership: membership.rows[0],
//         customer: customerInfo.rows[0]
//       });
//     } catch (err) {
//       await client.query('ROLLBACK');
//       res.status(500).json({
//         error: err.message
//       });
//     } finally {
//       client.release();
//     }
//   }
// );

// Cancel membership

// Assign now creates a PENDING membership — nothing goes active/earns points until payment is confirmed
router.post('/assign', authenticate, authorize('super_admin', 'receptionist'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { customer_id, customer, plan_id, amount_paid, start_date, payment_method } = req.body;

    let customerId = customer_id;
    if (!customerId) {
      if (!customer || !customer.phone || !customer.name) {
        throw new Error('Customer name and phone are required');
      }
      const existing = await client.query(`SELECT id, membership_card_id FROM customers WHERE phone = $1`, [customer.phone]);
      if (existing.rows.length) {
        customerId = existing.rows[0].id;
        if (!existing.rows[0].membership_card_id) {
          const memberId = await generateMembershipId(client);
          await client.query(`UPDATE customers SET membership_card_id = $1 WHERE id = $2`, [memberId, customerId]);
        }
      } else {
        const memberId = await generateMembershipId(client);
        const newCustomer = await client.query(`INSERT INTO customers
          (name, phone, email, whatsapp_number, date_of_birth, membership_card_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [customer.name, customer.phone, customer.email || null, customer.whatsapp_number, customer.date_of_birth, memberId]
        );
        customerId = newCustomer.rows[0].id;
      }
    }

    const plan = await client.query(`SELECT * FROM membership_plans WHERE id=$1`, [plan_id]);
    if (!plan.rows.length) throw new Error('Plan not found');

    const sd = start_date ? new Date(start_date) : new Date();
    const ed = new Date(sd);
    ed.setDate(ed.getDate() + plan.rows[0].duration_days);
    const finalAmount = amount_paid || plan.rows[0].price;

    // Note: existing active membership is NOT cancelled yet — only on confirm-payment,
    // so a customer keeps their current membership until the new one is actually paid for.
    const membership = await client.query(`
      INSERT INTO customer_memberships
        (customer_id, plan_id, start_date, end_date, purchased_by, amount_paid, status, payment_status, payment_method)
      VALUES ($1,$2,$3,$4,$5,$6,'pending','pending',$7)
      RETURNING *`,
      [customerId, plan_id, sd.toISOString().split('T')[0], ed.toISOString().split('T')[0], req.user.id, finalAmount, payment_method || 'upi']
    );

    const customerInfo = await client.query(`SELECT id, name, phone, email, membership_card_id FROM customers WHERE id=$1`, [customerId]);
    await client.query('COMMIT');
    res.status(201).json({ success: true, membership: membership.rows[0], customer: customerInfo.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// UPI string for a specific pending membership
router.get('/upi-string/:membershipId', authenticate, async (req, res) => {
  try {
    const m = await pool.query('SELECT amount_paid FROM customer_memberships WHERE id=$1', [req.params.membershipId]);
    if (!m.rows.length) return res.status(404).json({ error: 'Membership not found' });

    const upiId   = process.env.UPI_ID   || 'jyotiejagwani@okhdfcbank';
    const upiName = process.env.UPI_NAME || 'J Eighteen Beauty Salon Academy';
    const amount  = m.rows[0].amount_paid;
    const note    = `Membership_${req.params.membershipId}`;

    const upiString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
    res.json({ upi_string: upiString, upi_id: upiId, upi_name: upiName, amount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Staff confirms payment was actually received -> activates membership + awards points
router.post('/:id/confirm-payment', authenticate, authorize('super_admin', 'receptionist'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT * FROM customer_memberships WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!existing.rows.length) throw new Error('Membership not found');
    const membership = existing.rows[0];

    if (membership.payment_status === 'paid') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Payment already confirmed for this membership' });
    }

    await client.query(
      `UPDATE customer_memberships SET status='cancelled' WHERE customer_id=$1 AND status='active' AND id != $2`,
      [membership.customer_id, req.params.id]
    );

    const updated = await client.query(
      `UPDATE customer_memberships SET status='active', payment_status='paid' WHERE id=$1 RETURNING *`,
      [req.params.id]
    );

    const pointsEarned = await awardMembershipPoints(
      client, membership.customer_id, membership.plan_id, parseFloat(membership.amount_paid), req.user.id
    );

    const customerInfo = await client.query('SELECT id, name, phone, membership_card_id FROM customers WHERE id=$1', [membership.customer_id]);

    await client.query('COMMIT');
    res.json({ success: true, membership: updated.rows[0], customer: customerInfo.rows[0], points_earned: pointsEarned });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// Optional: queue view for staff to see who's still awaiting payment confirmation
router.get('/pending', authenticate, authorize('super_admin', 'receptionist'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cm.*, mp.name as plan_name, mp.tier, c.name as customer_name, c.phone as customer_phone
      FROM customer_memberships cm
      JOIN membership_plans mp ON cm.plan_id = mp.id
      JOIN customers c ON cm.customer_id = c.id
      WHERE cm.payment_status = 'pending'
      ORDER BY cm.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


router.patch('/:id/cancel', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    await pool.query(`UPDATE customer_memberships SET status='cancelled' WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Membership cancelled' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Blackout Dates ────────────────────────────────────────────────────────────

// Get blackout dates (public)
router.get('/blackout', async (req, res) => {
  try {
    const { year, month } = req.query;
    let query = 'SELECT * FROM membership_blackout_dates';
    const params = [];
    if (year && month) {
      params.push(year, month);
      query += ` WHERE EXTRACT(YEAR FROM date)=$1 AND EXTRACT(MONTH FROM date)=$2`;
    }
    query += ' ORDER BY date ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Add blackout date
router.post('/blackout', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { date, reason } = req.body;
    const result = await pool.query(
      'INSERT INTO membership_blackout_dates (date, reason, created_by) VALUES ($1, $2, $3) RETURNING *',
      [date, reason, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Date already marked as blackout' });
    res.status(500).json({ error: err.message });
  }
});

// Remove blackout date
router.delete('/blackout/:id', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM membership_blackout_dates WHERE id=$1', [req.params.id]);
    res.json({ message: 'Blackout date removed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Check discount eligibility for a date ────────────────────────────────────
router.get('/check-discount', authenticate, async (req, res) => {
  try {
    const { customer_id, date } = req.query;
    const checkDate = date || new Date().toISOString().split('T')[0];

    // Check blackout
    const blackout = await pool.query(
      'SELECT * FROM membership_blackout_dates WHERE date=$1', [checkDate]
    );
    if (blackout.rows.length > 0) {
      return res.json({ eligible: false, reason: `Blackout: ${blackout.rows[0].reason || 'Special offer day'}` });
    }

    // Check active membership
    const membership = await pool.query(`
      SELECT cm.*, mp.discount_percent, mp.name as plan_name, mp.color, mp.tier
      FROM customer_memberships cm
      JOIN membership_plans mp ON cm.plan_id = mp.id
      WHERE cm.customer_id=$1 AND cm.status='active' AND cm.end_date >= $2
      LIMIT 1
    `, [customer_id, checkDate]);

    if (!membership.rows.length) {
      return res.json({ eligible: false, reason: 'No active membership' });
    }

    res.json({ eligible: true, membership: membership.rows[0], discount_percent: membership.rows[0].discount_percent });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/card/:customerId', authenticate, async (req, res) => {
    try {

        const result = await pool.query(`
            SELECT
                c.id,
                c.name,
                c.phone,
                c.email,
                c.date_of_birth,
                c.membership_card_id,

                cm.start_date,
                cm.end_date,
                cm.status,

                mp.name AS plan_name,
                mp.tier,
                mp.discount_percent,
                mp.color

            FROM customers c
            JOIN customer_memberships cm
                ON cm.customer_id = c.id
            JOIN membership_plans mp
                ON mp.id = cm.plan_id

            WHERE
                c.id = $1
                AND cm.status='active'

            LIMIT 1
        `,[req.params.customerId]);

        if(result.rows.length===0){
            return res.status(404).json({
                error:"Membership not found"
            });
        }

        res.json(result.rows[0]);

    } catch(err){
        res.status(500).json({
            error:err.message
        });
    }
});

module.exports = router;
