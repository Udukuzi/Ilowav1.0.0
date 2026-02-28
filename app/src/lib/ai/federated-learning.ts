/**
 * Federated Learning System
 * 
 * Privacy-preserving on-device learning that allows users to:
 * 1. Opt-in to contribute to model improvement
 * 2. Earn rewards for their contributions
 * 3. Keep their data on-device (only gradients are shared)
 * 
 * This creates a community-powered AI that improves with usage
 * while respecting user privacy.
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FL_ENABLED_KEY = 'federated_learning_enabled';
const FL_EARNINGS_KEY = 'federated_learning_earnings';
const FL_CONTRIBUTIONS_KEY = 'federated_learning_contributions';
const FL_LAST_SYNC_KEY = 'federated_learning_last_sync';

export interface FederatedLearningConfig {
  enabled: boolean;
  minBatchSize: number;
  syncIntervalMs: number;
  rewardPerContribution: number; // In ILOWA tokens
  serverUrl: string;
}

export interface Contribution {
  id: string;
  type: 'feedback' | 'correction' | 'rating' | 'interaction';
  timestamp: number;
  dataHash: string; // Hash of local data, not the data itself
  gradientsSent: boolean;
  rewardClaimed: boolean;
  rewardAmount: number;
}

export interface ContributionData {
  promptHash: string;
  responseQuality: number; // 1-5 rating
  wasHelpful: boolean;
  correction?: string; // User's corrected response
  language: string;
  region: string;
  category: string;
}

export interface EarningsInfo {
  totalEarned: number;
  pendingRewards: number;
  contributionCount: number;
  lastClaimDate: number | null;
  claimableAmount: number;
}

// Default configuration
const DEFAULT_CONFIG: FederatedLearningConfig = {
  enabled: false,
  minBatchSize: 10,
  syncIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
  rewardPerContribution: 0.01, // 0.01 ILOWA per contribution
  serverUrl: process.env.EXPO_PUBLIC_FL_SERVER_URL || 'https://fl.ilowa.app/v1',
};

let config: FederatedLearningConfig = DEFAULT_CONFIG;
let contributions: Contribution[] = [];
let isInitialized = false;

/**
 * Initialize federated learning system
 */
export async function initFederatedLearning(
  customConfig?: Partial<FederatedLearningConfig>
): Promise<void> {
  try {
    config = { ...DEFAULT_CONFIG, ...customConfig };
    
    // Load user preference
    const enabled = await SecureStore.getItemAsync(FL_ENABLED_KEY);
    config.enabled = enabled === 'true';
    
    // Load contributions history
    const savedContributions = await AsyncStorage.getItem(FL_CONTRIBUTIONS_KEY);
    if (savedContributions) {
      contributions = JSON.parse(savedContributions);
    }
    
    isInitialized = true;
    console.log('[FL] Initialized:', { 
      enabled: config.enabled, 
      contributions: contributions.length 
    });
    
    // Auto-sync if enabled and due
    if (config.enabled) {
      await checkAndSync();
    }
  } catch (error) {
    console.error('[FL] Init failed:', error);
  }
}

/**
 * Enable federated learning (user opt-in)
 */
export async function enableFederatedLearning(): Promise<void> {
  config.enabled = true;
  await SecureStore.setItemAsync(FL_ENABLED_KEY, 'true');
  console.log('[FL] User opted in to federated learning');
}

/**
 * Disable federated learning (user opt-out)
 */
export async function disableFederatedLearning(): Promise<void> {
  config.enabled = false;
  await SecureStore.setItemAsync(FL_ENABLED_KEY, 'false');
  console.log('[FL] User opted out of federated learning');
}

/**
 * Check if federated learning is enabled
 */
export function isFederatedLearningEnabled(): boolean {
  return config.enabled;
}

/**
 * Record a user interaction for federated learning
 */
export async function recordInteraction(data: ContributionData): Promise<string | null> {
  if (!config.enabled || !isInitialized) {
    return null;
  }

  try {
    const contribution: Contribution = {
      id: generateContributionId(),
      type: data.correction ? 'correction' : data.responseQuality ? 'rating' : 'interaction',
      timestamp: Date.now(),
      dataHash: await hashData(data),
      gradientsSent: false,
      rewardClaimed: false,
      rewardAmount: calculateReward(data),
    };

    contributions.push(contribution);
    await saveContributions();
    
    console.log('[FL] Recorded contribution:', contribution.id);
    
    // Check if we should sync
    await checkAndSync();
    
    return contribution.id;
  } catch (error) {
    console.error('[FL] Failed to record interaction:', error);
    return null;
  }
}

/**
 * Submit feedback on an AI response
 */
export async function submitFeedback(
  promptHash: string,
  responseQuality: number,
  wasHelpful: boolean,
  language: string,
  region: string,
  category: string = 'general',
  correction?: string
): Promise<boolean> {
  const contributionId = await recordInteraction({
    promptHash,
    responseQuality,
    wasHelpful,
    correction,
    language,
    region,
    category,
  });

  return !!contributionId;
}

/**
 * Get user's earnings information
 */
export async function getEarnings(): Promise<EarningsInfo> {
  try {
    const savedEarnings = await AsyncStorage.getItem(FL_EARNINGS_KEY);
    const earnings = savedEarnings ? JSON.parse(savedEarnings) : {
      totalEarned: 0,
      lastClaimDate: null,
    };

    const pendingContributions = contributions.filter(c => !c.rewardClaimed);
    const pendingRewards = pendingContributions.reduce((sum, c) => sum + c.rewardAmount, 0);
    
    return {
      totalEarned: earnings.totalEarned,
      pendingRewards,
      contributionCount: contributions.length,
      lastClaimDate: earnings.lastClaimDate,
      claimableAmount: pendingRewards,
    };
  } catch (error) {
    console.error('[FL] Failed to get earnings:', error);
    return {
      totalEarned: 0,
      pendingRewards: 0,
      contributionCount: 0,
      lastClaimDate: null,
      claimableAmount: 0,
    };
  }
}

