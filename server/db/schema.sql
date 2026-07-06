-- ============================================
-- SALON STOCK & SALES ANALYSIS SYSTEM
-- Database Schema
-- ============================================

-- Users table (Super Admin, Receptionist, Stockist)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin', 'receptionist', 'stockist')),
  phone VARCHAR(15),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Service Specialists (stylists/technicians)
CREATE TABLE IF NOT EXISTS specialists (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(15),
  email VARCHAR(150),
  specialization VARCHAR(200),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Product Categories
CREATE TABLE IF NOT EXISTS product_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Products (shampoos, creams, etc.)
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category_id INTEGER REFERENCES product_categories(id),
  unit_type VARCHAR(10) NOT NULL CHECK (unit_type IN ('ml', 'g', 'l', 'kg')),
  unit_size_per_tube DECIMAL(10,2),  -- e.g., 80ml per tube
  container_label VARCHAR(50) DEFAULT 'tube',  -- tube, bottle, jar, etc.
  current_stock_ml DECIMAL(10,2) DEFAULT 0,  -- stored in base unit (ml or g)
  reorder_level_ml DECIMAL(10,2) DEFAULT 500,
  price_per_unit DECIMAL(10,2),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Stock Transactions (additions by stockist)
CREATE TABLE IF NOT EXISTS stock_transactions (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id),
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('addition', 'deduction', 'adjustment')),
  quantity_ml DECIMAL(10,2) NOT NULL,  -- in base unit
  quantity_containers DECIMAL(10,2),   -- in tubes/bottles
  notes TEXT,
  performed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Services offered by the salon
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Products required per service
CREATE TABLE IF NOT EXISTS service_products (
  id SERIAL PRIMARY KEY,
  service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  quantity_ml DECIMAL(10,2) NOT NULL  -- quantity used per service session in ml/g
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(15) UNIQUE NOT NULL,
  email VARCHAR(150),
  date_of_birth DATE,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Appointments / Bookings
CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  specialist_id INTEGER REFERENCES specialists(id),
  appointment_date TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  total_amount DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partial')),
  payment_method VARCHAR(30) CHECK (payment_method IN ('cash', 'card', 'upi', 'other')),
  amount_paid DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Services in each appointment
CREATE TABLE IF NOT EXISTS appointment_services (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES services(id),
  price DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'skipped'))
);

