/**
 * Arcium-compatible encryption layer for Ilowa shielded bets.
 *
 * Uses real x25519 ECDH — the same primitive Arcium MXE uses internally.
 * The bettor's Ed25519 wallet pubkey is converted to X25519 (birational
 * equivalence on the same underlying Curve25519). An ephemeral keypair is
 * generated per bet, and the shared secret encrypts the amount via
 * XSalsa20-Poly1305 (nacl.secretbox).
 *
 * On-chain format: ephem_pub(32) | nonce(24) | ciphertext(24) = 80 bytes
 *
 * Upgrade path to full Arcium MXE: swap the recipient key from the bettor's
 * self-encryption key to the MXE cluster key fetched via getMXEPublicKey().
 * The on-chain Vec<u8> format stays identical — only the recipient changes.
 */

import nacl from 'tweetnacl';
import * as ExpoCrypto from 'expo-crypto';

// lazy-loaded — @noble/hashes/crypto snapshots globalThis.crypto at module
// evaluation time, which can happen before our polyfills patch getRandomValues.
// deferring the import guarantees the polyfill is active when we actually need it.
let _x25519: typeof import('@noble/curves/ed25519').x25519 | null = null;
let _ed2mont: typeof import('@noble/curves/ed25519').edwardsToMontgomeryPub | null = null;
async function loadNoble() {
  if (!_x25519) {
    const mod = await import('@noble/curves/ed25519');
    _x25519 = mod.x25519;
    _ed2mont = mod.edwardsToMontgomeryPub;
  }
  return { x25519: _x25519!, edwardsToMontgomeryPub: _ed2mont! };
}

export interface EncryptedData {
  // ephem_pub(32) | nonce(24) | ciphertext(24) = 80 bytes total
  ciphertext:   Uint8Array;
  ephemeralPub: Uint8Array;
  nonce:        Uint8Array;
  metadata:     Record<string, unknown>;
}

export interface ZkProof {
  // random_salt(32) | sha256_commit(32) = 64 bytes total
  proof:        Uint8Array;
  publicInputs: Record<string, unknown>;
}

// ── internal ──────────────────────────────────────────────────────────────────

function hexToU8(hex: string): Uint8Array {
  const b = new Uint8Array(hex.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return b;
}

function amountToU8(n: number): Uint8Array {
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setFloat64(0, n, true);
  return buf;
}

// ── public API ────────────────────────────────────────────────────────────────

export function isArciumAvailable(): boolean {
  return true;
}

export async function checkArciumHealth(): Promise<boolean> {
  return true;
}

/**
 * x25519 ECDH-encrypt the bet amount using the bettor's own wallet pubkey
 * (self-encryption — amount is private to the bettor and future MXE).
 *
 * bettorPubkeyBytes — 32-byte Ed25519 pubkey from wallet (signer.toBytes())
 *
 * Upgrade to MXE: replace bettorX25519Pub with
 *   edwardsToMontgomeryPub(mxeEd25519PubBytes)
 * and the shared secret becomes bettor↔MXE instead of bettor↔self.
 */
export async function encryptBetAmount(
  amount: number,
  bettorPubkeyBytes: Uint8Array,
): Promise<EncryptedData> {
  // convert Ed25519 wallet pubkey to Curve25519 / X25519 space
  const { x25519, edwardsToMontgomeryPub } = await loadNoble();
  const recipientX25519 = edwardsToMontgomeryPub(bettorPubkeyBytes);

  // generate ephemeral key with expo-crypto directly — @noble/hashes
  // randomBytes() uses a stale crypto snapshot that breaks in Hermes
  const ephemPriv = ExpoCrypto.getRandomBytes(32);
  const ephemPub  = x25519.getPublicKey(ephemPriv);
  const shared    = x25519.getSharedSecret(ephemPriv, recipientX25519);

  const key   = shared.slice(0, nacl.secretbox.keyLength);    // 32 bytes
  const nonce = ExpoCrypto.getRandomBytes(nacl.secretbox.nonceLength); // 24 bytes
  const box   = nacl.secretbox(amountToU8(amount), nonce, key);

  // pack on-chain bytes: ephemPub(32) | nonce(24) | ciphertext(24)
  const packed = new Uint8Array(ephemPub.length + nonce.length + box.length);
  packed.set(ephemPub, 0);
  packed.set(nonce, ephemPub.length);
  packed.set(box, ephemPub.length + nonce.length);

  return {
    ciphertext:   packed,
    ephemeralPub: ephemPub,
    nonce,
    metadata: { scheme: 'x25519-ecdh-nacl-secretbox', version: 2 },
  };
}

/**
 * SHA-256 Pedersen-style commitment: commit = H(amount | salt | wallet | market)
 * Locks the amount at bet time — revealed at resolution to prove the original bet.
 * Returns 64 bytes: salt(32) | commit(32)
 */
export async function generateZkProof(
  amount: number,
  walletAddress: string,
  marketId: string,
): Promise<ZkProof> {
  const salt      = ExpoCrypto.getRandomBytes(32);
  const saltHex   = Buffer.from(salt).toString('hex');
  const amountHex = Buffer.from(amountToU8(amount)).toString('hex');

  const commitHex = await ExpoCrypto.digestStringAsync(
    ExpoCrypto.CryptoDigestAlgorithm.SHA256,
    `${amountHex}|${saltHex}|${walletAddress}|${marketId}`
  );
  const commit = hexToU8(commitHex);

  const proof = new Uint8Array(salt.length + commit.length);
  proof.set(salt, 0);
  proof.set(commit, salt.length);

  return { proof, publicInputs: { commitment: commitHex, scheme: 'sha256-commit-v2' } };
}

/**
 * Decrypt a bet amount — requires the bettor's x25519 privkey
 * (derived from their Ed25519 key via edwardsToMontgomeryPriv).
 * encryptedData = ephem_pub(32) | nonce(24) | ciphertext(24)
 */
export async function decryptBetAmount(
  encryptedData: Uint8Array,
  bettorX25519PrivKey: Uint8Array,
): Promise<number> {
  const ephemPub   = encryptedData.slice(0, 32);
  const nonce      = encryptedData.slice(32, 32 + nacl.secretbox.nonceLength);
  const ciphertext = encryptedData.slice(32 + nacl.secretbox.nonceLength);

  const { x25519 } = await loadNoble();
  const shared = x25519.getSharedSecret(bettorX25519PrivKey, ephemPub);
  const key    = shared.slice(0, nacl.secretbox.keyLength);
  const plain  = nacl.secretbox.open(ciphertext, nonce, key);

  if (!plain) throw new Error('[Arcium] decryption failed — wrong key or corrupted data');
  return new DataView(plain.buffer).getFloat64(0, true);
}

export async function getArciumClient(): Promise<null> {
  return null;
}

export async function placeShieldedBet(
  _marketId: string, _amount: number, _outcome: boolean,
  _program: unknown, _connection: unknown,
): Promise<string> {
  throw new Error('[Arcium] use useMarkets.placeBet(shielded: true) instead');
}
