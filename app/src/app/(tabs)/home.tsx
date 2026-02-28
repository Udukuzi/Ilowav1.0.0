import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedRef,
  withRepeat,
  withTiming,
  Easing,
  useDerivedValue,
  scrollTo,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Mic, Lightbulb, TrendingUp, Globe2, Link2, Ticket, Trophy, Star, BookOpen } from 'lucide-react-native';
import { ILOWA_COLORS } from '../../theme/colors';
import { ElderAvatar } from '../../components/ElderAvatar';
import { DailyChallenge } from '../../components/DailyChallenge';
import { MarketCard } from '../../components/MarketCard';
import { EventTicketCard } from '../../components/EventTicketCard';
import { Market } from '../../types/market';
import { useRegion } from '../../hooks/useRegion';
import { useWallet } from '../../hooks/useWallet';
import { useMarkets } from '../../hooks/useMarkets';
import { getDailyWisdom } from '../../lib/wisdom/daily-wisdom';
import { getActiveCampaigns, enrollInCampaign, isEnrolled, TorqueCampaign } from '../../lib/loyalty/torque';
import { getUpcomingEvents, KYDEvent } from '../../lib/ticketing/kyd';
import { PODCAST_LIBRARY, getEpisodesForRegion } from '../../lib/podcasts/content-library';

const { width } = Dimensions.get('window');

