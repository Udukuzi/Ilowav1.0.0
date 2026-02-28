"""
Ilowa Python backend — FastAPI entry point.

Handles everything that's too privacy-sensitive for the Node.js API:
- Private bet storage / retrieval (Nillion blind vault)
- Points accounting with encrypted breakdowns
- Governance vote submission (blind counting)
- Analytics aggregation with differential privacy

The Node.js API in /api handles public-facing stuff (stream metadata,
leaderboard reads, etc.) and proxies here for anything touching Nillion.
"""

import json
import logging
import os
import time
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from lib.nillion_client import nillion_storage
from lib.storage_orchestrator import storage
from lib.dark_pool import dark_pool
from lib.chain_adapter import chain_router

load_dotenv()

logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "info").upper()),
    format="%(asctime)s %(name)s %(levelname)s — %(message)s",
)
logger = logging.getLogger("ilowa.main")


# ── startup / shutdown ────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    db_url = os.environ["SUPABASE_DB_URL"]
    await storage.connect(db_url)
    logger.info("Backend ready")
    yield
    await storage.close()
    logger.info("Backend shut down cleanly")


app = FastAPI(title="Ilowa Backend", version="0.1.0", lifespan=lifespan)

_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()] or ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "x-wallet-address"],
)


# ── auth helper ───────────────────────────────────────────────────────────────
# Super minimal for now — Node.js API gateway validates JWT before forwarding.
# The wallet address comes through as a header set by the gateway.

def get_wallet(x_wallet_address: str = Header(...)) -> str:
    if not x_wallet_address or len(x_wallet_address) < 32:
        raise HTTPException(401, "Missing or invalid wallet address header")
    return x_wallet_address


# ── request/response models ───────────────────────────────────────────────────

class UserSyncBody(BaseModel):
    region: str
    language: str = "en"

class BetBody(BaseModel):
    market_id: str
    amount_sol: float
    resolver_wallet: str

class PointsEventBody(BaseModel):
    delta: int
    reason: str
    breakdown: dict | None = None

class VoteBody(BaseModel):
    proposal_id: str
    vote: str   # "yes" | "no" | "abstain"

class AwardPointsBody(BaseModel):
    user_wallet: str
    action: str
    metadata: dict = {}

class ProposeBody(BaseModel):
    title: str
    description: str = ""
    proposer_wallet: str
    voting_duration: int = 7   # days


# ── routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/user/sync")
async def sync_user(body: UserSyncBody, wallet: str = Depends(get_wallet)):
    await storage.ensure_user(wallet, body.region, body.language)
    return {"synced": True}


@app.post("/bets/store")
async def store_bet(body: BetBody, wallet: str = Depends(get_wallet)):
    result = await storage.store_private_bet(
        wallet          = wallet,
        market_id       = body.market_id,
        amount_sol      = body.amount_sol,
        resolver_wallet = body.resolver_wallet,
    )
    return result


@app.get("/bets/{market_id}")
async def get_bet(market_id: str, wallet: str = Depends(get_wallet)):
    amount = await storage.get_private_bet(wallet, market_id)
    return {"amount_sol": amount, "market_id": market_id}


@app.post("/points/event")
async def points_event(body: PointsEventBody, wallet: str = Depends(get_wallet)):
    result = await storage.record_points_event(
        wallet    = wallet,
        delta     = body.delta,
        reason    = body.reason,
        full_breakdown = body.breakdown,
    )
    return result


@app.get("/leaderboard")
async def leaderboard(region: str | None = None, limit: int = 50):
    rows = await storage.get_leaderboard(region=region, limit=min(limit, 100))
    return {"entries": rows}


@app.post("/governance/vote")
async def cast_vote(body: VoteBody, wallet: str = Depends(get_wallet)):
    if body.vote not in ("yes", "no", "abstain"):
        raise HTTPException(400, "vote must be 'yes', 'no', or 'abstain'")
    result = await storage.cast_vote(wallet, body.proposal_id, body.vote)
    return result


# ── Part 3: points award + governance propose ─────────────────────────────────

@app.post("/points/award")
async def award_points(body: AwardPointsBody):
    """Called by Node.js proxy — awards points for a specific action and updates Nillion."""
    pts = _calc_points(body.action, body.metadata)
    category = _action_category(body.action)

    # pull existing breakdown if we have it, otherwise start fresh
    async with storage._db().acquire() as conn:
        row = await conn.fetchrow(
            "SELECT total_points FROM user_points_cache WHERE wallet_address = $1",
            body.user_wallet,
        )
    current_total = row["total_points"] if row else 0
    new_total = current_total + pts
    new_tier  = _tier_for(new_total)

    breakdown = {
        "category": category,
        "action":   body.action,
        "delta":    pts,
        "metadata": body.metadata,
    }

    result = await storage.record_points_event(
        wallet         = body.user_wallet,
        delta          = pts,
        reason         = body.action,
        full_breakdown = breakdown,
    )
    return {
        "points_awarded": pts,
        "new_total": result["total"],
        "tier": result["tier"],
    }


