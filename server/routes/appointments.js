const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { awardPointsAfterPayment, redeemPoints } = require('./loyalty');
const { getActiveOffer } = require('./offers');

// Get appointments
router.get('/', authenticate, async (req, res) => {
  try {
    const { date, status, customer_id } = req.query;
    let query = `
      SELECT a.*,
        c.name as customer_name, c.phone as customer_phone,
        spec.name as specialist_name,
        mp.name as membership_plan_name,
        mp.tier as membership_tier,
        mp.discount_percent as membership_discount_percent,
        COALESCE(cp.total_points, 0) as customer_points,
        o.name as offer_name,
        o.discount_percent as offer_discount_percent,
        jsonb_agg(
          jsonb_build_object('service_id', s.id, 'service_name', s.name, 'price', aps.price, 'status', aps.status)
          ORDER BY aps.id
        ) FILTER (WHERE aps.id IS NOT NULL) as services
      FROM appointments a
      JOIN customers c ON a.customer_id = c.id
      LEFT JOIN specialists spec ON a.specialist_id = spec.id
      LEFT JOIN appointment_services aps ON a.id = aps.appointment_id
      LEFT JOIN services s ON aps.service_id = s.id
      LEFT JOIN customer_memberships cm ON a.membership_id = cm.id
      LEFT JOIN membership_plans mp ON cm.plan_id = mp.id
      LEFT JOIN customer_points cp ON c.id = cp.customer_id
      LEFT JOIN offers o ON a.offer_id = o.id
      WHERE 1=1
    `;
    const params = [];
    if (date)        { params.push(date);        query += ` AND DATE(a.appointment_date) = $${params.length}`; }
    if (status)      { params.push(status);      query += ` AND a.status = $${params.length}`; }
    if (customer_id) { params.push(customer_id); query += ` AND a.customer_id = $${params.length}`; }

    query += ' GROUP BY a.id, c.name, c.phone, spec.name, mp.name, mp.tier, mp.discount_percent, cp.total_points, o.name, o.discount_percent ORDER BY a.appointment_date DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create appointment — auto membership discount
router.post('/', authenticate, authorize('super_admin', 'receptionist'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { customer_id, specialist_id, appointment_date, services, notes } = req.body;

    let totalAmount = 0;
    const serviceRows = [];
    if (services && services.length > 0) {
      for (const svc of services) {
        const s = await client.query('SELECT * FROM services WHERE id = $1', [svc.service_id]);
        if (s.rows.length) { totalAmount += parseFloat(s.rows[0].price); serviceRows.push(s.rows[0]); }
      }
    }

    let membershipDiscount = 0;
    let membershipId = null;
    let membershipInfo = null;
    let offerDiscount = 0;
    let offerId = null;
    let offerInfo = null;
    const apptDate = appointment_date.split('T')[0];
    const serviceIds = serviceRows.map(s => s.id);

    // Check active offer first — offer takes priority over membership
    try {
      offerInfo = await getActiveOffer(client, apptDate, serviceIds);
      if (offerInfo) {
        offerDiscount = (totalAmount * parseFloat(offerInfo.discount_percent)) / 100;
        offerId = offerInfo.id;
      }
    } catch (_) {}

    // Only apply membership if NO offer is active
    if (!offerInfo) {
      try {
        const blackout = await client.query('SELECT id FROM membership_blackout_dates WHERE date = $1', [apptDate]);
        if (!blackout.rows.length) {
          const mem = await client.query(`
            SELECT cm.*, mp.discount_percent, mp.name as plan_name, mp.tier
            FROM customer_memberships cm
            JOIN membership_plans mp ON cm.plan_id = mp.id
            WHERE cm.customer_id=$1 AND cm.status='active' AND cm.end_date >= $2
            ORDER BY mp.discount_percent DESC LIMIT 1
          `, [customer_id, apptDate]);
          if (mem.rows.length) {
            membershipInfo = mem.rows[0];
            membershipDiscount = (totalAmount * parseFloat(mem.rows[0].discount_percent)) / 100;
            membershipId = mem.rows[0].id;
          }
        }
      } catch (_) {}
    }

    const appt = await client.query(
      `INSERT INTO appointments (customer_id, specialist_id, appointment_date, total_amount,
        membership_discount, membership_id, offer_id, offer_discount, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [customer_id, specialist_id || null, appointment_date, totalAmount,
       membershipDiscount, membershipId, offerId, offerDiscount, notes, req.user.id]
    );

    for (const svc of serviceRows) {
      await client.query(
        'INSERT INTO appointment_services (appointment_id, service_id, price) VALUES ($1,$2,$3)',
        [appt.rows[0].id, svc.id, svc.price]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({
      ...appt.rows[0],
      membership_plan_name: membershipInfo?.plan_name || null,
      membership_tier: membershipInfo?.tier || null,
      membership_discount_percent: membershipInfo?.discount_percent || 0,
      offer_name: offerInfo?.name || null,
      offer_discount_percent: offerInfo?.discount_percent || 0,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// Update appointment status
router.patch('/:id/status', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { status } = req.body;
    const appt = await client.query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
    if (!appt.rows.length) throw new Error('Appointment not found');

    await client.query('UPDATE appointments SET status=$1, updated_at=NOW() WHERE id=$2', [status, req.params.id]);

    if (status === 'completed') {
      const apptServices = await client.query(
        `SELECT aps.service_id FROM appointment_services aps WHERE aps.appointment_id=$1 AND aps.status != 'skipped'`,
        [req.params.id]
      );
      for (const svc of apptServices.rows) {
        const products = await client.query('SELECT * FROM service_products WHERE service_id=$1', [svc.service_id]);
        for (const prod of products.rows) {
          await client.query(
            'UPDATE products SET current_stock_ml=GREATEST(0, current_stock_ml-$1), updated_at=NOW() WHERE id=$2',
            [prod.quantity_ml, prod.product_id]
          );
          await client.query(
            `INSERT INTO stock_transactions (product_id, transaction_type, quantity_ml, notes, performed_by)
             VALUES ($1,'deduction',$2,$3,$4)`,
            [prod.product_id, prod.quantity_ml, `Used in appointment #${req.params.id}`, req.user.id]
          );
          await client.query(
            `INSERT INTO appointment_product_usage (appointment_id, product_id, quantity_used_ml)
             VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
            [req.params.id, prod.product_id, prod.quantity_ml]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.json({ message: `Appointment status updated to ${status}` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// Process payment — with optional points redemption + auto points award after
router.patch('/:id/payment', authenticate, authorize('super_admin', 'receptionist'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { payment_method, amount_paid, extra_discount, redeem_points } = req.body;

    const appt = await client.query('SELECT * FROM appointments WHERE id=$1', [req.params.id]);
    if (!appt.rows.length) throw new Error('Appointment not found');
    const a = appt.rows[0];

    const membershipDiscount = parseFloat(a.membership_discount || 0);
    const extraDiscount      = parseFloat(extra_discount || 0);
    let pointsDiscount       = 0;
    let pointsRedeemed       = 0;

    // Redeem points if requested
    if (redeem_points && parseFloat(redeem_points) > 0) {
      pointsRedeemed = parseFloat(redeem_points);
      pointsDiscount = await redeemPoints(client, a.id, a.customer_id, pointsRedeemed, req.user.id);
    }

    const totalDiscount = membershipDiscount + extraDiscount + pointsDiscount;
    const netPayable    = Math.max(0, parseFloat(a.total_amount) - totalDiscount);
    const paid          = parseFloat(amount_paid || 0);
    const paymentStatus = paid >= netPayable ? 'paid' : paid > 0 ? 'partial' : 'pending';

    await client.query(
      `UPDATE appointments
       SET payment_method=$1, amount_paid=$2, discount=$3, payment_status=$4, updated_at=NOW()
       WHERE id=$5`,
      [payment_method, paid, totalDiscount, paymentStatus, a.id]
    );

    // Award points ONLY when fully paid (on the actual amount paid, after all discounts)
    let pointsEarned = 0;
    if (paymentStatus === 'paid') {
      pointsEarned = await awardPointsAfterPayment(client, a.id, a.customer_id, paid, req.user.id);
    }

    await client.query('COMMIT');

    res.json({
      message: 'Payment processed',
      payment_status: paymentStatus,
      total_discount: totalDiscount,
      net_payable: netPayable,
      points_redeemed: pointsRedeemed,
      points_discount: pointsDiscount,
      points_earned: pointsEarned,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

module.exports = router;
