#!/usr/bin/env bash
set -euo pipefail

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Ilowa Deploy Script
#  Deploys Node.js API + Python backend via Docker Compose
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

echo "┌─────────────────────────────────────┐"
echo "│  Ilowa Backend Deploy               │"
echo "└─────────────────────────────────────┘"

# Check env files exist
if [ ! -f backend/.env ]; then
  echo "⚠  backend/.env missing — copying from .env.example"
  cp backend/.env.example backend/.env
  echo "   → Edit backend/.env with real credentials before running"
fi

if [ ! -f server/.env ]; then
  echo "⚠  server/.env not found — creating minimal one"
  cat > server/.env <<'EOF'
PORT=3000
PYTHON_API_URL=http://backend:8000
QWEN_API_KEY=
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen3-235b-a22b
SUPABASE_URL=http://supabase-db:5432
SUPABASE_ANON_KEY=
ELEVENLABS_API_KEY=
RESOLVER_WALLET=
EOF
  echo "   → Edit server/.env with real credentials"
fi

# Build and deploy
echo ""
echo "Building containers..."
docker compose build --parallel

echo ""
echo "Starting services..."
docker compose up -d

echo ""
echo "Waiting for health checks..."
sleep 5

# Check health
API_OK=$(curl -sf http://localhost:3000/health 2>/dev/null | grep -c '"ok"' || echo "0")
BACKEND_OK=$(curl -sf http://localhost:8000/health 2>/dev/null | grep -c '"ok"' || echo "0")

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$API_OK" = "1" ]; then
  echo "  ✓ Node.js API:    http://localhost:3000"
else
  echo "  ✗ Node.js API:    NOT RESPONDING"
fi
if [ "$BACKEND_OK" = "1" ]; then
  echo "  ✓ Python Backend: http://localhost:8000"
else
  echo "  ✗ Python Backend: NOT RESPONDING"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Logs: docker compose logs -f"
echo "Stop: docker compose down"
