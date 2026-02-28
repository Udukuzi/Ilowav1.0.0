import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Alert, ActivityIndicator, Share,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowLeft, Calendar, MapPin, Users, Ticket, Share2 } from 'lucide-react-native';
import { ILOWA_COLORS } from '../../theme/colors';
import { useWallet } from '../../hooks/useWallet';
import {
  kydClient, KYDEvent, TicketTier,
  formatTicketPrice, getTicketAvailability, formatEventDate,
} from '../../lib/ticketing/kyd';
import { createTicketBlink, getBlinkShareText } from '../../lib/actions/orbitflare';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const wallet = useWallet();

  const [event, setEvent] = useState<KYDEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (!id) return;
    kydClient.getEvent(id).then(evt => {
      setEvent(evt);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const handlePurchase = async () => {
    if (!event || !selectedTier || !wallet.connected) {
      if (!wallet.connected) Alert.alert('Wallet Required', 'Connect your wallet to buy tickets.');
      return;
    }

    const tier = event.tiers.find(t => t.id === selectedTier);
    if (!tier) return;

    setPurchasing(true);
    try {
      const result = await kydClient.purchaseTicket(
        event.id,
        selectedTier,
        wallet.publicKey!.toBase58(),
        wallet.signAndSendTransaction,
      );

      if (result.success) {
        Alert.alert(
          'Ticket Purchased!',
          `${tier.name} for ${event.name}\nTx: ${result.txSignature?.slice(0, 16)}...`,
          [{ text: 'OK', onPress: () => router.canGoBack() ? router.back() : router.replace('/(tabs)/home') }]
        );
      } else {
        Alert.alert('Purchase Failed', result.error || 'Something went wrong.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Transaction failed.');
    } finally {
      setPurchasing(false);
    }
  };

  const shareTierBlink = async (tier: TicketTier) => {
    if (!event) return;
    const blink = createTicketBlink({
      eventId: event.id, eventName: event.name,
      tierId: tier.id, tierName: tier.name, price: tier.price,
    });
    try { await Share.share({ message: getBlinkShareText(blink) }); } catch {}
  };

  if (loading) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={ILOWA_COLORS.cyan} style={{ marginTop: 80 }} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[s.root, { paddingTop: insets.top, padding: 20 }]}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/home')} style={s.back}>
          <ArrowLeft size={24} color={ILOWA_COLORS.textPrimary} />
        </Pressable>
        <Text style={s.empty}>Event not found</Text>
      </View>
    );
  }

  const soldPct = Math.round((event.soldCount / event.totalCapacity) * 100);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {/* Nav */}
        <View style={s.nav}>
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/home')} style={s.back}>
            <ArrowLeft size={24} color={ILOWA_COLORS.textPrimary} />
          </Pressable>
          <Text style={s.navTitle} numberOfLines={1}>Event</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Hero */}
        <Animated.View entering={FadeInDown.delay(100)} style={s.hero}>
          <Text style={s.eventName}>{event.name}</Text>
          <Text style={s.eventDesc}>{event.description}</Text>

          <View style={s.metaBlock}>
            <Row icon={<Calendar size={15} color={ILOWA_COLORS.gold} />} text={formatEventDate(event.startTime)} />
            <Row icon={<MapPin size={15} color={ILOWA_COLORS.textMuted} />} text={`${event.venue}, ${event.location}`} />
            <Row icon={<Users size={15} color={ILOWA_COLORS.cyan} />} text={`${event.soldCount}/${event.totalCapacity} sold (${soldPct}%)`} />
          </View>

          <View style={s.bar}><View style={[s.barFill, { width: `${Math.min(soldPct, 100)}%` }]} /></View>
        </Animated.View>

        {/* Tiers */}
        <Animated.View entering={FadeInDown.delay(200)}>
          <Text style={s.secLabel}>Select Ticket</Text>
          {event.tiers.map(tier => {
            const avail = getTicketAvailability(tier);
            const picked = selectedTier === tier.id;
            const gone = avail.status === 'sold_out';
            return (
              <Pressable
                key={tier.id}
                style={[s.tier, picked && s.tierPicked, gone && { opacity: 0.45 }]}
                onPress={() => !gone && setSelectedTier(tier.id)}
                disabled={gone}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.tierName, picked && { color: ILOWA_COLORS.gold }]}>{tier.name}</Text>
                  <Text style={s.tierDesc}>{tier.description}</Text>
                  {tier.benefits.length > 0 && (
                    <Text style={s.tierBenefits}>{tier.benefits.slice(0, 3).join(' · ')}</Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[s.tierPrice, picked && { color: ILOWA_COLORS.gold }]}>{formatTicketPrice(tier.price)}</Text>
                  <Text style={[s.tierAvail, avail.status === 'low' && { color: '#F59E0B' }, gone && { color: '#EF4444' }]}>
                    {gone ? 'Sold Out' : `${avail.available} left`}
                  </Text>
                  <Pressable onPress={() => shareTierBlink(tier)} hitSlop={8} style={s.shareRow}>
                    <Share2 size={13} color={ILOWA_COLORS.cyan} />
                    <Text style={s.shareText}>Blink</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })}
        </Animated.View>

        {/* Buy button */}
        {selectedTier && (
          <Animated.View entering={FadeInDown.delay(50)}>
            <Pressable
              style={[s.buyBtn, purchasing && { opacity: 0.6 }]}
              onPress={handlePurchase}
              disabled={purchasing}
            >
              {purchasing ? (
                <ActivityIndicator size="small" color={ILOWA_COLORS.deepBlack} />
              ) : (
                <>
                  <Ticket size={18} color={ILOWA_COLORS.deepBlack} />
                  <Text style={s.buyText}>
                    Purchase — {formatTicketPrice(event.tiers.find(t => t.id === selectedTier)?.price || 0)}
                  </Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

// tiny helper to avoid repeating the row pattern
function Row({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {icon}
      <Text style={{ fontFamily: 'Inter', fontSize: 12, color: ILOWA_COLORS.textSecondary }}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: ILOWA_COLORS.deepBlack },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontFamily: 'Sora-Bold', fontSize: 18, color: ILOWA_COLORS.textPrimary },
  empty: { fontFamily: 'Inter', fontSize: 14, color: ILOWA_COLORS.textMuted, textAlign: 'center', marginTop: 40 },

  hero: {
    backgroundColor: ILOWA_COLORS.cardDark, borderRadius: 18, padding: 20, gap: 10,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.1)', marginBottom: 20,
  },
  eventName: { fontFamily: 'Sora-Bold', fontSize: 22, color: ILOWA_COLORS.textPrimary },
  eventDesc: { fontFamily: 'Inter', fontSize: 13, color: ILOWA_COLORS.textSecondary, lineHeight: 20 },
  metaBlock: { gap: 6, marginTop: 4 },
  bar: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: ILOWA_COLORS.gold, borderRadius: 2 },

  secLabel: { fontFamily: 'Sora-SemiBold', fontSize: 15, color: ILOWA_COLORS.textPrimary, marginBottom: 10 },
  tier: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  tierPicked: { borderColor: ILOWA_COLORS.gold, backgroundColor: 'rgba(255,215,0,0.06)' },
  tierName: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: ILOWA_COLORS.textPrimary },
  tierDesc: { fontFamily: 'Inter', fontSize: 11, color: ILOWA_COLORS.textMuted, marginTop: 2 },
  tierBenefits: { fontFamily: 'Inter', fontSize: 10, color: ILOWA_COLORS.cyan, marginTop: 3 },
  tierPrice: { fontFamily: 'Sora-Bold', fontSize: 16, color: ILOWA_COLORS.textPrimary },
  tierAvail: { fontFamily: 'Inter', fontSize: 10, color: ILOWA_COLORS.textMuted },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  shareText: { fontFamily: 'Inter', fontSize: 10, color: ILOWA_COLORS.cyan },

  buyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ILOWA_COLORS.gold, borderRadius: 14, paddingVertical: 16, marginTop: 16,
  },
  buyText: { fontFamily: 'Sora-Bold', fontSize: 15, color: ILOWA_COLORS.deepBlack },
});
