"""
Nillion blind-vault wrapper for Ilowa.

Wraps the Nillion Python SDK so the rest of the backend doesn't have to
care about SDK internals. Handles connection lifecycle, retries, and the
fact that the testnet can occasionally be flaky.

SDK docs: https://docs.nillion.com/python-client
"""

import json
import logging
import os
from typing import Optional

import nillion_client as nillion
from nillion_client import (
    NodeKey,
    UserKey,
    Value,
    Permissions,
    NillionClient,
)

logger = logging.getLogger("ilowa.nillion")


def _load_config(config_path: str) -> dict:
    with open(config_path) as f:
        return json.load(f)


def _load_credentials(creds_path: str) -> dict:
    with open(creds_path) as f:
        return json.load(f)


class NillionStorage:
    """
    One instance per backend process. Callers initialise per-user by
    passing a wallet address (used as user_seed so each user gets a
    deterministic but unique keypair inside Nillion's network).
    """

    def __init__(self, config_path: str = "/opt/ilowa/backend/nillion_config.json"):
        self.cfg = _load_config(config_path)
        self._client: Optional[NillionClient] = None
        self._current_user: Optional[str] = None

        # try loading node credentials once at startup — not strictly required
        # for client ops but handy for the accuser node heartbeat
        try:
            self._node_creds = _load_credentials(self.cfg["credentials_path"])
        except FileNotFoundError:
            self._node_creds = {}
            logger.warning("Nillion node credentials not found — is the node initialised?")

    # ── connection ─────────────────────────────────────────────────────────────

    async def initialise(self, user_wallet: str) -> bool:
        """
        Set up (or swap to) a Nillion client for the given wallet.
        Wallet address doubles as the user seed — deterministic per user.
        """
        if self._current_user == user_wallet and self._client is not None:
            return True  # already connected for this user, nothing to do

        try:
            # derive keypairs from the wallet address as seed
            user_key  = UserKey.from_seed(user_wallet)
            node_key  = NodeKey.from_seed(f"node_{user_wallet}")

            cluster_id = await nillion.fetch_cluster_id(self.cfg["rpc_url"])

            self._client = await NillionClient.create(
                node_key    = node_key,
                bootnodes   = [self.cfg["node_url"]],
                cluster_id  = cluster_id,
                user_key    = user_key,
            )

            self._current_user = user_wallet
            logger.info("Nillion connected for %s", user_wallet[:8] + "…")
            return True

        except Exception as exc:
            logger.error("Nillion connection failed for %s: %s", user_wallet[:8] + "…", exc)
            self._client = None
            self._current_user = None
            return False

    def _assert_ready(self):
        if self._client is None:
            raise RuntimeError("Nillion client not initialised — call initialise(wallet) first")

    # ── store ──────────────────────────────────────────────────────────────────

    async def store_secret(
        self,
        name: str,
        value: str,
        allowed_retrievers: list[str] | None = None,
        ttl_days: int = 90,
    ) -> str:
        """
        Blindly store a named secret. Returns the store_id reference that
        gets saved to Supabase. The value itself never touches Supabase.

        allowed_retrievers: list of wallet addresses that may read this secret.
        Defaults to owner-only if not supplied.
        """
        self._assert_ready()
        allowed_retrievers = allowed_retrievers or []

        secrets = nillion.Secrets({name: nillion.SecretBlob(value.encode())})

        # build permission object
        perms = Permissions.default_for_user(self._client.user_id)
        for wallet in allowed_retrievers:
            # each wallet also has a deterministic user_id we can derive
            other_uid = str(UserKey.from_seed(wallet).user_id)
            perms.add_retrieve_permissions({other_uid})

        result = await self._client.store_secrets(
            self.cfg.get("cluster", "testnet"),
            secrets,
            None,       # no program binding for simple blob storage
            perms,
        )

        store_id = str(result)
        logger.debug("Stored secret '%s' → store_id %s", name, store_id[:12] + "…")
        return store_id

    # ── retrieve ───────────────────────────────────────────────────────────────

    async def retrieve_secret(self, store_id: str, name: str) -> str:
        """
        Fetch a secret by its store_id + the original name used when storing.
        Raises PermissionError if the current user wasn't in the allowed list.
        """
        self._assert_ready()

        try:
            result = await self._client.retrieve_secrets(
                self.cfg.get("cluster", "testnet"),
                store_id,
                None,  # no program
            )

            raw = result[name]
            if hasattr(raw, "value"):
                return raw.value.decode()
            return str(raw)

        except Exception as exc:
            msg = str(exc).lower()
            if "permission" in msg or "unauthorized" in msg or "not found" in msg:
                raise PermissionError(f"Access denied or secret gone: {store_id[:12]}…") from exc
            raise

    # ── delete ─────────────────────────────────────────────────────────────────

    async def delete_secret(self, store_id: str) -> bool:
        """Delete a secret. Only the owner (user who stored it) can do this."""
        self._assert_ready()
        try:
            await self._client.delete_secrets(
                self.cfg.get("cluster", "testnet"),
                store_id,
            )
            logger.debug("Deleted store_id %s", store_id[:12] + "…")
            return True
        except Exception as exc:
            logger.warning("Could not delete %s: %s", store_id[:12] + "…", exc)
            return False

    # ── convenience wrappers ───────────────────────────────────────────────────

    async def store_points_breakdown(self, wallet: str, breakdown: dict) -> str:
        await self.initialise(wallet)
        return await self.store_secret(
            name       = "points_breakdown",
            value      = json.dumps(breakdown),
            ttl_days   = self._ttl("points_breakdown"),
        )

    async def store_bet_amount(self, wallet: str, market_id: str, amount: float, resolver: str) -> str:
        await self.initialise(wallet)
        return await self.store_secret(
            name                = f"bet_{market_id}",
            value               = str(amount),
            allowed_retrievers  = [resolver],
            ttl_days            = self._ttl("bet_amount"),
        )

    async def store_vote(self, wallet: str, proposal_id: str, vote: str) -> str:
        await self.initialise(wallet)
        return await self.store_secret(
            name     = f"vote_{proposal_id}",
            value    = vote,
            ttl_days = self._ttl("vote"),
        )

    def _ttl(self, secret_type: str) -> int:
        return self.cfg.get("secret_types", {}).get(secret_type, {}).get("ttl_days", 90)


# module-level singleton — import this everywhere
nillion_storage = NillionStorage()
