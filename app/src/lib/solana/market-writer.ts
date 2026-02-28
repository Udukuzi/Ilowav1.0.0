/**
 * Raw instruction builder for Ilowa on-chain program.
 * Completely bypasses Anchor's Program constructor (which blows Hermes stack).
 * Builds TransactionInstruction objects directly with borsh-serialized data.
 *
 * Discriminators come straight from the deployed IDL (Feb 24 build).
 */

import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  AccountMeta,
} from '@solana/web3.js';

export const PROGRAM_ID = new PublicKey('HYDwFwax9U6svCRYWD7Fqq3TXxSSQCQ6CwKrb3ZTkD3z');

// ── Instruction discriminators (first 8 bytes of SHA256("global:<snake_name>")) ──
// Using Uint8Array (native Hermes) instead of Buffer (polyfill, unavailable at module scope).
const DISC = {
  createMarket:           new Uint8Array([103, 226, 97, 235, 200, 188, 251, 254]),
  createLightMarket:      new Uint8Array([11, 242, 55, 159, 192, 200, 213, 194]),
  placeBet:               new Uint8Array([222, 62, 67, 220, 63, 166, 126, 33]),
  placeLightBet:          new Uint8Array([204, 254, 206, 181, 196, 192, 43, 135]),
  shieldedBet:            new Uint8Array([90, 105, 95, 126, 111, 101, 63, 177]),
  placeShieldedLightBet:  new Uint8Array([5, 56, 197, 172, 246, 167, 198, 244]),
  resolveMarket:          new Uint8Array([155, 23, 80, 173, 46, 74, 23, 239]),
  resolveLightMarket:     new Uint8Array([255, 210, 244, 222, 116, 215, 52, 144]),
  resolveLightMarketOracle: new Uint8Array([79, 32, 223, 151, 235, 201, 24, 32]),
  claimWinnings:          new Uint8Array([161, 215, 24, 59, 14, 236, 242, 221]),
  claimLightWinnings:     new Uint8Array([197, 43, 82, 82, 197, 136, 36, 139]),
  initElderGuardian:      new Uint8Array([97, 112, 214, 157, 49, 30, 181, 54]),
  setGuardianKey:         new Uint8Array([246, 106, 17, 152, 218, 159, 212, 69]),
  initiateRecovery:       new Uint8Array([132, 148, 60, 74, 49, 178, 235, 187]),
  cancelRecovery:         new Uint8Array([176, 23, 203, 37, 121, 251, 227, 83]),
  initSocialRecovery:     new Uint8Array([140, 113, 74, 169, 49, 131, 171, 17]),
  approveSocialRecovery:  new Uint8Array([69, 151, 178, 41, 141, 137, 47, 184]),
  tipDj:                  new Uint8Array([177, 199, 52, 184, 145, 33, 26, 148]),
};

// ── Uint8Array concat (no Buffer dependency) ────────────────

const _enc = new TextEncoder();

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function strToBytes(s: string): Uint8Array {
  return _enc.encode(s);
}

// ── Borsh serialization helpers ──────────────────────────────

function writeU8(val: number): Uint8Array {
  return new Uint8Array([val & 0xff]);
}

function writeBool(val: boolean): Uint8Array {
  return writeU8(val ? 1 : 0);
}

function writeU32LE(val: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = val & 0xff;
  b[1] = (val >>> 8) & 0xff;
  b[2] = (val >>> 16) & 0xff;
  b[3] = (val >>> 24) & 0xff;
  return b;
}

function writeU64LE(val: number): Uint8Array {
  const lo = val >>> 0;
  const hi = Math.floor(val / 0x1_0000_0000) >>> 0;
  const b = new Uint8Array(8);
  b[0] = lo & 0xff; b[1] = (lo >>> 8) & 0xff;
  b[2] = (lo >>> 16) & 0xff; b[3] = (lo >>> 24) & 0xff;
  b[4] = hi & 0xff; b[5] = (hi >>> 8) & 0xff;
  b[6] = (hi >>> 16) & 0xff; b[7] = (hi >>> 24) & 0xff;
  return b;
}

function writeI64LE(val: number): Uint8Array {
  // handle negative values via BigInt
  const big = BigInt(val);
  const b = new Uint8Array(8);
  const view = new DataView(b.buffer);
  view.setBigInt64(0, big, true);
  return b;
}

