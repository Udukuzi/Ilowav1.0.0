# Supabase + Python Backend Setup Guide

## Architecture

```
Mobile App (Expo) → Node.js API (/api) → Python Backend (/backend)
                                              ↓
                                         Supabase (Postgres)
                                              ↓
                                         Nillion (blind vault)
```

- **Node.js API** — public-facing: stream metadata, leaderboard reads, proxy
- **Python Backend** — privacy-sensitive: Nillion secrets, dark pool, governance, points
- **Supabase** — Postgres DB for caches, pointers, user state
- **Nillion** — encrypted secret storage (bet amounts, private data)

## Prerequisites

- Python 3.11+
- A Supabase project (free tier works)
- Nillion testnet credentials (optional for dev)

## 1. Supabase Project Setup

### Create project at https://supabase.com/dashboard

1. Click **New Project**
2. Name: `ilowa` (or any name)
3. Region: pick closest to your users
4. Generate a strong DB password — **save it**

### Get your credentials

From **Project Settings → Database**:
- **Host:** `db.<project-ref>.supabase.co`
- **Port:** `5432` (or `6543` for connection pooler)
- **Database:** `postgres`
- **User:** `postgres`
- **Password:** (the one you set)

Build the connection URL:
```
postgresql://postgres:<PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres
```

For pooled connections (recommended for production):
```
postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres
```

### Run the schema migrations

Connect via Supabase SQL Editor or `psql` and run:

```sql
-- Users
CREATE TABLE IF NOT EXISTS users (
    wallet_address TEXT PRIMARY KEY,
    region TEXT NOT NULL DEFAULT 'global',
    language TEXT NOT NULL DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Points cache (fast reads, authoritative source is Nillion)
CREATE TABLE IF NOT EXISTS user_points_cache (
    wallet_address TEXT PRIMARY KEY REFERENCES users(wallet_address),
    total_points INTEGER DEFAULT 0,
    tier TEXT DEFAULT 'bronze',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Points event log
CREATE TABLE IF NOT EXISTS points_events (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL REFERENCES users(wallet_address),
    delta INTEGER NOT NULL,
    reason TEXT NOT NULL,
    breakdown JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Nillion secret references
CREATE TABLE IF NOT EXISTS nillion_secrets (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    secret_type TEXT NOT NULL DEFAULT 'generic',
    secret_name TEXT NOT NULL,
    nillion_store_id TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_nillion_wallet_name ON nillion_secrets(wallet_address, secret_name);

-- Private bets (pointer to Nillion, amount encrypted)
CREATE TABLE IF NOT EXISTS private_bets (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    market_id TEXT NOT NULL,
    nillion_store_id TEXT,
    resolver_wallet TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(wallet_address, market_id)
);

-- Governance proposals
CREATE TABLE IF NOT EXISTS proposals (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    proposer_wallet TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    voting_ends TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'active'
);

-- Votes
CREATE TABLE IF NOT EXISTS votes (
    id BIGSERIAL PRIMARY KEY,
    proposal_id TEXT REFERENCES proposals(id),
    wallet_address TEXT NOT NULL,
    vote TEXT NOT NULL CHECK (vote IN ('yes', 'no', 'abstain')),
    nillion_store_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(proposal_id, wallet_address)
);

-- SAFT holders (for governance eligibility)
CREATE TABLE IF NOT EXISTS saft_holders (
    wallet_address TEXT PRIMARY KEY,
    added_at TIMESTAMPTZ DEFAULT now()
);

-- Dark pool orders
CREATE TABLE IF NOT EXISTS dark_pool_orders (
    order_id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    market_id TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('yes', 'no')),
    nillion_store_id TEXT,
    commitment_hash TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Leaderboard materialized view (refresh periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS leaderboard AS
SELECT
    u.wallet_address,
    u.region,
    COALESCE(p.total_points, 0) AS total_points,
    COALESCE(p.tier, 'bronze') AS tier
FROM users u
LEFT JOIN user_points_cache p ON u.wallet_address = p.wallet_address
ORDER BY total_points DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_wallet ON leaderboard(wallet_address);
```

## 2. Environment Variables

Create `/backend/.env`:

```bash
# ── Supabase ──
SUPABASE_DB_URL=postgresql://postgres:<PASSWORD>@db.<REF>.supabase.co:5432/postgres

# ── Nillion (testnet) ──
NILLION_CLUSTER_ID=<from Nillion dashboard>
NILLION_BOOTNODE_MULTIADDR=<from Nillion dashboard>
NILLION_PAYMENT_KEY=<your private key hex>
NILLION_USER_SEED=ilowa-backend

# ── Solana ──
SOLANA_RPC_URL=https://api.devnet.solana.com

# ── Logging ──
LOG_LEVEL=info
```

## 3. Install & Run

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The backend starts on `http://localhost:8000`. Health check: `GET /health`.

## 4. Connect the Mobile App

In your Expo app's `.env`:

```bash
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
# For device testing, use your machine's LAN IP:
# EXPO_PUBLIC_BACKEND_URL=http://192.168.1.x:8000
```

The Node.js API layer (`/api/server/index.ts`) proxies privacy-sensitive requests to the Python backend.

## 5. Deployment (Production)

### Option A: Railway / Render

1. Push `/backend` as a separate service
2. Set env vars in dashboard
3. Use Supabase pooled connection string (port 6543)
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Option B: Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Production checklist

- [ ] Tighten CORS origins (replace `"*"` in `main.py`)
- [ ] Use pooled Supabase connection string
- [ ] Set `LOG_LEVEL=warning`
- [ ] Enable Supabase Row Level Security (RLS) on sensitive tables
- [ ] Add rate limiting (e.g., `slowapi`)
- [ ] Set up Nillion mainnet credentials when available

## API Endpoints Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |
| POST | `/user/sync` | Wallet | Ensure user exists |
| POST | `/bets/store` | Wallet | Store private bet (Nillion) |
| GET | `/bets/{market_id}` | Wallet | Retrieve private bet |
| POST | `/points/event` | Wallet | Record points change |
| POST | `/points/award` | No* | Award points for action |
| GET | `/leaderboard` | No | Get leaderboard |
| POST | `/governance/vote` | Wallet | Cast governance vote |
| POST | `/governance/propose` | No* | Create proposal |
| POST | `/nillion/store` | Wallet | Store generic secret |
| GET | `/nillion/retrieve` | Wallet | Retrieve secret |
| DELETE | `/nillion/delete` | Wallet | Delete secret |
| POST | `/darkpool/order` | Wallet | Place dark pool order |
| GET | `/darkpool/pool/{id}` | No | Pool snapshot |
| POST | `/darkpool/settle` | Wallet | Settle market |
| GET | `/oracle/price/{pair}` | No | Get oracle price |
| POST | `/oracle/resolve` | Wallet | Check oracle condition |

*Called by Node.js gateway which validates JWT first.

**Auth = Wallet** means the request must include `X-Wallet-Address` header.
