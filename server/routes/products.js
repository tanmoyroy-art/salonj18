const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

// Get all products
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, pc.name as category_name,
        CASE 
          WHEN p.unit_size_per_tube > 0 THEN ROUND(p.current_stock_ml / p.unit_size_per_tube, 2)
          ELSE 0 
        END as current_stock_containers,
        CASE WHEN p.current_stock_ml <= p.reorder_level_ml THEN true ELSE false END as low_stock
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.is_active = true
      ORDER BY p.name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get product categories
router.get('/categories', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM product_categories ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create product (super admin, stockist)
router.post('/', authenticate, authorize('super_admin', 'stockist'), async (req, res) => {
  try {
    const { name, category_id, unit_type, unit_size_per_tube, container_label, reorder_level_ml, price_per_unit, description } = req.body;
    const result = await pool.query(
      `INSERT INTO products (name, category_id, unit_type, unit_size_per_tube, container_label, reorder_level_ml, price_per_unit, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, category_id, unit_type, unit_size_per_tube, container_label || 'tube', reorder_level_ml || 500, price_per_unit, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update product
router.put('/:id', authenticate, authorize('super_admin', 'stockist'), async (req, res) => {
  try {
    const { name, category_id, unit_type, unit_size_per_tube, container_label, reorder_level_ml, price_per_unit, description } = req.body;
    const result = await pool.query(
      `UPDATE products SET name=$1, category_id=$2, unit_type=$3, unit_size_per_tube=$4, container_label=$5, reorder_level_ml=$6, price_per_unit=$7, description=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [name, category_id, unit_type, unit_size_per_tube, container_label, reorder_level_ml, price_per_unit, description, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add stock (stockist only)
router.post('/:id/stock', authenticate, authorize('super_admin', 'stockist'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { quantity_ml, quantity_containers, notes } = req.body;

    // Get product
    const product = await client.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (product.rows.length === 0) throw new Error('Product not found');
    const prod = product.rows[0];

    // Calculate ml from containers if not provided directly
    let totalMl = parseFloat(quantity_ml) || 0;
    let containers = parseFloat(quantity_containers) || 0;

    if (containers > 0 && prod.unit_size_per_tube > 0) {
      totalMl = containers * prod.unit_size_per_tube;
    } else if (totalMl > 0 && prod.unit_size_per_tube > 0) {
      containers = totalMl / prod.unit_size_per_tube;
    }

    // Update stock
    await client.query(
      'UPDATE products SET current_stock_ml = current_stock_ml + $1, updated_at = NOW() WHERE id = $2',
      [totalMl, req.params.id]
    );

    // Log transaction
    const txn = await client.query(
      `INSERT INTO stock_transactions (product_id, transaction_type, quantity_ml, quantity_containers, notes, performed_by)
       VALUES ($1, 'addition', $2, $3, $4, $5) RETURNING *`,
      [req.params.id, totalMl, containers, notes, req.user.id]
    );

    await client.query('COMMIT');
    res.json({
      transaction: txn.rows[0],
      message: `Added ${containers > 0 ? containers + ' ' + prod.container_label + '(s)' : ''} (${totalMl} ${prod.unit_type}) to stock`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Get stock transactions for a product
router.get('/:id/transactions', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT st.*, u.name as performed_by_name, p.name as product_name, p.unit_type, p.container_label
       FROM stock_transactions st
       JOIN users u ON st.performed_by = u.id
       JOIN products p ON st.product_id = p.id
       WHERE st.product_id = $1
       ORDER BY st.created_at DESC
       LIMIT 50`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all stock transactions
router.get('/transactions/all', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = `
      SELECT st.*, u.name as performed_by_name, p.name as product_name, p.unit_type, p.container_label
      FROM stock_transactions st
      JOIN users u ON st.performed_by = u.id
      JOIN products p ON st.product_id = p.id
      WHERE 1=1
    `;
    const params = [];
    if (from) { params.push(from); query += ` AND st.created_at >= $${params.length}`; }
    if (to) { params.push(to); query += ` AND st.created_at <= $${params.length}`; }
    query += ' ORDER BY st.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