// Borsh string: 4-byte LE length + UTF-8 bytes
function writeString(s: string): Uint8Array {
  const encoded = strToBytes(s);
  return concatBytes(writeU32LE(encoded.length), encoded);
}

// Borsh bytes (Vec<u8>): 4-byte LE length + raw bytes
function writeBytes(data: Uint8Array | number[]): Uint8Array {
  const raw = data instanceof Uint8Array ? data : new Uint8Array(data);
  return concatBytes(writeU32LE(raw.length), raw);
}

function writePubkey(pk: PublicKey): Uint8Array {
  return pk.toBytes();
}

// ── PDA derivation ──────────────────────────────────────────────────────
// Now using the real findProgramAddressSync from @solana/web3.js.
// This works in Hermes because our Symbol.hasInstance polyfill in
// polyfills.ts fixed the Uint8Array instanceof check that @noble/hashes
// relies on. The earlier custom hermesFindPDA had a buggy ed25519
// on-curve check (48% mismatch rate) that produced wrong PDAs.

function hermesFindPDA(seeds: Uint8Array[], programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    seeds.map(s => Buffer.from(s)),
    programId,
  );
}

export function findMarketPDA(creator: PublicKey, expiresAt: number): [PublicKey, number] {
  const ts = writeI64LE(expiresAt);
  return hermesFindPDA([strToBytes('market'), creator.toBytes(), ts], PROGRAM_ID);
}

export function findLightMarketPDA(creator: PublicKey, resolveDate: number): [PublicKey, number] {
  const ts = writeI64LE(resolveDate);
  return hermesFindPDA([strToBytes('light_market'), creator.toBytes(), ts], PROGRAM_ID);
}

export function findBetPDA(market: PublicKey, user: PublicKey): [PublicKey, number] {
  return hermesFindPDA([strToBytes('bet'), market.toBytes(), user.toBytes()], PROGRAM_ID);
}

export function findLightBetPDA(market: PublicKey, user: PublicKey): [PublicKey, number] {
  return hermesFindPDA([strToBytes('light_bet'), market.toBytes(), user.toBytes()], PROGRAM_ID);
}

export function findShieldedBetPDA(market: PublicKey, user: PublicKey): [PublicKey, number] {
  return hermesFindPDA([strToBytes('shielded_bet'), market.toBytes(), user.toBytes()], PROGRAM_ID);
}

export function findShieldedLightBetPDA(market: PublicKey, bettor: PublicKey): [PublicKey, number] {
  return hermesFindPDA([strToBytes('shielded_light_bet'), market.toBytes(), bettor.toBytes()], PROGRAM_ID);
}

export function findTreasuryPDA(): [PublicKey, number] {
  return hermesFindPDA([strToBytes('treasury')], PROGRAM_ID);
}

export function findVaultPDA(market: PublicKey): [PublicKey, number] {
  return hermesFindPDA([strToBytes('vault'), market.toBytes()], PROGRAM_ID);
}

export function findLightVaultPDA(market: PublicKey): [PublicKey, number] {
  return hermesFindPDA([strToBytes('light_vault'), market.toBytes()], PROGRAM_ID);
}

// ── Category / region enum maps ──────────────────────────────

const CATEGORY_MAP: Record<string, number> = {
  'all': 0, 'finance': 1, 'sports': 2, 'politics': 3, 'crypto': 4,
  'culture': 5, 'music': 6, 'afrobeats': 6, 'nollywood': 5, 'football': 2,
  'elections': 3, 'currency': 1, 'tech': 4, 'weather': 0, 'other': 0,
};

const REGION_MAP: Record<string, number> = {
  'global': 0, 'west-africa': 1, 'east-africa': 2, 'southern-africa': 3,
  'latin-america': 4, 'south-asia': 5, 'southeast-asia': 6, 'mena': 7,
  'caribbean': 8, 'pacific': 0,
};

// ── Helper to build TransactionInstruction ───────────────────

function buildIx(
  disc: Uint8Array,
  argBuffers: Uint8Array[],
  keys: AccountMeta[],
): TransactionInstruction {
  const raw = concatBytes(disc, ...argBuffers);
  // Buffer polyfill is available here (inside a function, runs after polyfills load)
  // TransactionInstruction.data requires Buffer, not plain Uint8Array
  const data = Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength);
  return new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
}

