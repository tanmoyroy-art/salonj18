const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

// Lookup customer by phone
router.get('/lookup/:phone', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customers WHERE phone = $1', [req.params.phone]);
    if (result.rows.length === 0) return res.status(404).json({ exists: false });
    res.json({ exists: true, customer: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all customers
router.get('/', authenticate, async (req, res) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT c.*, 
        COUNT(a.id) as total_appointments,
        MAX(a.appointment_date) as last_visit
      FROM customers c
      LEFT JOIN appointments a ON c.id = a.customer_id
      WHERE 1=1
    `;
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (c.name ILIKE $${params.length} OR c.phone ILIKE $${params.length})`;
    }
    query += ' GROUP BY c.id ORDER BY c.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create customer
router.post('/', authenticate, authorize('super_admin', 'receptionist'), async (req, res) => {
  try {
    const { name, phone, email, date_of_birth, address, notes } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });

    const result = await pool.query(
      'INSERT INTO customers (name, phone, email, date_of_birth, address, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, phone, email, date_of_birth || null, address, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Phone number already registered' });
    res.status(500).json({ error: err.message });
  }
});

// Update customer
router.put('/:id', authenticate, authorize('super_admin', 'receptionist'), async (req, res) => {
  try {
    const { name, email, date_of_birth, address, notes } = req.body;
    const result = await pool.query(
      'UPDATE customers SET name=$1, email=$2, date_of_birth=$3, address=$4, notes=$5, updated_at=NOW() WHERE id=$6 RETURNING *',
      [name, email, date_of_birth || null, address, notes, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get customer history
router.get('/:id/history', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, 
        spec.name as specialist_name,
        jsonb_agg(
          jsonb_build_object('service_name', s.name, 'price', aps.price, 'status', aps.status)
        ) FILTER (WHERE aps.id IS NOT NULL) as services
      FROM appointments a
      LEFT JOIN specialists spec ON a.specialist_id = spec.id
      LEFT JOIN appointment_services aps ON a.id = aps.appointment_id
      LEFT JOIN services s ON aps.service_id = s.id
      WHERE a.customer_id = $1
      GROUP BY a.id, spec.name
      ORDER BY a.appointment_date DESC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
