/**
 * Follow Button Component
 * 
 * Social follow/unfollow button for DJs and predictors
 */

import React, { useState, useEffect } from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { UserPlus, UserCheck } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ILOWA_COLORS } from '../theme/colors';
import { followUser, unfollowUser, isFollowing } from '../lib/social/tapestry';

interface FollowButtonProps {
  targetWallet: string;
  currentWallet: string | null;
  compact?: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
}

export function FollowButton({
  targetWallet,
  currentWallet,
  compact = false,
  onFollowChange,
}: FollowButtonProps) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    checkFollowStatus();
  }, [currentWallet, targetWallet]);

  const checkFollowStatus = async () => {
    if (!currentWallet) {
      setCheckingStatus(false);
      return;
    }
    
    try {
      const status = await isFollowing(currentWallet, targetWallet);
      setFollowing(status);
    } catch (e) {
      console.warn('[FollowButton] Check status failed:', e);
    } finally {
      setCheckingStatus(false);
    }
  };

  const toggleFollow = async () => {
    if (!currentWallet || loading) return;
    
    setLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      if (following) {
        await unfollowUser(currentWallet, targetWallet);
        setFollowing(false);
        onFollowChange?.(false);
      } else {
        await followUser(currentWallet, targetWallet);
        setFollowing(true);
        onFollowChange?.(true);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('[FollowButton] Toggle failed:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  if (!currentWallet) {
    return null;
  }

  if (currentWallet === targetWallet) {
    return null; // Can't follow yourself
  }

  if (checkingStatus) {
    return (
      <Pressable style={[styles.button, compact && styles.buttonCompact, styles.buttonDisabled]}>
        <ActivityIndicator size="small" color={ILOWA_COLORS.textMuted} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={toggleFollow}
      disabled={loading}
      style={[
        styles.button,
        compact && styles.buttonCompact,
        following && styles.buttonFollowing,
        loading && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={following ? ILOWA_COLORS.purple : 'white'} />
      ) : following ? (
        <>
          <UserCheck size={compact ? 14 : 16} color={ILOWA_COLORS.purple} strokeWidth={2.5} />
          {!compact && <Text style={styles.textFollowing}>Following</Text>}
        </>
      ) : (
        <>
          <UserPlus size={compact ? 14 : 16} color="white" strokeWidth={2.5} />
          {!compact && <Text style={styles.text}>Follow</Text>}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: ILOWA_COLORS.purple,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  buttonCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  buttonFollowing: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: ILOWA_COLORS.purple,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  text: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 13,
    color: 'white',
  },
  textFollowing: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 13,
    color: ILOWA_COLORS.purple,
  },
});
