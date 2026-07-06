const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'salon_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

async function initializeDatabase() {
  try {
    // Run schema
    const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schemaSQL);
    console.log('✅ Database schema initialized');

    // Create default super admin if not exists
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@salon.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (existing.rows.length === 0) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await pool.query(
        `INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)`,
        ['Super Admin', adminEmail, hashedPassword, 'super_admin']
      );
      console.log(`✅ Default Super Admin created: ${adminEmail} / ${adminPassword}`);
    }
  } catch (err) {
    console.error('❌ Database initialization failed:', err.message);
    throw err;
  }
}

module.exports = { pool, initializeDatabase };
