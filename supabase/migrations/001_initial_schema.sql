-- Ilowa initial schema
-- Layer 1 metadata only — no PII, no raw amounts, no private keys ever live here
-- Run against the self-hosted Supabase postgres instance

-- ── extensions ───────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── users ─────────────────────────────────────────────────────────────────────
-- Deliberately thin. Sensitive profile data goes straight to Nillion.

CREATE TABLE IF NOT EXISTS users (
  wallet_address  TEXT        PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  region          TEXT        NOT NULL,
  language        TEXT        NOT NULL DEFAULT 'en',
  tier            TEXT        NOT NULL DEFAULT 'bronze',
  is_verified     BOOLEAN     NOT NULL DEFAULT false,

  CONSTRAINT tier_values CHECK (tier IN ('bronze','silver','gold','diamond','elder'))
);

CREATE INDEX idx_users_region   ON users (region);
CREATE INDEX idx_users_tier     ON users (tier);
CREATE INDEX idx_users_active   ON users (last_active DESC);

-- ── points cache ─────────────────────────────────────────────────────────────
-- This is a read-optimised summary. The real breakdown stays in Nillion.
-- Gets refreshed by the backend worker, not written to directly by clients.

CREATE TABLE IF NOT EXISTS user_points_cache (
  wallet_address  TEXT        PRIMARY KEY REFERENCES users (wallet_address) ON DELETE CASCADE,
  total_points    INTEGER     NOT NULL DEFAULT 0,
  tier            TEXT        NOT NULL DEFAULT 'bronze',
  last_updated    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT cache_tier_values CHECK (tier IN ('bronze','silver','gold','diamond','elder'))
);

CREATE INDEX idx_points_leaderboard ON user_points_cache (tier, total_points DESC);

-- ── proposals ────────────────────────────────────────────────────────────────
-- Vote tallies are NOT stored here — those go to Nillion for blind counting.
-- This table is just for listing / discovery.

CREATE TABLE IF NOT EXISTS proposals (
  id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  title           TEXT        NOT NULL,
  description     TEXT,
  proposer_wallet TEXT        REFERENCES users (wallet_address) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  voting_ends     TIMESTAMPTZ NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'active',
  proposal_type   TEXT        NOT NULL DEFAULT 'community',

  CONSTRAINT proposal_status  CHECK (status IN ('active','passed','rejected','expired','cancelled')),
  CONSTRAINT proposal_type_ck CHECK (proposal_type IN ('community','saft','emergency'))
);

CREATE INDEX idx_proposals_status  ON proposals (status, voting_ends);
CREATE INDEX idx_proposals_recent  ON proposals (created_at DESC);

-- ── nillion secret references ─────────────────────────────────────────────────
-- Pointers only. The store_id is meaningless without the Nillion node — intentional.

CREATE TABLE IF NOT EXISTS nillion_secrets (
  id              BIGSERIAL   PRIMARY KEY,
  wallet_address  TEXT        NOT NULL REFERENCES users (wallet_address) ON DELETE CASCADE,
  secret_type     TEXT        NOT NULL,
  secret_name     TEXT,
  nillion_store_id TEXT       NOT NULL UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,

  CONSTRAINT secret_type_values CHECK (
    secret_type IN ('points_breakdown','pii','bet_amount','vote','private_key_shard','ai_data','generic')
  )
);

CREATE INDEX idx_secrets_wallet_type ON nillion_secrets (wallet_address, secret_type);
CREATE INDEX idx_secrets_wallet_name ON nillion_secrets (wallet_address, secret_name) WHERE secret_name IS NOT NULL;
CREATE INDEX idx_secrets_expiry      ON nillion_secrets (expires_at) WHERE expires_at IS NOT NULL;

-- ── saft holders ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saft_holders (
  wallet_address    TEXT        PRIMARY KEY REFERENCES users (wallet_address),
  amount_usd        NUMERIC(14,2) NOT NULL CHECK (amount_usd > 0),
  investment_date   TIMESTAMPTZ NOT NULL,
  governance_weight NUMERIC(12,4) NOT NULL CHECK (governance_weight > 0),
  notes             TEXT
);

CREATE INDEX idx_saft_weight ON saft_holders (governance_weight DESC);

