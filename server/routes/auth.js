const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'salon_secret_key',
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all users (super admin only)
router.get('/users', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, phone, date_of_birth, is_active, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create user (super admin only)
router.post('/users', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { name, email, password, role, phone, date_of_birth } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ error: 'All fields required' });
    if (!['receptionist', 'stockist', 'super_admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role, phone, date_of_birth) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, phone, date_of_birth',
      [name, email, hashedPassword, role, phone, date_of_birth || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// Toggle user active status
router.patch('/users/:id/toggle', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE users SET is_active = NOT is_active WHERE id = $1 RETURNING id, name, is_active',
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Change password
router.patch('/users/:id/password', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.params.id]);
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
