/**
 * Private points system — stores all breakdowns in Nillion (blind vault)
 * so even Ilowa's servers can't see individual user activity details.
 *
 * For fast UI reads we cache total + tier in Supabase. The full breakdown
 * only lives in Nillion and can only be retrieved by the user themselves
 * or the airdrop calculator at token launch.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { nillionStorage, WalletAuth } from '../nillion/NillionClient';

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient | null {
  if (_supabase) return _supabase;
  const url  = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key  = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _supabase = createClient(url, key);
  return _supabase;
}

const VPS_URL = process.env.EXPO_PUBLIC_VPS_API_URL || 'http://localhost:3000';

// ── Extensive tier system — Fibonacci-inspired thresholds ───────────────────
// Each tier requires roughly φ (1.618) × the previous threshold.
// This gives early progression that's fast and rewarding, but top tiers
// take real commitment — matching how compounding knowledge works.

export const TIERS = [
  { id: 'seed',        label: 'Seed',            threshold: 0,        color: '#8B7355', emoji: '🌱', multiplier: 1.0 },
  { id: 'sprout',      label: 'Sprout',          threshold: 50,       color: '#90B77D', emoji: '🌿', multiplier: 1.05 },
  { id: 'sapling',     label: 'Sapling',         threshold: 150,      color: '#4CAF50', emoji: '🌳', multiplier: 1.1 },
  { id: 'bronze',      label: 'Bronze',          threshold: 400,      color: '#CD7F32', emoji: '🥉', multiplier: 1.15 },
  { id: 'iron',        label: 'Iron',            threshold: 800,      color: '#A19D94', emoji: '⚒️', multiplier: 1.2 },
  { id: 'silver',      label: 'Silver',          threshold: 1_500,    color: '#C0C0C0', emoji: '🥈', multiplier: 1.25 },
  { id: 'gold',        label: 'Gold',            threshold: 3_000,    color: '#FFD700', emoji: '🥇', multiplier: 1.3 },
  { id: 'emerald',     label: 'Emerald',         threshold: 5_000,    color: '#50C878', emoji: '💎', multiplier: 1.4 },
  { id: 'sapphire',    label: 'Sapphire',        threshold: 8_000,    color: '#0F52BA', emoji: '💠', multiplier: 1.5 },
  { id: 'ruby',        label: 'Ruby',            threshold: 13_000,   color: '#E0115F', emoji: '❤️‍🔥', multiplier: 1.6 },
  { id: 'diamond',     label: 'Diamond',         threshold: 21_000,   color: '#B9F2FF', emoji: '💎', multiplier: 1.75 },
  { id: 'platinum',    label: 'Platinum',        threshold: 34_000,   color: '#E5E4E2', emoji: '⚡', multiplier: 1.9 },
  { id: 'obsidian',    label: 'Obsidian',        threshold: 55_000,   color: '#3D3D3D', emoji: '🖤', multiplier: 2.0 },
  { id: 'elder',       label: 'Elder',           threshold: 89_000,   color: '#8B5CF6', emoji: '👑', multiplier: 2.25 },
  { id: 'ancestor',    label: 'Ancestor',        threshold: 144_000,  color: '#FFD700', emoji: '🌟', multiplier: 2.5 },
] as const;

export type TierId = typeof TIERS[number]['id'];

// ── Early Adopter Badges ────────────────────────────────────────────────────
// First 33 users: Genesis Elder — 2x point multiplier + governance perks
// Users 34-99:    Pioneer Voice — 1.5x point multiplier + badge
// After 99:       no early badge, normal progression

export interface EarlyAdopterBadge {
  type: 'genesis_elder' | 'pioneer_voice' | null;
  label: string;
  emoji: string;
  color: string;
  multiplierBonus: number; // stacks with tier multiplier
  userNumber: number; // signup order
}

export const EARLY_BADGES = {
  genesis_elder: {
    type: 'genesis_elder' as const,
    label: 'Genesis Elder',
    emoji: '🏛️',
    color: '#FFD700',
    multiplierBonus: 1.0, // effectively 2x total
    maxUsers: 33,
    perks: ['2x point multiplier', 'Governance voting weight +50%', 'Exclusive Genesis NFT airdrop', 'Priority feature access'],
  },
  pioneer_voice: {
    type: 'pioneer_voice' as const,
    label: 'Pioneer Voice',
    emoji: '🌅',
    color: '#F59E0B',
    multiplierBonus: 0.5, // effectively 1.5x total
    maxUsers: 99,
    perks: ['1.5x point multiplier', 'Pioneer badge on profile', 'Early access to new features'],
  },
};

const BADGE_STORAGE_KEY = '@ilowa/early_badge';

export async function getEarlyBadge(wallet: string): Promise<EarlyAdopterBadge | null> {
  try {
    const raw = await AsyncStorage.getItem(`${BADGE_STORAGE_KEY}/${wallet.slice(0, 16)}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function assignEarlyBadge(wallet: string, userNumber: number): Promise<EarlyAdopterBadge | null> {
  // already assigned?
  const existing = await getEarlyBadge(wallet);
  if (existing) return existing;

  let badge: EarlyAdopterBadge | null = null;

  if (userNumber <= 33) {
    badge = {
      type: 'genesis_elder',
      label: EARLY_BADGES.genesis_elder.label,
      emoji: EARLY_BADGES.genesis_elder.emoji,
      color: EARLY_BADGES.genesis_elder.color,
      multiplierBonus: EARLY_BADGES.genesis_elder.multiplierBonus,
      userNumber,
    };
  } else if (userNumber <= 99) {
    badge = {
      type: 'pioneer_voice',
      label: EARLY_BADGES.pioneer_voice.label,
      emoji: EARLY_BADGES.pioneer_voice.emoji,
      color: EARLY_BADGES.pioneer_voice.color,
      multiplierBonus: EARLY_BADGES.pioneer_voice.multiplierBonus,
      userNumber,
    };
  }

  if (badge) {
    try {
      await AsyncStorage.setItem(
        `${BADGE_STORAGE_KEY}/${wallet.slice(0, 16)}`,
        JSON.stringify(badge)
      );
    } catch {}
  }

  return badge;
}

// Milestone bonuses — awarded once when crossing a threshold
export const MILESTONES: { at: number; bonus: number; title: string }[] = [
  { at: 50,      bonus: 10,   title: 'First Steps' },
  { at: 100,     bonus: 25,   title: 'Getting Started' },
  { at: 250,     bonus: 50,   title: 'Rising Voice' },
  { at: 500,     bonus: 75,   title: 'Community Member' },
  { at: 1_000,   bonus: 150,  title: 'Trusted Participant' },
  { at: 2_500,   bonus: 300,  title: 'Cultural Bridge' },
  { at: 5_000,   bonus: 500,  title: 'Wisdom Keeper' },
  { at: 10_000,  bonus: 1000, title: 'Market Oracle' },
  { at: 25_000,  bonus: 2000, title: 'Elder\'s Apprentice' },
  { at: 50_000,  bonus: 3500, title: 'Voice of the People' },
  { at: 100_000, bonus: 5000, title: 'Legend of Ilowa' },
];

export interface UserPoints {
  userId: string;
  totalPoints: number;
  breakdown: {
    earlyUser: number;
    predictions: number;
    accuratePredictions: number;
    socialEngagement: number;
    contentCreation: number;
    referrals: number;
  };
  tier: TierId;
  level: number; // 1-based, derived from tier index + 1
  milestonesHit: number[]; // thresholds already awarded
  lastUpdated: number;
}

// ── local on-device cache (survives offline / no VPS) ─────────────────────

const LOCAL_KEY = (w: string) => `@ilowa/pts/${w.slice(0, 16)}`;

async function readLocal(wallet: string): Promise<UserPoints | null> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY(wallet));
    return raw ? JSON.parse(raw) as UserPoints : null;
  } catch { return null; }
}

async function writeLocal(pts: UserPoints): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCAL_KEY(pts.userId), JSON.stringify(pts));
  } catch {}
}

// ── helpers ─────────────────────────────────────────────────────────────────

const EMPTY_POINTS = (wallet: string): UserPoints => ({
  userId: wallet,
  totalPoints: 0,
  breakdown: {
    earlyUser: 0,
    predictions: 0,
    accuratePredictions: 0,
    socialEngagement: 0,
    contentCreation: 0,
    referrals: 0,
  },
  tier: 'seed',
  level: 1,
  milestonesHit: [],
  lastUpdated: Date.now(),
});

class PrivatePointsSystem {

  // ── write ──────────────────────────────────────────────────────────────────

  /**
   * Award points for an activity. Calls the VPS which routes to Python → Nillion.
   * Auth is required so only the user (or server-side flows) can update points.
   */
  async awardPoints({
    userWallet,
    activity,
    amount,
    auth,
  }: {
    userWallet: string;
    activity: keyof UserPoints['breakdown'];
    amount: number;
    auth: WalletAuth;
  }): Promise<UserPoints> {
    try {
      let signature = '';
      let message   = '';

      if (auth.signMessage) {
        message = `ilowa_AUTH_${Date.now()}`;
        const sigBytes = await auth.signMessage(new TextEncoder().encode(message));
        signature = Buffer.from(sigBytes).toString('hex');
      }

      const resp = await fetch(`${VPS_URL}/api/points/award`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: userWallet,
          ...(signature ? { signature, message } : {}),
          action: this._activityToAction(activity),
          metadata: { amount },
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        console.warn('[Points] VPS rejected award:', txt);
        return EMPTY_POINTS(userWallet);
      }

      const result = await resp.json();
      console.log('[Points] Awarded', amount, 'for', activity, '→ total', result.new_total);

      return await this.getUserPoints(userWallet);
    } catch (err: any) {
      // VPS down — apply the award locally so the UI actually updates
      console.warn('[Points] VPS unreachable, writing local points:', err?.message ?? err);
      const local = (await readLocal(userWallet)) ?? EMPTY_POINTS(userWallet);
      local.breakdown[activity] = (local.breakdown[activity] ?? 0) + amount;
      local.totalPoints += amount;
      local.tier = this.calculateTier(local.totalPoints);
      local.lastUpdated = Date.now();
      await writeLocal(local);
      return local;
    }
  }

  // ── read ───────────────────────────────────────────────────────────────────

  /**
   * Full breakdown from Nillion (only works if the user is authenticated).
   * Falls back to Supabase cache (total + tier only) if Nillion is unreachable.
   */
  async getUserPoints(wallet: string): Promise<UserPoints> {
    // Try Nillion first for full breakdown
    try {
      const raw = await nillionStorage.retrieveSecret(`points_${wallet}`, wallet);
      if (raw) return JSON.parse(raw) as UserPoints;
    } catch {
      // Nillion unavailable — fall through to cache
    }

    // Supabase cache gives us total + tier for the UI
    const sb = getSupabase();
    if (sb) {
      const { data } = await sb
        .from('user_points_cache')
        .select('total_points, tier')
        .eq('wallet_address', wallet)
        .single();

      if (data) {
        const p = EMPTY_POINTS(wallet);
        p.totalPoints = data.total_points;
        p.tier = data.tier as UserPoints['tier'];
        return p;
      }
    }

    // Last resort — on-device accumulation (works 100% offline)
    const local = await readLocal(wallet);
    return local ?? EMPTY_POINTS(wallet);
  }

  /**
   * Quick tier check — hits Supabase cache, never blocks on Nillion.
   */
  async getTier(wallet: string): Promise<UserPoints['tier']> {
    const sb = getSupabase();
    if (!sb) return 'bronze';

    const { data } = await sb
      .from('user_points_cache')
      .select('tier')
      .eq('wallet_address', wallet)
      .single();

    return (data?.tier ?? 'bronze') as UserPoints['tier'];
  }

  // ── tier + milestone math ──────────────────────────────────────────────────

  calculateTier(total: number): TierId {
    let tier: TierId = 'seed';
    for (const t of TIERS) {
      if (total >= t.threshold) tier = t.id;
      else break;
    }
    return tier;
  }

  calculateLevel(total: number): number {
    let lvl = 1;
    for (const t of TIERS) {
      if (total >= t.threshold) lvl = TIERS.indexOf(t) + 1;
      else break;
    }
    return lvl;
  }

  /**
   * Check which milestones are newly crossed and return bonus points to add.
   * `alreadyHit` is the array of thresholds previously awarded.
   */
  checkMilestones(total: number, alreadyHit: number[]): { newHits: number[]; bonus: number } {
    let bonus = 0;
    const newHits: number[] = [];
    for (const m of MILESTONES) {
      if (total >= m.at && !alreadyHit.includes(m.at)) {
        newHits.push(m.at);
        bonus += m.bonus;
      }
    }
    return { newHits, bonus };
  }

  /**
   * Get the current tier's point multiplier — higher tiers earn faster.
   */
  getMultiplier(tier: TierId): number {
    return TIERS.find(t => t.id === tier)?.multiplier ?? 1.0;
  }

  // ── airdrop helpers ────────────────────────────────────────────────────────

  /**
   * Proportional airdrop share calculation — runs against Supabase cache
   * (public totals only). The actual breakdown stays private in Nillion.
   * In production this moves to a Nillion MPC program so totals are also blind.
   */
  async calculateAirdropAllocation(totalSupply: number): Promise<Map<string, number>> {
    const sb = getSupabase();
    if (!sb) return new Map();

    const { data } = await sb
      .from('user_points_cache')
      .select('wallet_address, total_points');

    if (!data || data.length === 0) return new Map();

    const poolSize   = totalSupply * 0.15;   // 15% earmarked for community airdrop
    const grandTotal = data.reduce((s, r) => s + r.total_points, 0);
    const map        = new Map<string, number>();

    for (const row of data) {
      const share = grandTotal > 0 ? (row.total_points / grandTotal) * poolSize : 0;
      map.set(row.wallet_address, share);
    }

    return map;
  }

  // ── internal ───────────────────────────────────────────────────────────────

  private _activityToAction(activity: keyof UserPoints['breakdown']): string {
    const map: Record<keyof UserPoints['breakdown'], string> = {
      earlyUser:           'early_user',
      predictions:         'bet_placed',
      accuratePredictions: 'prediction_won',
      socialEngagement:    'creator_followed',
      contentCreation:     'nft_minted',
      referrals:           'user_referred',
    };
    return map[activity] ?? activity;
  }
}

export const pointsSystem = new PrivatePointsSystem();
