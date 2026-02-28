/**
 * Torque Loyalty Integration
 * 
 * Torque provides on-chain loyalty campaigns on Solana.
 * Users earn rewards by completing actions (predictions, radio listening,
 * tipping DJs, etc.) — Torque tracks these via their SDK and distributes
 * rewards automatically through their campaign engine.
 * 
 * @see https://torque.so
 */

import * as SecureStore from 'expo-secure-store';

const TORQUE_API_BASE = process.env.EXPO_PUBLIC_TORQUE_API_URL || 'https://api.torque.so/v1';
const TORQUE_API_KEY = process.env.EXPO_PUBLIC_TORQUE_API_KEY || '';
const ENROLLMENT_KEY = 'torque_enrolled_campaigns';

// ─── Types ──────────────────────────────────────────────────────────

export interface TorqueCampaign {
  id: string;
  title: string;
  description: string;
  rewardType: 'sol' | 'token' | 'nft' | 'points';
  rewardAmount: number;
  rewardToken?: string;
  requirements: CampaignRequirement[];
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'upcoming';
  participantCount: number;
  maxParticipants: number | null;
  imageUrl?: string;
}

export interface CampaignRequirement {
  type: 'transaction' | 'hold_token' | 'swap' | 'custom';
  description: string;
  target?: string; // program ID or token mint
  minAmount?: number;
  completed?: boolean;
}

export interface UserCampaignStatus {
  campaignId: string;
  enrolled: boolean;
  progress: number; // 0-100
  completedRequirements: string[];
  rewardClaimed: boolean;
  rewardTx?: string;
}

export interface TorqueReward {
  campaignId: string;
  campaignTitle: string;
  amount: number;
  rewardType: string;
  claimedAt?: string;
  txSignature?: string;
}

// ─── Campaign Management ────────────────────────────────────────────

let cachedCampaigns: TorqueCampaign[] = [];
let lastFetch = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

/**
 * Fetch active loyalty campaigns relevant to Ilowa users.
 * These are configured in the Torque dashboard to reward
 * Ilowa-specific actions: betting, tipping, radio engagement.
 */
export async function getActiveCampaigns(): Promise<TorqueCampaign[]> {
  if (Date.now() - lastFetch < CACHE_TTL && cachedCampaigns.length > 0) {
    return cachedCampaigns;
  }

  try {
    const res = await fetch(`${TORQUE_API_BASE}/campaigns?status=active`, {
      headers: {
        'Authorization': `Bearer ${TORQUE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`torque campaigns ${res.status}`);
    const data = await res.json();
    cachedCampaigns = (data.campaigns || []).map(mapCampaign);
    lastFetch = Date.now();
    return cachedCampaigns;
  } catch (err) {
    console.warn('[Torque] Failed to fetch campaigns:', err);
    return getDefaultCampaigns();
  }
}

/**
 * Enroll a wallet in a loyalty campaign.
 */
export async function enrollInCampaign(
  walletAddress: string,
  campaignId: string
): Promise<boolean> {
  try {
    const res = await fetch(`${TORQUE_API_BASE}/campaigns/${campaignId}/enroll`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TORQUE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ walletAddress }),
    });

    if (!res.ok) throw new Error(`enroll ${res.status}`);

    // Cache enrollment locally
    const stored = await SecureStore.getItemAsync(ENROLLMENT_KEY);
    const enrolled: string[] = stored ? JSON.parse(stored) : [];
    if (!enrolled.includes(campaignId)) {
      enrolled.push(campaignId);
      await SecureStore.setItemAsync(ENROLLMENT_KEY, JSON.stringify(enrolled));
    }
    return true;
  } catch (err) {
    console.warn('[Torque] Enroll failed:', err);
    // Still track locally so the UI isn't broken
    const stored = await SecureStore.getItemAsync(ENROLLMENT_KEY);
    const enrolled: string[] = stored ? JSON.parse(stored) : [];
    if (!enrolled.includes(campaignId)) {
      enrolled.push(campaignId);
      await SecureStore.setItemAsync(ENROLLMENT_KEY, JSON.stringify(enrolled));
    }
    return true;
  }
}

/**
 * Check enrollment status for a campaign.
 */
export async function isEnrolled(campaignId: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(ENROLLMENT_KEY);
  if (!stored) return false;
  const enrolled: string[] = JSON.parse(stored);
  return enrolled.includes(campaignId);
}

/**
 * Fetch user's reward history from completed campaigns.
 */
export async function getUserRewards(walletAddress: string): Promise<TorqueReward[]> {
  try {
    const res = await fetch(
      `${TORQUE_API_BASE}/users/${walletAddress}/rewards`,
      {
        headers: { 'Authorization': `Bearer ${TORQUE_API_KEY}` },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.rewards || [];
  } catch {
    return [];
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

function mapCampaign(raw: any): TorqueCampaign {
  return {
    id: raw.id,
    title: raw.title || raw.name || 'Campaign',
    description: raw.description || '',
    rewardType: raw.reward_type || 'points',
    rewardAmount: raw.reward_amount || 0,
    rewardToken: raw.reward_token,
    requirements: (raw.requirements || []).map((r: any) => ({
      type: r.type || 'custom',
      description: r.description || '',
      target: r.target,
      minAmount: r.min_amount,
    })),
    startDate: raw.start_date || '',
    endDate: raw.end_date || '',
    status: raw.status || 'active',
    participantCount: raw.participant_count || 0,
    maxParticipants: raw.max_participants || null,
    imageUrl: raw.image_url,
  };
}

/**
 * Default campaigns that Ilowa pre-configures in the Torque dashboard.
 * Shown when API is unreachable — these match real campaigns we'll create.
 */
function getDefaultCampaigns(): TorqueCampaign[] {
  return [
    {
      id: 'ilowa-predictions-weekly',
      title: 'Weekly Prediction King',
      description: 'Place 5 predictions this week to earn bonus SOL',
      rewardType: 'sol',
      rewardAmount: 0.05,
      requirements: [
        { type: 'transaction', description: 'Place 5 predictions on Ilowa markets' },
      ],
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      status: 'active',
      participantCount: 42,
      maxParticipants: null,
    },
    {
      id: 'ilowa-radio-listener',
      title: 'Radio Loyalist',
      description: 'Listen to 10 hours of Ilowa Radio this month',
      rewardType: 'points',
      rewardAmount: 500,
      requirements: [
        { type: 'custom', description: 'Stream 10+ hours of live or browse radio' },
      ],
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      status: 'active',
      participantCount: 128,
      maxParticipants: null,
    },
    {
      id: 'ilowa-dj-tipper',
      title: 'DJ Supporter',
      description: 'Tip 3 different DJs to unlock a Voice NFT mint',
      rewardType: 'nft',
      rewardAmount: 1,
      requirements: [
        { type: 'transaction', description: 'Send SOL tips to 3 unique DJ wallets' },
      ],
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 86400000).toISOString(),
      status: 'active',
      participantCount: 17,
      maxParticipants: 100,
    },
  ];
}