@app.post("/governance/propose")
async def create_proposal(body: ProposeBody):
    """Create a governance proposal. Requires 1 000+ points OR SAFT holder status."""
    # eligibility check against Supabase cache (fast path)
    async with storage._db().acquire() as conn:
        pts_row = await conn.fetchrow(
            "SELECT total_points FROM user_points_cache WHERE wallet_address = $1",
            body.proposer_wallet,
        )
        saft_row = await conn.fetchrow(
            "SELECT 1 FROM saft_holders WHERE wallet_address = $1",
            body.proposer_wallet,
        )

    has_points  = pts_row is not None and pts_row["total_points"] >= 1_000
    is_saft     = saft_row is not None

    if not has_points and not is_saft:
        raise HTTPException(403, "Need 1 000+ points or SAFT holder status to submit proposals")

    now_ms       = int(time.time() * 1000)
    deadline_ms  = now_ms + body.voting_duration * 86_400_000
    proposal_id  = f"prop_{now_ms}"

    async with storage._db().acquire() as conn:
        await conn.execute(
            """
            INSERT INTO proposals
                (id, title, description, proposer_wallet, created_at, voting_ends, status)
            VALUES ($1, $2, $3, $4, to_timestamp($5/1000.0), to_timestamp($6/1000.0), 'active')
            """,
            proposal_id,
            body.title,
            body.description,
            body.proposer_wallet,
            now_ms,
            deadline_ms,
        )

    logger.info("Proposal %s created by %s", proposal_id, body.proposer_wallet[:8] + "\u2026")
    return {"proposal_id": proposal_id, "status": "created", "voting_ends_ms": deadline_ms}


# ── points helpers ────────────────────────────────────────────────────────────

_POINTS_TABLE: dict[str, int] = {
    "market_created":      10,
    "bet_placed":           5,
    "prediction_won":      50,
    "creator_followed":     2,
    "creator_tipped":      15,
    "user_referred":      100,
    "radio_call_in":        8,
    "nft_minted":          20,
}

def _calc_points(action: str, meta: dict) -> int:
    base = _POINTS_TABLE.get(action, 0)
    if action == "prediction_won":
        streak = int(meta.get("win_streak", 0))
        if streak >= 5:
            base += 100
        elif streak >= 3:
            base += 25
    return base

def _action_category(action: str) -> str:
    if action in ("market_created", "bet_placed"):
        return "predictions"
    if action == "prediction_won":
        return "accurate_predictions"
    if action in ("creator_followed", "creator_tipped", "radio_call_in"):
        return "social_engagement"
    if action == "user_referred":
        return "referrals"
    if action == "nft_minted":
        return "content_creation"
    return "early_user"

def _tier_for(total: int) -> str:
    if total >= 100_000: return "elder"
    if total >= 20_000:  return "diamond"
    if total >= 5_000:   return "gold"
    if total >= 1_000:   return "silver"
    return "bronze"


# ── Nillion generic store/retrieve/delete ─────────────────────────────────────
# Called by server/index.ts which proxies from the mobile NillionClient.

class NillionStoreBody(BaseModel):
    wallet: str
    secret_name: str
    secret_value: str
    allowed_users: list[str] = []

class NillionDeleteBody(BaseModel):
    wallet: str
    secret_name: str


@app.post("/nillion/store")
async def nillion_store(body: NillionStoreBody, wallet: str = Depends(get_wallet)):
    await nillion_storage.initialise(wallet)
    store_id = await nillion_storage.store_secret(
        name               = body.secret_name,
        value              = body.secret_value,
        allowed_retrievers = body.allowed_users,
    )
    # persist reference pointer in Supabase — name lets us look it up later
    try:
        async with storage._db().acquire() as conn:
            await conn.execute(
                """
                INSERT INTO nillion_secrets (wallet_address, secret_type, secret_name, nillion_store_id)
                VALUES ($1, 'generic', $2, $3)
                ON CONFLICT (nillion_store_id) DO NOTHING
                """,
                wallet, body.secret_name, store_id,
            )
    except Exception as exc:
        logger.warning("Could not persist Nillion ref to Supabase: %s", exc)

    return {"store_id": store_id}


