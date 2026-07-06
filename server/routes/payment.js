const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { pool } = require('../db');
const { awardPointsAfterPayment } = require('./loyalty');
const generateInvoice = require("../utils/invoiceGenerator");
const InvoiceService = require("../services/invoiceService");

// Lazy-load razorpay so server starts even if not installed yet
function getRazorpay() {
  try {
    const Razorpay = require('razorpay');
    return new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  } catch (e) {
    return null;
  }
}

// ── Create Razorpay order ─────────────────────────────────────────────────────
// Called from public booking after form submit when user picks "Pay Now"
router.post('/create-order', async (req, res) => {
  try {
    const razorpay = getRazorpay();
    if (!razorpay) return res.status(500).json({ error: 'Razorpay not installed. Run: cd server && npm install' });

    const { appointment_id, amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const amountPaise = Math.round(parseFloat(amount) * 100); // Razorpay uses paise

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `appt_${appointment_id}_${Date.now()}`,
      notes: { appointment_id: String(appointment_id) },
    });

    // Save order to DB
    await pool.query(
      `INSERT INTO payment_orders (appointment_id, razorpay_order_id, amount, currency, status)
       VALUES ($1, $2, $3, 'INR', 'created')
       ON CONFLICT (razorpay_order_id) DO NOTHING`,
      [appointment_id, order.id, amount]
    );

    res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('Razorpay create order error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Verify payment after Razorpay callback ────────────────────────────────────
router.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, appointment_id } = req.body;

    // Verify signature
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Invalid payment signature' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update payment order record
      await client.query(
        `UPDATE payment_orders
         SET razorpay_payment_id=$1, razorpay_signature=$2, status='paid', updated_at=NOW()
         WHERE razorpay_order_id=$3`,
        [razorpay_payment_id, razorpay_signature, razorpay_order_id]
      );

      // Get appointment details
      const apptRes = await client.query('SELECT * FROM appointments WHERE id=$1', [appointment_id]);
      if (!apptRes.rows.length) throw new Error('Appointment not found');
      const appt = apptRes.rows[0];

      const discount = parseFloat(appt.discount || 0);
      const offerDiscount = parseFloat(appt.offer_discount || 0);
      const pointsDiscount = parseFloat(appt.points_discount || 0);
      const membershipDiscount = parseFloat(appt.membership_discount || 0);
      const totalDiscount = discount + membershipDiscount + pointsDiscount + offerDiscount;
      const netPayable = Math.max(0, parseFloat(appt.total_amount) - totalDiscount);

      // Mark appointment as paid
      await client.query(
        `UPDATE appointments
         SET payment_status='paid', payment_method='razorpay', payment_type='online',
             amount_paid=$1, discount=$2, updated_at=NOW()
         WHERE id=$3`,
        [netPayable, membershipDiscount, appointment_id]
      );

      // Award loyalty points for online payment
      let pointsEarned = 0;
      try {
        pointsEarned = await awardPointsAfterPayment(client, parseInt(appointment_id), appt.customer_id, netPayable, null);
      } catch (pe) {
        console.warn('Points award skipped:', pe.message);
      }

      await client.query('COMMIT');

      res.json({ success: true, message: 'Payment verified and appointment confirmed', points_earned: pointsEarned });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally { client.release(); }
  } catch (err) {
    console.error('Razorpay verify error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Get payment status ────────────────────────────────────────────────────────
router.get('/status/:appointmentId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM payment_orders WHERE appointment_id=$1 ORDER BY created_at DESC LIMIT 1',
      [req.params.appointmentId]
    );
    res.json(result.rows[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/invoice/:appointmentId', async (req, res) => {
  try {
    const appointmentId = req.params.appointmentId;
    const invoiceData = await InvoiceService.getInvoiceData(appointmentId);
    const pdf = await generateInvoice(invoiceData);
      return res.json({pdf, invoiceData});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
