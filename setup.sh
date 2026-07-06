#!/bin/bash

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║   SALON STOCK & SALES MANAGEMENT SYSTEM   ║"
echo "║              Setup Script                  ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

# ── Colour helpers ───────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}ℹ  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠  $1${NC}"; }
error()   { echo -e "${RED}❌ $1${NC}"; exit 1; }

# ── Dependency checks ────────────────────────────
command -v node  >/dev/null 2>&1 || error "Node.js not found. Install from https://nodejs.org"
command -v npm   >/dev/null 2>&1 || error "npm not found. Install Node.js from https://nodejs.org"
command -v psql  >/dev/null 2>&1 || warn  "psql not found – make sure PostgreSQL is running."

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
[ "$NODE_VER" -lt 16 ] && error "Node.js 16+ required (found $(node -v))"

success "Node.js $(node -v) detected"

# ── Database setup ───────────────────────────────
echo ""
echo "─── Database Configuration ───────────────────"
read -p "PostgreSQL host       [localhost]: " DB_HOST;  DB_HOST=${DB_HOST:-localhost}
read -p "PostgreSQL port       [5432]:      " DB_PORT;  DB_PORT=${DB_PORT:-5432}
read -p "Database name         [salon_db]:  " DB_NAME;  DB_NAME=${DB_NAME:-salon_db}
read -p "PostgreSQL user       [postgres]:  " DB_USER;  DB_USER=${DB_USER:-postgres}
read -s -p "PostgreSQL password              : " DB_PASS;  echo ""

# Try creating the database (ignore error if it already exists)
info "Creating database '$DB_NAME' if it doesn't exist …"
PGPASSWORD="$DB_PASS" createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" 2>/dev/null \
  && success "Database '$DB_NAME' created" \
  || info    "Database '$DB_NAME' already exists (or createdb failed — continuing)"

# ── Admin credentials ────────────────────────────
echo ""
echo "─── Super Admin Account ──────────────────────"
read -p "Admin email    [admin@salon.com]: " ADMIN_EMAIL; ADMIN_EMAIL=${ADMIN_EMAIL:-admin@salon.com}
read -s -p "Admin password [Admin@123]:       " ADMIN_PASS;  ADMIN_PASS=${ADMIN_PASS:-Admin@123}; echo ""

# ── Write .env ───────────────────────────────────
cat > server/.env <<EOF
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
PORT=5000
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "salon_jwt_secret_change_me_$(date +%s)")
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASS
CLIENT_URL=http://localhost:3000
EOF
success ".env written to server/.env"

# ── Install dependencies ─────────────────────────
echo ""
info "Installing root dependencies …"
npm install --silent

info "Installing server dependencies …"
cd server && npm install --silent && cd ..

info "Installing client dependencies …"
cd client && npm install --silent && cd ..

success "All dependencies installed"

# ── Done ─────────────────────────────────────────
echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║              SETUP COMPLETE! 🎉            ║"
echo "╚═══════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}To start the application run:${NC}"
echo ""
echo "    npm run dev"
echo ""
echo -e "${CYAN}Then open:  http://localhost:3000${NC}"
echo ""
echo -e "Login with:  ${YELLOW}$ADMIN_EMAIL${NC}  /  ${YELLOW}$ADMIN_PASS${NC}"
echo ""
