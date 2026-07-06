const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

// Daily sales report
router.get('/daily', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const [sales, byService, byPayment] = await Promise.all([
      pool.query(`
        SELECT 
          COUNT(*) as total_appointments,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
          SUM(CASE WHEN payment_status = 'paid' THEN amount_paid ELSE 0 END) as total_revenue,
          SUM(CASE WHEN payment_status = 'paid' THEN total_amount - discount ELSE 0 END) as total_billed,
          SUM(CASE WHEN payment_status = 'pending' AND status = 'completed' THEN total_amount - discount ELSE 0 END) as pending_payments
        FROM appointments
        WHERE DATE(appointment_date) = $1
      `, [targetDate]),

      pool.query(`
        SELECT s.name as service_name, COUNT(*) as count, SUM(aps.price) as revenue
        FROM appointment_services aps
        JOIN appointments a ON aps.appointment_id = a.id
        JOIN services s ON aps.service_id = s.id
        WHERE DATE(a.appointment_date) = $1 AND a.status = 'completed'
        GROUP BY s.id, s.name
        ORDER BY revenue DESC
      `, [targetDate]),

      pool.query(`
        SELECT payment_method, COUNT(*) as count, SUM(amount_paid) as total
        FROM appointments
        WHERE DATE(appointment_date) = $1 AND payment_status IN ('paid', 'partial')
        GROUP BY payment_method
      `, [targetDate])
    ]);

    res.json({
      date: targetDate,
      summary: sales.rows[0],
      by_service: byService.rows,
      by_payment_method: byPayment.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sales range report
router.get('/sales', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { from, to, period } = req.query;
    let fromDate = from;
    let toDate = to || new Date().toISOString().split('T')[0];

    if (period === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      fromDate = d.toISOString().split('T')[0];
    } else if (period === 'month') {
      const d = new Date();
      d.setDate(1);
      fromDate = d.toISOString().split('T')[0];
    } else if (period === 'year') {
      fromDate = new Date().getFullYear() + '-01-01';
    }

    const result = await pool.query(`
      SELECT 
        DATE(appointment_date) as date,
        COUNT(*) as appointments,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        SUM(CASE WHEN payment_status IN ('paid','partial') THEN amount_paid ELSE 0 END) as revenue
      FROM appointments
      WHERE DATE(appointment_date) BETWEEN $1 AND $2
      GROUP BY DATE(appointment_date)
      ORDER BY date
    `, [fromDate, toDate]);

    const totals = await pool.query(`
      SELECT 
        COUNT(*) as total_appointments,
        SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as total_completed,
        SUM(CASE WHEN payment_status IN ('paid','partial') THEN amount_paid ELSE 0 END) as total_revenue
      FROM appointments
      WHERE DATE(appointment_date) BETWEEN $1 AND $2
    `, [fromDate, toDate]);

    res.json({ daily: result.rows, totals: totals.rows[0], from: fromDate, to: toDate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Customer analytics
router.get('/customers/:id', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const customerId = req.params.id;

    const [customer, visits, services, spending] = await Promise.all([
      pool.query('SELECT * FROM customers WHERE id = $1', [customerId]),
      
      pool.query(`
        SELECT 
          COUNT(*) as total_visits,
          COUNT(CASE WHEN DATE(appointment_date) >= NOW() - INTERVAL '7 days' THEN 1 END) as visits_week,
          COUNT(CASE WHEN DATE(appointment_date) >= NOW() - INTERVAL '30 days' THEN 1 END) as visits_month,
          COUNT(CASE WHEN DATE(appointment_date) >= NOW() - INTERVAL '365 days' THEN 1 END) as visits_year,
          MAX(appointment_date) as last_visit,
          MIN(appointment_date) as first_visit,
          SUM(amount_paid) as total_spent
        FROM appointments
        WHERE customer_id = $1 AND status = 'completed'
      `, [customerId]),

      pool.query(`
        SELECT s.name, COUNT(*) as times_taken, SUM(aps.price) as total_spent
        FROM appointment_services aps
        JOIN appointments a ON aps.appointment_id = a.id
        JOIN services s ON aps.service_id = s.id
        WHERE a.customer_id = $1 AND a.status = 'completed'
        GROUP BY s.id, s.name
        ORDER BY times_taken DESC
      `, [customerId]),

      pool.query(`
        SELECT 
          TO_CHAR(DATE_TRUNC('month', appointment_date), 'YYYY-MM') as month,
          COUNT(*) as visits,
          SUM(amount_paid) as spent
        FROM appointments
        WHERE customer_id = $1 AND status = 'completed'
        GROUP BY DATE_TRUNC('month', appointment_date)
        ORDER BY month DESC
        LIMIT 12
      `, [customerId])
    ]);

    if (customer.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });

    res.json({
      customer: customer.rows[0],
      visit_stats: visits.rows[0],
      favorite_services: services.rows,
      monthly_trend: spending.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stock overview
router.get('/stock', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, pc.name as category_name,
        CASE WHEN p.unit_size_per_tube > 0 THEN ROUND(p.current_stock_ml / p.unit_size_per_tube, 2) ELSE 0 END as containers,
        CASE WHEN p.current_stock_ml <= p.reorder_level_ml THEN true ELSE false END as low_stock,
        COALESCE(usage.last_30_days_ml, 0) as usage_30_days
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      LEFT JOIN (
        SELECT product_id, SUM(quantity_ml) as last_30_days_ml
        FROM stock_transactions
        WHERE transaction_type = 'deduction' AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY product_id
      ) usage ON p.id = usage.product_id
      WHERE p.is_active = true
      ORDER BY p.current_stock_ml ASC
    `);

    const summary = {
      total_products: result.rows.length,
      low_stock_count: result.rows.filter(p => p.low_stock).length,
      out_of_stock: result.rows.filter(p => p.current_stock_ml <= 0).length
    };

    res.json({ products: result.rows, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Top customers
router.get('/top-customers', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { period } = req.query;
    let interval = 'INTERVAL \'30 days\'';
    if (period === 'week') interval = 'INTERVAL \'7 days\'';
    if (period === 'year') interval = 'INTERVAL \'365 days\'';

    const result = await pool.query(`
      SELECT c.id, c.name, c.phone, 
        COUNT(a.id) as visits, 
        SUM(a.amount_paid) as total_spent,
        MAX(a.appointment_date) as last_visit
      FROM customers c
      JOIN appointments a ON c.id = a.customer_id
      WHERE a.status = 'completed' AND a.appointment_date >= NOW() - ${interval}
      GROUP BY c.id, c.name, c.phone
      ORDER BY total_spent DESC
      LIMIT 10
    `);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
