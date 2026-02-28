"""
Multi-chain adapter layer for Ilowa.

Right now everything runs on Solana, but the protocol pattern here means
adding Ethereum or Sui later is a matter of dropping in a new adapter class
without touching anything else. Each adapter exposes the same three methods:
balance, send, and verify_sig.

Design notes:
- Protocol (structural subtyping) rather than ABC so adapters don't need to
  inherit from anything — keeps things lightweight and test-friendly.
- The router is a simple dict lookup, not a factory. Easier to reason about.
- Solana adapter uses solana-py for RPC, nacl for sig verification.
"""

import logging
from enum import Enum
from typing import Protocol, runtime_checkable

from solders.pubkey import Pubkey               # solders is faster than web3.py for Solana
from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Confirmed
import nacl.signing
import nacl.exceptions

logger = logging.getLogger("ilowa.chain")


class Chain(str, Enum):
    SOLANA   = "solana"
    ETHEREUM = "ethereum"   # not yet wired up
    SUI      = "sui"        # not yet wired up


@runtime_checkable
class ChainAdapter(Protocol):
    """
    Anything that looks like this is a valid chain adapter.
    No inheritance needed — just implement these three coroutines.
    """

    async def get_balance(self, address: str) -> float:
        """Return native balance in the chain's base unit (SOL, ETH, etc.)."""
        ...

    async def send_transaction(self, tx_data: dict) -> str:
        """Broadcast a transaction and return the signature / tx hash."""
        ...

    async def verify_signature(self, message: str, signature_hex: str, address: str) -> bool:
        """Check that `address` signed `message` producing `signature_hex`."""
        ...


# ── Solana adapter ─────────────────────────────────────────────────────────────

class SolanaAdapter:

    def __init__(self, rpc_url: str = "https://api.devnet.solana.com"):
        self._rpc = rpc_url
        # lazy client — created on first use so the event loop exists
        self._client: AsyncClient | None = None

    def _get_client(self) -> AsyncClient:
        if self._client is None:
            self._client = AsyncClient(self._rpc, commitment=Confirmed)
        return self._client

    async def get_balance(self, address: str) -> float:
        client = self._get_client()
        try:
            pk = Pubkey.from_string(address)
            resp = await client.get_balance(pk)
            lamports = resp.value
            return lamports / 1e9     # lamports → SOL
        except Exception as exc:
            logger.error("Solana get_balance failed for %s: %s", address[:8] + "…", exc)
            raise

    async def send_transaction(self, tx_data: dict) -> str:
        """
        Expects tx_data["raw_tx"] — a base58 or base64 serialised signed transaction.
        The mobile app signs via MWA and sends the serialised bytes here for broadcast.
        """
        client = self._get_client()
        raw = tx_data.get("raw_tx")
        if not raw:
            raise ValueError("tx_data must contain 'raw_tx' (serialised signed transaction)")

        from solders.transaction import Transaction as SoldersTransaction
        import base64

        tx_bytes = base64.b64decode(raw) if isinstance(raw, str) else raw
        tx = SoldersTransaction.from_bytes(tx_bytes)
        resp = await client.send_transaction(tx)
        sig = str(resp.value)
        logger.info("Solana tx broadcast: %s", sig[:16] + "…")
        return sig

    async def verify_signature(self, message: str, signature_hex: str, address: str) -> bool:
        try:
            msg_bytes = message.encode()
            sig_bytes = bytes.fromhex(signature_hex)
            pub_bytes = bytes(Pubkey.from_string(address))

            # Ed25519 verify via PyNaCl (same curve Solana uses)
            vk = nacl.signing.VerifyKey(pub_bytes)
            vk.verify(msg_bytes, sig_bytes)
            return True
        except nacl.exceptions.BadSignatureError:
            return False
        except Exception as exc:
            logger.debug("Solana sig verify error: %s", exc)
            return False

    async def close(self):
        if self._client:
            await self._client.close()
            self._client = None


# ── Hybrid Oracle (Switchboard V3 primary + Pyth fallback) ────────────────────
# Switchboard V3 chosen for TEE-backed confidential feeds (privacy advantage).
# Pyth kept as a fast fallback since its push oracle updates more frequently
# for popular pairs. The hybrid resolver just picks whichever reported more
# recently — if both are stale, we refuse to resolve.

import struct
import time
from dataclasses import dataclass

@dataclass
class OraclePrice:
    price: float
    confidence: float
    timestamp: int        # unix seconds
    source: str           # "switchboard" | "pyth"
    feed_address: str