// writable + signer
function ws(pubkey: PublicKey): AccountMeta {
  return { pubkey, isSigner: true, isWritable: true };
}
// writable
function w(pubkey: PublicKey): AccountMeta {
  return { pubkey, isSigner: false, isWritable: true };
}
// readonly + signer
function rs(pubkey: PublicKey): AccountMeta {
  return { pubkey, isSigner: true, isWritable: false };
}
// readonly
function r(pubkey: PublicKey): AccountMeta {
  return { pubkey, isSigner: false, isWritable: false };
}

// ── Public market instructions ───────────────────────────────

/**
 * create_market(question, category, region, is_private, expires_at)
 * accounts: creator[WS], market[W], system_program
 */
export function createMarketIx(
  creator: PublicKey,
  question: string,
  category: string,
  region: string,
  isPrivate: boolean,
  expiresAt: number,
): TransactionInstruction {
  const [marketPDA] = findMarketPDA(creator, expiresAt);
  return buildIx(
    DISC.createMarket,
    [writeString(question), writeString(category), writeString(region), writeBool(isPrivate), writeI64LE(expiresAt)],
    [ws(creator), w(marketPDA), r(SystemProgram.programId)],
  );
}

/**
 * place_bet(amount, outcome)
 * accounts: user[WS], market[W], bet[W], platform_treasury[W], market_vault[W], system_program
 */
export function placeBetIx(
  user: PublicKey,
  marketPDA: PublicKey,
  amount: number,
  outcome: boolean,
): TransactionInstruction {
  const [betPDA] = findBetPDA(marketPDA, user);
  const [treasuryPDA] = findTreasuryPDA();
  const [vaultPDA] = findVaultPDA(marketPDA);
  return buildIx(
    DISC.placeBet,
    [writeU64LE(amount), writeBool(outcome)],
    [ws(user), w(marketPDA), w(betPDA), w(treasuryPDA), w(vaultPDA), r(SystemProgram.programId)],
  );
}

/**
 * shielded_bet(encrypted_amount, zk_proof, outcome)
 * accounts: user[WS], market[W], bet[W], platform_treasury[W], system_program
 */
export function shieldedBetIx(
  user: PublicKey,
  marketPDA: PublicKey,
  encryptedAmount: number[],
  zkProof: number[],
  outcome: boolean,
): TransactionInstruction {
  const [betPDA] = findShieldedBetPDA(marketPDA, user);
  const [treasuryPDA] = findTreasuryPDA();
  return buildIx(
    DISC.shieldedBet,
    [writeBytes(encryptedAmount), writeBytes(zkProof), writeBool(outcome)],
    [ws(user), w(marketPDA), w(betPDA), w(treasuryPDA), r(SystemProgram.programId)],
  );
}

/**
 * resolve_market(outcome)
 * accounts: resolver[WS], market[W]
 */
export function resolveMarketIx(
  resolver: PublicKey,
  marketPDA: PublicKey,
  outcome: boolean,
): TransactionInstruction {
  return buildIx(
    DISC.resolveMarket,
    [writeBool(outcome)],
    [ws(resolver), w(marketPDA)],
  );
}

/**
 * claim_winnings()  — no args
 * accounts: user[WS], market, bet[W], market_vault[W], system_program
 */
export function claimWinningsIx(
  user: PublicKey,
  marketPDA: PublicKey,
): TransactionInstruction {
  const [betPDA] = findBetPDA(marketPDA, user);
  const [vaultPDA] = findVaultPDA(marketPDA);
  return buildIx(
    DISC.claimWinnings,
    [],
    [ws(user), r(marketPDA), w(betPDA), w(vaultPDA), r(SystemProgram.programId)],
  );
}

// ── Light protocol market instructions ───────────────────────

/**
 * create_light_market(question_hash, category, region, resolve_date, oracle_authority, oracle_threshold, oracle_above)
 * accounts: creator[WS], market[W], system_program
 */
