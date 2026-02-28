/**
 * Raw RPC market fetcher — bypasses both Anchor AND @solana/web3.js response
 * parsing.  Hermes blows the stack inside web3.js's getProgramAccounts because
 * its superstruct coercions call Buffer.from() and new PublicKey(bs58string)
 * which both recurse in the Buffer polyfill.
 *
 * Strategy: raw fetch() → JSON-RPC, manual base64→Uint8Array, our polyfilled
 * bs58.encode for pubkey strings.  Zero web3.js in the hot path.
 */

import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { PROGRAM_ID } from './market-writer';
import type { Market, MarketStatus } from '../../types/market';

// @ts-ignore – patched in polyfills.ts
import bs58 from 'bs58';

const RPC_URL = process.env.EXPO_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';

// Raw discriminator bytes for type detection on single-account fetches
const MARKET_DISC_BYTES       = [219, 190, 213, 55, 0, 227, 198, 154];
const LIGHT_MARKET_DISC_BYTES = [114, 114, 74, 176, 29, 94, 99, 62];

// base64-encoded 8-byte discriminators for RPC memcmp (offset 0)
const MARKET_DISC_B64       = btoa(String.fromCharCode(...MARKET_DISC_BYTES));
const LIGHT_MARKET_DISC_B64 = btoa(String.fromCharCode(...LIGHT_MARKET_DISC_BYTES));

const CATEGORY_NAMES = ['other', 'finance', 'sports', 'politics', 'crypto', 'culture', 'music'];
const REGION_NAMES   = ['global', 'west-africa', 'east-africa', 'southern-africa', 'latin-america', 'south-asia', 'southeast-asia', 'mena', 'caribbean'];
const STATUS_VARIANTS: MarketStatus[] = ['active', 'resolved', 'expired', 'disputed'];

// 32 zero-bytes encoded to base58 = PublicKey.default
const PUBKEY_DEFAULT_B58 = '11111111111111111111111111111111';

// ── raw JSON-RPC helper ─────────────────────────────────────

let rpcId = 1;
async function rpcCall(method: string, params: any[]): Promise<any> {
  const body = JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params });
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const json = await res.json();
  if (json.error) throw new Error(`RPC ${method}: ${json.error.message}`);
  return json.result;
}

