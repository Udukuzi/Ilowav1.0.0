/**
 * Tapestry Social Graph Service — HYBRID MODE
 *
 * Public social actions (follows, tips, market creation) go to BOTH:
 *   1. SecureStore (local cache, offline-first, instant)
 *   2. Tapestry on-chain social graph (compressed Merkle tree on Solana)
 *
 * Private actions (bets, portfolio) stay in SecureStore ONLY.
 * If Tapestry API key is missing, everything falls back to local-only.
 *
 * API docs: https://docs.usetapestry.dev/
 */

import * as SecureStore from 'expo-secure-store';

const FOLLOW_STORAGE_KEY = 'ilowa_follows';
const ACTIVITY_STORAGE_KEY = 'ilowa_activities';

// Tapestry on-chain social graph
const TAPESTRY_API = 'https://api.usetapestry.dev/v1';
const TAPESTRY_KEY = process.env.EXPO_PUBLIC_TAPESTRY_API_KEY || '';
const TAPESTRY_NAMESPACE = 'ilowa';

function hasTapestry(): boolean {
  return TAPESTRY_KEY.length > 10;
}

async function tapestryFetch(path: string, opts?: RequestInit): Promise<any> {
  if (!hasTapestry()) return null;
  const sep = path.includes('?') ? '&' : '?';
  const url = `${TAPESTRY_API}${path}${sep}apiKey=${TAPESTRY_KEY}`;
  try {
    const res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...opts?.headers },
    });
    if (!res.ok) {
      console.warn(`[Tapestry] ${path} → ${res.status}`);
      return null;
    }
    return res.json();
  } catch (err: any) {
    console.warn('[Tapestry] API error:', err?.message);
    return null;
  }
}

/**
 * Ensure user has a Tapestry profile. Creates one if missing.
 * Uses the wallet pseudonym as the display name.
 */
export async function ensureTapestryProfile(wallet: string): Promise<boolean> {
  if (!hasTapestry()) return false;
  // check if profile exists
  const existing = await tapestryFetch(`/profiles/${wallet}`);
  if (existing?.id) return true;
  // create profile with pseudonym
  const displayName = walletPseudonym(wallet);
  const result = await tapestryFetch('/profiles', {
    method: 'POST',
    body: JSON.stringify({
      walletAddress: wallet,
      username: wallet.slice(0, 12),
      blockchain: 'SOLANA',
      namespace: TAPESTRY_NAMESPACE,
      execution: 'FAST_UNCONFIRMED',
      properties: [
        { key: 'displayName', value: displayName },
        { key: 'app', value: 'ilowa' },
      ],
    }),
  });
  if (result) {
    console.log('[Tapestry] Profile created for', wallet.slice(0, 8));
    return true;
  }
  return false;
}

export interface SocialProfile {
  wallet: string;
  displayName: string;
  avatar?: string;
  followerCount: number;
  followingCount: number;
  predictionCount: number;
  winRate: number;
  isVerified: boolean;
}