export function createLightMarketIx(
  creator: PublicKey,
  question: string,
  category: string,
  region: string,
  resolveDate: number,
  oracleAuthority: PublicKey = PublicKey.default,
  oracleThreshold: number = 0,
  oracleAbove: boolean = true,
): TransactionInstruction {
  const [marketPDA] = findLightMarketPDA(creator, resolveDate);

  // fold question into 32-byte hash (truncate + XOR for overflow)
  const enc = new TextEncoder();
  const questionBytes = enc.encode(question);
  const questionHash = new Uint8Array(32);
  for (let i = 0; i < Math.min(questionBytes.length, 32); i++) {
    questionHash[i] = questionBytes[i];
  }
  for (let i = 32; i < questionBytes.length; i++) {
    questionHash[i % 32] ^= questionBytes[i];
  }

  const categoryNum = CATEGORY_MAP[category.toLowerCase()] ?? 0;
  const regionNum = REGION_MAP[region.toLowerCase()] ?? 0;

  // question_hash is [u8; 32] — fixed-size array, no length prefix in borsh
  return buildIx(
    DISC.createLightMarket,
    [
      questionHash,                  // [u8; 32]
      writeU8(categoryNum),
      writeU8(regionNum),
      writeI64LE(resolveDate),
      writePubkey(oracleAuthority),
      writeI64LE(oracleThreshold),
      writeBool(oracleAbove),
    ],
    [ws(creator), w(marketPDA), r(SystemProgram.programId)],
  );
}

/**
 * place_light_bet(amount, outcome)
 * accounts: bettor[WS], market[W], bet[W], platform_treasury[W], market_vault[W], system_program
 */
export function placeLightBetIx(
  user: PublicKey,
  marketPDA: PublicKey,
  amount: number,
  outcome: boolean,
): TransactionInstruction {
  const [betPDA] = findLightBetPDA(marketPDA, user);
  const [treasuryPDA] = findTreasuryPDA();
  const [vaultPDA] = findLightVaultPDA(marketPDA);
  return buildIx(
    DISC.placeLightBet,
    [writeU64LE(amount), writeBool(outcome)],
    [ws(user), w(marketPDA), w(betPDA), w(treasuryPDA), w(vaultPDA), r(SystemProgram.programId)],
  );
}

/**
 * place_shielded_light_bet(encrypted_amount, zk_proof, outcome)
 * accounts: bettor[WS], market[W], bet[W], platform_treasury[W], system_program
 */
export function placeShieldedLightBetIx(
  bettor: PublicKey,
  marketPDA: PublicKey,
  encryptedAmount: number[],
  zkProof: number[],
  outcome: boolean,
): TransactionInstruction {
  const [betPDA] = findShieldedLightBetPDA(marketPDA, bettor);
  const [treasuryPDA] = findTreasuryPDA();
  return buildIx(
    DISC.placeShieldedLightBet,
    [writeBytes(encryptedAmount), writeBytes(zkProof), writeBool(outcome)],
    [ws(bettor), w(marketPDA), w(betPDA), w(treasuryPDA), r(SystemProgram.programId)],
  );
}

/**
 * resolve_light_market(outcome)
 * accounts: creator[S], market[W]
 */
export function resolveLightMarketIx(
  creator: PublicKey,
  marketPDA: PublicKey,
  outcome: boolean,
): TransactionInstruction {
  return buildIx(
    DISC.resolveLightMarket,
    [writeBool(outcome)],
    [rs(creator), w(marketPDA)],
  );
}

/**
 * resolve_light_market_oracle(attested_price, outcome)
 * accounts: oracle_authority[S], market[W], price_feed
 * pass SystemProgram.programId as price_feed for manual attestation mode
 */
export function resolveLightMarketOracleIx(
  oracleAuthority: PublicKey,
  marketPDA: PublicKey,
  attestedPrice: number,
  outcome: boolean,
  priceFeed: PublicKey = SystemProgram.programId,
): TransactionInstruction {
  return buildIx(
    DISC.resolveLightMarketOracle,
    [writeI64LE(attestedPrice), writeBool(outcome)],
    [rs(oracleAuthority), w(marketPDA), r(priceFeed)],
  );
}

/**
 * claim_light_winnings()  — no args
 * accounts: bettor[WS], market, bet[W], market_vault[W], system_program
 */
