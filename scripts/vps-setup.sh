#!/bin/bash
# Ilowa VPS bootstrap — tested on Ubuntu 24.04 LTS (fresh install)
# Run as root. Takes roughly 5-8 min on Hetzner CX22 / DO Droplet $6

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

log "Starting Ilowa VPS setup..."
START_TIME=$(date +%s)

# ── system baseline ──────────────────────────────────────────────────────────

log "Updating packages (this takes a moment)..."
apt-get update -qq && apt-get upgrade -y -qq

# some images don't have these basics
apt-get install -y -qq \
  curl wget git openssl unzip \
  ca-certificates gnupg lsb-release \
  software-properties-common

# ── docker ───────────────────────────────────────────────────────────────────

log "Installing Docker..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin

# docker-compose v1 CLI (some scripts still call it this way)
apt-get install -y -qq docker-compose || true

systemctl enable docker --now
log "Docker $(docker --version | cut -d' ' -f3 | tr -d ',') installed"

# ── node.js 20 ───────────────────────────────────────────────────────────────

log "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
apt-get install -y -qq nodejs
log "Node $(node --version) installed"

# ── python 3.11 ──────────────────────────────────────────────────────────────

log "Installing Python 3.11..."
apt-get install -y -qq python3.11 python3.11-venv python3-pip
# make python3 point to 3.11
update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1
log "Python $(python3 --version) installed"

# ── firewall ─────────────────────────────────────────────────────────────────

log "Configuring UFW firewall..."
apt-get install -y -qq ufw

ufw --force reset > /dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp     comment 'SSH'
ufw allow 443/tcp    comment 'HTTPS'
ufw allow 3000/tcp   comment 'Node API'
ufw allow 8000/tcp   comment 'Python backend'
# supabase studio and postgres — restrict to localhost in production later
ufw allow from 127.0.0.1 to any port 54321 comment 'Supabase studio (local only)'
ufw allow from 127.0.0.1 to any port 5432  comment 'Postgres (local only)'
ufw --force enable
log "Firewall rules set"

# ── directory layout ──────────────────────────────────────────────────────────

log "Creating directory structure..."
mkdir -p /opt/ilowa/{api,backend/{lib,data},nillion/accuser,supabase,logs,certs}
chmod 700 /opt/ilowa/nillion  # credentials live here — keep it tight

# ── nillion accuser node ─────────────────────────────────────────────────────

log "Initialising Nillion accuser node..."
# pull the image first so we can run initialise
docker pull nillion/retailtoken-accuser:v1.0.0 > /dev/null 2>&1

docker run --rm \
  -v /opt/ilowa/nillion/accuser:/var/tmp \
  nillion/retailtoken-accuser:v1.0.0 initialise

if [[ -f /opt/ilowa/nillion/accuser/credentials.json ]]; then
  NILLION_ACCOUNT=$(python3 -c "import json; d=json.load(open('/opt/ilowa/nillion/accuser/credentials.json')); print(d.get('accountId','<not found>'))")
  NILLION_PUBKEY=$(python3  -c "import json; d=json.load(open('/opt/ilowa/nillion/accuser/credentials.json')); print(d.get('publicKey','<not found>'))")
  log "Nillion node initialised — account: ${NILLION_ACCOUNT}"
else
  warn "Nillion credentials file missing — check Docker output above"
fi

# ── self-hosted supabase ──────────────────────────────────────────────────────

log "Setting up self-hosted Supabase..."
cd /opt/ilowa/supabase
git clone --depth 1 https://github.com/supabase/supabase . > /dev/null 2>&1 || \
  (git fetch --depth 1 && git reset --hard HEAD)  # idempotent re-run

cd docker
cp .env.example .env

# generate all secrets in one pass
PG_PASS=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
JWT_SEC=$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 64)
ANON_K=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
SVC_K=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
DASHBOARD_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)

sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${PG_PASS}|"          .env
sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SEC}|"                         .env
sed -i "s|ANON_KEY=.*|ANON_KEY=${ANON_K}|"                              .env
sed -i "s|SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=${SVC_K}|"               .env
sed -i "s|DASHBOARD_PASSWORD=.*|DASHBOARD_PASSWORD=${DASHBOARD_PASS}|"  .env

log "Supabase env generated"

# ── systemd services ──────────────────────────────────────────────────────────

log "Creating systemd services..."

cat > /etc/systemd/system/ilowa-api.service << 'UNIT'
[Unit]
Description=Ilowa Node.js API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ilowa/api
EnvironmentFile=/opt/ilowa/api/.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5s
StandardOutput=append:/opt/ilowa/logs/api.log
StandardError=append:/opt/ilowa/logs/api.log

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/systemd/system/ilowa-backend.service << 'UNIT'
[Unit]
Description=Ilowa Python Backend (FastAPI)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ilowa/backend
EnvironmentFile=/opt/ilowa/backend/.env
ExecStart=/usr/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
Restart=on-failure
RestartSec=5s
Environment=PYTHONUNBUFFERED=1
StandardOutput=append:/opt/ilowa/logs/backend.log
StandardError=append:/opt/ilowa/logs/backend.log

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/systemd/system/nillion-accuser.service << 'UNIT'
[Unit]
Description=Nillion Accuser Node
After=docker.service
Requires=docker.service

[Service]
Type=simple
Restart=on-failure
RestartSec=10s
ExecStartPre=-/usr/bin/docker stop nillion-accuser
ExecStartPre=-/usr/bin/docker rm nillion-accuser
ExecStart=/usr/bin/docker run --name nillion-accuser \
  -v /opt/ilowa/nillion/accuser:/var/tmp \
  nillion/retailtoken-accuser:v1.0.0 start
StandardOutput=append:/opt/ilowa/logs/nillion.log
StandardError=append:/opt/ilowa/logs/nillion.log

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload

# ── ssl (certbot) ─────────────────────────────────────────────────────────────

log "Installing Certbot..."
apt-get install -y -qq certbot

# ── summary ───────────────────────────────────────────────────────────────────

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Ilowa VPS Setup Complete (${ELAPSED}s)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  NEXT STEPS (do these in order):"
echo ""
echo "  1. Fund Nillion node:"
echo "     Account:    ${NILLION_ACCOUNT:-<see credentials.json>}"
echo "     Faucet:     https://faucet.testnet.nillion.network/"
echo ""
echo "  2. Register Nillion verifier:"
echo "     PublicKey:  ${NILLION_PUBKEY:-<see credentials.json>}"
echo "     Dashboard:  https://verifier.nillion.com/"
echo ""
echo "  3. Start Supabase:"
echo "     cd /opt/ilowa/supabase/docker && docker-compose up -d"
echo ""
echo "  4. Get TLS cert (replace with your domain):"
echo "     certbot certonly --standalone -d api.ilowa.app"
echo ""
echo "  5. Deploy backend code, then enable services:"
echo "     systemctl enable --now ilowa-api ilowa-backend nillion-accuser"
echo ""
echo "  CREDENTIALS:"
echo "     Supabase:  /opt/ilowa/supabase/docker/.env"
echo "     Nillion:   /opt/ilowa/nillion/accuser/credentials.json"
echo ""
echo "  ⚠  Back up those credential files before doing anything else."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