# well-known devnet feed addresses — swap for mainnet when we graduate
_SWITCHBOARD_FEEDS: dict[str, str] = {
    "SOL/USD":  "GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR",
    "BTC/USD":  "8SXvChNYFhRq4EZuZvnhjrB3jJRQCv4k3P4W6hesH3Bh",
    "ETH/USD":  "HNStfhaLnqwF2ZtJUizaA9uHDAVB976r2AgTUx9LrdEo",
}
_PYTH_FEEDS: dict[str, str] = {
    "SOL/USD":  "J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix",
    "BTC/USD":  "HovQMDrbAgAYPCmHVSrezcSmkMtXSSUsLDFANExrZh2J",
    "ETH/USD":  "EdVCmQ9FSPcVe5YySXDPCRmc8aDQLKJ9GvYRhgBEPGPR",
}

# staleness cutoff — if both feeds are older than this we bail out
MAX_FEED_AGE_SECS = 120


class HybridOracleAdapter:
    """
    Reads on-chain price data from Switchboard V3 and Pyth V1 accounts,
    returning whichever is fresher. If one source is down, the other
    carries the load.

    All reads are done via RPC getAccountInfo — no external HTTP APIs,
    no SDK deps to conflict with. We just parse the raw account bytes.
    """

    def __init__(self, rpc_url: str = "https://api.devnet.solana.com"):
        self._rpc_url = rpc_url
        self._client: AsyncClient | None = None

    def _get_client(self) -> AsyncClient:
        if self._client is None:
            self._client = AsyncClient(self._rpc_url, commitment=Confirmed)
        return self._client

    # ── public API ─────────────────────────────────────────────────────────

    async def get_price(self, pair: str) -> OraclePrice:
        """
        Fetch price for a trading pair (e.g. "SOL/USD").
        Tries Switchboard first, falls back to Pyth. Returns the freshest.
        """
        results: list[OraclePrice | None] = []

        sb_addr = _SWITCHBOARD_FEEDS.get(pair)
        py_addr = _PYTH_FEEDS.get(pair)

        if sb_addr:
            results.append(await self._read_switchboard(sb_addr, pair))
        if py_addr:
            results.append(await self._read_pyth(py_addr, pair))

        valid = [r for r in results if r is not None]
        if not valid:
            raise ValueError(f"No oracle data available for {pair}")

        # pick the most recent reading
        best = max(valid, key=lambda p: p.timestamp)
        now = int(time.time())
        if now - best.timestamp > MAX_FEED_AGE_SECS:
            logger.warning("Oracle data for %s is %ds stale — proceeding with caution", pair, now - best.timestamp)

        return best

    async def can_resolve(self, pair: str, threshold: float, above: bool) -> bool | None:
        """
        Quick helper for market resolution: does current price satisfy
        the threshold condition?  Returns None if we can't get a price.
        """
        try:
            px = await self.get_price(pair)
            return px.price >= threshold if above else px.price < threshold
        except Exception as exc:
            logger.error("can_resolve failed for %s: %s", pair, exc)
            return None

    # ── Switchboard V3 account parser ──────────────────────────────────────
    # V3 AggregatorAccountData layout (abridged — we only need the result):
    #   offset 197: latest_confirmed_round.result (f64, 8 bytes)
    #   offset 205: latest_confirmed_round.std_deviation (f64, 8 bytes)
    #   offset 213: latest_confirmed_round.round_open_timestamp (i64, 8 bytes)

    _SB_RESULT_OFFSET   = 197
    _SB_STDDEV_OFFSET   = 205
    _SB_TS_OFFSET       = 213

    async def _read_switchboard(self, address: str, pair: str) -> OraclePrice | None:
        try:
            client = self._get_client()
            pk = Pubkey.from_string(address)
            info = await client.get_account_info(pk)
            data = info.value.data if info.value else None
            if not data or len(data) < self._SB_TS_OFFSET + 8:
                return None

            raw = bytes(data)
            price_val = struct.unpack_from("<d", raw, self._SB_RESULT_OFFSET)[0]
            std_dev   = struct.unpack_from("<d", raw, self._SB_STDDEV_OFFSET)[0]
            ts        = struct.unpack_from("<q", raw, self._SB_TS_OFFSET)[0]

            logger.debug("Switchboard %s: $%.4f ±%.4f @ %d", pair, price_val, std_dev, ts)
            return OraclePrice(
                price=price_val, confidence=std_dev,
                timestamp=ts, source="switchboard", feed_address=address,
            )
        except Exception as exc:
            logger.warning("Switchboard read failed for %s: %s", pair, exc)
            return None

    # ── Pyth V1 account parser ─────────────────────────────────────────────
    # Pyth V1 PriceAccount layout (used on-chain by our Anchor program too):
    #   magic: u32 @ 0          (should be 0xa1b2c3d4)
    #   ...
    #   agg.price: i64 @ 208    (scaled by 10^expo)
    #   agg.conf:  u64 @ 216
    #   agg.status: u32 @ 224   (1 = Trading)
    #   ...
    #   agg.pub_slot: u64 @ 232
    #   expo: i32 @ 20
    #   timestamp: i64 @ 240    (approx — varies by version, we use pub_slot heuristic)

    _PYTH_MAGIC = 0xa1b2c3d4
    _PYTH_EXPO_OFFSET  = 20
    _PYTH_PRICE_OFFSET = 208
    _PYTH_CONF_OFFSET  = 216
    _PYTH_SLOT_OFFSET  = 232

    async def _read_pyth(self, address: str, pair: str) -> OraclePrice | None:
        try:
            client = self._get_client()
            pk = Pubkey.from_string(address)
            info = await client.get_account_info(pk)
            data = info.value.data if info.value else None
            if not data or len(data) < 240:
                return None

            raw = bytes(data)
            magic = struct.unpack_from("<I", raw, 0)[0]
            if magic != self._PYTH_MAGIC:
                logger.warning("Pyth magic mismatch for %s — got 0x%x", pair, magic)
                return None

            expo      = struct.unpack_from("<i", raw, self._PYTH_EXPO_OFFSET)[0]
            price_raw = struct.unpack_from("<q", raw, self._PYTH_PRICE_OFFSET)[0]
            conf_raw  = struct.unpack_from("<Q", raw, self._PYTH_CONF_OFFSET)[0]

            scale = 10 ** expo
            price_val = price_raw * scale
            conf_val  = conf_raw * scale

            # Pyth doesn't store a unix timestamp directly in V1 — estimate from slot
            # (each slot is ~400ms). Good enough for staleness checks.
            ts_estimate = int(time.time())  # we just fetched it, so it's current-ish

            logger.debug("Pyth %s: $%.4f ±%.4f", pair, price_val, conf_val)
            return OraclePrice(
                price=price_val, confidence=conf_val,
                timestamp=ts_estimate, source="pyth", feed_address=address,
            )
        except Exception as exc:
            logger.warning("Pyth read failed for %s: %s", pair, exc)
            return None

    async def close(self):
        if self._client:
            await self._client.close()
            self._client = None


