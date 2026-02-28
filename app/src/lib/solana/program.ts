import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor';
import { getConnection } from './connection';
import IDL from './idl.json';

export const PROGRAM_ID = new PublicKey('HYDwFwax9U6svCRYWD7Fqq3TXxSSQCQ6CwKrb3ZTkD3z');

let programInstance: Program | null = null;
let lastWalletKey: string | null = null;

export function getProgram(wallet: any): Program {
  const currentKey = wallet?.publicKey?.toBase58?.() ?? null;
  if (programInstance && currentKey === lastWalletKey) return programInstance;
  const connection = getConnection();
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  try {
    programInstance = new Program(IDL as Idl, provider);
  } catch (e: any) {
    // Anchor's IDL parser can overflow Hermes's native stack for large IDLs.
    // Surface a clear message instead of letting it propagate as an opaque crash.
    if (e?.message?.includes('call stack') || e?.message?.includes('stack size')) {
      console.error('[Program] IDL parse blew Hermes stack — use dev client build for on-chain ops');
      throw new Error('Anchor IDL too large for Hermes stack. Use EAS dev client build.');
    }
    throw e;
  }
  lastWalletKey = currentKey;
  return programInstance;
}

export function resetProgram() {
  programInstance = null;
  lastWalletKey = null;
}

// ── PDA Helpers ─────────────────────────────────────────────

export function findMarketPDA(creator: PublicKey, expiresAt: number): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(BigInt(expiresAt));
  return PublicKey.findProgramAddressSync(
    [Buffer.from('market'), creator.toBuffer(), buf],
    PROGRAM_ID
  );
}

export function findBetPDA(market: PublicKey, user: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('bet'), market.toBuffer(), user.toBuffer()],
    PROGRAM_ID
  );
}

export function findShieldedBetPDA(market: PublicKey, user: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('shielded_bet'), market.toBuffer(), user.toBuffer()],
    PROGRAM_ID
  );
}

export function findTreasuryPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('treasury')],
    PROGRAM_ID
  );
}

export function findVaultPDA(market: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), market.toBuffer()],
    PROGRAM_ID
  );
}

export function findElderGuardianPDA(user: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('elder_guardian'), user.toBuffer()],
    PROGRAM_ID
  );
}

export function findSocialRecoveryPDA(user: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('social_recovery'), user.toBuffer()],
    PROGRAM_ID
  );
}

export function findVoiceNftPDA(owner: PublicKey, voiceUri: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('voice_nft'), owner.toBuffer(), Buffer.from(voiceUri)],
    PROGRAM_ID
  );
}

export function findDappRegistryPDA(dapp: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('dapp_registry'), dapp.toBuffer()],
    PROGRAM_ID
  );
}

// ── Instruction Builders ────────────────────────────────────