/**
 * Claim pending rewards
 * 
 * This would trigger a blockchain transaction to send ILOWA tokens
 * to the user's wallet.
 */
export async function claimRewards(walletAddress: string): Promise<{
  success: boolean;
  amount: number;
  txSignature?: string;
  error?: string;
}> {
  if (!config.enabled) {
    return { success: false, amount: 0, error: 'Federated learning not enabled' };
  }

  try {
    const pendingContributions = contributions.filter(c => !c.rewardClaimed && c.gradientsSent);
    const claimableAmount = pendingContributions.reduce((sum, c) => sum + c.rewardAmount, 0);

    if (claimableAmount <= 0) {
      return { success: false, amount: 0, error: 'No rewards to claim' };
    }

    // Call rewards API
    const response = await fetch(`${config.serverUrl}/claim-rewards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress,
        contributionIds: pendingContributions.map(c => c.id),
        amount: claimableAmount,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, amount: 0, error };
    }

    const result = await response.json();

    // Mark contributions as claimed
    for (const contribution of pendingContributions) {
      contribution.rewardClaimed = true;
    }
    await saveContributions();

    // Update earnings
    const earnings = await getEarnings();
    await AsyncStorage.setItem(FL_EARNINGS_KEY, JSON.stringify({
      totalEarned: earnings.totalEarned + claimableAmount,
      lastClaimDate: Date.now(),
    }));

    console.log('[FL] Claimed rewards:', claimableAmount);

    return {
      success: true,
      amount: claimableAmount,
      txSignature: result.signature,
    };
  } catch (error) {
    console.error('[FL] Claim failed:', error);
    return { 
      success: false, 
      amount: 0, 
      error: error instanceof Error ? error.message : 'Claim failed' 
    };
  }
}

/**
 * Sync contributions with server
 * 
 * Sends gradient updates (not raw data) to improve the model
 */
async function syncContributions(): Promise<boolean> {
  const pendingContributions = contributions.filter(c => !c.gradientsSent);
  
  if (pendingContributions.length < config.minBatchSize) {
    console.log('[FL] Not enough contributions to sync:', pendingContributions.length);
    return false;
  }

  try {
    // In a real implementation, this would:
    // 1. Compute local gradients from user interactions
    // 2. Apply differential privacy noise
    // 3. Send only the gradients (not raw data) to the server
    
    const response = await fetch(`${config.serverUrl}/submit-gradients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contributionHashes: pendingContributions.map(c => c.dataHash),
        batchSize: pendingContributions.length,
        timestamp: Date.now(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status}`);
    }

    // Mark as sent
    for (const contribution of pendingContributions) {
      contribution.gradientsSent = true;
    }
    await saveContributions();
    await AsyncStorage.setItem(FL_LAST_SYNC_KEY, Date.now().toString());

    console.log('[FL] Synced contributions:', pendingContributions.length);
    return true;
  } catch (error) {
    console.error('[FL] Sync failed:', error);
    return false;
  }
}

/**
 * Check if sync is due and perform it
 */
async function checkAndSync(): Promise<void> {
  try {
    const lastSync = await AsyncStorage.getItem(FL_LAST_SYNC_KEY);
    const lastSyncTime = lastSync ? parseInt(lastSync, 10) : 0;
    const now = Date.now();

    if (now - lastSyncTime >= config.syncIntervalMs) {
      await syncContributions();
    }
  } catch (error) {
    console.error('[FL] Check and sync failed:', error);
  }
}

/**
 * Save contributions to storage
 */
async function saveContributions(): Promise<void> {
  await AsyncStorage.setItem(FL_CONTRIBUTIONS_KEY, JSON.stringify(contributions));
}

/**
 * Calculate reward for a contribution
 */
function calculateReward(data: ContributionData): number {
  let reward = config.rewardPerContribution;
  
  // Bonus for corrections (more valuable)
  if (data.correction) {
    reward *= 2;
  }
  
  // Bonus for non-English contributions (help with multilingual)
  if (data.language !== 'en') {
    reward *= 1.5;
  }
  
  return reward;
}

/**
 * Generate contribution ID
 */
function generateContributionId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'fl_';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Hash data for privacy (only hash is sent, not data)
 */
async function hashData(data: ContributionData): Promise<string> {
  const str = JSON.stringify(data);
  // Simple hash for demo - in production use crypto.subtle
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get federated learning status for UI
 */
export function getFederatedLearningStatus(): {
  enabled: boolean;
  contributionCount: number;
  pendingSync: number;
  isInitialized: boolean;
} {
  const pendingSync = contributions.filter(c => !c.gradientsSent).length;
  
  return {
    enabled: config.enabled,
    contributionCount: contributions.length,
    pendingSync,
    isInitialized,
  };
}

/**
 * Clear all federated learning data
 */
export async function clearFederatedLearningData(): Promise<void> {
  contributions = [];
  await AsyncStorage.removeItem(FL_CONTRIBUTIONS_KEY);
  await AsyncStorage.removeItem(FL_EARNINGS_KEY);
  await AsyncStorage.removeItem(FL_LAST_SYNC_KEY);
  console.log('[FL] All data cleared');
}
