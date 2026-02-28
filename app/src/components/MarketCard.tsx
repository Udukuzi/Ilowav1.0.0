import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Share } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ILOWA_COLORS } from '../theme/colors';
import { Market, UserBetPosition } from '../types/market';
import { PremiumGlassCard } from './UI';
import { createBetBlink, getBlinkShareText } from '../lib/actions/orbitflare';

interface MarketCardProps {
  market: Market;
  userPosition?: UserBetPosition;
  onClaimWinnings?: (marketId: string) => Promise<void>;
  onResolve?: (marketId: string, outcome: boolean) => Promise<void>;
}

export function MarketCard({ market, userPosition, onClaimWinnings, onResolve }: MarketCardProps) {
  const router = useRouter();
  const [claiming, setClaiming] = useState(false);
  const [resolving, setResolving] = useState(false);
  const scale = useSharedValue(1);
  
  const totalPool = market.yesPool + market.noPool;
  const yesPercent = totalPool > 0 ? (market.yesPool / totalPool) * 100 : 50;
  const noPercent = 100 - yesPercent;

  const isResolved = market.status === 'resolved';
  const isExpired = market.status === 'expired';
  const winningOutcome = market.outcome;
  
  const canClaim = isResolved &&
    userPosition?.isWinner &&
    userPosition?.bet &&
    !userPosition.bet.claimed;

  // show resolve buttons when parent passes onResolve (gated to creator) + market expired + not yet resolved
  const canResolve = !!(onResolve && (isExpired || Date.now() >= market.expiresAt) && !isResolved);

  const timeLeft = getTimeLeft(market.expiresAt);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handleClaim = async () => {
    if (!onClaimWinnings || claiming) return;
    setClaiming(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await onClaimWinnings(market.id);
    } finally {
      setClaiming(false);
    }
  };

  const handleResolve = async (outcome: boolean) => {
    if (!onResolve || resolving) return;
    setResolving(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await onResolve(market.id, outcome);
    } finally {
      setResolving(false);
    }
  };

  const glowColor = isResolved
    ? ILOWA_COLORS.truth
    : isExpired
    ? ILOWA_COLORS.textMuted
    : market.isPrivate
    ? ILOWA_COLORS.purple
    : ILOWA_COLORS.gold;

  return (
    <Animated.View style={[animatedStyle, isExpired && { opacity: 0.7 }]}>
      <Pressable
        onPress={() => router.push(`/market/${market.id}`)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <PremiumGlassCard
          glowColor={glowColor}
          style={styles.card}
          padding={16}
          animate={!isExpired}
        >
        <View style={styles.header}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{market.category}</Text>
          </View>
          {(market.isPrivate || (market.shieldedBetCount ?? 0) > 0) && (
            <View style={styles.privateBadge}>
              <Text style={styles.privateText}>🔒 Arcium</Text>
            </View>
          )}
          {isResolved ? (
            <View style={[styles.statusBadge, styles.resolvedBadge]}>
              <Text style={styles.resolvedText}>
                {winningOutcome === 'yes' ? '✓ YES' : '✗ NO'}
              </Text>
            </View>
          ) : isExpired ? (
            <View style={[styles.statusBadge, styles.expiredBadge]}>
              <Text style={styles.expiredText}>Expired</Text>
            </View>
          ) : (
            <Text style={styles.timeLeft}>{timeLeft}</Text>
          )}
        </View>

        <Text style={styles.question}>{market.question}</Text>

        <View style={styles.poolBar}>
          <View style={[
            styles.yesBar, 
            { flex: yesPercent },
            isResolved && winningOutcome === 'yes' && styles.winnerBar,
            isResolved && winningOutcome === 'no' && styles.loserBar,
          ]} />
          <View style={[
            styles.noBar, 
            { flex: noPercent },
            isResolved && winningOutcome === 'no' && styles.winnerBar,
            isResolved && winningOutcome === 'yes' && styles.loserBar,
          ]} />
        </View>

        <View style={styles.poolLabels}>
          <View style={styles.poolSide}>
            <View style={[styles.poolDot, { backgroundColor: ILOWA_COLORS.truth }]} />
            <Text style={styles.poolLabel}>YES</Text>
            <Text style={[styles.poolValue, { color: ILOWA_COLORS.truth }]}>
              {yesPercent.toFixed(0)}%
            </Text>
            <Text style={styles.poolAmount}>{market.yesPool.toFixed(2)} SOL</Text>
          </View>
          <View style={styles.poolSide}>
            <Text style={styles.poolAmount}>{market.noPool.toFixed(2)} SOL</Text>
            <Text style={[styles.poolValue, { color: ILOWA_COLORS.doubt }]}>
              {noPercent.toFixed(0)}%
            </Text>
            <Text style={styles.poolLabel}>NO</Text>
            <View style={[styles.poolDot, { backgroundColor: ILOWA_COLORS.doubt }]} />
          </View>
        </View>

        {userPosition?.bet && (
          <Animated.View entering={FadeIn} style={styles.positionRow}>
            <Text style={styles.positionLabel}>Your bet:</Text>
            <Text style={[
              styles.positionValue,
              { color: userPosition.bet.outcome === 'yes' ? ILOWA_COLORS.truth : ILOWA_COLORS.doubt }
            ]}>
              {userPosition.bet.amount.toFixed(2)} SOL on {userPosition.bet.outcome.toUpperCase()}
            </Text>
            {isResolved && (
              <Text style={[
                styles.positionResult,
                { color: userPosition.isWinner ? ILOWA_COLORS.truth : ILOWA_COLORS.doubt }
              ]}>
                {userPosition.isWinner ? `Won ${userPosition.potentialWinnings.toFixed(2)} SOL` : 'Lost'}
              </Text>
            )}
          </Animated.View>
        )}

        {canResolve && (
          <View style={styles.resolveRow}>
            <Pressable
              style={[styles.resolveBtn, styles.resolveBtnYes]}
              onPress={() => handleResolve(true)}
              disabled={resolving}
            >
              {resolving ? (
                <ActivityIndicator size="small" color={ILOWA_COLORS.deepBlack} />
              ) : (
                <Text style={styles.resolveBtnText}>✓ Resolve YES</Text>
              )}
            </Pressable>
            <Pressable
              style={[styles.resolveBtn, styles.resolveBtnNo]}
              onPress={() => handleResolve(false)}
              disabled={resolving}
            >
              <Text style={[styles.resolveBtnText, { color: ILOWA_COLORS.textPrimary }]}>✗ Resolve NO</Text>
            </Pressable>
          </View>
        )}

        {canClaim && (
          <Pressable
            style={styles.claimButton}
            onPress={handleClaim}
            disabled={claiming}
          >
            {claiming ? (
              <ActivityIndicator size="small" color={ILOWA_COLORS.deepBlack} />
            ) : (
              <Text style={styles.claimButtonText}>
                Claim {userPosition.potentialWinnings.toFixed(2)} SOL
              </Text>
            )}
          </Pressable>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>{market.totalBets} bets</Text>
          <Pressable
            style={styles.shareBlinkBtn}
            hitSlop={6}
            onPress={async () => {
              const blink = createBetBlink({
                marketId: market.id,
                marketQuestion: market.question,
                side: 'yes',
              });
              try { await Share.share({ message: getBlinkShareText(blink) }); } catch {}
            }}
          >
            <Text style={styles.shareBlinkText}>Share</Text>
          </Pressable>
          <Text style={styles.footerText}>by {market.creator}</Text>
        </View>
        </PremiumGlassCard>
      </Pressable>
    </Animated.View>
  );
}

function getTimeLeft(expiresAt: number): string {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d left`;
  return `${hours}h left`;
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  categoryText: {
    fontFamily: 'Sora',
    fontSize: 10,
    color: ILOWA_COLORS.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  privateBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  privateText: {
    fontFamily: 'Inter',
    fontSize: 10,
    color: ILOWA_COLORS.purple,
  },
  timeLeft: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: ILOWA_COLORS.textMuted,
    marginLeft: 'auto',
  },
  question: {
    fontFamily: 'Inter-Medium',
    fontSize: 15,
    color: ILOWA_COLORS.textPrimary,
    lineHeight: 22,
    marginBottom: 14,
  },
  poolBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  yesBar: {
    backgroundColor: ILOWA_COLORS.truth,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },
  noBar: {
    backgroundColor: ILOWA_COLORS.doubt,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  poolLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  poolSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  poolDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  poolLabel: {
    fontFamily: 'Sora-Bold',
    fontSize: 11,
    color: ILOWA_COLORS.textSecondary,
  },
  poolValue: {
    fontFamily: 'Sora-Bold',
    fontSize: 13,
  },
  poolAmount: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: ILOWA_COLORS.textMuted,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 10,
  },
  footerText: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: ILOWA_COLORS.textMuted,
  },
  cardResolved: {
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  cardExpired: {
    opacity: 0.7,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  resolvedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  resolvedText: {
    fontFamily: 'Sora-Bold',
    fontSize: 11,
    color: ILOWA_COLORS.truth,
    letterSpacing: 0.5,
  },
  expiredBadge: {
    backgroundColor: 'rgba(107, 114, 128, 0.15)',
  },
  expiredText: {
    fontFamily: 'Sora',
    fontSize: 11,
    color: ILOWA_COLORS.textMuted,
  },
  winnerBar: {
    opacity: 1,
  },
  loserBar: {
    opacity: 0.3,
  },
  positionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  positionLabel: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.textMuted,
  },
  positionValue: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 12,
  },
  positionResult: {
    fontFamily: 'Sora-Bold',
    fontSize: 12,
    marginLeft: 'auto',
  },
  claimButton: {
    backgroundColor: ILOWA_COLORS.gold,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  claimButtonText: {
    fontFamily: 'Sora-Bold',
    fontSize: 14,
    color: ILOWA_COLORS.deepBlack,
  },
  resolveRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  resolveBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resolveBtnYes: {
    backgroundColor: ILOWA_COLORS.truth,
  },
  resolveBtnNo: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: ILOWA_COLORS.doubt,
  },
  resolveBtnText: {
    fontFamily: 'Sora-Bold',
    fontSize: 12,
    color: ILOWA_COLORS.deepBlack,
  },
  shareBlinkBtn: {
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  shareBlinkText: {
    fontFamily: 'Sora',
    fontSize: 10,
    color: ILOWA_COLORS.cyan,
    letterSpacing: 0.3,
  },
});
