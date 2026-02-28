import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { 
  Grid3X3, TrendingUp, Trophy, Users, Coins, Palette, Music, Drum, 
  Film, Award, Vote, ArrowLeftRight, Smartphone, CloudSun, Search 
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ILOWA_COLORS } from '../../theme/colors';
import { MarketCard } from '../../components/MarketCard';
import { MarketCardSkeleton } from '../../components/Skeleton';
import { PrivacyToggle } from '../../components/PrivacyToggle';
import { CompressedToggle } from '../../components/CompressedToggle';
import { VoiceInputButton } from '../../components/VoiceInputButton';
import { Market, MarketCategory } from '../../types/market';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { validateMarket } from '../../lib/ai/qwen3';
import { useMarkets } from '../../hooks/useMarkets';
import { useWallet } from '../../hooks/useWallet';

interface CategoryWithIcon extends MarketCategory {
  Icon: LucideIcon;
}

const CATEGORIES: CategoryWithIcon[] = [
  { id: 'all', name: 'All', icon: '', color: ILOWA_COLORS.gold, Icon: Grid3X3 },
  { id: 'finance', name: 'Finance', icon: '', color: '#10B981', Icon: TrendingUp },
  { id: 'sports', name: 'Sports', icon: '', color: '#3B82F6', Icon: Trophy },
  { id: 'politics', name: 'Politics', icon: '', color: '#8B5CF6', Icon: Users },
  { id: 'crypto', name: 'Crypto', icon: '', color: '#F59E0B', Icon: Coins },
  { id: 'culture', name: 'Culture', icon: '', color: '#EC4899', Icon: Palette },
  { id: 'music', name: 'Music', icon: '', color: '#06B6D4', Icon: Music },
  { id: 'afrobeats', name: 'Afrobeats', icon: '', color: '#84CC16', Icon: Drum },
  { id: 'nollywood', name: 'Nollywood', icon: '', color: '#F97316', Icon: Film },
  { id: 'football', name: 'Football', icon: '', color: '#14B8A6', Icon: Award },
  { id: 'elections', name: 'Elections', icon: '', color: '#A855F7', Icon: Vote },
  { id: 'currency', name: 'Currency', icon: '', color: '#22C55E', Icon: ArrowLeftRight },
  { id: 'tech', name: 'Tech', icon: '', color: '#6366F1', Icon: Smartphone },
  { id: 'weather', name: 'Weather', icon: '', color: '#0EA5E9', Icon: CloudSun },
];

