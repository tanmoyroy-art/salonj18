# ✂️ Salon Stock & Sales Management System

A full-stack Node.js + React + PostgreSQL application for managing a salon's inventory, appointments, customers, staff, and sales analytics.

---

## 🗂 Project Structure

```
salon-system/
├── server/               # Express.js backend (API)
│   ├── db/
│   │   ├── index.js      # DB connection + auto-migration
│   │   └── schema.sql    # Full PostgreSQL schema
│   ├── middleware/
│   │   └── auth.js       # JWT auth middleware
│   ├── routes/
│   │   ├── auth.js       # Login & user management
│   │   ├── products.js   # Products & stock
│   │   ├── services.js   # Services & specialists
│   │   ├── customers.js  # Customer profiles
│   │   ├── appointments.js
│   │   └── analytics.js  # Reports & dashboards
│   ├── index.js          # Server entry point
│   ├── package.json
│   └── .env.example      # Environment template
│
├── client/               # React frontend
│   ├── src/
│   │   ├── context/      # AuthContext (JWT state)
│   │   ├── components/common/
│   │   │   └── Sidebar.js
│   │   ├── pages/
│   │   │   ├── Login.js
│   │   │   ├── Dashboard.js      # Super Admin overview
│   │   │   ├── Products.js       # Stockist + Admin
│   │   │   ├── StockOverview.js  # Inventory analysis
│   │   │   ├── Services.js       # Service catalog
│   │   │   ├── Specialists.js    # Staff profiles
│   │   │   ├── Appointments.js   # Booking + payments
│   │   │   ├── Customers.js      # Customer database
│   │   │   ├── Reports.js        # Sales analytics
│   │   │   └── Users.js          # System users
│   │   ├── utils/api.js   # Axios with auto-auth
│   │   ├── App.js         # Routes + role guards
│   │   └── index.css      # Design system styles
│   └── package.json
│
├── setup.sh              # One-command setup
├── package.json          # Root (concurrently)
└── README.md
```

---

## ⚙️ Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 16 or newer |
| npm | 8 or newer |
| PostgreSQL | 13 or newer |

---

## 🚀 Quick Start

### 1. Clone / download the project

```bash
cd salon-system
```

### 2. Run the setup script (interactive)

```bash
bash setup.sh
```

This will:
- Ask for your PostgreSQL credentials
- Create the `salon_db` database
- Write `server/.env`
- Install all npm dependencies
- Create the default Super Admin account

### 3. Start the app

```bash
npm run dev
```

Opens:
- **Client:** http://localhost:3000
- **API:** http://localhost:5000/api

---

## 🔐 Manual Setup (without the script)

### 1. Configure environment

```bash
cp server/.env.example server/.env
# Edit server/.env with your DB credentials
```

### 2. Create database

```bash
psql -U postgres -c "CREATE DATABASE salon_db;"
```

### 3. Install dependencies

```bash
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### 4. Start

```bash
npm run dev
```

---

## 👥 User Roles & Access

### 👑 Super Admin
| Feature | Access |
|---------|--------|
| Dashboard & Analytics | ✅ Full |
| Sales Reports | ✅ Full |
| Stock Overview | ✅ Full |
| Services (create/edit) | ✅ Full |
| Specialists (create/edit) | ✅ Full |
| Products | ✅ Full |
| Customers | ✅ Full |
| Appointments | ✅ Full |
| System Users | ✅ Full |

### 💁 Receptionist
| Feature | Access |
|---------|--------|
| Appointments | ✅ Create, manage, complete |
| Customer lookup / creation | ✅ By phone number |
| Payment processing | ✅ Cash, Card, UPI |

### 📦 Stockist
| Feature | Access |
|---------|--------|
| Products | ✅ Add, edit |
| Add Stock | ✅ By tube/container or ml/g |
| Stock Overview | ✅ View only |

---

## 📦 Stock Management (Tube/Container Logic)

When adding a product, you set:
- **Unit type** — `ml`, `g`, `l`, `kg`
- **Container label** — tube, bottle, jar, sachet, etc.
- **Size per container** — e.g. `80` means 1 tube = 80ml

When the **Stockist adds stock**, they can enter quantity in either format:
- **By containers** → e.g. "10 tubes" → system stores 800ml
- **By ml** → e.g. "800ml" → system shows "10 tubes"

Stock is automatically deducted when an appointment is marked **Completed**, based on each service's product requirements.

---

## 📅 Appointment Flow

```
Receptionist types mobile number
        ↓