export function claimLightWinningsIx(
  bettor: PublicKey,
  marketPDA: PublicKey,
): TransactionInstruction {
  const [betPDA] = findLightBetPDA(marketPDA, bettor);
  const [vaultPDA] = findLightVaultPDA(marketPDA);
  return buildIx(
    DISC.claimLightWinnings,
    [],
    [ws(bettor), r(marketPDA), w(betPDA), w(vaultPDA), r(SystemProgram.programId)],
  );
}

// ── Security / Guardian instructions ─────────────────────────

export function findElderGuardianPDA(user: PublicKey): [PublicKey, number] {
  return hermesFindPDA([strToBytes('elder_guardian'), user.toBytes()], PROGRAM_ID);
}

export function findSocialRecoveryPDA(user: PublicKey): [PublicKey, number] {
  return hermesFindPDA([strToBytes('social_recovery'), user.toBytes()], PROGRAM_ID);
}

/**
 * init_elder_guardian() — no args
 * accounts: user[WS], guardian[W], system_program
 */
export function initElderGuardianIx(user: PublicKey): TransactionInstruction {
  const [guardianPDA] = findElderGuardianPDA(user);
  return buildIx(
    DISC.initElderGuardian,
    [],
    [ws(user), w(guardianPDA), r(SystemProgram.programId)],
  );
}

/**
 * set_guardian_key(guardian_key)
 * accounts: user[WS], guardian[W]
 */
export function setGuardianKeyIx(user: PublicKey, guardianKey: PublicKey): TransactionInstruction {
  const [guardianPDA] = findElderGuardianPDA(user);
  return buildIx(
    DISC.setGuardianKey,
    [writePubkey(guardianKey)],
    [ws(user), w(guardianPDA)],
  );
}

/**
 * initiate_recovery() — no args
 * accounts: initiator[WS], guardian[W]
 */
export function initiateRecoveryIx(initiator: PublicKey, userWallet: PublicKey): TransactionInstruction {
  const [guardianPDA] = findElderGuardianPDA(userWallet);
  return buildIx(
    DISC.initiateRecovery,
    [],
    [ws(initiator), w(guardianPDA)],
  );
}

/**
 * cancel_recovery() — no args
 * accounts: user[WS], guardian[W]
 */
export function cancelRecoveryIx(user: PublicKey): TransactionInstruction {
  const [guardianPDA] = findElderGuardianPDA(user);
  return buildIx(
    DISC.cancelRecovery,
    [],
    [ws(user), w(guardianPDA)],
  );
}

/**
 * init_social_recovery(guardians: Vec<Pubkey>)
 * accounts: user[WS], social_recovery[W], system_program
 */
export function initSocialRecoveryIx(user: PublicKey, guardians: PublicKey[]): TransactionInstruction {
  const [recoveryPDA] = findSocialRecoveryPDA(user);
  // Borsh Vec<Pubkey>: 4-byte LE count + N * 32-byte pubkeys
  const parts = [writeU32LE(guardians.length), ...guardians.map(g => g.toBytes())];
  return buildIx(
    DISC.initSocialRecovery,
    parts,
    [ws(user), w(recoveryPDA), r(SystemProgram.programId)],
  );
}

/**
 * approve_social_recovery(new_wallet)
 * accounts: guardian[WS], social_recovery[W]
 */
export function approveSocialRecoveryIx(
  guardian: PublicKey,
  userWallet: PublicKey,
  newWallet: PublicKey,
): TransactionInstruction {
  const [recoveryPDA] = findSocialRecoveryPDA(userWallet);
  return buildIx(
    DISC.approveSocialRecovery,
    [writePubkey(newWallet)],
    [ws(guardian), w(recoveryPDA)],
  );
}

// ── Radio instructions ───────────────────────────────────────

/**
 * tip_dj(amount)
 * accounts: tipper[WS], dj[W], platform_treasury[W], system_program
 */
export function tipDjIx(
  tipper: PublicKey,
  dj: PublicKey,
  amount: number,
): TransactionInstruction {
  const [treasuryPDA] = findTreasuryPDA();
  return buildIx(
    DISC.tipDj,
    [writeU64LE(amount)],
    [ws(tipper), w(dj), w(treasuryPDA), r(SystemProgram.programId)],
  );
}
