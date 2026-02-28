"""
Post-quantum cryptography layer for Ilowa.

Current state: AES-256-GCM for symmetric (already quantum-resistant) +
RSA-4096 as a placeholder where asymmetric is needed. The RSA bits are
clearly marked for replacement once we integrate a proper ML-KEM (Kyber)
library — either `pqcrypto` or the upcoming stdlib support in Python 3.14+.

NIST standards we're targeting:
  - ML-KEM  (FIPS 203) — replaces Kyber-1024 once standardised libs land
  - ML-DSA  (FIPS 204) — replaces Dilithium-5 for signatures
  - SLH-DSA (FIPS 205) — stateless hash-based sigs, fallback option

Until then, AES-256-GCM + HKDF + SHA-3 give us good post-quantum
symmetric security. The RSA placeholder generates but isn't used in
production flows — it's there so callers have a consistent interface
to swap when we upgrade.
"""

import hashlib
import logging
import os
import secrets
from typing import NamedTuple

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, hmac, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

logger = logging.getLogger("ilowa.qcrypto")

_backend = default_backend()


class KeyPair(NamedTuple):
    private_key_hex: str
    public_key_hex:  str
    algorithm:       str


class EncryptedBlob(NamedTuple):
    ciphertext_hex: str
    nonce_hex:      str
    algorithm:      str  # "AES-256-GCM" | "AES-256-GCM+HKDF" | ...


class PostQuantumCrypto:
    """
    Unified crypto facade. Symmetric methods are production-ready.
    Asymmetric methods are scaffolded — replace RSA with ML-KEM when
    pqcrypto / liboqs Python bindings stabilise.
    """

    # ── symmetric (quantum-safe today) ────────────────────────────────────────

    def encrypt(self, plaintext: str, key: bytes) -> EncryptedBlob:
        """
        AES-256-GCM authenticated encryption.
        96-bit random nonce, 128-bit auth tag (GCM default).
        """
        if len(key) != 32:
            raise ValueError(f"Need a 32-byte key, got {len(key)}")

        nonce = secrets.token_bytes(12)
        aead  = AESGCM(key)
        ct    = aead.encrypt(nonce, plaintext.encode(), None)

        return EncryptedBlob(
            ciphertext_hex = ct.hex(),
            nonce_hex      = nonce.hex(),
            algorithm      = "AES-256-GCM",
        )

    def decrypt(self, blob: EncryptedBlob, key: bytes) -> str:
        if len(key) != 32:
            raise ValueError(f"Need a 32-byte key, got {len(key)}")

        aead  = AESGCM(key)
        nonce = bytes.fromhex(blob.nonce_hex)
        ct    = bytes.fromhex(blob.ciphertext_hex)
        plain = aead.decrypt(nonce, ct, None)
        return plain.decode()

    def derive_key(self, material: str | bytes, salt: bytes | None = None, info: bytes = b"ilowa") -> bytes:
        """
        HKDF-SHA256 key derivation — turns wallet addresses or shared
        secrets into proper 32-byte AES keys.
        """
        if isinstance(material, str):
            material = material.encode()

        salt = salt or secrets.token_bytes(16)
        hkdf = HKDF(
            algorithm = hashes.SHA256(),
            length    = 32,
            salt      = salt,
            info      = info,
            backend   = _backend,
        )
        return hkdf.derive(material)

    def mac(self, data: bytes, key: bytes) -> str:
        """HMAC-SHA3-256 integrity tag — SHA-3 is already quantum-resistant."""
        h = hmac.HMAC(key, hashes.SHA3_256(), backend=_backend)
        h.update(data)
        return h.finalize().hex()

    # ── asymmetric — SCAFFOLDED, not for production use yet ─────────────────
    # These are here so callers can code against a stable interface before
    # we swap RSA out for ML-KEM. Do not use for actual key exchange.

    def generate_keypair(self) -> KeyPair:
        """
        SCAFFOLD — generates RSA-4096 as a placeholder.
        TODO: replace with `pqcrypto.kem.kyber1024.generate_keypair()`
              once the Python bindings are stable (expected mid-2025).
        """
        priv = rsa.generate_private_key(
            public_exponent = 65537,
            key_size        = 4096,
            backend         = _backend,
        )
        priv_bytes = priv.private_bytes(
            serialization.Encoding.DER,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
        pub_bytes = priv.public_key().public_bytes(
            serialization.Encoding.DER,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        logger.warning("generate_keypair using RSA-4096 scaffold — replace with ML-KEM before mainnet")
        return KeyPair(priv_bytes.hex(), pub_bytes.hex(), "RSA-4096 (scaffold → ML-KEM)")

    def kem_encapsulate(self, _public_key_hex: str) -> tuple[str, bytes]:
        """
        SCAFFOLD — returns a random shared secret and a fake ciphertext.
        TODO: replace with Kyber-1024 encapsulation.
        """
        logger.warning("kem_encapsulate is a scaffold — not cryptographically secure")
        ss = secrets.token_bytes(32)   # shared secret
        ct = secrets.token_bytes(64)   # fake ciphertext
        return ct.hex(), ss

    def kem_decapsulate(self, _private_key_hex: str, _ciphertext_hex: str) -> bytes:
        """SCAFFOLD."""
        logger.warning("kem_decapsulate is a scaffold")
        return secrets.token_bytes(32)

    # ── utility ────────────────────────────────────────────────────────────────

    @staticmethod
    def random_key() -> bytes:
        """Generate a fresh 32-byte key. Short-lived keys only — don't persist these."""
        return secrets.token_bytes(32)

    @staticmethod
    def sha3_256(data: str | bytes) -> str:
        if isinstance(data, str):
            data = data.encode()
        return hashlib.sha3_256(data).hexdigest()


# module-level singleton
post_quantum_crypto = PostQuantumCrypto()