Customer found?  YES → show name
                 NO  → create new profile
        ↓
Select services (shows price + products used + duration)
        ↓
Choose specialist & date/time
        ↓
Appointment created (status: Scheduled)
        ↓
Start → In Progress
        ↓
Complete → stock auto-deducted → Payment screen
        ↓
Payment recorded (Cash / Card / UPI / Other)
```

---

## 📊 Analytics

### Dashboard (Super Admin)
- Today's appointments, revenue, pending payments
- Revenue trend chart
- Low stock alerts
- Top customers

### Sales Reports
- Revenue trend (week / month / year / custom range)
- Daily appointments bar chart
- Service breakdown pie chart
- Payment method breakdown
- Top customers by spend

### Customer Analytics
- Total visits (week / month / year / all time)
- Total & average spend
- Favourite services
- Monthly spending trend chart

### Stock Overview
- Per-product stock bar chart (colour-coded: green/orange/red)
- Days-left estimate based on 30-day usage rate
- Full transaction history per product

---

## 🗄️ Database Schema

Key tables:

| Table | Purpose |
|-------|---------|
| `users` | Staff accounts (admin / receptionist / stockist) |
| `specialists` | Service technicians / stylists |
| `products` | Shampoos, creams, etc. with container conversion |
| `product_categories` | Shampoo, Conditioner, Color, etc. |
| `stock_transactions` | Every stock IN/OUT event |
| `services` | Service catalog with duration & price |
| `service_products` | Which products each service uses (ml/g) |
| `customers` | Customer profiles (unique by phone) |
| `appointments` | Bookings with status & payment |
| `appointment_services` | Services in each appointment |
| `appointment_product_usage` | Exact product deduction per appointment |

---

## 🛠 API Endpoints

### Auth
```
POST   /api/auth/login
GET    /api/auth/users                    (admin)
POST   /api/auth/users                    (admin)
PATCH  /api/auth/users/:id/toggle         (admin)
PATCH  /api/auth/users/:id/password       (admin)
```

### Products
```
GET    /api/products
GET    /api/products/categories
POST   /api/products
PUT    /api/products/:id
POST   /api/products/:id/stock            (add stock)
GET    /api/products/:id/transactions
GET    /api/products/transactions/all
```

### Services
```
GET    /api/services
POST   /api/services
PUT    /api/services/:id
PATCH  /api/services/:id/toggle
GET    /api/services/specialists
POST   /api/services/specialists
PUT    /api/services/specialists/:id
```

### Customers
```
GET    /api/customers
GET    /api/customers/lookup/:phone
POST   /api/customers
PUT    /api/customers/:id
GET    /api/customers/:id/history
```

### Appointments
```
GET    /api/appointments
POST   /api/appointments
PATCH  /api/appointments/:id/status
PATCH  /api/appointments/:id/payment
```

### Analytics
```
GET    /api/analytics/daily?date=YYYY-MM-DD
GET    /api/analytics/sales?period=week|month|year
GET    /api/analytics/customers/:id
GET    /api/analytics/stock
GET    /api/analytics/top-customers?period=week|month|year
```

---

## 💡 Tips

- **Low stock threshold** is set per product (default 500ml). Adjust in the product edit form.
- **Default Super Admin** is created on first server start using `.env` credentials.
- All passwords are **bcrypt-hashed** — never stored in plain text.
- **JWT tokens** expire after 12 hours; users are redirected to login automatically.

---

## 📄 License

MIT — free to use and modify for your salon business.
