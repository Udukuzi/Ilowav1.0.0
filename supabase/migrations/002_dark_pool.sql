-- Dark pool orders — confidential AMM order book metadata
-- Actual bet amounts live in Nillion; this table only stores pointers + sides.

CREATE TABLE IF NOT EXISTS dark_pool_orders (
  order_id          TEXT        PRIMARY KEY,
  wallet_address    TEXT        NOT NULL REFERENCES users (wallet_address) ON DELETE CASCADE,
  market_id         TEXT        NOT NULL,
  side              TEXT        NOT NULL,
  commitment_hash   TEXT        NOT NULL,
  nillion_store_id  TEXT        NOT NULL,
  placed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled           BOOLEAN     NOT NULL DEFAULT false,

  CONSTRAINT dp_side_values CHECK (side IN ('yes', 'no'))
);

CREATE INDEX idx_dp_market_active ON dark_pool_orders (market_id) WHERE settled = false;
CREATE INDEX idx_dp_wallet        ON dark_pool_orders (wallet_address, placed_at DESC);

ALTER TABLE dark_pool_orders ENABLE ROW LEVEL SECURITY;

-- users can only see their own orders
CREATE POLICY dp_self_select ON dark_pool_orders
  FOR SELECT USING (wallet_address = current_setting('app.wallet', true));

-- backend service role bypasses RLS anyway, but this keeps direct DB access safe
