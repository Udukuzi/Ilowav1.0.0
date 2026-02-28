import { getRandomValues as expoCryptoGetRandomValues } from 'expo-crypto';
import { Buffer } from 'buffer';

// Buffer polyfill — needed by @solana/web3.js and @coral-xyz/anchor
global.Buffer = Buffer;

// Solana Mobile required fix: Buffer.subarray must return a Buffer, not a bare Uint8Array.
// Without this, Anchor's borsh decoder loses readUIntLE/readInt32LE on sliced buffers.
Buffer.prototype.subarray = function subarray(begin?: number, end?: number) {
  const result = Uint8Array.prototype.subarray.apply(this, [begin, end]);
  Object.setPrototypeOf(result, Buffer.prototype);
  return result;
};

// ── Hermes instanceof fix ────────────────────────────────────────────────
//
// Hermes breaks `x instanceof Uint8Array` for Buffer polyfill objects.
// We patch Buffer.isBuffer, @noble/hashes isBytes, AND Symbol.hasInstance.
//
// CRITICAL: isUint8ArrayLike must NEVER use `instanceof Uint8Array` because
// our Symbol.hasInstance override calls isUint8ArrayLike — that would create
// an infinite recursion loop that blows the stack.

// grab the native hasInstance BEFORE we override it
const _nativeHasInstance = Uint8Array[Symbol.hasInstance]?.bind(Uint8Array);

function isUint8ArrayLike(a: any): boolean {
  if (a == null) return false;
  // use the saved native check — NOT `instanceof` which would trigger our override
  if (_nativeHasInstance?.(a)) return true;
  const cname = a.constructor?.name;
  if (cname === 'Uint8Array' || cname === 'Buffer') return true;
  // duck-type: typed-array shape with 1-byte elements
  return (
    typeof a.length === 'number' &&
    typeof a.byteLength === 'number' &&
    typeof a.byteOffset === 'number' &&
    typeof a.BYTES_PER_ELEMENT === 'number' &&
    a.BYTES_PER_ELEMENT === 1 &&
    typeof a.slice === 'function'
  );
}

// Ensure Buffer objects pass through all byte-array checks by coercing to plain Uint8Array
// when needed. We wrap Buffer.from so it returns a Buffer with a clean prototype link.
// NOTE: We don't replace Buffer.from — we just ensure isBuffer catches everything.

// 1. Widen Buffer.isBuffer — catches base-x v3, safe-buffer, and any lib checking isBuffer
{
  const _origIsBuffer = Buffer.isBuffer.bind(Buffer);
  (Buffer as any).isBuffer = function (b: any): boolean {
    if (_origIsBuffer(b)) return true;
    return isUint8ArrayLike(b);
  };
}

// 2. Patch @noble/hashes isBytes — this is the CRITICAL fix for @solana/web3.js
//    ed25519 operations during Transaction.serialize / sign / verify
{
  try {
    const nobleUtils = require('@noble/hashes/utils');
    if (nobleUtils && typeof nobleUtils.isBytes === 'function') {
      nobleUtils.isBytes = function (a: any): boolean {
        return isUint8ArrayLike(a);
      };
      console.log('[Polyfill] ✓ @noble/hashes isBytes patched');
    }
  } catch {
    // @noble/hashes not installed — skip
  }
}

// 3. Belt-and-suspenders: Symbol.hasInstance override — uses isUint8ArrayLike
//    which itself uses _nativeHasInstance (captured above), so no recursion.
{
  try {
    Object.defineProperty(Uint8Array, Symbol.hasInstance, {
      value: function (instance: any): boolean {
        return isUint8ArrayLike(instance);
      },
      writable: true,
      configurable: true,
    });
  } catch {
    // Symbol.hasInstance not configurable in this engine version
  }
}

// TextEncoder polyfill — needed by borsh serialization
try {
  if (typeof globalThis.TextEncoder === 'undefined') {
    globalThis.TextEncoder = require('text-encoding').TextEncoder;
  }
} catch {
  // text-encoding not available — TextEncoder may already exist in newer Hermes
}

// crypto.getRandomValues polyfill — needed by Keypair.generate() and PDA derivation
class Crypto {
  getRandomValues = expoCryptoGetRandomValues;
}

if (typeof globalThis.crypto === 'undefined') {
  (globalThis as any).crypto = new Crypto();
}
// always force expo-crypto's implementation — react-native-get-random-values
// sets a version that relies on NativeModules.RNGetRandomValues which isn't
// linked in Expo Go, so it throws "Native module not found" at runtime
(globalThis.crypto as any).getRandomValues = expoCryptoGetRandomValues;

