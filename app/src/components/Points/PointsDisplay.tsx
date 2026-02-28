import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Trophy, TrendingUp, Users, Zap, Star } from 'lucide-react-native';
import { PremiumGlassCard } from '@/components/UI/PremiumGlassCard';
import { pointsSystem, UserPoints, TIERS, MILESTONES, TierId, getEarlyBadge, assignEarlyBadge, EarlyAdopterBadge } from '@/lib/points/PointsSystem';

// Derive color + next-tier threshold from the TIERS array at render time
function tierInfo(tierId: TierId) {
  const idx = TIERS.findIndex(t => t.id === tierId);
  const current = TIERS[idx] ?? TIERS[0];
  const next = idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
  return { current, next, level: idx + 1 };
}

export function PointsDisplay({ userWallet }: { userWallet: string }) {
  const [points, setPoints] = useState<UserPoints | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [earlyBadge, setEarlyBadge] = useState<EarlyAdopterBadge | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, badge] = await Promise.all([
        pointsSystem.getUserPoints(userWallet),
        getEarlyBadge(userWallet),
      ]);
      setPoints(data);

      if (badge) {
        setEarlyBadge(badge);
      } else {
        // First-time user — assign early adopter badge based on signup order.
        // Until we have a real user counter from the backend, derive a
        // deterministic number from the wallet bytes. During the early
        // early access phase, all users land within the first 99.
        const walletBytes = userWallet.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
        const userNum = (walletBytes % 66) + 1; // 1..66 → covers both Genesis Elder and Pioneer Voice tiers
        const freshBadge = await assignEarlyBadge(userWallet, userNum);
        setEarlyBadge(freshBadge);
      }
    } catch (e) {
      console.error('[PointsDisplay] load error:', e);
      setError('Could not load points');
    } finally {
      setLoading(false);
    }
  }, [userWallet]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <PremiumGlassCard style={styles.container}>
        <ActivityIndicator color="#FFD700" size="small" />
      </PremiumGlassCard>
    );
  }

  if (error || !points) {
    return (
      <PremiumGlassCard style={styles.container}>
        <Text style={styles.errorText}>{error ?? 'No points data'}</Text>
      </PremiumGlassCard>
    );
  }

  const { current: tierData, next: nextTier, level } = tierInfo(points.tier);
  const color = tierData.color;
  const multiplier = tierData.multiplier;

  // progress within current tier band
  const tierFloor = tierData.threshold;
  const tierCeil  = nextTier?.threshold ?? tierFloor;
  const withinBand = tierCeil > tierFloor
    ? Math.min((points.totalPoints - tierFloor) / (tierCeil - tierFloor), 1)
    : 1;

  const socialPts  = points.breakdown.socialEngagement;
  const predPts    = points.breakdown.predictions + points.breakdown.accuratePredictions;
  const contentPts = points.breakdown.contentCreation;

  // next milestone
  const hitSet = new Set(points.milestonesHit ?? []);
  const nextMilestone = MILESTONES.find(m => !hitSet.has(m.at) && points.totalPoints < m.at);

  return (
    <PremiumGlassCard glowColor={color} style={styles.container}>

      {/* tier badge + level */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Trophy size={28} color={color} />
          <Text style={[styles.levelText, { color }]}>Lv. {level}</Text>
        </View>
        <View style={[styles.badge, { borderColor: color, backgroundColor: `${color}20` }]}>
          <Text style={[styles.badgeText, { color }]}>{tierData.emoji} {tierData.label.toUpperCase()}</Text>
        </View>
      </View>

      {/* early adopter badge */}
      {earlyBadge && (
        <View style={[styles.earlyBadgeRow, { borderColor: `${earlyBadge.color}40`, backgroundColor: `${earlyBadge.color}12` }]}>
          <Text style={styles.earlyBadgeEmoji}>{earlyBadge.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.earlyBadgeLabel, { color: earlyBadge.color }]}>{earlyBadge.label}</Text>
            <Text style={styles.earlyBadgeSub}>User #{earlyBadge.userNumber} · +{earlyBadge.multiplierBonus}x bonus multiplier</Text>
          </View>
        </View>
      )}

      {/* big number */}
      <Text style={styles.total}>{points.totalPoints.toLocaleString()}</Text>
      <Text style={styles.totalLabel}>Points Earned  ·  {multiplier}{earlyBadge ? ` + ${earlyBadge.multiplierBonus}` : ''}x multiplier</Text>

      {/* progress to next tier */}
      {nextTier && (
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${withinBand * 100}%`, backgroundColor: color }]} />
          </View>
          <Text style={styles.progressLabel}>
            {(nextTier.threshold - points.totalPoints).toLocaleString()} pts to {nextTier.label}
          </Text>
        </View>
      )}
      {!nextTier && (
        <Text style={[styles.progressLabel, { textAlign: 'center', marginBottom: 12 }]}>Max tier reached 🌟</Text>
      )}

      {/* breakdown */}
      <View style={styles.breakdown}>
        <BreakdownItem icon={<TrendingUp size={15} color="#FFD700" />} label="Predictions" value={predPts} />
        <BreakdownItem icon={<Users size={15} color="#00D9FF" />}       label="Social"      value={socialPts} />
        <BreakdownItem icon={<Zap size={15} color="#8B5CF6" />}         label="Content"     value={contentPts} />
      </View>

      {/* next milestone */}
      {nextMilestone && (
        <View style={styles.milestoneRow}>
          <Star size={14} color="#F59E0B" />
          <Text style={styles.milestoneText}>
            Next milestone: <Text style={{ fontWeight: '700', color: '#F59E0B' }}>{nextMilestone.title}</Text> at {nextMilestone.at.toLocaleString()} pts (+{nextMilestone.bonus} bonus)
          </Text>
        </View>
      )}

      {/* airdrop callout */}
      <View style={styles.airdropRow}>
        <Text style={styles.airdropTitle}>🎁 Points = Future Airdrop</Text>
        <Text style={styles.airdropSub}>Token launches after milestones. Keep earning.</Text>
      </View>

    </PremiumGlassCard>
  );
}

function BreakdownItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.breakdownItem}>
      {icon}
      <Text style={styles.breakdownLabel}>{label}</Text>
      <Text style={styles.breakdownValue}>{value.toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  total: {
    fontSize: 52,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
  },
  progressRow: {
    marginBottom: 20,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'right',
  },
  breakdown: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  breakdownItem: {
    alignItems: 'center',
    gap: 4,
  },
  breakdownLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  breakdownValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
  airdropRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 16,
    alignItems: 'center',
    gap: 4,
  },
  airdropTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFD700',
  },
  airdropSub: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  levelText: {
    fontSize: 20,
    fontWeight: '800',
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  milestoneText: {
    fontSize: 11,
    color: '#94A3B8',
    flex: 1,
  },
  errorText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    padding: 8,
  },
  earlyBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  earlyBadgeEmoji: {
    fontSize: 26,
  },
  earlyBadgeLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  earlyBadgeSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
});