@app.get("/nillion/retrieve")
async def nillion_retrieve(secret_name: str, wallet: str = Depends(get_wallet)):
    async with storage._db().acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT nillion_store_id FROM nillion_secrets
            WHERE  wallet_address = $1
              AND  secret_name    = $2
            ORDER BY created_at DESC LIMIT 1
            """,
            wallet, secret_name,
        )

    if not row:
        raise HTTPException(404, "Secret not found")

    await nillion_storage.initialise(wallet)
    try:
        value = await nillion_storage.retrieve_secret(row["nillion_store_id"], secret_name)
        return {"value": value}
    except PermissionError:
        raise HTTPException(403, "Not authorised to access this secret")
    except Exception as exc:
        if "not found" in str(exc).lower():
            raise HTTPException(404, "Secret not found")
        raise HTTPException(500, str(exc))


@app.delete("/nillion/delete")
async def nillion_delete(body: NillionDeleteBody, wallet: str = Depends(get_wallet)):
    async with storage._db().acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT nillion_store_id FROM nillion_secrets
            WHERE  wallet_address = $1
              AND  secret_name    = $2
            ORDER BY created_at DESC LIMIT 1
            """,
            wallet, body.secret_name,
        )

    if not row:
        return {"deleted": False, "reason": "not_found"}

    await nillion_storage.initialise(wallet)
    ok = await nillion_storage.delete_secret(row["nillion_store_id"])

    if ok:
        async with storage._db().acquire() as conn:
            await conn.execute(
                "DELETE FROM nillion_secrets WHERE nillion_store_id = $1",
                row["nillion_store_id"],
            )

    return {"deleted": ok}


# ── Dark Pool / Confidential AMM ─────────────────────────────────────────────

class DarkPoolOrderBody(BaseModel):
    market_id: str
    side: str           # "yes" | "no"
    encrypted_amount: str
    commitment_hash: str

class DarkPoolSettleBody(BaseModel):
    market_id: str
    outcome: bool

class OracleResolveBody(BaseModel):
    market_id: str
    pair: str           # e.g. "SOL/USD"
    threshold: float
    above: bool


@app.post("/darkpool/order")
async def darkpool_place_order(body: DarkPoolOrderBody, wallet: str = Depends(get_wallet)):
    """Place an encrypted bet into the dark pool. Amount stays in Nillion."""
    try:
        order = await dark_pool.place_order(
            wallet=wallet,
            market_id=body.market_id,
            side=body.side,
            encrypted_amount=body.encrypted_amount,
            commitment_hash=body.commitment_hash,
            db_pool=storage._db(),
        )
        return {
            "order_id": order.order_id,
            "nillion_store_id": order.nillion_store_id,
            "side": order.side,
        }
    except ValueError as exc:
        raise HTTPException(400, str(exc))


@app.get("/darkpool/pool/{market_id}")
async def darkpool_snapshot(market_id: str):
    """Public pool snapshot — counts only, no individual amounts."""
    snap = await dark_pool.get_pool_snapshot(market_id, storage._db())
    return {
        "market_id": snap.market_id,
        "yes_count": snap.yes_count,
        "no_count": snap.no_count,
        "last_updated": snap.last_updated,
    }


@app.post("/darkpool/settle")
async def darkpool_settle(body: DarkPoolSettleBody, wallet: str = Depends(get_wallet)):
    """Settle all dark pool orders for a resolved market."""
    result = await dark_pool.settle_market(
        market_id=body.market_id,
        outcome=body.outcome,
        db_pool=storage._db(),
    )
    return {
        "market_id": result.market_id,
        "outcome": result.outcome,
        "winners": result.winners,
        "losers": result.losers,
        "settled_at": result.settled_at,
    }


# ── Hybrid Oracle (Switchboard V3 + Pyth) ────────────────────────────────────

@app.get("/oracle/price/{pair}")
async def oracle_price(pair: str):
    """Fetch live price from Switchboard V3 / Pyth hybrid. Public endpoint."""
    try:
        px = await chain_router.oracle.get_price(pair)
        return {
            "pair": pair,
            "price": px.price,
            "confidence": px.confidence,
            "source": px.source,
            "timestamp": px.timestamp,
            "feed_address": px.feed_address,
        }
    except ValueError as exc:
        raise HTTPException(404, str(exc))


@app.post("/oracle/resolve")
async def oracle_resolve(body: OracleResolveBody, wallet: str = Depends(get_wallet)):
    """
    Check if a market's oracle condition is met.
    Returns the boolean outcome + the price that triggered it.
    """
    outcome = await dark_pool.resolve_with_oracle(
        market_id=body.market_id,
        pair=body.pair,
        threshold=body.threshold,
        above=body.above,
    )
    if outcome is None:
        raise HTTPException(503, "Oracle data unavailable — try again shortly")

    px = await chain_router.oracle.get_price(body.pair)
    return {
        "market_id": body.market_id,
        "outcome": outcome,
        "price": px.price,
        "source": px.source,
        "threshold": body.threshold,
        "above": body.above,
    }
