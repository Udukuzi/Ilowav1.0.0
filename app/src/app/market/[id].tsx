import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PublicKey } from '@solana/web3.js';
import { ILOWA_COLORS } from '../../theme/colors';
import { PrivacyToggle } from '../../components/PrivacyToggle';
import { Market } from '../../types/market';
import { fetchMarketByPubkey } from '../../lib/solana/market-reader';
import { useMarkets } from '../../hooks/useMarkets';
import { useWallet } from '../../hooks/useWallet';
import { poolOdds, estimatePayout, probLabel, oddsShiftLabel } from '../../lib/markets/lmsr';

export default function MarketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const wallet = useWallet();
  const { markets: allMarkets, placeBet, resolveLightMarket, claimLightWinnings } = useMarkets(wallet.connected ? wallet : undefined);
  const [betSide, setBetSide] = useState<'yes' | 'no' | null>(null);
  const [betAmount, setBetAmount] = useState('0.1');
  const [customAmount, setCustomAmount] = useState('');
  const [isShielded, setIsShielded] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMarket = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    // Demo / optimistic cards live only in-memory — don't hit RPC
    if (id.startsWith('demo-') || id.startsWith('UserMkt')) {
      const cached = allMarkets.find(m => m.id === id) ?? null;
      setMarket(cached);
      setLoading(false);
      return;
    }

    // Check cached list first — the optimistic card from another hook
    // instance may have propagated via a re-fetch by now
    const cached = allMarkets.find(m => m.id === id) ?? null;

    // Try RPC, with retries for freshly created accounts that
    // haven't been indexed yet (devnet can lag a few seconds)
    const MAX_TRIES = 5;
    const RETRY_MS  = 1500;
    let fetched: Market | null = null;

    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
      try {
        const pubkey = new PublicKey(id);
        fetched = await fetchMarketByPubkey(pubkey);
        if (fetched) break;
      } catch { /* RPC hiccup — will retry */ }

      // Use cached version while we wait, so the screen isn't blank
      if (cached && attempt === 0) {
        setMarket(cached);
        setLoading(false);
      }

      if (attempt < MAX_TRIES - 1) {
        await new Promise(r => setTimeout(r, RETRY_MS));
      }
    }

    let final = fetched ?? cached;

    // overlay locally-cached question text (light markets store only a hash
    // on-chain; public markets are fine but the cache is a nice fallback)
    if (final && id) {
      try {
        const q = await AsyncStorage.getItem('ilowa_mktq_' + id);
        if (q) final = { ...final, question: q };
      } catch {}
    }

    setMarket(final);
    setLoading(false);
  }, [id, wallet.connected, allMarkets]);

  useEffect(() => {
    loadMarket();
  }, [loadMarket]);

  const effectiveAmount = useMemo(() => {
    const raw = customAmount || betAmount;
    const n = parseFloat(raw);
    return isNaN(n) || n <= 0 ? 0 : n;
  }, [betAmount, customAmount]);

  const odds = useMemo(
    () => market ? poolOdds(market.yesPool, market.noPool) : null,
    [market]
  );

  const payout = useMemo(() => {
    if (!market || !betSide || effectiveAmount <= 0) return null;
    return estimatePayout(market.yesPool, market.noPool, effectiveAmount, betSide);
  }, [market, betSide, effectiveAmount]);

  const isMyMarket = market && wallet.publicKey
    ? market.creator.startsWith(wallet.publicKey.toBase58().slice(0, 8))
    : false;

  const now = Date.now();
  const isExpiredOrPast = market ? now >= market.expiresAt : false;
  const canResolve = !!(market?.isLight && isMyMarket && isExpiredOrPast && market.status !== 'resolved');
  // only show claim for the market creator (who is also the resolver)
  // full bet-position tracking would need on-chain bet account reads
  const canClaim   = !!(market?.isLight && market.status === 'resolved' && market.outcome && isMyMarket);

  const handlePlaceBet = async () => {
    if (!betSide || !market || !wallet.connected || effectiveAmount <= 0) return;

    const payoutStr = payout ? `\nPayout if you win: ${payout.grossPayout.toFixed(3)} SOL${payout.roi > 0.5 ? ` (+${payout.roi.toFixed(0)}% ROI)` : ''}\nFee: ${payout.fee.toFixed(4)} SOL (0.5%)` : '';
    Alert.alert(
      `Confirm ${isShielded ? 'Shielded ' : ''}Bet`,
      `${effectiveAmount} SOL on ${betSide.toUpperCase()}${payoutStr}${isShielded ? '\n🔒 Amount encrypted via Arcium MPC' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setPlacing(true);
              await placeBet(market.pubkey, betSide === 'yes', effectiveAmount, isShielded);
              Alert.alert('Placed!', 'Your bet is on-chain.');
              await loadMarket();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to place bet');
            } finally {
              setPlacing(false);
            }
          },
        },
      ]
    );
  };

  const handleResolve = (outcome: boolean) => {
    Alert.alert(
      `Resolve as ${outcome ? 'YES' : 'NO'}?`,
      'This is permanent and on-chain. Cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          style: 'destructive',
          onPress: async () => {
            try {
              setResolving(true);
              await resolveLightMarket!(market!.pubkey, outcome);
              Alert.alert('Resolved', `Market settled as ${outcome ? 'YES' : 'NO'}`);
              await loadMarket();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Resolve failed');
            } finally {
              setResolving(false);
            }
          },
        },
      ]
    );
  };

  const handleClaim = async () => {
    try {
      setClaiming(true);
      await claimLightWinnings!(market!.pubkey);
      Alert.alert('Claimed!', 'Winnings sent to your wallet.');
      await loadMarket();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Claim failed');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={ILOWA_COLORS.gold} />
      </View>
    );
  }

  if (!market) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: ILOWA_COLORS.textMuted, fontFamily: 'Inter', fontSize: 14 }}>Market not found</Text>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/markets')} style={{ marginTop: 16 }}>
          <Text style={{ color: ILOWA_COLORS.cyan, fontFamily: 'Sora', fontSize: 14 }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const totalPool = market.yesPool + market.noPool;
  const yesProb = odds?.yesProb ?? 0.5;
  const noProb  = odds?.noProb  ?? 0.5;
  const shiftLabel = betSide && payout
    ? oddsShiftLabel(betSide === 'yes' ? yesProb : noProb, betSide === 'yes' ? payout.newYesProb : payout.newNoProb)
    : '';
  const isActive = market.status === 'active';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/markets')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={ILOWA_COLORS.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Market</Text>
        <View style={styles.headerBadges}>
          {market.isLight && <View style={styles.lightBadge}><Text style={styles.lightBadgeText}>⚡ Light Protocol</Text></View>}
          {(market.isPrivate || (market.shieldedBetCount ?? 0) > 0) && <View style={styles.privateBadge}><Text style={styles.privateBadgeText}>🔒 Arcium</Text></View>}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <View style={styles.categoryRow}>
            <View style={styles.categoryBadge}><Text style={styles.categoryText}>{market.category}</Text></View>
            {market.status === 'resolved' && (
              <View style={[styles.statusBadge, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                <Text style={[styles.statusText, { color: ILOWA_COLORS.truth }]}>{market.outcome === 'yes' ? '✓ YES' : '✗ NO'}</Text>
              </View>
            )}
            {market.status === 'expired' && (
              <View style={[styles.statusBadge, { backgroundColor: 'rgba(107,114,128,0.15)' }]}>
                <Text style={[styles.statusText, { color: ILOWA_COLORS.textMuted }]}>Expired</Text>
              </View>
            )}
          </View>
          <Text style={styles.question}>{market.question}</Text>
          <Text style={styles.meta}>
            {market.creator} · {market.totalBets} bets{(market.shieldedBetCount ?? 0) > 0 ? ` · ${market.shieldedBetCount} 🔒` : ''}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.poolCard}>
          <View style={styles.poolHeader}>
            <Text style={styles.poolTitle}>Pool</Text>
            <Text style={styles.poolTotal}>{totalPool.toFixed(2)} SOL</Text>
          </View>
          <View style={styles.poolBar}>
            <View style={[styles.yesBar, { flex: yesProb * 100 }]} />
            <View style={[styles.noBar,  { flex: noProb  * 100 }]} />
          </View>
          <View style={styles.poolLabels}>
            <View>
              <Text style={[styles.poolPercent, { color: ILOWA_COLORS.truth }]}>{probLabel(yesProb)} YES</Text>
              <Text style={styles.poolAmount}>{market.yesPool.toFixed(2)} SOL</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.poolPercent, { color: ILOWA_COLORS.doubt }]}>{probLabel(noProb)} NO</Text>
              <Text style={styles.poolAmount}>{market.noPool.toFixed(2)} SOL</Text>
            </View>
          </View>
          {(market.shieldedBetCount ?? 0) > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
              <Text style={{ color: ILOWA_COLORS.purple, fontSize: 12, fontFamily: 'Inter' }}>
                🔒 {market.shieldedBetCount} shielded bet{(market.shieldedBetCount ?? 0) > 1 ? 's' : ''} — amounts encrypted via Arcium (not reflected in pool totals)
              </Text>
            </View>
          )}
        </Animated.View>

        {market.oracleAuthority && (
          <Animated.View entering={FadeInDown.delay(190).duration(400)} style={styles.oracleCard}>
            <Text style={styles.oracleTitle}>⚙ Oracle Resolution</Text>
            <Text style={styles.oracleLine}>YES wins when price {market.oracleAbove ? '≥' : '≤'} {market.oracleThreshold?.toLocaleString()}</Text>
            <Text style={styles.oracleLine} numberOfLines={1}>Authority: {market.oracleAuthority.slice(0, 16)}…</Text>
          </Animated.View>
        )}

        {isActive && (
          <Animated.View entering={FadeInDown.delay(230).duration(400)} style={styles.betSection}>
            <Text style={styles.betTitle}>Place Your Bet</Text>
            <View style={styles.betSides}>
              <Pressable onPress={() => { setBetSide('yes'); setCustomAmount(''); }}
                style={[styles.betSideButton, betSide === 'yes' && styles.betSideYesActive]}>
                <Text style={[styles.betSideText, betSide === 'yes' && { color: ILOWA_COLORS.deepBlack }]}>YES</Text>
                <Text style={[styles.betSideProb, betSide === 'yes' && { color: ILOWA_COLORS.deepBlack }]}>{probLabel(yesProb)}</Text>
              </Pressable>
              <Pressable onPress={() => { setBetSide('no'); setCustomAmount(''); }}
                style={[styles.betSideButton, betSide === 'no' && styles.betSideNoActive]}>
                <Text style={[styles.betSideText, betSide === 'no' && { color: ILOWA_COLORS.deepBlack }]}>NO</Text>
                <Text style={[styles.betSideProb, betSide === 'no' && { color: ILOWA_COLORS.deepBlack }]}>{probLabel(noProb)}</Text>
              </Pressable>
            </View>
            <View style={styles.amountRow}>
              {['0.1', '0.5', '1', '5'].map((amt) => (
                <Pressable key={amt} onPress={() => { setBetAmount(amt); setCustomAmount(''); }}
                  style={[styles.amountChip, betAmount === amt && !customAmount && styles.amountChipActive]}>
                  <Text style={[styles.amountText, betAmount === amt && !customAmount && styles.amountTextActive]}>{amt}</Text>
                </Pressable>
              ))}
              <TextInput style={styles.customInput} placeholder="custom" placeholderTextColor={ILOWA_COLORS.textMuted}
                keyboardType="decimal-pad" value={customAmount} onChangeText={setCustomAmount} />
            </View>
            {payout && betSide && (
              <Animated.View entering={FadeIn.duration(200)} style={styles.payoutCard}>
                <View style={styles.payoutRow}>
                  <Text style={styles.payoutLabel}>If {betSide.toUpperCase()} wins</Text>
                  <Text style={styles.payoutValue}>{payout.grossPayout.toFixed(3)} SOL</Text>
                </View>
                <View style={styles.payoutRow}>
                  <Text style={styles.payoutLabel}>Net profit</Text>
                  <Text style={[styles.payoutProfit, { color: payout.profit > 0 ? ILOWA_COLORS.truth : payout.profit < -0.001 ? ILOWA_COLORS.doubt : ILOWA_COLORS.textMuted }]}>
                    {payout.profit >= 0 ? '+' : ''}{payout.profit.toFixed(3)} SOL {payout.roi > 0.5 ? `(${payout.roi.toFixed(0)}% ROI)` : ''}
                  </Text>
                </View>
                <View style={styles.payoutRow}>
                  <Text style={styles.payoutLabel}>Platform fee</Text>
                  <Text style={[styles.payoutLabel, { color: ILOWA_COLORS.textMuted }]}>{payout.fee.toFixed(4)} SOL (0.5%)</Text>
                </View>
                {payout.isFirstBet && (
                  <Text style={[styles.payoutShift, { color: ILOWA_COLORS.gold }]}>
                    First bet on this side — your ROI grows as bets come in on {betSide === 'yes' ? 'NO' : 'YES'}
                  </Text>
                )}
                {shiftLabel !== '' && <Text style={styles.payoutShift}>Your bet moves {betSide.toUpperCase()} {shiftLabel}</Text>}
              </Animated.View>
            )}
            {market.isLight && <PrivacyToggle value={isShielded} onChange={setIsShielded} disabled={placing} />}
            <View style={{ height: 14 }} />
            <Pressable
              style={[styles.placeBetButton, (!betSide || placing || !wallet.connected || effectiveAmount <= 0) && styles.placeBetDisabled]}
              disabled={!betSide || placing || !wallet.connected || effectiveAmount <= 0}
              onPress={handlePlaceBet}>
              {placing ? <ActivityIndicator size="small" color={ILOWA_COLORS.deepBlack} /> : (
                <Text style={styles.placeBetText}>
                  {!wallet.connected ? 'Connect Wallet to Bet' : betSide ? `Bet ${effectiveAmount > 0 ? effectiveAmount : '?'} SOL on ${betSide.toUpperCase()}` : 'Select YES or NO'}
                </Text>
              )}
            </Pressable>
          </Animated.View>
        )}

        {canResolve && (
          <Animated.View entering={FadeInDown.delay(260).duration(400)} style={styles.resolveSection}>
            <Text style={styles.resolveTitle}>Resolve Market</Text>
            <Text style={styles.resolveSubtitle}>You created this market. Settle it now.</Text>
            <View style={styles.resolveButtons}>
              <Pressable style={[styles.resolveBtn, { backgroundColor: ILOWA_COLORS.truth }]}
                onPress={() => handleResolve(true)} disabled={resolving}>
                {resolving ? <ActivityIndicator size="small" color={ILOWA_COLORS.deepBlack} />
                  : <Text style={styles.resolveBtnText}>✓ YES</Text>}
              </Pressable>
              <Pressable style={[styles.resolveBtn, styles.resolveBtnNo]}
                onPress={() => handleResolve(false)} disabled={resolving}>
                <Text style={[styles.resolveBtnText, { color: ILOWA_COLORS.textPrimary }]}>✗ NO</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {canClaim && (
          <Animated.View entering={FadeInDown.delay(260).duration(400)} style={styles.claimSection}>
            <Text style={styles.claimTitle}>Settled: {market.outcome === 'yes' ? 'YES ✓' : 'NO ✗'}</Text>
            <Text style={styles.claimSubtitle}>Bet on the winning side? Claim your payout.</Text>
            <Pressable style={styles.claimButton} onPress={handleClaim} disabled={claiming}>
              {claiming ? <ActivityIndicator size="small" color={ILOWA_COLORS.deepBlack} />
                : <Text style={styles.claimButtonText}>Claim Winnings</Text>}
            </Pressable>
          </Animated.View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ILOWA_COLORS.deepBlack },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12, gap: 12,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Sora-Bold', fontSize: 18, color: ILOWA_COLORS.textPrimary, flex: 1 },
  headerBadges: { flexDirection: 'row', gap: 6 },
  lightBadge: { backgroundColor: 'rgba(0,217,255,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  lightBadgeText: { fontFamily: 'Sora', fontSize: 10, color: ILOWA_COLORS.cyan },
  privateBadge: { backgroundColor: 'rgba(139,92,246,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  privateBadgeText: { fontSize: 12 },
  scrollContent: { paddingHorizontal: 20 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  categoryBadge: { backgroundColor: 'rgba(255,215,0,0.12)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  categoryText: { fontFamily: 'Sora', fontSize: 11, color: ILOWA_COLORS.gold, textTransform: 'uppercase', letterSpacing: 0.5 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontFamily: 'Sora-Bold', fontSize: 11, letterSpacing: 0.4 },
  question: { fontFamily: 'Sora-Bold', fontSize: 21, color: ILOWA_COLORS.textPrimary, lineHeight: 29, marginBottom: 8 },
  meta: { fontFamily: 'Inter', fontSize: 12, color: ILOWA_COLORS.textMuted, marginBottom: 20 },
  poolCard: { backgroundColor: ILOWA_COLORS.cardDark, borderRadius: 16, padding: 20, marginBottom: 14 },
  poolHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  poolTitle: { fontFamily: 'Sora-SemiBold', fontSize: 13, color: ILOWA_COLORS.textSecondary },
  poolTotal: { fontFamily: 'Sora-Bold', fontSize: 17, color: ILOWA_COLORS.gold },
  poolBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  yesBar: { backgroundColor: ILOWA_COLORS.truth, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
  noBar:  { backgroundColor: ILOWA_COLORS.doubt, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  poolLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  poolPercent: { fontFamily: 'Sora-Bold', fontSize: 14, marginBottom: 2 },
  poolAmount:  { fontFamily: 'Inter', fontSize: 12, color: ILOWA_COLORS.textMuted },
  oracleCard: {
    backgroundColor: 'rgba(139,92,246,0.08)', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)', marginBottom: 14,
  },
  oracleTitle: { fontFamily: 'Sora-SemiBold', fontSize: 13, color: ILOWA_COLORS.purple, marginBottom: 6 },
  oracleLine:  { fontFamily: 'Inter', fontSize: 12, color: ILOWA_COLORS.textSecondary, marginBottom: 2 },
  betSection: {
    backgroundColor: ILOWA_COLORS.cardDark, borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: 'rgba(0,217,255,0.12)', marginBottom: 14,
  },
  betTitle: { fontFamily: 'Sora-SemiBold', fontSize: 16, color: ILOWA_COLORS.textPrimary, marginBottom: 14 },
  betSides: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  betSideButton: {
    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  betSideYesActive: { backgroundColor: ILOWA_COLORS.truth, borderColor: ILOWA_COLORS.truth },
  betSideNoActive:  { backgroundColor: ILOWA_COLORS.doubt, borderColor: ILOWA_COLORS.doubt },
  betSideText: { fontFamily: 'Sora-Bold', fontSize: 16, color: ILOWA_COLORS.textSecondary },
  betSideProb: { fontFamily: 'Inter', fontSize: 11, color: ILOWA_COLORS.textMuted, marginTop: 2 },
  amountRow: { flexDirection: 'row', gap: 6, marginBottom: 14, alignItems: 'center' },
  amountChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  amountChipActive: { backgroundColor: ILOWA_COLORS.cyan },
  amountText: { fontFamily: 'Sora', fontSize: 12, color: ILOWA_COLORS.textSecondary },
  amountTextActive: { color: ILOWA_COLORS.deepBlack, fontFamily: 'Sora-Bold' },
  customInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 9,
    fontFamily: 'Inter', fontSize: 12, color: ILOWA_COLORS.textPrimary, textAlign: 'center',
  },
  payoutCard: {
    backgroundColor: 'rgba(0,217,255,0.07)', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(0,217,255,0.15)', marginBottom: 14,
  },
  payoutRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  payoutLabel: { fontFamily: 'Inter', fontSize: 12, color: ILOWA_COLORS.textMuted },
  payoutValue: { fontFamily: 'Sora-Bold', fontSize: 14, color: ILOWA_COLORS.cyan },
  payoutProfit: { fontFamily: 'Sora-SemiBold', fontSize: 13 },
  payoutShift:  { fontFamily: 'Inter', fontSize: 11, color: ILOWA_COLORS.textMuted, marginTop: 4 },
  placeBetButton: { backgroundColor: ILOWA_COLORS.cyan, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  placeBetDisabled: { backgroundColor: 'rgba(255,255,255,0.06)' },
  placeBetText: { fontFamily: 'Sora-Bold', fontSize: 15, color: ILOWA_COLORS.deepBlack },
  resolveSection: {
    backgroundColor: ILOWA_COLORS.cardDark, borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)', marginBottom: 14,
  },
  resolveTitle:    { fontFamily: 'Sora-SemiBold', fontSize: 15, color: ILOWA_COLORS.textPrimary, marginBottom: 4 },
  resolveSubtitle: { fontFamily: 'Inter', fontSize: 12, color: ILOWA_COLORS.textMuted, marginBottom: 14 },
  resolveButtons:  { flexDirection: 'row', gap: 10 },
  resolveBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  resolveBtnNo: { backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: ILOWA_COLORS.doubt },
  resolveBtnText: { fontFamily: 'Sora-Bold', fontSize: 14, color: ILOWA_COLORS.deepBlack },
  claimSection: {
    backgroundColor: ILOWA_COLORS.cardDark, borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)', marginBottom: 14,
  },
  claimTitle:    { fontFamily: 'Sora-Bold', fontSize: 15, color: ILOWA_COLORS.gold, marginBottom: 4 },
  claimSubtitle: { fontFamily: 'Inter', fontSize: 12, color: ILOWA_COLORS.textMuted, marginBottom: 14 },
  claimButton: {
    backgroundColor: ILOWA_COLORS.gold, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
  },
  claimButtonText: { fontFamily: 'Sora-Bold', fontSize: 14, color: ILOWA_COLORS.deepBlack },
});
