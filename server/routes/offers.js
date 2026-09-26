const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const uploadsDir = path.join(__dirname, '../uploads/offers');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'offer-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/mpeg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  }
});

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
    
    const offers = result.rows.map(offer => ({
      ...offer,
      media_url: offer.media_file ? `/uploads/offers/${offer.media_file}` : null
    }));
    
    res.json(offers);
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
    
    const offers = result.rows.map(offer => ({
      ...offer,
      media_url: offer.media_file ? `/uploads/offers/${offer.media_file}` : null
    }));
    
    res.json(offers);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create offer
router.post('/', authenticate, authorize('super_admin'), upload.single('media'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let { name, description, discount_percent, start_date, end_date, service_ids, is_active } = req.body;

    if (!name || !discount_percent || !start_date || !end_date)
      return res.status(400).json({ error: 'Name, discount, start and end date are required' });

    if (new Date(end_date) < new Date(start_date))
      return res.status(400).json({ error: 'End date must be after start date' });

    // Parse service_ids if it's a JSON string
    if (typeof service_ids === 'string') {
      try {
        service_ids = JSON.parse(service_ids);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid service_ids format' });
      }
    }

    let mediaFile = null;
    let mediaType = null;

    if (req.file) {
      mediaFile = req.file.filename;
      const mimeType = req.file.mimetype;
      mediaType = mimeType.startsWith('image/') ? 'image' : 'video';
    }

    const offer = await client.query(
      `INSERT INTO offers (name, description, discount_percent, start_date, end_date, media_file, media_type, created_by, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [name, description, discount_percent, start_date, end_date, mediaFile, mediaType, req.user.id, is_active ?? true]
    );
    const offerId = offer.rows[0].id;

    if (service_ids && Array.isArray(service_ids) && service_ids.length > 0) {
      for (const sid of service_ids) {
        await client.query(
          'INSERT INTO offer_services (offer_id, service_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [offerId, sid]
        );
      }
    }

    await client.query('COMMIT');
    
    const offerData = offer.rows[0];
    if (mediaFile) {
      offerData.media_url = `/uploads/offers/${mediaFile}`;
    }
    
    res.status(201).json(offerData);
  } catch (err) {
    await client.query('ROLLBACK');
    if (req.file) {
      fs.unlink(req.file.path, (err) => { if (err) console.error(err); });
    }
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// Update offer
router.put('/:id', authenticate, authorize('super_admin'), upload.single('media'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let { name, description, discount_percent, start_date, end_date, is_active, service_ids } = req.body;

    // Parse service_ids if it's a JSON string
    if (typeof service_ids === 'string') {
      try {
        service_ids = JSON.parse(service_ids);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid service_ids format' });
      }
    }

    let mediaFile = null;
    let mediaType = null;

    // Get existing offer to handle old media file
    const existingOffer = await client.query('SELECT media_file FROM offers WHERE id=$1', [req.params.id]);
    const oldMediaFile = existingOffer.rows[0]?.media_file;

    if (req.file) {
      mediaFile = req.file.filename;
      const mimeType = req.file.mimetype;
      mediaType = mimeType.startsWith('image/') ? 'image' : 'video';

      // Delete old media file if it exists
      if (oldMediaFile) {
        const oldPath = path.join(uploadsDir, oldMediaFile);
        fs.unlink(oldPath, (err) => { if (err) console.error('Error deleting old media:', err); });
      }
    }

    const updateQuery = mediaFile
      ? `UPDATE offers SET name=$1, description=$2, discount_percent=$3,
         start_date=$4, end_date=$5, is_active=$6, media_file=$7, media_type=$8, updated_at=NOW() WHERE id=$9`
      : `UPDATE offers SET name=$1, description=$2, discount_percent=$3,
         start_date=$4, end_date=$5, is_active=$6, updated_at=NOW() WHERE id=$9`;

    const params = mediaFile
      ? [name, description, discount_percent, start_date, end_date, is_active, mediaFile, mediaType, req.params.id]
      : [name, description, discount_percent, start_date, end_date, is_active, req.params.id];

    await client.query(updateQuery, params);

    // Replace services
    await client.query('DELETE FROM offer_services WHERE offer_id=$1', [req.params.id]);
    if (service_ids && Array.isArray(service_ids) && service_ids.length > 0) {
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
    if (req.file) {
      fs.unlink(req.file.path, (err) => { if (err) console.error(err); });
    }
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

// ── PUBLIC ENDPOINTS (No authentication required) ────────────────────────────

// Public: Get ALL active offers (for public booking page, banner, etc.)
// Optional query param: ?date=YYYY-MM-DD (defaults to today)
router.get('/public/list', async (req, res) => {
  try {
    const { date } = req.query;
    const checkDate = date || new Date().toISOString().split('T')[0];
    
    const result = await pool.query(`
      SELECT 
        o.id, 
        o.name, 
        o.description, 
        o.discount_percent, 
        o.start_date, 
        o.end_date, 
        o.media_file, 
        o.media_type,
        jsonb_agg(
          jsonb_build_object(
            'service_id', os2.service_id,
            'service_name', s.name
          ) ORDER BY s.name
        ) FILTER (WHERE os2.id IS NOT NULL) as services
      FROM offers o
      LEFT JOIN offer_services os2 ON o.id = os2.offer_id
      LEFT JOIN services s ON os2.service_id = s.id
      WHERE o.is_active = true AND $1::date BETWEEN o.start_date AND o.end_date
      GROUP BY o.id
      ORDER BY o.discount_percent DESC
    `, [checkDate]);
    
    const offers = result.rows.map(offer => ({
      ...offer,
      media_url: offer.media_file ? `/uploads/offers/${offer.media_file}` : null,
      service_count: offer.services?.length || 0
    }));
    
    res.json({
      success: true,
      count: offers.length,
      date: checkDate,
      offers: offers
    });
  } catch (err) { 
    res.status(500).json({ success: false, error: err.message }); 
  }
});

// Public: Get offers for specific services (for service detail page)
// Query params: ?services=68,38,51&date=YYYY-MM-DD
router.get('/public/services', async (req, res) => {
  try {
    const { services: serviceIds, date } = req.query;
    const checkDate = date || new Date().toISOString().split('T')[0];
    
    if (!serviceIds) {
      return res.status(400).json({ 
        success: false, 
        error: 'Query parameter "services" is required (comma-separated IDs)' 
      });
    }
    
    // Parse comma-separated service IDs
    const ids = serviceIds.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
    
    if (ids.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid service IDs provided' 
      });
    }
    
    const result = await pool.query(`
      SELECT DISTINCT
        o.id, 
        o.name, 
        o.description, 
        o.discount_percent, 
        o.start_date, 
        o.end_date, 
        o.media_file, 
        o.media_type,
        jsonb_agg(
          jsonb_build_object(
            'service_id', os2.service_id,
            'service_name', s.name
          ) ORDER BY s.name
        ) FILTER (WHERE os2.id IS NOT NULL) as services
      FROM offers o
      LEFT JOIN offer_services os2 ON o.id = os2.offer_id
      LEFT JOIN services s ON os2.service_id = s.id
      WHERE o.is_active = true 
        AND $1::date BETWEEN o.start_date AND o.end_date
        AND os2.service_id = ANY($2::int[])
      GROUP BY o.id
      ORDER BY o.discount_percent DESC
    `, [checkDate, ids]);
    
    const offers = result.rows.map(offer => ({
      ...offer,
      media_url: offer.media_file ? `/uploads/offers/${offer.media_file}` : null,
      service_count: offer.services?.length || 0
    }));
    
    res.json({
      success: true,
      count: offers.length,
      date: checkDate,
      requested_services: ids,
      offers: offers
    });
  } catch (err) { 
    res.status(500).json({ success: false, error: err.message }); 
  }
});

// Legacy: Public: get active offers for a date (for booking page)
router.get('/public', async (req, res) => {
  try {
    const { date } = req.query;
    const checkDate = date || new Date().toISOString().split('T')[0];
    const result = await pool.query(`
      SELECT 
        o.id, 
        o.name, 
        o.description, 
        o.discount_percent, 
        o.start_date, 
        o.end_date, 
        o.media_file, 
        o.media_type,
        jsonb_agg(
          jsonb_build_object(
            'service_id', os2.service_id,
            'service_name', s.name
          ) ORDER BY s.name
        ) FILTER (WHERE os2.id IS NOT NULL) as services
      FROM offers o
      LEFT JOIN offer_services os2 ON o.id = os2.offer_id
      LEFT JOIN services s ON os2.service_id = s.id
      WHERE o.is_active = true AND $1::date BETWEEN o.start_date AND o.end_date
      GROUP BY o.id
      ORDER BY o.discount_percent DESC
    `, [checkDate]);
    
    const offers = result.rows.map(offer => ({
      ...offer,
      media_url: offer.media_file ? `/uploads/offers/${offer.media_file}` : null
    }));
    
    res.json(offers);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