// base64 → Uint8Array (no Buffer.from, Hermes-safe)
function b64toBytes(b64: string): Uint8Array {
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Hermes-safe base58 encode for 32-byte pubkey slices
function pubkeyB58(bytes: Uint8Array, off: number): string {
  return bs58.encode(bytes.slice(off, off + 32));
}

// ── Uint8Array-based readers (no Buffer dependency) ─────────

function rdU8(d: Uint8Array, o: number): [number, number] {
  return [d[o], o + 1];
}
function rdBool(d: Uint8Array, o: number): [boolean, number] {
  return [d[o] !== 0, o + 1];
}
function rdU32(d: Uint8Array, o: number): [number, number] {
  return [d[o] | (d[o+1] << 8) | (d[o+2] << 16) | ((d[o+3] << 24) >>> 0), o + 4];
}
function rdI64(d: Uint8Array, o: number): [number, number] {
  const lo = (d[o] | (d[o+1] << 8) | (d[o+2] << 16) | ((d[o+3] << 24) >>> 0)) >>> 0;
  const hi = d[o+4] | (d[o+5] << 8) | (d[o+6] << 16) | (d[o+7] << 24);
  return [hi * 0x1_0000_0000 + lo, o + 8];
}
function rdU64(d: Uint8Array, o: number): [number, number] {
  const lo = (d[o] | (d[o+1] << 8) | (d[o+2] << 16) | ((d[o+3] << 24) >>> 0)) >>> 0;
  const hi = (d[o+4] | (d[o+5] << 8) | (d[o+6] << 16) | ((d[o+7] << 24) >>> 0)) >>> 0;
  return [hi * 0x1_0000_0000 + lo, o + 8];
}
function rdString(d: Uint8Array, o: number): [string, number] {
  const [len, o2] = rdU32(d, o);
  const slice = d.slice(o2, o2 + len);
  return [new TextDecoder().decode(slice), o2 + len];
}
function rdOptionBool(d: Uint8Array, o: number): [boolean | null, number] {
  if (d[o] === 0) return [null, o + 1];
  return rdBool(d, o + 1);
}
function rdOptionI64(d: Uint8Array, o: number): [number | null, number] {
  if (d[o] === 0) return [null, o + 1];
  return rdI64(d, o + 1);
}

// ── LightMarketStub layout ──────────────────────────────────
// 8  discriminator
// 32 creator (pubkey)
// 32 question_hash ([u8; 32])
// 1  category (u8)
// 1  region (u8)
// 8  resolve_date (i64)
// 8  yes_pool (u64)
// 8  no_pool (u64)
// 4  total_bets (u32)
// 4  shielded_bet_count (u32)
// 1  is_active (bool)
// 1  resolved (bool)
// 1  outcome (u8)
// 8  created_at (i64)
// 32 oracle_authority (pubkey)
// 8  oracle_threshold (i64)
// 1  oracle_above (bool)
// 1  bump (u8)

function decodeLightMarket(pubkeyB58Str: string, data: Uint8Array): Market | null {
  try {
    let off = 8; // skip discriminator
    const creatorB58 = pubkeyB58(data, off); off += 32;
    const hashSlice = data.slice(off, off + 32); off += 32;
    const [category, o2] = rdU8(data, off); off = o2;
    const [region, o3] = rdU8(data, off); off = o3;
    const [resolveDate, o4] = rdI64(data, off); off = o4;
    const [yesPool, o5] = rdU64(data, off); off = o5;
    const [noPool, o6] = rdU64(data, off); off = o6;
    const [totalBets, o7] = rdU32(data, off); off = o7;
    const [shieldedBetCount, o8] = rdU32(data, off); off = o8;
    const [isActive, o9] = rdBool(data, off); off = o9;
    const [resolved, o10] = rdBool(data, off); off = o10;
    const [outcome, o11] = rdU8(data, off); off = o11;
    const [createdAt, o12] = rdI64(data, off); off = o12;
    const oracleAuthB58 = pubkeyB58(data, off); off += 32;
    const [oracleThreshold, o14] = rdI64(data, off); off = o14;
    const [oracleAbove, o15] = rdBool(data, off); off = o15;

    // question_hash is SHA-256 of the original text — can't reverse it.
    // useMarkets overlays the real text from AsyncStorage; here we just
    // put a readable placeholder so the card isn't total noise.
    const question = `Market ${pubkeyB58Str.slice(0, 8)}…`;

    const hasOracle = oracleAuthB58 !== PUBKEY_DEFAULT_B58;

    return {
      id: pubkeyB58Str,
      pubkey: pubkeyB58Str,
      creator: creatorB58.slice(0, 8) + '...',
      question,
      category: CATEGORY_NAMES[category] || 'other',
      region: REGION_NAMES[region] || 'global',
      isPrivate: true,
      isLight: true,
      status: resolved ? 'resolved' : isActive ? 'active' : 'expired',
      outcome: resolved ? (outcome === 1 ? 'yes' : 'no') : null,
      yesPool: yesPool / LAMPORTS_PER_SOL,
      noPool: noPool / LAMPORTS_PER_SOL,
      totalBets,
      shieldedBetCount,
      createdAt: createdAt * 1000,
      expiresAt: resolveDate * 1000,
      oracleAuthority: hasOracle ? oracleAuthB58 : undefined,
      oracleThreshold: hasOracle ? oracleThreshold : undefined,
      oracleAbove: hasOracle ? oracleAbove : undefined,
    };
  } catch (e: any) {
    console.warn('[MarketReader] decode light failed', pubkeyB58Str, e.message?.slice(0, 60));
    return null;
  }
}

// ── Market layout ────────────────────────────────────────────
// 8  discriminator
// 32 creator (pubkey)
// 4+N question (borsh string)
// 4+N category (borsh string)
// 4+N region (borsh string)
// 1  is_private (bool)
// 1  status (enum variant index)
// 1+? outcome (Option<bool>)
// 8  yes_pool (u64)
// 8  no_pool (u64)
// 4  total_bets (u32)
// 8  created_at (i64)
// 8  expires_at (i64)
// 1+? resolved_at (Option<i64>)
// 1  bump (u8)

function decodeMarket(pubkeyB58Str: string, data: Uint8Array): Market | null {
  try {
    let off = 8; // skip disc
    const creatorB58 = pubkeyB58(data, off); off += 32;
    const [question, o2] = rdString(data, off); off = o2;
    const [category, o3] = rdString(data, off); off = o3;
    const [region, o4] = rdString(data, off); off = o4;
    const [isPrivate, o5] = rdBool(data, off); off = o5;
    const [statusIdx, o6] = rdU8(data, off); off = o6;
    const [outcome, o7] = rdOptionBool(data, off); off = o7;
    const [yesPool, o8] = rdU64(data, off); off = o8;
    const [noPool, o9] = rdU64(data, off); off = o9;
    const [totalBets, o10] = rdU32(data, off); off = o10;
    const [createdAt, o11] = rdI64(data, off); off = o11;
    const [expiresAt, o12] = rdI64(data, off); off = o12;
    const [resolvedAt, o13] = rdOptionI64(data, off); off = o13;

    return {
      id: pubkeyB58Str,
      pubkey: pubkeyB58Str,
      creator: creatorB58.slice(0, 8) + '...',
      question,
      category: category || 'other',
      region: region || 'global',
      isPrivate,
      status: STATUS_VARIANTS[statusIdx] || 'active',
      outcome: outcome === true ? 'yes' : outcome === false ? 'no' : null,
      yesPool: yesPool / LAMPORTS_PER_SOL,
      noPool: noPool / LAMPORTS_PER_SOL,
      totalBets,
      createdAt: createdAt * 1000,
      expiresAt: expiresAt * 1000,
      resolvedAt: resolvedAt ? resolvedAt * 1000 : undefined,
    };
  } catch (e: any) {
    console.warn('[MarketReader] decode market failed', pubkeyB58Str, e.message?.slice(0, 60));
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────

const PROG_B58 = PROGRAM_ID.toBase58();

/**
 * Raw fetch()-based getProgramAccounts.  Returns [{pubkey: string, data: Uint8Array}].
 * Completely bypasses @solana/web3.js response parsing which overflows Hermes.
 */
async function rawGetProgramAccounts(
  discB64: string,
): Promise<Array<{ pubkey: string; data: Uint8Array }>> {
  const result = await rpcCall('getProgramAccounts', [
    PROG_B58,
    {
      encoding: 'base64',
      filters: [{ memcmp: { offset: 0, bytes: discB64, encoding: 'base64' } }],
    },
  ]);
  if (!Array.isArray(result)) return [];
  return result.map((item: any) => ({
    pubkey: item.pubkey as string,
    data: b64toBytes(item.account.data[0]),
  }));
}

export async function fetchMarketsRaw(): Promise<Market[]> {
  const accs = await rawGetProgramAccounts(MARKET_DISC_B64);
  const decoded: Market[] = [];
  for (const { pubkey, data } of accs) {
    const m = decodeMarket(pubkey, data);
    if (m) decoded.push(m);
  }
  console.log(`[MarketReader] Fetched ${decoded.length} regular markets via raw RPC`);
  return decoded;
}

export async function fetchLightMarketsRaw(): Promise<Market[]> {
  const accs = await rawGetProgramAccounts(LIGHT_MARKET_DISC_B64);
  const decoded: Market[] = [];
  for (const { pubkey, data } of accs) {
    const m = decodeLightMarket(pubkey, data);
    if (m) decoded.push(m);
  }
  console.log(`[MarketReader] Fetched ${decoded.length} light markets via raw RPC`);
  return decoded;
}

/**
 * Fetch a single market by its pubkey — uses raw getAccountInfo RPC,
 * tries both Market and LightMarketStub discriminators.
 */
export async function fetchMarketByPubkey(pubkey: PublicKey): Promise<Market | null> {
  const pubkeyStr = pubkey.toBase58();
  const result = await rpcCall('getAccountInfo', [
    pubkeyStr,
    { encoding: 'base64' },
  ]);
  if (!result?.value?.data) return null;

  const data = b64toBytes(result.value.data[0]);
  if (data.length < 8) return null;

  const matchDisc = (disc: number[]) => disc.every((b, i) => b === data[i]);
  if (matchDisc(MARKET_DISC_BYTES)) return decodeMarket(pubkeyStr, data);
  if (matchDisc(LIGHT_MARKET_DISC_BYTES)) return decodeLightMarket(pubkeyStr, data);
  return null;
}