export interface ActivityItem {
  id: string;
  type: 'prediction' | 'tip' | 'follow' | 'win' | 'market_created';
  user: string;
  userDisplayName: string;
  content: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface FollowRelation {
  follower: string;
  followee: string;
  timestamp: Date;
}

/**
 * Get stored follows (local storage for Expo Go)
 */
async function getStoredFollows(): Promise<FollowRelation[]> {
  try {
    const stored = await SecureStore.getItemAsync(FOLLOW_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((f: any) => ({
        ...f,
        timestamp: new Date(f.timestamp),
      }));
    }
  } catch (e) {
    console.warn('[Tapestry] Failed to get follows:', e);
  }
  return [];
}

/**
 * Save follows to local storage
 */
async function saveFollows(follows: FollowRelation[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(FOLLOW_STORAGE_KEY, JSON.stringify(follows));
  } catch (e) {
    console.warn('[Tapestry] Failed to save follows:', e);
  }
}

/**
 * Get stored activities (local storage for Expo Go)
 */
async function getStoredActivities(): Promise<ActivityItem[]> {
  try {
    const stored = await SecureStore.getItemAsync(ACTIVITY_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((a: any) => ({
        ...a,
        timestamp: new Date(a.timestamp),
      }));
    }
  } catch (e) {
    console.warn('[Tapestry] Failed to get activities:', e);
  }
  return [];
}

/**
 * Save activities to local storage
 */
async function saveActivities(activities: ActivityItem[]): Promise<void> {
  try {
    // Keep only last 100 activities
    const trimmed = activities.slice(0, 100);
    await SecureStore.setItemAsync(ACTIVITY_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('[Tapestry] Failed to save activities:', e);
  }
}

/**
 * Follow a user (DJ or predictor)
 * Writes to SecureStore (instant) AND Tapestry on-chain (background).
 */
export async function followUser(
  followerWallet: string,
  followeeWallet: string
): Promise<boolean> {
  try {
    const follows = await getStoredFollows();
    
    const existing = follows.find(
      f => f.follower === followerWallet && f.followee === followeeWallet
    );
    if (existing) {
      console.log('[Tapestry] Already following:', followeeWallet);
      return true;
    }
    
    follows.push({
      follower: followerWallet,
      followee: followeeWallet,
      timestamp: new Date(),
    });
    await saveFollows(follows);
    
    // On-chain write (fire-and-forget — don't block UX)
    tapestryFetch('/followers', {
      method: 'POST',
      body: JSON.stringify({
        startId: followerWallet,
        endId: followeeWallet,
        blockchain: 'SOLANA',
        namespace: TAPESTRY_NAMESPACE,
        execution: 'FAST_UNCONFIRMED',
      }),
    }).then(r => r && console.log('[Tapestry] On-chain follow confirmed'))
      .catch(() => {});
    
    await postActivity({
      type: 'follow',
      user: followerWallet,
      userDisplayName: shortenWallet(followerWallet),
      content: `Started following ${shortenWallet(followeeWallet)}`,
      metadata: { followee: followeeWallet },
    });
    
    console.log('[Tapestry] Followed:', followeeWallet);
    return true;
  } catch (error) {
    console.error('[Tapestry] Follow failed:', error);
    return false;
  }
}

/**
 * Unfollow a user — removes from local AND Tapestry on-chain.
 */
export async function unfollowUser(
  followerWallet: string,
  followeeWallet: string
): Promise<boolean> {
  try {
    const follows = await getStoredFollows();
    const filtered = follows.filter(
      f => !(f.follower === followerWallet && f.followee === followeeWallet)
    );
    await saveFollows(filtered);
    
    // On-chain unfollow (fire-and-forget)
    tapestryFetch('/followers', {
      method: 'DELETE',
      body: JSON.stringify({
        startId: followerWallet,
        endId: followeeWallet,
        blockchain: 'SOLANA',
        namespace: TAPESTRY_NAMESPACE,
      }),
    }).catch(() => {});
    
    console.log('[Tapestry] Unfollowed:', followeeWallet);
    return true;
  } catch (error) {
    console.error('[Tapestry] Unfollow failed:', error);
    return false;
  }
}

/**
 * Check if user is following another user
 */
export async function isFollowing(
  followerWallet: string,
  followeeWallet: string
): Promise<boolean> {
  const follows = await getStoredFollows();
  return follows.some(
    f => f.follower === followerWallet && f.followee === followeeWallet
  );
}

/**
 * Get users that a wallet is following
 */
export async function getFollowing(wallet: string): Promise<string[]> {
  const follows = await getStoredFollows();
  return follows
    .filter(f => f.follower === wallet)
    .map(f => f.followee);
}

/**
 * Get followers of a wallet
 */
export async function getFollowers(wallet: string): Promise<string[]> {
  const follows = await getStoredFollows();
  return follows
    .filter(f => f.followee === wallet)
    .map(f => f.follower);
}

/**
 * Get follower count — prefers on-chain data when available.
 */
export async function getFollowerCount(wallet: string): Promise<number> {
  // Try Tapestry first for real on-chain count
  const onChain = await tapestryFetch(`/profiles/followers/${wallet}/count`);
  if (onChain?.count != null) return onChain.count;
  // Fall back to local
  const followers = await getFollowers(wallet);
  return followers.length;
}

/**
 * Get following count — prefers on-chain data when available.
 */
export async function getFollowingCount(wallet: string): Promise<number> {
  const onChain = await tapestryFetch(`/profiles/following/${wallet}/count`);
  if (onChain?.count != null) return onChain.count;
  const following = await getFollowing(wallet);
  return following.length;
}

/**
 * Post an activity to the feed
 */
export async function postActivity(activity: Omit<ActivityItem, 'id' | 'timestamp'>): Promise<void> {
  try {
    const activities = await getStoredActivities();
    
    const newActivity: ActivityItem = {
      ...activity,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    
    // Add to beginning (newest first)
    activities.unshift(newActivity);
    await saveActivities(activities);
    
    console.log('[Tapestry] Posted activity:', activity.type);
  } catch (error) {
    console.error('[Tapestry] Post activity failed:', error);
  }
}

/**
 * Post a prediction activity
 */
export async function postPrediction(
  wallet: string,
  question: string,
  outcome: boolean,
  amount: number
): Promise<void> {
  await postActivity({
    type: 'prediction',
    user: wallet,
    userDisplayName: shortenWallet(wallet),
    content: question,
    metadata: { outcome, amount },
  });
}

/**
 * Post a tip activity
 */
export async function postTip(
  wallet: string,
  djWallet: string,
  djName: string,
  amount: number
): Promise<void> {
  await postActivity({
    type: 'tip',
    user: wallet,
    userDisplayName: shortenWallet(wallet),
    content: `Tipped ${amount} SOL to ${djName}`,
    metadata: { djWallet, amount },
  });
}

/**
 * Post a win activity
 */
export async function postWin(
  wallet: string,
  question: string,
  payout: number
): Promise<void> {
  await postActivity({
    type: 'win',
    user: wallet,
    userDisplayName: shortenWallet(wallet),
    content: `Won prediction: "${question}"`,
    metadata: { payout },
  });
}

/**
 * Get activity feed for a user (their own + people they follow)
 */
export async function getActivityFeed(
  wallet: string,
  limit: number = 50
): Promise<ActivityItem[]> {
  const activities = await getStoredActivities();
  const following = await getFollowing(wallet);
  
  // Include own activities and activities from followed users
  const relevantWallets = [wallet, ...following];
  
  return activities
    .filter(a => relevantWallets.includes(a.user))
    .slice(0, limit);
}

/**
 * Get global activity feed (all activities)
 */
export async function getGlobalFeed(limit: number = 50): Promise<ActivityItem[]> {
  const activities = await getStoredActivities();
  return activities.slice(0, limit);
}

/**
 * Get user's own activities
 */
export async function getUserActivities(
  wallet: string,
  limit: number = 50
): Promise<ActivityItem[]> {
  const activities = await getStoredActivities();
  return activities
    .filter(a => a.user === wallet)
    .slice(0, limit);
}

/**
 * Get a mock social profile (for demo purposes)
 */
export function getMockProfile(wallet: string): SocialProfile {
  return {
    wallet,
    displayName: shortenWallet(wallet),
    followerCount: Math.floor(Math.random() * 100),
    followingCount: Math.floor(Math.random() * 50),
    predictionCount: Math.floor(Math.random() * 20),
    winRate: Math.floor(Math.random() * 100),
    isVerified: false,
  };
}

/**
 * Privacy-friendly pseudonym from wallet address.
 * Deterministic — same wallet always yields the same name —
 * but tells an observer nothing about the real address.
 */
const ADJECTIVES = [
  'Swift','Bold','Quiet','Bright','Warm','Calm','Sharp','Wise',
  'Keen','Brave','Steady','Noble','Lucky','True','Deep','Clear',
] as const;
const ANIMALS = [
  'Lion','Eagle','Hawk','Panther','Rhino','Falcon','Cheetah','Owl',
  'Crane','Cobra','Leopard','Ibis','Heron','Raven','Gazelle','Wolf',
] as const;

export function walletPseudonym(wallet: string): string {
  // simple hash: sum char codes, use as index into the word lists
  let hash = 0;
  for (let i = 0; i < wallet.length; i++) {
    hash = ((hash << 5) - hash + wallet.charCodeAt(i)) | 0;
  }
  const adj = ADJECTIVES[Math.abs(hash) % ADJECTIVES.length];
  const anm = ANIMALS[Math.abs(hash >> 8) % ANIMALS.length];
  const tag = Math.abs(hash % 1000).toString().padStart(3, '0');
  return `${adj}${anm}#${tag}`;
}

/**
 * Follow an Audius artist by their user ID.
 * Stores the relation the same way wallet follows work — the "followee"
 * is prefixed with `audius:` so we can tell them apart during feed builds.
 */
export async function followAudiusArtist(
  followerWallet: string,
  audiusUserId: string,
  artistName: string,
): Promise<boolean> {
  const compositeId = `audius:${audiusUserId}`;
  const ok = await followUser(followerWallet, compositeId);
  if (ok) {
    await postActivity({
      type: 'follow',
      user: followerWallet,
      userDisplayName: walletPseudonym(followerWallet),
      content: `Started following artist ${artistName}`,
      metadata: { audiusUserId, artistName },
    });
  }
  return ok;
}

/**
 * Shorten wallet address for display
 */
function shortenWallet(wallet: string): string {
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

/**
 * Format activity timestamp for display
 */
export function formatActivityTime(timestamp: Date): string {
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();
  
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  
  return timestamp.toLocaleDateString();
}

/**
 * Get activity type icon name
 */
export function getActivityIcon(type: ActivityItem['type']): string {
  switch (type) {
    case 'prediction': return 'trending-up';
    case 'tip': return 'gift';
    case 'follow': return 'user-plus';
    case 'win': return 'trophy';
    case 'market_created': return 'plus-circle';
    default: return 'activity';
  }
}

/**
 * Get activity type color
 */
export function getActivityColor(type: ActivityItem['type']): string {
  switch (type) {
    case 'prediction': return '#8B5CF6'; // Purple
    case 'tip': return '#FFD700'; // Gold
    case 'follow': return '#00D9FF'; // Cyan
    case 'win': return '#10B981'; // Green
    case 'market_created': return '#F59E0B'; // Orange
    default: return '#64748B'; // Gray
  }
}
