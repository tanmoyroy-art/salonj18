const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

// ── Helper: get active offer for a date + service list ────────────────────────
// Returns the best offer (highest discount) that covers at least one of the services
async function getActiveOffer(client, date, serviceIds) {
  if (!serviceIds || !serviceIds.length) return null;
  const db = client || pool;

  const result = await db.query(`
    SELECT o.*,
      jsonb_agg(DISTINCT os2.service_id) as service_ids
    FROM offers o
    JOIN offer_services os2 ON o.id = os2.offer_id
    WHERE o.is_active = true
      AND $1::date BETWEEN o.start_date AND o.end_date
      AND os2.service_id = ANY($2::int[])
    GROUP BY o.id
    ORDER BY o.discount_percent DESC
    LIMIT 1
  `, [date, serviceIds]);

  return result.rows[0] || null;
}

module.exports.getActiveOffer = getActiveOffer;

// ── CRUD ──────────────────────────────────────────────────────────────────────

// Get all offers with their services
router.get('/', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*,
        jsonb_agg(
          jsonb_build_object('service_id', os2.service_id, 'service_name', s.name)
          ORDER BY s.name
        ) FILTER (WHERE os2.id IS NOT NULL) as services
      FROM offers o
      LEFT JOIN offer_services os2 ON o.id = os2.offer_id
      LEFT JOIN services s ON os2.service_id = s.id
      GROUP BY o.id
      ORDER BY o.start_date DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get active offers for today (public + receptionist use)
router.get('/active', authenticate, async (req, res) => {
  try {
    const { date } = req.query;
    const checkDate = date || new Date().toISOString().split('T')[0];
    const result = await pool.query(`
      SELECT o.*,
        jsonb_agg(
          jsonb_build_object('service_id', os2.service_id, 'service_name', s.name)
          ORDER BY s.name
        ) FILTER (WHERE os2.id IS NOT NULL) as services
      FROM offers o
      LEFT JOIN offer_services os2 ON o.id = os2.offer_id
      LEFT JOIN services s ON os2.service_id = s.id
      WHERE o.is_active = true AND $1::date BETWEEN o.start_date AND o.end_date
      GROUP BY o.id
      ORDER BY o.discount_percent DESC
    `, [checkDate]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create offer
router.post('/', authenticate, authorize('super_admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, description, discount_percent, start_date, end_date, service_ids } = req.body;

    if (!name || !discount_percent || !start_date || !end_date)
      return res.status(400).json({ error: 'Name, discount, start and end date are required' });

    if (new Date(end_date) < new Date(start_date))
      return res.status(400).json({ error: 'End date must be after start date' });

    const offer = await client.query(
      `INSERT INTO offers (name, description, discount_percent, start_date, end_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, description, discount_percent, start_date, end_date, req.user.id]
    );
    const offerId = offer.rows[0].id;

    if (service_ids && service_ids.length > 0) {
      for (const sid of service_ids) {
        await client.query(
          'INSERT INTO offer_services (offer_id, service_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [offerId, sid]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json(offer.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// Update offer
router.put('/:id', authenticate, authorize('super_admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, description, discount_percent, start_date, end_date, is_active, service_ids } = req.body;

    await client.query(
      `UPDATE offers SET name=$1, description=$2, discount_percent=$3,
       start_date=$4, end_date=$5, is_active=$6, updated_at=NOW() WHERE id=$7`,
      [name, description, discount_percent, start_date, end_date, is_active, req.params.id]
    );

    // Replace services
    await client.query('DELETE FROM offer_services WHERE offer_id=$1', [req.params.id]);
    if (service_ids && service_ids.length > 0) {
      for (const sid of service_ids) {
        await client.query(
          'INSERT INTO offer_services (offer_id, service_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [req.params.id, sid]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Offer updated' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// Delete offer
router.delete('/:id', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM offers WHERE id=$1', [req.params.id]);
    res.json({ message: 'Offer deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Public: get active offers for a date (for booking page)
router.get('/public', async (req, res) => {
  try {
    const { date } = req.query;
    const checkDate = date || new Date().toISOString().split('T')[0];
    const result = await pool.query(`
      SELECT o.id, o.name, o.description, o.discount_percent, o.start_date, o.end_date,
        jsonb_agg(os2.service_id) FILTER (WHERE os2.id IS NOT NULL) as service_ids
      FROM offers o
      LEFT JOIN offer_services os2 ON o.id = os2.offer_id
      WHERE o.is_active = true AND $1::date BETWEEN o.start_date AND o.end_date
      GROUP BY o.id
      ORDER BY o.discount_percent DESC
    `, [checkDate]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
