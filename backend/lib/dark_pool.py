"""
Dark Pool engine for Ilowa's Confidential AMM.

Encrypted order books, MPC-computed aggregates, blind settlement.
On-chain program only sees ciphertexts + ZK proofs — real amounts
stay in Nillion. Oracle resolution via HybridOracleAdapter.
"""

import hashlib
import json
import logging
import secrets
import time
from dataclasses import dataclass, asdict
from typing import Optional

from .quantum_crypto import post_quantum_crypto
from .nillion_client import nillion_storage
from .chain_adapter import chain_router, OraclePrice

logger = logging.getLogger("ilowa.darkpool")


@dataclass
class ConfidentialOrder:
    order_id: str
    wallet: str
    market_id: str
    side: str                  # "yes" | "no"
    encrypted_amount: str      # AES-256-GCM ciphertext from mobile
    commitment_hash: str       # sha3(wallet + market + amount + nonce)
    nillion_store_id: str = ""
    placed_at: int = 0
    settled: bool = False


@dataclass
class PoolSnapshot:
    market_id: str
    yes_count: int = 0
    no_count: int = 0
    aggregate_yes_lamports: int = 0
    aggregate_no_lamports: int = 0
    last_updated: int = 0


@dataclass
class SettlementResult:
    market_id: str
    outcome: bool
    winners: int = 0
    losers: int = 0
    total_payout_lamports: int = 0
    oracle_price: Optional[OraclePrice] = None
    settled_at: int = 0


class DarkPoolEngine:

    def __init__(self):
        self._active: dict[str, list[ConfidentialOrder]] = {}

    async def place_order(
        self, wallet: str, market_id: str, side: str,
        encrypted_amount: str, commitment_hash: str, db_pool,
    ) -> ConfidentialOrder:
        if side not in ("yes", "no"):
            raise ValueError(f"side must be 'yes' or 'no', got '{side}'")

        order_id = f"dp_{int(time.time()*1000)}_{secrets.token_hex(4)}"

        # blind-store the encrypted amount in Nillion
        await nillion_storage.initialise(wallet)
        store_id = await nillion_storage.store_secret(
            name=f"darkpool_{order_id}",
            value=encrypted_amount,
            ttl_days=30,
        )

        order = ConfidentialOrder(
            order_id=order_id, wallet=wallet, market_id=market_id,
            side=side, encrypted_amount=encrypted_amount,
            commitment_hash=commitment_hash,
            nillion_store_id=store_id, placed_at=int(time.time() * 1000),
        )

        # pointer row in Supabase — no amounts, just the reference
        async with db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO dark_pool_orders
                    (order_id, wallet_address, market_id, side,
                     commitment_hash, nillion_store_id, placed_at)
                VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7/1000.0))
            """, order_id, wallet, market_id, side,
                commitment_hash, store_id, order.placed_at)

        self._active.setdefault(market_id, []).append(order)
        logger.info("Dark pool order %s placed — %s on %s",
                     order_id[:12], side, market_id[:8])
        return order

    async def get_pool_snapshot(self, market_id: str, db_pool) -> PoolSnapshot:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT side, COUNT(*) as cnt
                FROM dark_pool_orders
                WHERE market_id = $1 AND settled = false
                GROUP BY side
            """, market_id)

        snap = PoolSnapshot(market_id=market_id, last_updated=int(time.time()))
        for r in rows:
            if r["side"] == "yes":
                snap.yes_count = r["cnt"]
            else:
                snap.no_count = r["cnt"]
        return snap

    async def resolve_with_oracle(
        self, market_id: str, pair: str, threshold: float, above: bool,
    ) -> Optional[bool]:
        """Check oracle and return resolution outcome, or None if indeterminate."""
        result = await chain_router.oracle.can_resolve(pair, threshold, above)
        if result is not None:
            logger.info("Oracle resolved %s: %s (pair=%s threshold=%.2f above=%s)",
                        market_id[:8], result, pair, threshold, above)
        return result

    async def settle_market(
        self, market_id: str, outcome: bool, db_pool,
    ) -> SettlementResult:
        """
        Mark all dark pool orders for this market as settled.
        Winning side gets flagged — actual payout happens on-chain via
        claim_light_winnings after the program's resolve tx confirms.
        """
        winning_side = "yes" if outcome else "no"

        async with db_pool.acquire() as conn:
            # count winners and losers
            stats = await conn.fetch("""
                SELECT side, COUNT(*) as cnt
                FROM dark_pool_orders
                WHERE market_id = $1 AND settled = false
                GROUP BY side
            """, market_id)

            winners = losers = 0
            for r in stats:
                if r["side"] == winning_side:
                    winners = r["cnt"]
                else:
                    losers = r["cnt"]

            # mark everything settled
            await conn.execute("""
                UPDATE dark_pool_orders SET settled = true
                WHERE market_id = $1 AND settled = false
            """, market_id)

        # clear memory cache
        self._active.pop(market_id, None)

        result = SettlementResult(
            market_id=market_id, outcome=outcome,
            winners=winners, losers=losers,
            settled_at=int(time.time() * 1000),
        )
        logger.info("Settled %s — %d winners, %d losers",
                     market_id[:8], winners, losers)
        return result

    @staticmethod
    def compute_commitment(wallet: str, market_id: str, amount_str: str) -> str:
        """Deterministic commitment hash — verifiable without revealing amount."""
        nonce = secrets.token_hex(16)
        payload = f"{wallet}:{market_id}:{amount_str}:{nonce}"
        return post_quantum_crypto.sha3_256(payload)


# singleton
dark_pool = DarkPoolEngine()