-- Product usage per appointment (deducted from stock when appointment completed)
CREATE TABLE IF NOT EXISTS appointment_product_usage (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  quantity_used_ml DECIMAL(10,2) NOT NULL
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_appointments_customer ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_product ON stock_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_date ON stock_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- ============================================
-- DEFAULT DATA
-- ============================================
INSERT INTO product_categories (name) VALUES 
  ('Shampoo'),
  ('Conditioner'),
  ('Hair Color'),
  ('Cream'),
  ('Oil'),
  ('Serum'),
  ('Mask'),
  ('Other')
ON CONFLICT DO NOTHING;

-- ============================================
-- UPGRADE 1: Membership System
-- ============================================

CREATE TABLE IF NOT EXISTS membership_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,           -- Basic, Gold, Diamond
  tier VARCHAR(20) NOT NULL UNIQUE CHECK (tier IN ('basic', 'gold', 'diamond')),
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  price DECIMAL(10,2) NOT NULL,        -- cost to buy this membership
  duration_days INTEGER NOT NULL DEFAULT 365,
  color VARCHAR(20) DEFAULT '#8B5CF6', -- UI color
  benefits TEXT,                       -- description
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_memberships (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES membership_plans(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  purchased_by INTEGER REFERENCES users(id),
  amount_paid DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Blackout dates: membership discount NOT applicable on these dates (festive offers etc.)
CREATE TABLE IF NOT EXISTS membership_blackout_dates (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  reason VARCHAR(200),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(date)
);

-- Add membership_discount to appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS membership_discount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS membership_id INTEGER REFERENCES customer_memberships(id);

-- Add date_of_birth to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Default membership plans
INSERT INTO membership_plans (name, tier, discount_percent, price, duration_days, color, benefits) VALUES
  ('Basic', 'basic', 5, 999, 180, '#6B7280', 'Get 5% off on all services for 6 months'),
  ('Gold', 'gold', 15, 1999, 365, '#F59E0B', 'Get 15% off on all services for 1 year + priority booking'),
  ('Diamond', 'diamond', 25, 3499, 365, '#8B5CF6', 'Get 25% off on all services for 1 year + priority booking + free consultation')
ON CONFLICT (tier) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_customer_memberships_customer ON customer_memberships(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_memberships_status ON customer_memberships(status);
CREATE INDEX IF NOT EXISTS idx_blackout_dates_date ON membership_blackout_dates(date);

-- ============================================
-- UPGRADE 2: Loyalty Points System
-- ============================================

-- Points config per membership tier (admin sets these)
ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS points_per_100 DECIMAL(8,2) DEFAULT 1;
-- e.g. points_per_100 = 2 means ₹100 spent = 2 points

-- Update defaults
UPDATE membership_plans SET points_per_100 = 1 WHERE tier = 'basic'    AND points_per_100 IS NULL;
UPDATE membership_plans SET points_per_100 = 2 WHERE tier = 'gold'     AND points_per_100 IS NULL;
UPDATE membership_plans SET points_per_100 = 3 WHERE tier = 'diamond'  AND points_per_100 IS NULL;


-- Customer points wallet
CREATE TABLE IF NOT EXISTS customer_points (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE UNIQUE,
  total_points DECIMAL(10,2) DEFAULT 0,       -- current balance
  lifetime_points DECIMAL(10,2) DEFAULT 0,    -- never decreases, for tracking
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Points transaction ledger
CREATE TABLE IF NOT EXISTS points_transactions (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('earned', 'redeemed', 'bonus', 'expired', 'adjusted')),
  points DECIMAL(10,2) NOT NULL,              -- positive = earned/bonus, negative = redeemed
  amount_spent DECIMAL(10,2),                 -- ₹ amount that generated these points
  description TEXT,
  performed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Points redemption config (admin sets: how many points = ₹1)
-- Stored as a system setting
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO system_settings (key, value, description) VALUES
  ('points_redemption_rate', '100', 'Number of points needed to get ₹1 discount (e.g. 100 = 100 pts = ₹1)'),
  ('points_expiry_days', '365', 'Points expire after this many days (0 = never expire)')
ON CONFLICT (key) DO NOTHING;

-- Track redeemed points on appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS points_redeemed DECIMAL(10,2) DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS points_discount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS points_earned DECIMAL(10,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_points_transactions_customer ON points_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_appointment ON points_transactions(appointment_id);
CREATE INDEX IF NOT EXISTS idx_customer_points_customer ON customer_points(customer_id);

-- ============================================
-- UPGRADE 3: Service Media + Razorpay Payments
-- ============================================

-- Service media files (images/videos)
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

CREATE INDEX IF NOT EXISTS idx_service_media_service ON service_media(service_id);

-- Razorpay orders for online payments
CREATE TABLE IF NOT EXISTS payment_orders (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
  razorpay_order_id VARCHAR(100) UNIQUE NOT NULL,
  razorpay_payment_id VARCHAR(100),
  razorpay_signature VARCHAR(255),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  status VARCHAR(20) DEFAULT 'created' CHECK (status IN ('created','paid','failed','refunded')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Track payment method on appointments more granularly
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20) DEFAULT 'desk' CHECK (payment_type IN ('desk','online'));

-- ============================================
-- UPGRADE 4: Festival Offers System
-- ============================================

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

-- Services included in each offer
CREATE TABLE IF NOT EXISTS offer_services (
  id SERIAL PRIMARY KEY,
  offer_id INTEGER REFERENCES offers(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
  UNIQUE(offer_id, service_id)
);

-- Track offer applied on appointment
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS offer_id INTEGER REFERENCES offers(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS offer_discount DECIMAL(10,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_offers_dates ON offers(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_offer_services_offer ON offer_services(offer_id);
