import { useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

export type UserTier = 'free' | 'pro' | 'stealth';

export interface TierLimits {
  maxBetSOL: number;
  maxMarketsPerDay: number;
  shieldedBetsEnabled: boolean;
  priorityCreation: boolean;
  customVoiceModels: boolean;
  analyticsAccess: boolean;
}

const TIER_LIMITS: Record<UserTier, TierLimits> = {
  free: {
    maxBetSOL: 10,
    maxMarketsPerDay: 3,
    shieldedBetsEnabled: true,
    priorityCreation: false,
    customVoiceModels: false,
    analyticsAccess: false,
  },
  pro: {
    maxBetSOL: 100,
    maxMarketsPerDay: 20,
    shieldedBetsEnabled: true,
    priorityCreation: true,
    customVoiceModels: true,
    analyticsAccess: true,
  },
  stealth: {
    maxBetSOL: 1000,
    maxMarketsPerDay: 100,
    shieldedBetsEnabled: true,
    priorityCreation: true,
    customVoiceModels: true,
    analyticsAccess: true,
  },
};

const TIER_KEY = 'ilowa_user_tier';

export function useUserTier() {
  const [tier, setTierState] = useState<UserTier>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(TIER_KEY);
        if (stored && (stored === 'free' || stored === 'pro' || stored === 'stealth')) {
          setTierState(stored as UserTier);
        }
      } catch {
        // Default to free
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setTier = useCallback(async (newTier: UserTier) => {
    await SecureStore.setItemAsync(TIER_KEY, newTier);
    setTierState(newTier);
  }, []);

  const limits = TIER_LIMITS[tier];

  return {
    tier,
    limits,
    loading,
    setTier,
    isPro: tier === 'pro' || tier === 'stealth',
    isStealth: tier === 'stealth',
  };
}