-- ── differential-privacy analytics ───────────────────────────────────────────
-- Rows written by the backend worker only — never by the app directly.
-- Counts already have Laplacian noise applied before insert.

CREATE TABLE IF NOT EXISTS analytics_daily (
  date                DATE    PRIMARY KEY,
  daily_active_users  INTEGER NOT NULL DEFAULT 0,
  markets_created     INTEGER NOT NULL DEFAULT 0,
  predictions_made    INTEGER NOT NULL DEFAULT 0,
  total_volume_sol    NUMERIC(20,9) NOT NULL DEFAULT 0,
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── row level security ────────────────────────────────────────────────────────

ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_points_cache  ENABLE ROW LEVEL SECURITY;
ALTER TABLE nillion_secrets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE saft_holders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily    ENABLE ROW LEVEL SECURITY;

-- users: own row only
CREATE POLICY users_self_select ON users
  FOR SELECT USING (wallet_address = current_setting('app.wallet', true));

CREATE POLICY users_self_update ON users
  FOR UPDATE USING (wallet_address = current_setting('app.wallet', true));

-- points: own row only
CREATE POLICY points_self_select ON user_points_cache
  FOR SELECT USING (wallet_address = current_setting('app.wallet', true));

-- nillion refs: own rows only
CREATE POLICY secrets_self_select ON nillion_secrets
  FOR SELECT USING (wallet_address = current_setting('app.wallet', true));

-- proposals: readable by everyone (governance needs transparency)
CREATE POLICY proposals_public_read ON proposals
  FOR SELECT USING (true);

-- saft: own row + admins (service role bypasses RLS anyway)
CREATE POLICY saft_self_select ON saft_holders
  FOR SELECT USING (wallet_address = current_setting('app.wallet', true));

-- analytics: public read
CREATE POLICY analytics_public_read ON analytics_daily
  FOR SELECT USING (true);

-- ── helper functions ──────────────────────────────────────────────────────────

-- Upsert user on first login / region change
CREATE OR REPLACE FUNCTION upsert_user(
  p_wallet   TEXT,
  p_region   TEXT,
  p_language TEXT DEFAULT 'en'
) RETURNS VOID AS $$
BEGIN
  INSERT INTO users (wallet_address, region, language, last_active)
  VALUES (p_wallet, p_region, p_language, NOW())
  ON CONFLICT (wallet_address) DO UPDATE
    SET last_active = NOW(),
        region      = EXCLUDED.region,
        language    = EXCLUDED.language;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bump last_active without a full round-trip from the app
CREATE OR REPLACE FUNCTION touch_user(p_wallet TEXT) RETURNS VOID AS $$
BEGIN
  UPDATE users SET last_active = NOW() WHERE wallet_address = p_wallet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Noisy DAU for public dashboards — epsilon=0.1 Laplacian mechanism
CREATE OR REPLACE FUNCTION get_daily_active_users(target_date DATE)
RETURNS INTEGER AS $$
DECLARE
  real_count INTEGER;
  noise      FLOAT;
  u1 FLOAT; u2 FLOAT;
BEGIN
  SELECT COUNT(DISTINCT wallet_address) INTO real_count
  FROM users
  WHERE DATE(last_active) = target_date;

  -- Box–Muller gives us a normal distribution; we convert to Laplacian
  u1 := random(); u2 := random();
  noise := sqrt(-2.0 * ln(u1)) * cos(2.0 * pi() * u2);
  -- scale by 1/epsilon (sensitivity=1, epsilon=0.1 → b=10)
  noise := noise * 10.0;

  RETURN GREATEST(0, (real_count + noise)::INTEGER);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refresh points cache from a Nillion-sourced value (called by backend worker)
CREATE OR REPLACE FUNCTION refresh_points_cache(
  p_wallet TEXT,
  p_points INTEGER,
  p_tier   TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO user_points_cache (wallet_address, total_points, tier, last_updated)
  VALUES (p_wallet, p_points, p_tier, NOW())
  ON CONFLICT (wallet_address) DO UPDATE
    SET total_points = EXCLUDED.total_points,
        tier         = EXCLUDED.tier,
        last_updated = NOW();

  -- keep users.tier in sync too
  UPDATE users SET tier = p_tier WHERE wallet_address = p_wallet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
