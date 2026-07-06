const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

// ── Multer setup ──────────────────────────────────────────────────────────────
let multer;
try {
  multer = require('multer');
} catch (e) {
  console.warn('multer not installed yet — run npm install in server/');
}

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'services');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer && multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, unique);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/webm','video/quicktime'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only images (jpg,png,gif,webp) and videos (mp4,webm,mov) are allowed'));
};

const upload = multer && multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });

// Helper: get file type from mimetype
const getFileType = (mime) => mime.startsWith('video/') ? 'video' : 'image';

// ── Services ──────────────────────────────────────────────────────────────────

// Get all services with products + media
router.get('/', authenticate, async (req, res) => {
  try {
    // First ensure service_media table exists
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

    const services = await pool.query(`
      SELECT
        s.id, s.name, s.description, s.duration_minutes, s.category_name, s.price,
        s.is_active, s.created_at, s.updated_at,
        jsonb_agg(DISTINCT
          jsonb_build_object(
            'id', sp.id, 'product_id', sp.product_id,
            'product_name', p.name, 'quantity_ml', sp.quantity_ml, 'unit_type', p.unit_type
          )
        ) FILTER (WHERE sp.id IS NOT NULL) as products_required,
        jsonb_agg(DISTINCT
          jsonb_build_object(
            'id', sm.id, 'file_name', sm.file_name,
            'original_name', sm.original_name,
            'file_type', sm.file_type, 'sort_order', sm.sort_order
          )
        ) FILTER (WHERE sm.id IS NOT NULL) as media
      FROM services s
      LEFT JOIN service_products sp ON s.id = sp.service_id
      LEFT JOIN products p ON sp.product_id = p.id
      LEFT JOIN service_media sm ON s.id = sm.service_id
      WHERE s.is_active = true
      GROUP BY s.id, s.name, s.description, s.duration_minutes, s.price, s.is_active, s.created_at, s.updated_at
      ORDER BY s.name
    `);
    res.json(services.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create service
router.post('/', authenticate, authorize('super_admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, description, duration_minutes, price, products_required } = req.body;
    const service = await client.query(
      'INSERT INTO services (name, description, duration_minutes, price) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, description, duration_minutes, price]
    );
    const serviceId = service.rows[0].id;
    if (products_required && products_required.length > 0) {
      for (const prod of products_required) {
        await client.query(
          'INSERT INTO service_products (service_id, product_id, quantity_ml) VALUES ($1,$2,$3)',
          [serviceId, prod.product_id, prod.quantity_ml]
        );
      }
    }
    await client.query('COMMIT');
    res.status(201).json(service.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// Update service
router.put('/:id', authenticate, authorize('super_admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, description, duration_minutes, price, products_required } = req.body;
    await client.query(
      'UPDATE services SET name=$1, description=$2, duration_minutes=$3, price=$4, updated_at=NOW() WHERE id=$5',
      [name, description, duration_minutes, price, req.params.id]
    );
    await client.query('DELETE FROM service_products WHERE service_id=$1', [req.params.id]);
    if (products_required && products_required.length > 0) {
      for (const prod of products_required) {
        await client.query(
          'INSERT INTO service_products (service_id, product_id, quantity_ml) VALUES ($1,$2,$3)',
          [req.params.id, prod.product_id, prod.quantity_ml]
        );
      }
    }
    await client.query('COMMIT');
    res.json({ message: 'Service updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// Toggle active
router.patch('/:id/toggle', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE services SET is_active = NOT is_active WHERE id=$1 RETURNING id, name, is_active',
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Media Upload ──────────────────────────────────────────────────────────────

// Upload images/videos for a service
router.post('/:id/media', authenticate, authorize('super_admin'),
  (req, res, next) => {
    if (!upload) return res.status(500).json({ error: 'multer not installed. Run: cd server && npm install' });
    upload.array('files', 10)(req, res, next);
  },
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
      const serviceId = req.params.id;
      const inserted = [];
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const fileType = getFileType(file.mimetype);
        const row = await pool.query(
          `INSERT INTO service_media (service_id, file_name, original_name, file_type, mime_type, file_size, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [serviceId, file.filename, file.originalname, fileType, file.mimetype, file.size, i]
        );
        inserted.push(row.rows[0]);
      }
      res.status(201).json(inserted);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// Delete a media file
router.delete('/media/:mediaId', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const row = await pool.query('SELECT * FROM service_media WHERE id=$1', [req.params.mediaId]);
    if (!row.rows.length) return res.status(404).json({ error: 'Not found' });
    const filePath = path.join(UPLOAD_DIR, row.rows[0].file_name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await pool.query('DELETE FROM service_media WHERE id=$1', [req.params.mediaId]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Serve uploaded files (public — needed for booking page)
router.get('/media/file/:filename', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

// ── Specialists ───────────────────────────────────────────────────────────────

router.get('/specialists', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM specialists WHERE is_active=true ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/specialists', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { name, phone, email, specialization } = req.body;
    const result = await pool.query(
      'INSERT INTO specialists (name, phone, email, specialization) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, phone, email, specialization]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/specialists/:id', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { name, phone, email, specialization, is_active } = req.body;
    const result = await pool.query(
      'UPDATE specialists SET name=$1, phone=$2, email=$3, specialization=$4, is_active=$5 WHERE id=$6 RETURNING *',
      [name, phone, email, specialization, is_active, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