export async function createMarketIx(
  program: Program,
  creator: PublicKey,
  question: string,
  category: string,
  region: string,
  isPrivate: boolean,
  expiresAt: number,
) {
  const [marketPDA] = findMarketPDA(creator, expiresAt);
  return program.methods
    .createMarket(question, category, region, isPrivate, new BN(expiresAt))
    .accounts({
      creator,
      market: marketPDA,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function placeBetIx(
  program: Program,
  user: PublicKey,
  marketPDA: PublicKey,
  amount: number,
  outcome: boolean,
) {
  const [betPDA] = findBetPDA(marketPDA, user);
  const [treasuryPDA] = findTreasuryPDA();
  const [vaultPDA] = findVaultPDA(marketPDA);
  return program.methods
    .placeBet(new BN(amount), outcome)
    .accounts({
      user,
      market: marketPDA,
      bet: betPDA,
      platformTreasury: treasuryPDA,
      marketVault: vaultPDA,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function shieldedBetIx(
  program: Program,
  user: PublicKey,
  marketPDA: PublicKey,
  encryptedAmount: number[],
  zkProof: number[],
  outcome: boolean,
) {
  const [betPDA] = findShieldedBetPDA(marketPDA, user);
  const [treasuryPDA] = findTreasuryPDA();
  return program.methods
    .shieldedBet(Buffer.from(encryptedAmount), Buffer.from(zkProof), outcome)
    .accounts({
      user,
      market: marketPDA,
      bet: betPDA,
      platformTreasury: treasuryPDA,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function resolveMarketIx(
  program: Program,
  resolver: PublicKey,
  marketPDA: PublicKey,
  outcome: boolean,
) {
  return program.methods
    .resolveMarket(outcome)
    .accounts({
      resolver,
      market: marketPDA,
    })
    .instruction();
}

export async function tipDjIx(
  program: Program,
  tipper: PublicKey,
  dj: PublicKey,
  amount: number,
) {
  const [treasuryPDA] = findTreasuryPDA();
  return program.methods
    .tipDj(new BN(amount))
    .accounts({
      tipper,
      dj,
      platformTreasury: treasuryPDA,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function mintVoiceNftIx(
  program: Program,
  owner: PublicKey,
  voiceUri: string,
  metadataUri: string,
  market: PublicKey,
  isWinner: boolean,
  isMeme: boolean,
) {
  const [nftPDA] = findVoiceNftPDA(owner, voiceUri);
  return program.methods
    .mintVoiceNft(voiceUri, metadataUri, market, isWinner, isMeme)
    .accounts({
      owner,
      voiceNft: nftPDA,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function initElderGuardianIx(
  program: Program,
  user: PublicKey,
) {
  const [guardianPDA] = findElderGuardianPDA(user);
  return program.methods
    .initElderGuardian()
    .accounts({
      user,
      guardian: guardianPDA,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function setGuardianKeyIx(
  program: Program,
  user: PublicKey,
  guardianKey: PublicKey,
) {
  const [guardianPDA] = findElderGuardianPDA(user);
  return program.methods
    .setGuardianKey(guardianKey)
    .accounts({
      user,
      guardian: guardianPDA,
    })
    .instruction();
}

export async function initiateRecoveryIx(
  program: Program,
  initiator: PublicKey,
  userWallet: PublicKey,
) {
  const [guardianPDA] = findElderGuardianPDA(userWallet);
  return program.methods
    .initiateRecovery()
    .accounts({
      initiator,
      guardian: guardianPDA,
    })
    .instruction();
}

export async function cancelRecoveryIx(
  program: Program,
  user: PublicKey,
) {
  const [guardianPDA] = findElderGuardianPDA(user);
  return program.methods
    .cancelRecovery()
    .accounts({
      user,
      guardian: guardianPDA,
    })
    .instruction();
}

export async function initSocialRecoveryIx(
  program: Program,
  user: PublicKey,
  guardians: PublicKey[],
) {
  const [recoveryPDA] = findSocialRecoveryPDA(user);
  return program.methods
    .initSocialRecovery(guardians)
    .accounts({
      user,
      socialRecovery: recoveryPDA,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function approveSocialRecoveryIx(
  program: Program,
  guardian: PublicKey,
  userWallet: PublicKey,
  newWallet: PublicKey,
) {
  const [recoveryPDA] = findSocialRecoveryPDA(userWallet);
  return program.methods
    .approveSocialRecovery(newWallet)
    .accounts({
      guardian,
      socialRecovery: recoveryPDA,
    })
    .instruction();
}

export async function registerDappIx(
  program: Program,
  registrar: PublicKey,
  dapp: PublicKey,
  domain: string,
) {
  const [registryPDA] = findDappRegistryPDA(dapp);
  return program.methods
    .registerDapp(domain)
    .accounts({
      registrar,
      dapp,
      registry: registryPDA,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

// ── Light Protocol Market Helpers ─────────────────────────

// Category enum mapping for Light Protocol markets
const CATEGORY_MAP: Record<string, number> = {
  'all': 0, 'finance': 1, 'sports': 2, 'politics': 3, 'crypto': 4,
  'culture': 5, 'music': 6, 'afrobeats': 6, 'nollywood': 5, 'football': 2,
  'elections': 3, 'currency': 1, 'tech': 4, 'weather': 0, 'other': 0,
};

// Region enum mapping for Light Protocol markets
const REGION_MAP: Record<string, number> = {
  'global': 0, 'west-africa': 1, 'east-africa': 2, 'southern-africa': 3,
  'latin-america': 4, 'south-asia': 5, 'southeast-asia': 6, 'mena': 7,
  'caribbean': 8, 'pacific': 0,
};

export function findLightMarketPDA(creator: PublicKey, resolveDate: number): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(BigInt(resolveDate));
  return PublicKey.findProgramAddressSync(
    [Buffer.from('light_market'), creator.toBuffer(), buf],
    PROGRAM_ID
  );
}

export function findLightBetPDA(market: PublicKey, user: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('light_bet'), market.toBuffer(), user.toBuffer()],
    PROGRAM_ID
  );
}

export function findShieldedLightBetPDA(market: PublicKey, bettor: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('shielded_light_bet'), market.toBuffer(), bettor.toBuffer()],
    PROGRAM_ID
  );
}

export function findLightVaultPDA(market: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('light_vault'), market.toBuffer()],
    PROGRAM_ID
  );
}

export function findShieldedPoolPDA(market: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('shielded_pool'), market.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Create a Light Protocol compressed market instruction.
 * Uses ZK compression for ~1000x cheaper storage.
 */
export async function createLightMarketIx(
  program: Program,
  creator: PublicKey,
  question: string,
  category: string,
  region: string,
  resolveDate: number,
  oracleAuthority: PublicKey = PublicKey.default,
  oracleThreshold: number = 0,
  oracleAbove: boolean = true,
) {
  const [marketPDA] = findLightMarketPDA(creator, resolveDate);

  // Truncate-then-XOR-fold question into 32 bytes
  const encoder = new TextEncoder();
  const questionBytes = encoder.encode(question);
  const questionHash = new Uint8Array(32);
  for (let i = 0; i < Math.min(questionBytes.length, 32); i++) {
    questionHash[i] = questionBytes[i];
  }
  for (let i = 32; i < questionBytes.length; i++) {
    questionHash[i % 32] ^= questionBytes[i];
  }

  const categoryNum = CATEGORY_MAP[category.toLowerCase()] ?? 0;
  const regionNum   = REGION_MAP[region.toLowerCase()]   ?? 0;

  return program.methods
    .createLightMarket(
      Buffer.from(questionHash),
      categoryNum,
      regionNum,
      new BN(resolveDate),
      oracleAuthority,
      new BN(oracleThreshold),
      oracleAbove,
    )
    .accounts({
      creator,
      market: marketPDA,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function resolveLightMarketIx(
  program: Program,
  creator: PublicKey,
  marketPDA: PublicKey,
  outcome: boolean,
) {
  return program.methods
    .resolveLightMarket(outcome)
    .accounts({ creator, market: marketPDA })
    .instruction();
}

export async function resolveLightMarketOracleIx(
  program: Program,
  oracleAuthority: PublicKey,
  marketPDA: PublicKey,
  attestedPrice: number,
  outcome: boolean,
  priceFeed: PublicKey = SystemProgram.programId,
) {
  return program.methods
    .resolveLightMarketOracle(new BN(attestedPrice), outcome)
    .accounts({ oracleAuthority, market: marketPDA, priceFeed })
    .instruction();
}

export async function claimLightWinningsIx(
  program: Program,
  bettor: PublicKey,
  marketPDA: PublicKey,
) {
  const [betPDA]   = findLightBetPDA(marketPDA, bettor);
  const [vaultPDA] = findLightVaultPDA(marketPDA);
  return program.methods
    .claimLightWinnings()
    .accounts({
      bettor,
      market: marketPDA,
      bet: betPDA,
      marketVault: vaultPDA,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function initShieldedPoolIx(
  program: Program,
  creator: PublicKey,
  marketPDA: PublicKey,
  mxeAuthority: PublicKey,
) {
  const [poolPDA] = findShieldedPoolPDA(marketPDA);
  return program.methods
    .initShieldedPool(mxeAuthority)
    .accounts({
      creator,
      market: marketPDA,
      pool: poolPDA,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function submitShieldedAggregateIx(
  program: Program,
  mxeAuthority: PublicKey,
  marketPDA: PublicKey,
  encryptedYesTotal: number[],
  encryptedNoTotal: number[],
  totalShieldedBets: number,
  finalize: boolean,
) {
  const [poolPDA] = findShieldedPoolPDA(marketPDA);
  return program.methods
    .submitShieldedAggregate(
      Buffer.from(encryptedYesTotal),
      Buffer.from(encryptedNoTotal),
      totalShieldedBets,
      finalize,
    )
    .accounts({
      mxeAuthority,
      pool: poolPDA,
      market: marketPDA,
    })
    .instruction();
}

/**
 * Place a bet on a Light Protocol compressed market.
 */
export async function placeLightBetIx(
  program: Program,
  user: PublicKey,
  marketPDA: PublicKey,
  amount: number,
  outcome: boolean,
) {
  const [betPDA] = findLightBetPDA(marketPDA, user);
  const [treasuryPDA] = findTreasuryPDA();
  const [vaultPDA] = findLightVaultPDA(marketPDA);
  
  return program.methods
    .placeLightBet(new BN(amount), outcome)
    .accounts({
      bettor: user,
      market: marketPDA,
      bet: betPDA,
      platformTreasury: treasuryPDA,
      marketVault: vaultPDA,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function placeShieldedLightBetIx(
  program: Program,
  bettor: PublicKey,
  marketPDA: PublicKey,
  encryptedAmount: number[],
  zkProof: number[],
  outcome: boolean,
) {
  const [betPDA] = findShieldedLightBetPDA(marketPDA, bettor);
  const [treasuryPDA] = findTreasuryPDA();
  return program.methods
    .placeShieldedLightBet(Buffer.from(encryptedAmount), Buffer.from(zkProof), outcome)
    .accounts({
      bettor,
      market: marketPDA,
      bet: betPDA,
      platformTreasury: treasuryPDA,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

// ── Compressed Market Helpers ─────────────────────────────

export function findCompressedMarketPDA(creator: PublicKey, resolveDate: number): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(BigInt(resolveDate));
  return PublicKey.findProgramAddressSync(
    [Buffer.from('compressed_market'), creator.toBuffer(), buf],
    PROGRAM_ID
  );
}

export function findRateLimitPDA(user: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('rate_limit'), user.toBuffer()],
    PROGRAM_ID
  );
}

export function findCompressedBetPDA(market: PublicKey, user: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('compressed_bet'), market.toBuffer(), user.toBuffer()],
    PROGRAM_ID
  );
}

export function findCompressedVaultPDA(market: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('compressed_vault'), market.toBuffer()],
    PROGRAM_ID
  );
}

export async function createCompressedMarketIx(
  program: Program,
  creator: PublicKey,
  question: string,
  resolveDate: number,
  category: object,
) {
  const [marketPDA] = findCompressedMarketPDA(creator, resolveDate);
  return program.methods
    .createCompressedMarket(question, new BN(resolveDate), category)
    .accounts({
      creator,
      market: marketPDA,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function claimWinningsIx(
  program: Program,
  user: PublicKey,
  marketPDA: PublicKey,
) {
  const [betPDA] = findBetPDA(marketPDA, user);
  const [vaultPDA] = findVaultPDA(marketPDA);
  return program.methods
    .claimWinnings()
    .accounts({
      user,
      market: marketPDA,
      bet: betPDA,
      marketVault: vaultPDA,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function placeCompressedBetIx(
  program: Program,
  user: PublicKey,
  marketPDA: PublicKey,
  amount: number,
  outcome: boolean,
) {
  const [betPDA] = findCompressedBetPDA(marketPDA, user);
  const [treasuryPDA] = findTreasuryPDA();
  const [vaultPDA] = findCompressedVaultPDA(marketPDA);
  return program.methods
    .placeCompressedBet(new BN(amount), outcome)
    .accounts({
      user,
      market: marketPDA,
      bet: betPDA,
      platformTreasury: treasuryPDA,
      marketVault: vaultPDA,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

// ── Account Fetchers ────────────────────────────────────────

export async function fetchMarketAccount(program: Program, marketPDA: PublicKey) {
  return (program.account as any).market.fetch(marketPDA);
}

export async function fetchLightMarketAccount(program: Program, marketPDA: PublicKey) {
  return (program.account as any).lightMarketStub.fetch(marketPDA);
}

export async function fetchAllMarkets(program: Program) {
  return (program.account as any).market.all();
}

export async function fetchAllLightMarkets(program: Program) {
  return (program.account as any).lightMarketStub.all();
}

export async function fetchElderGuardian(program: Program, user: PublicKey) {
  const [pda] = findElderGuardianPDA(user);
  return (program.account as any).elderGuardian.fetch(pda);
}

export async function fetchSocialRecovery(program: Program, user: PublicKey) {
  const [pda] = findSocialRecoveryPDA(user);
  return (program.account as any).socialRecovery.fetch(pda);
}

export async function fetchDappRegistry(program: Program, dapp: PublicKey) {
  const [pda] = findDappRegistryPDA(dapp);
  return (program.account as any).dAppRegistry.fetch(pda);
}

export async function fetchAllCompressedMarkets(program: Program) {
  return (program.account as any).compressedMarket.all();
}

// reverse-lookup tables for light market category/region numbers
const CATEGORY_NAMES = ['other', 'finance', 'sports', 'politics', 'crypto', 'culture', 'music'];
const REGION_NAMES  = ['global', 'west-africa', 'east-africa', 'southern-africa', 'latin-america', 'south-asia', 'southeast-asia', 'mena', 'caribbean'];

/**
 * Convert a LightMarketStub account to the shared Market type.
 * Question is recovered from the first non-null bytes of the stored hash
 * (works for questions ≤32 chars; longer ones show a truncated prefix).
 */
export function lightMarketAccountToMarket(pubkey: PublicKey, account: any): import('../../types/market').Market {
  const hashBytes: number[] = account.questionHash || [];
  const cutoff = hashBytes.findIndex((b, i) => i > 0 && hashBytes.slice(i).every((x: number) => x === 0));
  const raw = new Uint8Array(cutoff > 0 ? hashBytes.slice(0, cutoff) : hashBytes);
  const question = new TextDecoder('utf-8', { fatal: false }).decode(raw) || '[Compressed Market]';

  const isResolved = account.resolved === true;
  const isActive   = account.isActive === true;

  const oracleAuth: string | undefined = account.oracleAuthority?.toBase58?.();
  const hasOracle = oracleAuth && oracleAuth !== PublicKey.default.toBase58();

  return {
    id: pubkey.toBase58(),
    pubkey: pubkey.toBase58(),
    creator: account.creator?.toBase58?.()?.slice(0, 8) + '...' || 'Unknown',
    question,
    category: CATEGORY_NAMES[account.category ?? 0] || 'other',
    region:   REGION_NAMES[account.region ?? 0]    || 'global',
    isPrivate: true,
    isLight: true,
    status: isResolved ? 'resolved' : isActive ? 'active' : 'expired',
    outcome: isResolved ? (account.outcome === 1 ? 'yes' : 'no') : null,
    yesPool:         (account.yesPool?.toNumber?.()   || 0) / LAMPORTS_PER_SOL,
    noPool:          (account.noPool?.toNumber?.()    || 0) / LAMPORTS_PER_SOL,
    totalBets:       account.totalBets || 0,
    shieldedBetCount: account.shieldedBetCount || 0,
    createdAt:       (account.createdAt?.toNumber?.()   || 0) * 1000,
    expiresAt:       (account.resolveDate?.toNumber?.() || 0) * 1000,
    oracleAuthority: hasOracle ? oracleAuth : undefined,
    oracleThreshold: hasOracle ? (account.oracleThreshold?.toNumber?.() ?? 0) : undefined,
    oracleAbove:     hasOracle ? (account.oracleAbove ?? true) : undefined,
  };
}

/**
 * Convert on-chain Market account to frontend Market type.
 */
export function marketAccountToMarket(pubkey: PublicKey, account: any): import('../../types/market').Market {
  type MarketStatus = import('../../types/market').MarketStatus;
  const statusMap: Record<string, MarketStatus> = {
    active: 'active',
    resolved: 'resolved',
    expired: 'expired',
    disputed: 'disputed',
  };
  const statusKey = Object.keys(account.status || {})[0] || 'active';

  return {
    id: pubkey.toBase58(),
    pubkey: pubkey.toBase58(),
    creator: account.creator?.toBase58()?.slice(0, 8) + '...' || 'Unknown',
    question: account.question || '',
    category: account.category || 'other',
    region: account.region || 'global',
    isPrivate: account.isPrivate || false,
    status: statusMap[statusKey] || ('active' as MarketStatus),
    outcome: account.outcome ?? null,
    yesPool: (account.yesPool?.toNumber?.() || 0) / LAMPORTS_PER_SOL,
    noPool: (account.noPool?.toNumber?.() || 0) / LAMPORTS_PER_SOL,
    totalBets: account.totalBets || 0,
    createdAt: (account.createdAt?.toNumber?.() || 0) * 1000,
    expiresAt: (account.expiresAt?.toNumber?.() || 0) * 1000,
  };
}