export default function MarketsScreen() {
  const insets = useSafeAreaInsets();
  const voiceInput = useVoiceInput();
  const wallet = useWallet();
  const {
    markets: fetchedMarkets, loading: marketsLoading,
    createMarket, placeBet, fetchMarkets,
    resolveLightMarket, claimLightWinnings,
  } = useMarkets(wallet);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isCompressed, setIsCompressed] = useState(true); // Default to compressed for cost savings
  const [isReady, setIsReady] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [durationDays, setDurationDays] = useState(7);
  const [isCreating, setIsCreating] = useState(false);

  // Delay render on focus to prevent Android glitch
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => setIsReady(true), 100);
      return () => { clearTimeout(timer); setIsReady(false); };
    }, [])
  );

  // Sync markets from hook
  useEffect(() => {
    setMarkets(fetchedMarkets);
    setLoading(marketsLoading);
  }, [fetchedMarkets, marketsLoading]);

  const filteredMarkets = markets.filter((m) => {
    if (activeCategory !== 'all' && m.category !== activeCategory) return false;
    if (searchQuery && !m.question.toLowerCase().includes(searchQuery.toLowerCase()))
      return false;
    return true;
  });

  if (!isReady) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={ILOWA_COLORS.gold} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.header}>
          <Text style={styles.headerTitle}>Markets</Text>
          <View style={styles.headerStats}>
            <Text style={styles.statValue}>{markets.filter(m => m.status === 'active').length}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
        </Animated.View>

        {/* Search */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.searchRow}>
          <View style={styles.searchInput}>
            <Search size={18} color={ILOWA_COLORS.textMuted} strokeWidth={2.5} />
            <TextInput
              style={styles.searchText}
              placeholder="Search predictions..."
              placeholderTextColor={ILOWA_COLORS.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </Animated.View>

        {/* Categories */}
        <Animated.View entering={FadeInDown.delay(300).duration(500)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            {CATEGORIES.map((cat) => {
              const IconComponent = cat.Icon;
              const isActive = activeCategory === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setActiveCategory(cat.id)}
                  style={[
                    styles.categoryChip,
                    isActive && {
                      backgroundColor: cat.color,
                      shadowColor: cat.color,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.7,
                      shadowRadius: 8,
                      elevation: 6,
                      borderColor: cat.color,
                    },
                  ]}
                >
                  <IconComponent 
                    size={16} 
                    color={isActive ? ILOWA_COLORS.deepBlack : cat.color} 
                    strokeWidth={2.5}
                  />
                  <Text
                    style={[
                      styles.categoryText,
                      isActive && styles.categoryTextActive,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Privacy & Compression Toggles */}
        <Animated.View entering={FadeInDown.delay(350).duration(500)} style={{ marginTop: 4, gap: 12, marginBottom: 16 }}>
          <PrivacyToggle value={isPrivate} onChange={setIsPrivate} />
          <CompressedToggle value={isCompressed} onChange={setIsCompressed} />
        </Animated.View>

        {/* Create Market */}
        <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.voiceCreate}>
          <Text style={styles.voiceCreateLabel}>Create a prediction</Text>

          {/* Text Input */}
          <TextInput
            style={styles.marketTextInput}
            value={textInput}
            onChangeText={setTextInput}
            placeholder="e.g. Will Naira hit ₦1800/USD by Q3?"
            placeholderTextColor={ILOWA_COLORS.textMuted}
            multiline
            returnKeyType="done"
          />

          {/* Duration Presets */}
          <View style={styles.durationRow}>
            <Text style={styles.durationLabel}>Duration:</Text>
            {[1, 7, 30, 90].map((d) => (
              <Pressable
                key={d}
                onPress={() => setDurationDays(d)}
                style={[
                  styles.durationChip,
                  durationDays === d && styles.durationChipActive,
                ]}
              >
                <Text style={[
                  styles.durationChipText,
                  durationDays === d && styles.durationChipTextActive,
                ]}>
                  {d}d
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Action Row: text submit + voice */}
          <View style={styles.createActionRow}>
            <Pressable
              style={[
                styles.createTextBtn,
                (!textInput.trim() || isCreating) && styles.createTextBtnDisabled,
              ]}
              disabled={!textInput.trim() || isCreating}
              onPress={async () => {
                if (!textInput.trim()) return;
                const validation = await validateMarket(textInput.trim());
                if (!validation.valid) {
                  Alert.alert('Invalid Prediction', validation.reason || 'Try rephrasing your question.');
                  return;
                }
                Alert.alert(
                  'Create Market?',
                  `"${textInput.trim()}"\n\nCategory: ${validation.category}\nDuration: ${durationDays} day${durationDays > 1 ? 's' : ''}${isPrivate ? '\n\n🔒 Encrypted (Arcium MPC)' : ''}${isCompressed ? '\n\n⚡ Compressed (Light Protocol)' : ''}`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: isPrivate ? '🔒 Create Private' : (isCompressed ? '⚡ Create Compressed' : 'Create'),
                      onPress: async () => {
                        setIsCreating(true);
                        try {
                          const expiresAt = Math.floor(Date.now() / 1000) + durationDays * 24 * 60 * 60;
                          const marketCategory = validation.category || (activeCategory !== 'all' ? activeCategory : 'other');
                          await createMarket(textInput.trim(), marketCategory, 'global', isPrivate, expiresAt, isCompressed);
                          setTextInput('');
                          Alert.alert('Success', `Your ${isPrivate ? 'private ' : ''}${isCompressed ? 'compressed ' : ''}prediction market has been created!`);
                        } catch (err) {
                          Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create market');
                        } finally {
                          setIsCreating(false);
                        }
                      },
                    },
                  ]
                );
              }}
            >
              {isCreating ? (
                <ActivityIndicator size="small" color={ILOWA_COLORS.deepBlack} />
              ) : (
                <Text style={styles.createTextBtnLabel}>Create</Text>
              )}
            </Pressable>

            <VoiceInputButton
              onRecordComplete={async (uri) => {
                const text = await voiceInput.transcribe(uri);
                if (!text) {
                  Alert.alert('Error', 'Could not transcribe your voice. Try again.');
                  return;
                }
                setTextInput(text);
                voiceInput.reset();
              }}
            />
          </View>
        </Animated.View>

        {/* Market List */}
        <Animated.View entering={FadeInDown.delay(500).duration(500)}>
          {loading ? (
            <>
              <MarketCardSkeleton />
              <MarketCardSkeleton />
              <MarketCardSkeleton />
            </>
          ) : filteredMarkets.length > 0 ? (
            filteredMarkets.map((market) => {
              const isMyMarket = wallet.publicKey
                ? market.creator.startsWith(wallet.publicKey.toBase58().slice(0, 8))
                : false;
              return (
                <MarketCard
                  key={market.id}
                  market={market}
                  onResolve={market.isLight && isMyMarket ? async (id, outcome) => {
                    try {
                      await resolveLightMarket(id, outcome);
                      Alert.alert('Resolved', `Market resolved as ${outcome ? 'YES' : 'NO'}`);
                    } catch (e: any) {
                      Alert.alert('Error', e?.message ?? 'Failed to resolve');
                    }
                  } : undefined}
                  onClaimWinnings={market.isLight ? async (id) => {
                    try {
                      await claimLightWinnings(id);
                      Alert.alert('Claimed!', 'Winnings sent to your wallet.');
                    } catch (e: any) {
                      Alert.alert('Error', e?.message ?? 'Failed to claim');
                    }
                  } : undefined}
                />
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔮</Text>
              <Text style={styles.emptyText}>No predictions found</Text>
              <Text style={styles.emptySubtext}>
                Be the first to create one!
              </Text>
            </View>
          )}
        </Animated.View>

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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  headerTitle: {
    fontFamily: 'Sora-Bold',
    fontSize: 28,
    color: ILOWA_COLORS.textPrimary,
  },
  headerStats: {
    alignItems: 'center',
  },
  statValue: {
    fontFamily: 'Sora-Bold',
    fontSize: 18,
    color: ILOWA_COLORS.gold,
  },
  statLabel: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: ILOWA_COLORS.textMuted,
  },
  searchRow: {
    marginBottom: 16,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  searchText: {
    flex: 1,
    fontFamily: 'Inter',
    fontSize: 14,
    color: ILOWA_COLORS.textPrimary,
  },
  categoryRow: {
    gap: 8,
    paddingBottom: 16,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ILOWA_COLORS.cardDark,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryIcon: {
    fontSize: 14,
  },
  categoryText: {
    fontFamily: 'Sora',
    fontSize: 12,
    color: ILOWA_COLORS.textSecondary,
  },
  categoryTextActive: {
    color: ILOWA_COLORS.deepBlack,
    fontFamily: 'Sora-Bold',
  },
  voiceCreate: {
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 255, 0.2)',
  },
  voiceCreateLabel: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: ILOWA_COLORS.textSecondary,
    marginBottom: 12,
  },
  marketTextInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 14,
    color: ILOWA_COLORS.textPrimary,
    fontFamily: 'Inter',
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  durationLabel: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: ILOWA_COLORS.textMuted,
    marginRight: 4,
  },
  durationChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  durationChipActive: {
    backgroundColor: 'rgba(0, 217, 255, 0.15)',
    borderColor: ILOWA_COLORS.cyan,
    shadowColor: ILOWA_COLORS.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  durationChipText: {
    fontFamily: 'Sora',
    fontSize: 12,
    color: ILOWA_COLORS.textMuted,
  },
  durationChipTextActive: {
    color: ILOWA_COLORS.cyan,
    fontFamily: 'Sora-Bold',
  },
  createActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  createTextBtn: {
    flex: 1,
    backgroundColor: ILOWA_COLORS.purple,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${ILOWA_COLORS.purple}80`,
    shadowColor: ILOWA_COLORS.purple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  createTextBtnDisabled: {
    opacity: 0.4,
  },
  createTextBtnLabel: {
    fontFamily: 'Sora-Bold',
    fontSize: 15,
    color: '#FFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 16,
    color: ILOWA_COLORS.textPrimary,
    marginBottom: 4,
  },
  emptySubtext: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: ILOWA_COLORS.textMuted,
  },
});
