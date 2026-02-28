"""
StorageOrchestrator — routes data to the right layer.

The idea is simple: anything that could be used to identify or harm a user
goes to Nillion. Everything else (pointers, metadata, leaderboard positions)
goes to Supabase so the app can query it quickly.

Nothing in here should ever write raw amounts or PII to Supabase.
If you're tempted to add that, put it in Nillion instead and store the
store_id reference here.
"""

import logging
import os
from datetime import datetime, timezone
from typing import Optional

import asyncpg
from fastapi import HTTPException

from .nillion_client import nillion_storage

logger = logging.getLogger("ilowa.storage")

# tier thresholds — tweak these as the points economy matures
TIER_THRESHOLDS = {
    "bronze":  0,
    "silver":  1_000,
    "gold":    5_000,
    "diamond": 20_000,
    "elder":   100_000,
}


def points_to_tier(total: int) -> str:
    tier = "bronze"
    for name, threshold in TIER_THRESHOLDS.items():
        if total >= threshold:
            tier = name
    return tier


class StorageOrchestrator:

    def __init__(self):
        self._pool: Optional[asyncpg.Pool] = None

    async def connect(self, db_url: str):
        """Call once at startup (lifespan handler in main.py)."""
        self._pool = await asyncpg.create_pool(
            db_url,
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
        logger.info("Supabase Postgres pool ready")

    async def close(self):
        if self._pool:
            await self._pool.close()

    def _db(self):
        if self._pool is None:
            raise RuntimeError("DB pool not initialised — call connect() first")
        return self._pool

    # ── user registration / login ─────────────────────────────────────────────

    async def ensure_user(self, wallet: str, region: str, language: str = "en"):
        """
        Called on every app launch. Creates the user row if first time,
        otherwise just bumps last_active.
        """
        async with self._db().acquire() as conn:
            await conn.execute(
                "SELECT upsert_user($1, $2, $3)",
                wallet, region, language,
            )

    # ── private bets ──────────────────────────────────────────────────────────

    async def store_private_bet(
        self,
        wallet: str,
        market_id: str,
        amount_sol: float,
        resolver_wallet: str,
        market_resolve_date: Optional[datetime] = None,
    ) -> dict:
        """
        Two-phase write:
          1. Amount → Nillion (no Supabase node ever sees it)
          2. store_id pointer → Supabase (fast lookup, useless without Nillion)
        """
        store_id = await nillion_storage.store_bet_amount(
            wallet        = wallet,
            market_id     = market_id,
            amount        = amount_sol,
            resolver      = resolver_wallet,
        )

        expires = market_resolve_date
        async with self._db().acquire() as conn:
            await conn.execute(
                """
                INSERT INTO nillion_secrets
                    (wallet_address, secret_type, nillion_store_id, expires_at)
                VALUES ($1, 'bet_amount', $2, $3)
                ON CONFLICT (nillion_store_id) DO NOTHING
                """,
                wallet, store_id, expires,
            )

        logger.info("Private bet stored — wallet=%s market=%s", wallet[:8] + "…", market_id[:8] + "…")
        return {"store_id": store_id, "encrypted": True}

    async def get_private_bet(self, wallet: str, market_id: str) -> float:
        """
        Reverse of the above. Looks up the store_id in Supabase, fetches
        the actual value from Nillion.
        """
        async with self._db().acquire() as conn:
            # grab the most recent bet for this market
            row = await conn.fetchrow(
                """
                SELECT ns.nillion_store_id
                FROM   nillion_secrets ns
                WHERE  ns.wallet_address = $1
                  AND  ns.secret_type    = 'bet_amount'
                  AND  ns.nillion_store_id LIKE $2
                ORDER BY ns.created_at DESC
                LIMIT 1
                """,
                wallet,
                f"%{market_id[:8]}%",  # loose match on the store_id name prefix
            )

        if not row:
            raise HTTPException(status_code=404, detail="No bet found for this market")

        await nillion_storage.initialise(wallet)
        raw = await nillion_storage.retrieve_secret(row["nillion_store_id"], f"bet_{market_id}")
        return float(raw)

    # ── points ────────────────────────────────────────────────────────────────

    async def record_points_event(
        self,
        wallet: str,
        delta: int,
        reason: str,
        full_breakdown: Optional[dict] = None,
    ) -> dict:
        """
        Add delta points to a user. Stores the detailed breakdown in Nillion,
        updates the summary cache in Supabase.

        full_breakdown example:
          {"prediction_wins": 120, "radio_tips": 50, "governance": 30, ...}
        """
        # fetch current totals from cache (fast)
        async with self._db().acquire() as conn:
            row = await conn.fetchrow(
                "SELECT total_points FROM user_points_cache WHERE wallet_address = $1",
                wallet,
            )

        current = row["total_points"] if row else 0
        new_total = max(0, current + delta)
        new_tier  = points_to_tier(new_total)

        # if the caller gave us a breakdown, encrypt it
        if full_breakdown is not None:
            full_breakdown["total"] = new_total
            full_breakdown["last_event"] = {"reason": reason, "delta": delta}
            try:
                store_id = await nillion_storage.store_points_breakdown(wallet, full_breakdown)
                # update the reference
                async with self._db().acquire() as conn:
                    await conn.execute(
                        """
                        INSERT INTO nillion_secrets
                            (wallet_address, secret_type, nillion_store_id)
                        VALUES ($1, 'points_breakdown', $2)
                        ON CONFLICT (nillion_store_id) DO NOTHING
                        """,
                        wallet, store_id,
                    )
            except Exception as exc:
                # Nillion hiccup — log but don't block the points update
                logger.warning("Couldn't persist breakdown to Nillion: %s", exc)

        # always update the Supabase cache regardless of Nillion outcome
        async with self._db().acquire() as conn:
            await conn.execute(
                "SELECT refresh_points_cache($1, $2, $3)",
                wallet, new_total, new_tier,
            )

        return {"total": new_total, "tier": new_tier, "delta": delta}

    async def get_leaderboard(self, region: Optional[str] = None, limit: int = 50) -> list[dict]:
        """
        Public leaderboard from the Supabase cache.
        Returns wallet prefix + points + tier — no full addresses exposed.
        """
        async with self._db().acquire() as conn:
            if region:
                rows = await conn.fetch(
                    """
                    SELECT  SUBSTRING(p.wallet_address, 1, 6) || '…' AS wallet_hint,
                            p.total_points,
                            p.tier
                    FROM    user_points_cache p
                    JOIN    users u ON u.wallet_address = p.wallet_address
                    WHERE   u.region = $1
                    ORDER BY p.total_points DESC
                    LIMIT   $2
                    """,
                    region, limit,
                )
            else:
                rows = await conn.fetch(
                    """
                    SELECT  SUBSTRING(wallet_address, 1, 6) || '…' AS wallet_hint,
                            total_points,
                            tier
                    FROM    user_points_cache
                    ORDER BY total_points DESC
                    LIMIT   $1
                    """,
                    limit,
                )

        return [dict(r) for r in rows]

    # ── governance votes ──────────────────────────────────────────────────────

    async def cast_vote(self, wallet: str, proposal_id: str, vote_value: str) -> dict:
        """
        Store a governance vote. The actual vote value goes to Nillion —
        Supabase only gets the pointer so we know the user voted.
        """
        # make sure the proposal exists and is still open
        async with self._db().acquire() as conn:
            row = await conn.fetchrow(
                "SELECT status, voting_ends FROM proposals WHERE id = $1",
                proposal_id,
            )

        if not row:
            raise HTTPException(404, "Proposal not found")
        if row["status"] != "active":
            raise HTTPException(400, f"Proposal is {row['status']}, not active")
        if row["voting_ends"] < datetime.now(timezone.utc):
            raise HTTPException(400, "Voting period has ended")

        # blind store the actual vote
        store_id = await nillion_storage.store_vote(wallet, proposal_id, vote_value)

        async with self._db().acquire() as conn:
            await conn.execute(
                """
                INSERT INTO nillion_secrets
                    (wallet_address, secret_type, nillion_store_id,
                     expires_at)
                VALUES ($1, 'vote', $2, $3)
                ON CONFLICT (nillion_store_id) DO NOTHING
                """,
                wallet, store_id, row["voting_ends"],
            )

        logger.info("Vote cast — wallet=%s proposal=%s", wallet[:8] + "…", proposal_id[:8] + "…")
        return {"stored": True, "proposal_id": proposal_id}


# module-level singleton
storage = StorageOrchestrator()
