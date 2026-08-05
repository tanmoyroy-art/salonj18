const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Public: get all active services with media
router.get('/services', async (req, res) => {
  try {
    // Ensure service_media exists before querying
    await pool.query(`
      CREATE TABLE IF NOT EXISTS service_media (
        id SERIAL PRIMARY KEY,
        service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255),
        file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('image', 'video')),
        mime_type VARCHAR(100),
        file_size INTEGER,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const result = await pool.query(`
      SELECT
        s.id, s.name, s.description, s.duration_minutes, s.category_name, s.price,
        jsonb_agg(DISTINCT
          jsonb_build_object('product_name', p.name, 'quantity_ml', sp.quantity_ml, 'unit_type', p.unit_type)
        ) FILTER (WHERE sp.id IS NOT NULL) as products_used,
        jsonb_agg(DISTINCT
          jsonb_build_object('id', sm.id, 'file_name', sm.file_name, 'file_type', sm.file_type, 'sort_order', sm.sort_order)
        ) FILTER (WHERE sm.id IS NOT NULL) as media
      FROM services s
      LEFT JOIN service_products sp ON s.id = sp.service_id
      LEFT JOIN products p ON sp.product_id = p.id
      LEFT JOIN service_media sm ON s.id = sm.service_id
      WHERE s.is_active = true
      GROUP BY s.id, s.name, s.description, s.duration_minutes, s.price
      ORDER BY s.name
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Public: get specialists
router.get('/specialists', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, specialization FROM specialists WHERE is_active=true ORDER BY name'
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Public: get membership plans
router.get('/membership-plans', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, tier, discount_percent, price, duration_days, color, benefits, points_per_100
       FROM membership_plans WHERE is_active=true ORDER BY price ASC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Public: get blackout dates
router.get('/blackout-dates', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT date, reason FROM membership_blackout_dates ORDER BY date ASC'
    );
    res.json(result.rows.map(r => ({
      date: r.date.toISOString().split('T')[0],
      reason: r.reason
    })));
  } catch (err) {
    // If table doesn't exist yet return empty
    if (err.message.includes('membership_blackout_dates')) return res.json([]);
    res.status(500).json({ error: err.message });
  }
});

// Public: lookup customer by phone
router.get('/customer-lookup/:phone', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*,
        cm.id as membership_id, mp.name as membership_name,
        mp.tier, mp.discount_percent, mp.color, cm.end_date as membership_end,
        COALESCE(cp.total_points, 0) as total_points
      FROM customers c
      LEFT JOIN customer_memberships cm
        ON c.id = cm.customer_id AND cm.status='active' AND cm.end_date >= CURRENT_DATE
      LEFT JOIN membership_plans mp ON cm.plan_id = mp.id
      LEFT JOIN customer_points cp ON c.id = cp.customer_id
      WHERE c.phone = $1
      LIMIT 1
    `, [req.params.phone]);

    if (!result.rows.length) return res.status(404).json({ exists: false });
    res.json({ exists: true, customer: result.rows[0] });
  } catch (err) {
    // Fallback without membership if tables missing
    try {
      const r2 = await pool.query('SELECT * FROM customers WHERE phone=$1', [req.params.phone]);
      if (!r2.rows.length) return res.status(404).json({ exists: false });
      res.json({ exists: true, customer: r2.rows[0] });
    } catch (e2) { res.status(500).json({ error: e2.message }); }
  }
});

// Public: get booked slots for a specialist on a date
router.get('/booked-slots', async (req, res) => {
  try {
    const { specialist_id, date } = req.query;
    if (!date) return res.json([]);

    let query = `
      SELECT a.appointment_date,
        COALESCE(SUM(s.duration_minutes), 60) as total_duration
      FROM appointments a
      JOIN appointment_services aps ON a.id = aps.appointment_id
      JOIN services s ON aps.service_id = s.id
      WHERE DATE(a.appointment_date) = $1
        AND a.status NOT IN ('cancelled')
    `;
    const params = [date];

    if (specialist_id && specialist_id !== '' && specialist_id !== 'any') {
      params.push(specialist_id);
      query += ` AND a.specialist_id = $${params.length}`;
    }

    query += ' GROUP BY a.id, a.appointment_date';
    const result = await pool.query(query, params);

    const bookedSlots = result.rows.map(row => {
      const start = new Date(row.appointment_date);
      const end = new Date(start.getTime() + parseInt(row.total_duration) * 60000);
      return {
        start: start.toTimeString().slice(0, 5),
        end: end.toTimeString().slice(0, 5),
      };
    });

    res.json(bookedSlots);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Public: submit a booking
router.post('/book', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { customer, services, specialist_id, appointment_date, notes, apply_membership, membership_plan_id } = req.body;

    // Upsert customer
    let customerId;
    const existing = await client.query('SELECT id FROM customers WHERE phone=$1', [customer.phone]);
    if (existing.rows.length > 0) {
      customerId = existing.rows[0].id;
      await client.query(
        'UPDATE customers SET name=$1, email=$2, whatsapp_number=$3, updated_at=NOW() WHERE id=$4',
        [customer.name, customer.email || null, customer.whatsapp_number || null, customerId]
      );
    } else {
      const newC = await client.query(
        'INSERT INTO customers (name, phone, email, date_of_birth, whatsapp_number) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [customer.name, customer.phone, customer.email || null, customer.date_of_birth || null, customer.whatsapp_number || null]
      );
      customerId = newC.rows[0].id;
    }

    // Calculate total
    let totalAmount = 0;
    const serviceDetails = [];
    for (const svcId of services) {
      const s = await client.query('SELECT * FROM services WHERE id=$1', [svcId]);
      if (s.rows.length) {
        totalAmount += parseFloat(s.rows[0].price);
        serviceDetails.push(s.rows[0]);
      }
    }

    // Determine discount: offer takes priority over membership (one discount at a time)
    let membershipDiscount = 0;
    let membershipId = null;
    let offerDiscount = 0;
    let offerId = null;
    let membershipPurchaseId = null;
    let membershipCost = 0;
    
    const checkDate = appointment_date.split('T')[0];
    const serviceIds = serviceDetails.map(s => s.id);

    // Check active offer first
    try {
      const offerRes = await client.query(`
        SELECT o.* FROM offers o
        JOIN offer_services os2 ON o.id = os2.offer_id
        WHERE o.is_active = true
          AND $1::date BETWEEN o.start_date AND o.end_date
          AND os2.service_id = ANY($2::int[])
        GROUP BY o.id ORDER BY o.discount_percent DESC LIMIT 1
      `, [checkDate, serviceIds]);
      if (offerRes.rows.length) {
        offerDiscount = (totalAmount * parseFloat(offerRes.rows[0].discount_percent)) / 100;
        offerId = offerRes.rows[0].id;
      }
    } catch (_) {}

    // Apply membership only if no offer is active
    if (!offerId && apply_membership) {
      try {
        const blackout = await client.query(
          'SELECT id FROM membership_blackout_dates WHERE date=$1', [checkDate]
        );
        if (!blackout.rows.length) {
          // Check if customer already has active membership
          const mem = await client.query(`
            SELECT cm.*, mp.discount_percent FROM customer_memberships cm
            JOIN membership_plans mp ON cm.plan_id = mp.id
            WHERE cm.customer_id=$1 AND cm.status='active' AND cm.end_date >= $2 LIMIT 1
          `, [customerId, checkDate]);
          if (mem.rows.length) {
            // Existing member — apply discount
            membershipDiscount = (totalAmount * mem.rows[0].discount_percent) / 100;
            membershipId = mem.rows[0].id;
          } else if (membership_plan_id) {
            // New customer buying membership — add to cost, apply discount
            const plan = await client.query('SELECT * FROM membership_plans WHERE id=$1', [membership_plan_id]);
            if (plan.rows.length) {
              membershipCost = parseFloat(plan.rows[0].price);
              membershipDiscount = (totalAmount * plan.rows[0].discount_percent) / 100;
              
              // Create PENDING membership for new customer
              const startDate = new Date();
              const endDate = new Date(startDate);
              endDate.setDate(endDate.getDate() + plan.rows[0].duration_days);
              
              const memRes = await client.query(`
                INSERT INTO customer_memberships
                  (customer_id, plan_id, start_date, end_date, amount_paid, status, payment_status)
                VALUES ($1, $2, $3, $4, $5, 'pending', 'pending')
                RETURNING id
              `, [customerId, membership_plan_id, 
                  startDate.toISOString().split('T')[0], 
                  endDate.toISOString().split('T')[0], 
                  membershipCost]);
              
              membershipPurchaseId = memRes.rows[0].id;
            }
          }
        }
      } catch (_) {}
    }

    const totalDiscount = offerDiscount + membershipDiscount;
    const payable = totalAmount - totalDiscount + membershipCost;

    // Create appointment
    const appt = await client.query(
      `INSERT INTO appointments
         (customer_id, specialist_id, appointment_date, total_amount,
          membership_discount, membership_id, offer_id, offer_discount, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [customerId, specialist_id || null, appointment_date,
       totalAmount, membershipDiscount, membershipId, offerId, offerDiscount, notes || null]
    );

    // Add services
    for (const svc of serviceDetails) {
      await client.query(
        'INSERT INTO appointment_services (appointment_id, service_id, price) VALUES ($1,$2,$3)',
        [appt.rows[0].id, svc.id, svc.price]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      appointment_id: appt.rows[0].id,
      total: totalAmount,
      membership_discount: membershipDiscount,
      membership_purchase_id: membershipPurchaseId,
      membership_cost: membershipCost,
      offer_discount: offerDiscount,
      offer_id: offerId,
      payable: payable,
      message: 'Appointment booked successfully!'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// UPI: submit UTR after customer pays
router.post('/upi-submit', async (req, res) => {
  try {
    const { appointment_id, amount, utr_number } = req.body;
    if (!utr_number || utr_number.length < 12)
      return res.status(400).json({ error: 'Enter a valid 12-digit UTR number' });

    await pool.query(
      `INSERT INTO upi_payments (appointment_id, amount, utr_number)
       VALUES ($1, $2, $3)`,
      [appointment_id, amount, utr_number]
    );

    await pool.query(
      `UPDATE appointments 
       SET payment_status='pending_verification', upi_utr=$1, payment_type='online', updated_at=NOW()
       WHERE id=$2`,
      [utr_number, appointment_id]
    );

    res.json({ success: true, message: 'Payment submitted for verification' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// UPI: get UPI string for QR/intent (public)
router.get('/upi-string/:appointmentId/:amount', async (req, res) => {
  try {
    const { appointmentId, amount } = req.params;
    const upiId   = process.env.UPI_ID   || 'jyotiejagwani@okhdfcbank';
    const upiName = process.env.UPI_NAME || 'J Eighteen Beauty Salon Academy';
    const note    = `Appt_${appointmentId}`;

    const upiString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
    res.json({ upi_string: upiString, upi_id: upiId, upi_name: upiName });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
