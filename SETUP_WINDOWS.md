# 🪟 Windows Setup Guide

## Prerequisites
- Node.js 18+ from https://nodejs.org
- PostgreSQL from https://www.postgresql.org/download/windows/

---

## Step 1 — Create the database

Open pgAdmin (installed with PostgreSQL) or run in Command Prompt:
```
psql -U postgres -c "CREATE DATABASE salon_db;"
```

---

## Step 2 — Configure environment

Copy the example env file and edit it:
```
cd salon-system\server
copy .env.example .env
notepad .env
```

Change `DB_PASSWORD` to your PostgreSQL password. Save and close.

---

## Step 3 — Install all dependencies

Open Command Prompt or PowerShell in the `salon-system` folder:

```powershell
# Root
npm install

# Server
cd server
npm install
cd ..

# Client
cd client
npm install
cd ..
```

---

## Step 4 — Start the application

**Option A — Both together (if concurrently works):**
```powershell
npm run dev
```

**Option B — Two separate windows:**

Window 1 (Server):
```powershell
cd server
npm run dev
```

Window 2 (Client):
```powershell
cd client
npm start
```

---

## Step 5 — Open the app

- **Staff login (admin):** http://localhost:3000
  - Email: `admin@salon.com`
  - Password: `Admin@123`

- **Customer booking page:** http://localhost:3000/book

---

## Step 6 — Access from other devices on same WiFi

1. Find your laptop IP:
```powershell
ipconfig
```
Look for `IPv4 Address` (e.g. `192.168.1.10`)

2. Update `server\.env`:
```
CLIENT_URL=http://192.168.1.10:3000
```

3. Open Windows Firewall for ports 3000 and 5000 (run as Administrator):
```powershell
netsh advfirewall firewall add rule name="Salon-3000" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="Salon-5000" dir=in action=allow protocol=TCP localport=5000
```

4. Other devices open: `http://192.168.1.10:3000`

---

## What each user role can do

| Role | Access |
|------|--------|
| **Super Admin** | Everything — dashboard, reports, services, products, membership, loyalty, users |
| **Receptionist** | Appointments + Customers only |
| **Stockist** | Products + Stock Overview only |

## Creating staff accounts
Login as admin → go to **Users** → click **Create User** → set role.

---

## Troubleshooting

**"bash is not recognized"** — Use the manual steps above, not `bash setup.sh`

**"psql is not recognized"** — Add PostgreSQL bin to PATH:
`C:\Program Files\PostgreSQL\16\bin` (adjust version number)

**Port already in use** — Change `PORT=5001` in `server\.env` and update client proxy in `client\package.json`

**Razorpay payment not working** — Make sure the Razorpay SDK loads (internet required on booking page)
