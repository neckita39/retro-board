#!/bin/bash
set -e

# Retro Board — deploy without Docker
# Tested on Ubuntu 22.04 / Debian 12
# Saves ~100-150MB RAM by skipping Docker daemon

APP_DIR="/opt/retro"
APP_USER="retro"
DB_PASSWORD="${DB_PASSWORD:-retro}"
NODE_VERSION="22"
ORIGIN="${ORIGIN:-http://localhost}"

echo "=== Retro Board: bare-metal deployment ==="

# --- 1. System packages ---
echo "[1/6] Installing system packages..."
apt-get update -qq
apt-get install -y -qq curl gnupg2 lsb-release

# --- 2. Node.js 22 ---
echo "[2/6] Installing Node.js ${NODE_VERSION}..."
if ! command -v node &>/dev/null || [[ "$(node -v)" != v${NODE_VERSION}* ]]; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y -qq nodejs
fi
echo "Node.js $(node -v)"

# --- 3. PostgreSQL 16 ---
echo "[3/6] Installing PostgreSQL 16..."
if ! command -v psql &>/dev/null; then
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql.gpg
    echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
    apt-get update -qq
    apt-get install -y -qq postgresql-16
fi

# Configure PostgreSQL for low memory
cat > /etc/postgresql/16/main/conf.d/retro.conf <<EOF
shared_buffers = 128MB
work_mem = 4MB
effective_cache_size = 512MB
EOF
systemctl restart postgresql

# Create database and user
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${APP_USER}'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER ${APP_USER} WITH PASSWORD '${DB_PASSWORD}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='retro'" | grep -q 1 || \
    sudo -u postgres createdb -O "${APP_USER}" retro

# --- 4. App user + directory ---
echo "[4/6] Setting up application..."
id -u "${APP_USER}" &>/dev/null || useradd -r -m -s /bin/bash "${APP_USER}"
mkdir -p "${APP_DIR}"
cp -r . "${APP_DIR}/"
cd "${APP_DIR}"
npm ci --omit=dev
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

# --- 5. systemd service ---
echo "[5/6] Installing systemd service..."
cat > /etc/systemd/system/retro.service <<EOF
[Unit]
Description=Retro Board
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=${APP_USER}
WorkingDir=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DATABASE_URL=postgresql://${APP_USER}:${DB_PASSWORD}@localhost:5432/retro
Environment=ORIGIN=${ORIGIN}
ExecStartPre=/usr/bin/node migrate.js
ExecStart=/usr/bin/node --max-old-space-size=256 server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable retro.service

# --- 6. Start ---
echo "[6/6] Starting Retro Board..."
systemctl restart retro.service
sleep 2
systemctl status retro.service --no-pager

echo ""
echo "=== Done! Retro Board is running on port 3000 ==="
echo "Logs: journalctl -u retro -f"