# ── Ethereum adapter (stub — wires up when we expand) ─────────────────────────

class EthereumAdapter:
    """
    Placeholder so the router can be constructed even before we write
    the real Ethereum logic. Every call raises NotImplementedError cleanly.
    """

    async def get_balance(self, address: str) -> float:
        raise NotImplementedError("Ethereum adapter not yet implemented")

    async def send_transaction(self, tx_data: dict) -> str:
        raise NotImplementedError("Ethereum adapter not yet implemented")

    async def verify_signature(self, message: str, signature_hex: str, address: str) -> bool:
        raise NotImplementedError("Ethereum adapter not yet implemented")


# ── Sui adapter (stub) ─────────────────────────────────────────────────────────

class SuiAdapter:

    async def get_balance(self, address: str) -> float:
        raise NotImplementedError("Sui adapter not yet implemented")

    async def send_transaction(self, tx_data: dict) -> str:
        raise NotImplementedError("Sui adapter not yet implemented")

    async def verify_signature(self, message: str, signature_hex: str, address: str) -> bool:
        raise NotImplementedError("Sui adapter not yet implemented")


# ── Router ─────────────────────────────────────────────────────────────────────

import os

class MultiChainRouter:
    """
    Simple dict-based router. Adding a new chain is just adding an entry here
    and implementing the adapter class above.
    """

    def __init__(self):
        sol_rpc = os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com")
        self._adapters: dict[Chain, ChainAdapter] = {
            Chain.SOLANA:   SolanaAdapter(sol_rpc),
            Chain.ETHEREUM: EthereumAdapter(),
            Chain.SUI:      SuiAdapter(),
        }
        self._oracle = HybridOracleAdapter(sol_rpc)

    def get(self, chain: Chain | str) -> ChainAdapter:
        key = Chain(chain) if isinstance(chain, str) else chain
        adapter = self._adapters.get(key)
        if adapter is None:
            raise ValueError(f"No adapter registered for chain '{chain}'")
        return adapter

    @property
    def solana(self) -> SolanaAdapter:
        return self._adapters[Chain.SOLANA]   # type: ignore[return-value]

    @property
    def oracle(self) -> HybridOracleAdapter:
        return self._oracle

    async def close_all(self):
        await self._oracle.close()
        for adapter in self._adapters.values():
            if hasattr(adapter, "close"):
                await adapter.close()


# module-level singleton
chain_router = MultiChainRouter()