// prevent MarketCard re-renders when home screen state changes (campaigns, enrolled, etc.)
const MemoMarketCard = React.memo(MarketCard, (prev, next) => prev.market.id === next.market.id);

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeElder, elderColors, activeLanguage, config } = useRegion();
  const wallet = useWallet();
  const { markets, fetchMarkets } = useMarkets(wallet);

  // Sort by activity (most bets first), take top 10 for trending strip
  const trendingMarkets = [...markets]
    .filter(m => m.status === 'active')
    .sort((a, b) => b.totalBets - a.totalBets || (b.yesPool + b.noPool) - (a.yesPool + a.noPool))
    .slice(0, 10);

  // KYD events + Torque campaigns
  const [events, setEvents] = useState<KYDEvent[]>([]);
  const [campaigns, setCampaigns] = useState<TorqueCampaign[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getUpcomingEvents?.()?.then(setEvents).catch(() => {});
    getActiveCampaigns().then(async (list) => {
      setCampaigns(list);
      // hydrate enrolled state from local cache
      const checks = await Promise.all(list.map(c => isEnrolled(c.id).then(e => e ? c.id : null)));
      setEnrolledIds(new Set(checks.filter(Boolean) as string[]));
    }).catch(() => {});
  }, []);

  // podcast episodes from the content library, filtered by region
  const regionKey = config?.region ?? 'west-africa';
  const regionMap2: Record<string, string> = {
    westAfrica: 'west-africa', eastAfrica: 'east-africa', southernAfrica: 'southern-africa',
    latinAmerica: 'latin-america', southAsia: 'south-asia', southeastAsia: 'southeast-asia',
    mena: 'mena', caribbean: 'caribbean', pacific: 'pacific',
  };
  const mappedRegion = regionMap2[regionKey] || regionKey;
  const podcastEpisodes = getEpisodesForRegion(mappedRegion);

  const ICON_MAP: Record<string, any> = {
    'crypto': Mic, 'defi': Lightbulb, 'culture': Globe2,
    'business': TrendingUp, 'governance': Link2, 'health': BookOpen,
  };
  const COLOR_MAP: Record<string, string> = {
    'crypto': '#8B5CF6', 'defi': '#FFD700', 'culture': '#10B981',
    'business': '#00D9FF', 'governance': '#F59E0B', 'health': '#EC4899',
  };

  // ── Native-thread auto-scroll via Reanimated (no JS bridge per frame) ──
  const trendingRef = useAnimatedRef<Animated.ScrollView>();
  const listenRef = useAnimatedRef<Animated.ScrollView>();

  const trendingCardW = width * 0.75 + 12;
  const trendingMax = trendingCardW * trendingMarkets.length;
  const trendingScroll = useSharedValue(0);

  const podcastCardW = (width - 64) / 3 + 12;
  const podcastMax = podcastCardW * podcastEpisodes.length;
  const podcastScroll = useSharedValue(0);

  useEffect(() => {
    if (trendingMarkets.length < 2) return;
    // full cycle in ~12s — smooth, low overhead
    trendingScroll.value = 0;
    trendingScroll.value = withRepeat(
      withTiming(trendingMax, { duration: trendingMax * 30, easing: Easing.linear }),
      -1, false
    );
  }, [trendingMarkets.length]);

  useEffect(() => {
    if (podcastEpisodes.length < 2) return;
    podcastScroll.value = 0;
    podcastScroll.value = withRepeat(
      withTiming(podcastMax, { duration: podcastMax * 45, easing: Easing.linear }),
      -1, false
    );
  }, [podcastEpisodes.length]);

  // pipe the shared value → native scrollTo on the UI thread
  useDerivedValue(() => {
    if (trendingMax > 0) scrollTo(trendingRef, trendingScroll.value, 0, false);
  });
  useDerivedValue(() => {
    if (podcastMax > 0) scrollTo(listenRef, podcastScroll.value, 0, false);
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <ElderAvatar elder={activeElder} size={44} showGlow />
            <View style={styles.headerText}>
              <Text style={styles.greeting}>
                {activeElder.greeting[activeLanguage.code] || activeElder.greeting.en}
              </Text>
              <Text style={[styles.elderLabel, { color: elderColors.primary }]}>
                {activeElder.name}
              </Text>
            </View>
          </View>
        </View>

        {/* Daily Elder Wisdom */}
        <View style={styles.wisdomCard}>
          <View style={[styles.wisdomAccent, { backgroundColor: elderColors.primary }]} />
          <Text style={styles.wisdomLabel}>Elder Wisdom</Text>
          <Text style={styles.wisdomText}>
            "{getDailyWisdom(activeElder)}"
          </Text>
          <Text style={[styles.wisdomAuthor, { color: elderColors.primary }]}>
            — {activeElder.name}
          </Text>
        </View>

        {/* Daily Challenge */}
        <View>
          <DailyChallenge elder={activeElder} />
        </View>

        {/* Trending Markets — native-thread continuous scroll */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Trending Predictions</Text>
            <Pressable onPress={() => router.push('/(tabs)/markets')} hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}>
              <Text style={[styles.seeAll, { color: elderColors.primary }]}>See All</Text>
            </Pressable>
          </View>
          {trendingMarkets.length > 0 ? (
            <Animated.ScrollView
              ref={trendingRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              scrollEnabled={false}
              pointerEvents="box-none"
              contentContainerStyle={{ gap: 12 }}
            >
              {trendingMarkets.map((item) => (
                <View key={item.id} style={{ width: width * 0.75 }}>
                  <MemoMarketCard market={item} />
                </View>
              ))}
            </Animated.ScrollView>
          ) : (
            <Pressable onPress={() => router.push('/(tabs)/markets')}>
              <Text style={{ color: ILOWA_COLORS.textMuted, fontFamily: 'Inter', fontSize: 13, textAlign: 'center', paddingVertical: 20 }}>
                No predictions yet. Be the first!
              </Text>
            </Pressable>
          )}
        </View>

        {/* Listen Now — native-thread podcast scroll */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Listen Now</Text>
            <Pressable onPress={() => router.push('/(tabs)/radio')} hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}>
              <Text style={[styles.seeAll, { color: elderColors.primary }]}>Podcasts</Text>
            </Pressable>
          </View>
          <Animated.ScrollView
            ref={listenRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={false}
            pointerEvents="box-none"
            contentContainerStyle={{ gap: 12 }}
          >
            {podcastEpisodes.map((ep) => {
                const EpIcon = ICON_MAP[ep.category] || Mic;
                const epColor = COLOR_MAP[ep.category] || '#8B5CF6';
                const mins = Math.ceil(ep.durationEstimate / 60);
                return (
                  <Pressable
                    key={ep.id}
                    style={styles.podcastCard}
                    onPress={() => router.push(`/podcast/${ep.id}` as any)}
                  >
                    <View style={[styles.podcastCover, { backgroundColor: `${epColor}18` }]}>
                      <EpIcon size={28} color={epColor} strokeWidth={2} />
                    </View>
                    <Text style={styles.podcastTitle} numberOfLines={2}>{ep.title}</Text>
                    <Text style={styles.podcastDuration}>{mins} min</Text>
                  </Pressable>
                );
            })}
          </Animated.ScrollView>
        </View>

        {/* KYD Events */}
        {events.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Upcoming Events</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {events.slice(0, 5).map((evt) => (
                <Pressable key={evt.id} style={{ width: 200 }} onPress={() => router.push(`/event/${evt.id}` as any)}>
                  <EventTicketCard event={evt} compact />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Torque Loyalty Campaigns */}
        {campaigns.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Earn Rewards</Text>
            </View>
            {campaigns.slice(0, 3).map((c) => {
              const alreadyIn = enrolledIds.has(c.id);
              return (
                <Pressable
                  key={c.id}
                  style={[styles.campaignCard, alreadyIn && { borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' }]}
                  onPress={() => {
                    if (!wallet.connected) {
                      Alert.alert('Wallet Required', 'Connect your wallet to join campaigns.');
                      return;
                    }
                    if (alreadyIn) {
                      Alert.alert('Already Enrolled ✓', `You're in "${c.title}".\n\n${c.requirements.map(r => r.description).join('\n')}\n\nReward: ${c.rewardType === 'sol' ? `${c.rewardAmount} SOL` : c.rewardType === 'nft' ? 'NFT Mint' : `${c.rewardAmount} points`}\n\nProgress is tracked automatically as you use the app.`);
                      return;
                    }
                    Alert.alert(
                      c.title,
                      `${c.description}\n\nReward: ${c.rewardType === 'sol' ? `${c.rewardAmount} SOL` : c.rewardType === 'nft' ? 'NFT Mint' : `${c.rewardAmount} points`}`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Join Campaign', onPress: async () => {
                          const ok = await enrollInCampaign(wallet.publicKey!.toBase58(), c.id);
                          if (ok) {
                            setEnrolledIds(prev => new Set([...prev, c.id]));
                            Alert.alert('Enrolled! ✓', `You joined "${c.title}". Complete the requirements to earn your reward. Progress is tracked automatically.`);
                          }
                        }},
                      ]
                    );
                  }}
                >
                  <View style={[styles.campaignIcon, { backgroundColor: c.rewardType === 'sol' ? 'rgba(255,215,0,0.12)' : c.rewardType === 'nft' ? 'rgba(139,92,246,0.12)' : 'rgba(0,217,255,0.12)' }]}>
                    {c.rewardType === 'sol' ? <Star size={20} color={ILOWA_COLORS.gold} /> :
                     c.rewardType === 'nft' ? <Trophy size={20} color={ILOWA_COLORS.purple} /> :
                     <Ticket size={20} color={ILOWA_COLORS.cyan} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.campaignTitle}>{c.title}</Text>
                      {alreadyIn && <Text style={{ fontSize: 10, color: '#10B981', fontFamily: 'Sora-SemiBold' }}>✓ Joined</Text>}
                    </View>
                    <Text style={styles.campaignDesc} numberOfLines={1}>{c.description}</Text>
                  </View>
                  <View style={[styles.campaignReward, alreadyIn && { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                    <Text style={[styles.campaignRewardText, alreadyIn && { color: '#10B981' }]}>
                      {c.rewardType === 'sol' ? `${c.rewardAmount} SOL` : c.rewardType === 'nft' ? 'NFT' : `${c.rewardAmount} pts`}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ILOWA_COLORS.deepBlack,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    gap: 2,
  },
  greeting: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: ILOWA_COLORS.textSecondary,
  },
  elderLabel: {
    fontFamily: 'Sora-Bold',
    fontSize: 16,
  },
  wisdomCard: {
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    overflow: 'hidden',
  },
  wisdomAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  wisdomLabel: {
    fontFamily: 'Sora',
    fontSize: 11,
    color: ILOWA_COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  wisdomText: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontStyle: 'italic',
    color: ILOWA_COLORS.textPrimary,
    lineHeight: 24,
    marginBottom: 8,
  },
  wisdomAuthor: {
    fontFamily: 'Sora',
    fontSize: 12,
    textAlign: 'right',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 18,
    color: ILOWA_COLORS.textPrimary,
  },
  seeAll: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
  },
  podcastRow: {
    flexDirection: 'row',
    gap: 12,
  },
  podcastCard: {
    width: (width - 64) / 3,
  },
  podcastCover: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  podcastIcon: {
    fontSize: 32,
  },
  podcastTitle: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: ILOWA_COLORS.textPrimary,
    marginBottom: 2,
  },
  podcastDuration: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: ILOWA_COLORS.textMuted,
  },
  campaignCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  campaignIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  campaignTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 13,
    color: ILOWA_COLORS.textPrimary,
  },
  campaignDesc: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: ILOWA_COLORS.textMuted,
    marginTop: 2,
  },
  campaignReward: {
    backgroundColor: 'rgba(255,215,0,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  campaignRewardText: {
    fontFamily: 'Sora-Bold',
    fontSize: 11,
    color: ILOWA_COLORS.gold,
  },
});
