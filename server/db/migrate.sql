-- ============================================================
-- RUN THIS IN pgAdmin once to fix your existing database
-- Query Tool → paste this → Execute (F5)
-- ============================================================

-- 1. Create service_media table if missing
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
);

-- 2. Add membership / loyalty columns to appointments if missing
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS membership_discount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS membership_id INTEGER;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS points_redeemed DECIMAL(10,2) DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS points_discount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS points_earned DECIMAL(10,2) DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20) DEFAULT 'desk';

-- 3. Add DOB to users if missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- 4. Loyalty tables
CREATE TABLE IF NOT EXISTS customer_points (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE UNIQUE,
  total_points DECIMAL(10,2) DEFAULT 0,
  lifetime_points DECIMAL(10,2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS points_transactions (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('earned','redeemed','bonus','expired','adjusted')),
  points DECIMAL(10,2) NOT NULL,
  amount_spent DECIMAL(10,2),
  description TEXT,
  performed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO system_settings (key, value, description) VALUES
  ('points_redemption_rate', '100', '100 points = Rs1 discount'),
  ('points_expiry_days', '365', 'Points expire after days')
ON CONFLICT (key) DO NOTHING;

-- 5. Membership tables
CREATE TABLE IF NOT EXISTS membership_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  tier VARCHAR(20) NOT NULL UNIQUE CHECK (tier IN ('basic','gold','diamond')),
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  price DECIMAL(10,2) NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 365,
  color VARCHAR(20) DEFAULT '#8B5CF6',
  benefits TEXT,
  points_per_100 DECIMAL(8,2) DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO membership_plans (name, tier, discount_percent, price, duration_days, color, benefits, points_per_100) VALUES
  ('Basic',   'basic',   5,  999,  180, '#6B7280', 'Get 5% off on all services for 6 months', 1),
  ('Gold',    'gold',    15, 1999, 365, '#F59E0B', 'Get 15% off for 1 year + priority booking', 2),
  ('Diamond', 'diamond', 25, 3499, 365, '#8B5CF6', 'Get 25% off for 1 year + priority + free consultation', 3)
ON CONFLICT (tier) DO NOTHING;

ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS points_per_100 DECIMAL(8,2) DEFAULT 1;

CREATE TABLE IF NOT EXISTS customer_memberships (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES membership_plans(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  purchased_by INTEGER REFERENCES users(id),
  amount_paid DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS membership_blackout_dates (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  reason VARCHAR(200),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(date)
);

-- 6. Payment orders for Razorpay
CREATE TABLE IF NOT EXISTS payment_orders (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
  razorpay_order_id VARCHAR(100) UNIQUE NOT NULL,
  razorpay_payment_id VARCHAR(100),
  razorpay_signature VARCHAR(255),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  status VARCHAR(20) DEFAULT 'created',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

SELECT 'Migration complete! All tables are up to date.' as result;

-- ============================================================
-- Offers system (run this if upgrading existing database)
-- ============================================================
CREATE TABLE IF NOT EXISTS offers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  discount_percent DECIMAL(5,2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS offer_services (
  id SERIAL PRIMARY KEY,
  offer_id INTEGER REFERENCES offers(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
  UNIQUE(offer_id, service_id)
);

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS offer_id INTEGER REFERENCES offers(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS offer_discount DECIMAL(10,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_offers_dates ON offers(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_offer_services_offer ON offer_services(offer_id);

SELECT 'Offers migration complete!' as result;