// tweetnacl checks self.crypto at module load time — before this polyfill.
// its internal randombytes stays as the 'no PRNG' stub, so we force-set it.
try {
  const nacl = require('tweetnacl');
  if (typeof nacl.setPRNG === 'function') {
    nacl.setPRNG(function (x: Uint8Array, n: number) {
      const v = new Uint8Array(n);
      expoCryptoGetRandomValues(v);
      for (let i = 0; i < n; i++) x[i] = v[i];
    });
  }
} catch (_) { /* tweetnacl not installed — skip */ }

// ── Hermes-safe bs58 patch ──────────────────────────────────────────────
// base-x's encode() calls _Buffer.from(source) which triggers infinite
// recursion in Hermes's Buffer polyfill. Replace bs58.encode/decode with
// pure arithmetic — no Buffer.from, no recursion, Hermes stack safe.
{
  const B58_ALPHA = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const B58_MAP = new Uint8Array(256).fill(255);
  for (let i = 0; i < 58; i++) B58_MAP[B58_ALPHA.charCodeAt(i)] = i;

  function b58encode(src: Uint8Array | number[]): string {
    if (!src || src.length === 0) return '';
    // work on plain array of numbers — no Buffer involved
    const bytes: number[] = src instanceof Uint8Array
      ? Array.prototype.slice.call(src) : src;

    // count leading zeros
    let zeros = 0;
    while (zeros < bytes.length && bytes[zeros] === 0) zeros++;

    // base conversion (big-endian)
    const size = ((bytes.length - zeros) * 138 / 100 + 1) >>> 0;
    const b58 = new Uint8Array(size);
    let length = 0;
    for (let i = zeros; i < bytes.length; i++) {
      let carry = bytes[i];
      let j = 0;
      for (let it = size - 1; (carry !== 0 || j < length) && it >= 0; it--, j++) {
        carry += 256 * b58[it];
        b58[it] = carry % 58;
        carry = (carry / 58) >>> 0;
      }
      length = j;
    }

    let skip = size - length;
    while (skip < size && b58[skip] === 0) skip++;

    let result = B58_ALPHA[0].repeat(zeros);
    for (let i = skip; i < size; i++) result += B58_ALPHA[b58[i]];
    return result;
  }

  function b58decode(str: string): Buffer {
    if (!str || str.length === 0) return Buffer.alloc(0);
    let zeros = 0;
    while (zeros < str.length && str[zeros] === B58_ALPHA[0]) zeros++;

    const size = ((str.length - zeros) * 733 / 1000 + 1) >>> 0;
    const b256 = new Uint8Array(size);
    let length = 0;
    for (let i = zeros; i < str.length; i++) {
      let carry = B58_MAP[str.charCodeAt(i)];
      if (carry === 255) throw new Error('Non-base58 character');
      let j = 0;
      for (let it = size - 1; (carry !== 0 || j < length) && it >= 0; it--, j++) {
        carry += 58 * b256[it];
        b256[it] = carry % 256;
        carry = (carry / 256) >>> 0;
      }
      length = j;
    }

    let skip = size - length;
    while (skip < size && b256[skip] === 0) skip++;

    const out = Buffer.alloc(zeros + (size - skip));
    for (let i = 0; i < zeros; i++) out[i] = 0;
    let pos = zeros;
    for (let i = skip; i < size; i++) out[pos++] = b256[i];
    return out;
  }

  try {
    const bs58mod = require('bs58');
    bs58mod.encode = b58encode;
    bs58mod.decode = b58decode;
    // also patch .default if it exists (ESM interop)
    if (bs58mod.default) {
      bs58mod.default.encode = b58encode;
      bs58mod.default.decode = b58decode;
    }
    console.log('[Polyfill] ✓ bs58 encode/decode patched (Hermes-safe)');
  } catch {
    // bs58 not yet loaded — this shouldn't happen since polyfills load first
  }
}

// Log polyfill status for debugging
console.log('[Polyfill] Buffer.isBuffer(Buffer.alloc(1)):', Buffer.isBuffer(Buffer.alloc(1)));
console.log('[Polyfill] Buffer.isBuffer(new Uint8Array(1)):', Buffer.isBuffer(new Uint8Array(1)));
console.log('[Polyfill] isUint8ArrayLike(Buffer.alloc(1)):', isUint8ArrayLike(Buffer.alloc(1)));
console.log('[Polyfill] new Uint8Array(1) instanceof Uint8Array:', new Uint8Array(1) instanceof Uint8Array);
console.log('[Polyfill] Buffer.alloc(1) instanceof Uint8Array:', Buffer.alloc(1) instanceof Uint8Array);
