/**
 * About Ilowa
 * 
 * App description, version info, tech stack summary, and links.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Radio, Shield, Brain, Users, Globe, Coins } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ILOWA_COLORS } from '../../theme/colors';

const FEATURES = [
  {
    Icon: Radio,
    title: 'Decentralized Radio',
    desc: 'Live streaming via Livepeer, offline via IPFS, permanent archive on Arweave. Real radio stations from 9 Global South regions.',
    color: '#00D9FF',
  },
  {
    Icon: Coins,
    title: 'Prediction Markets',
    desc: 'On-chain prediction markets on Solana with Light Protocol compression and Arcium MPC shielded bets for private wagers.',
    color: '#FFD700',
  },
  {
    Icon: Brain,
    title: 'AI Elders',
    desc: 'Nine regional AI Elders powered by Cohere Aya (101 languages), GLM-5 (reasoning), and Lelapa (African languages). Privacy-preserved via federated learning.',
    color: '#8B5CF6',
  },
  {
    Icon: Shield,
    title: 'Privacy & Security',
    desc: 'Arcium MPC encryption for private bets, Elder Guardian timelock recovery, Social Recovery (3-of-5 multisig), biometric and voice authentication.',
    color: '#10B981',
  },
  {
    Icon: Users,
    title: 'Social Layer',
    desc: 'XMTP E2EE messaging, Tapestry on-chain social graph, Audius music integration, and community governance.',
    color: '#F59E0B',
  },
  {
    Icon: Globe,
    title: 'Built for the Global South',
    desc: '2.5 billion people across West Africa, East Africa, Southern Africa, Latin America, South Asia, Southeast Asia, MENA, Caribbean, and Pacific regions.',
    color: '#EC4899',
  },
];

export default function AboutIlowa() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={ILOWA_COLORS.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>About Ilowa</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Hero */}
      <Animated.View entering={FadeInDown.delay(100)} style={styles.heroCard}>
        <Text style={styles.heroTitle}>Ilowa</Text>
        <Text style={styles.heroSubtitle}>The Voice of the Global South</Text>
        <Text style={styles.heroDesc}>
          Ilowa is a voice-native, AI-powered cultural SocialFi radio platform. We combine prediction markets, end-to-end encrypted messaging, decentralized radio, and privacy-first AI Elders to empower 2.5 billion people to earn, learn, and connect — in their own languages, on their own terms.
        </Text>
      </Animated.View>

      {/* Features */}
      {FEATURES.map((feat, i) => (
        <Animated.View key={i} entering={FadeInDown.delay(150 + i * 60)} style={styles.featureCard}>
          <View style={[styles.featureIcon, { backgroundColor: `${feat.color}15` }]}>
            <feat.Icon size={22} color={feat.color} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.featureTitle}>{feat.title}</Text>
            <Text style={styles.featureDesc}>{feat.desc}</Text>
          </View>
        </Animated.View>
      ))}

      {/* Tech Stack */}
      <Animated.View entering={FadeInDown.delay(550)} style={styles.techCard}>
        <Text style={styles.techTitle}>Technology Stack</Text>
        {[
          'Solana (Anchor smart contracts)',
          'React Native (Expo)',
          'Light Protocol (compressed accounts)',
          'Arcium MPC (private bets)',
          'XMTP (E2EE messaging)',
          'Cohere Aya + GLM-5 + Lelapa AI',
          'Livepeer + IPFS + Arweave (radio)',
          'Tapestry (social graph)',
          'Gladia + Vosk (voice)',
          'Supabase (database)',
        ].map((tech, i) => (
          <Text key={i} style={styles.techItem}>• {tech}</Text>
        ))}
      </Animated.View>

      {/* Version */}
      <Animated.View entering={FadeInDown.delay(600)} style={styles.versionBlock}>
        <Text style={styles.versionText}>v1.0.0</Text>
        <Text style={styles.versionSub}>BantuBloomNetwork 2026 ©</Text>
      </Animated.View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ILOWA_COLORS.deepBlack },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Sora-Bold', fontSize: 20, color: ILOWA_COLORS.textPrimary },
  heroCard: {
    backgroundColor: ILOWA_COLORS.cardDark, borderRadius: 20, padding: 24,
    alignItems: 'center', gap: 8, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.1)',
  },
  heroTitle: {
    fontFamily: 'Sora-Bold', fontSize: 32, color: ILOWA_COLORS.gold,
    letterSpacing: 2,
  },
  heroSubtitle: {
    fontFamily: 'Sora', fontSize: 14, color: ILOWA_COLORS.textSecondary,
    letterSpacing: 1,
  },
  heroDesc: {
    fontFamily: 'Inter', fontSize: 14, color: ILOWA_COLORS.textSecondary,
    textAlign: 'center', lineHeight: 22, marginTop: 8,
  },
  featureCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: ILOWA_COLORS.cardDark, borderRadius: 14, padding: 16,
    marginBottom: 10,
  },
  featureIcon: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  featureTitle: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: ILOWA_COLORS.textPrimary, marginBottom: 4 },
  featureDesc: { fontFamily: 'Inter', fontSize: 12, color: ILOWA_COLORS.textSecondary, lineHeight: 18 },
  techCard: {
    backgroundColor: ILOWA_COLORS.cardDark, borderRadius: 14, padding: 20,
    marginTop: 10, marginBottom: 16, gap: 6,
  },
  techTitle: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: ILOWA_COLORS.textPrimary, marginBottom: 4 },
  techItem: { fontFamily: 'Inter', fontSize: 12, color: ILOWA_COLORS.textMuted, lineHeight: 20 },
  versionBlock: { alignItems: 'center', paddingVertical: 16 },
  versionText: { fontFamily: 'Sora', fontSize: 13, color: ILOWA_COLORS.textMuted },
  versionSub: { fontFamily: 'Inter', fontSize: 11, color: ILOWA_COLORS.textMuted, opacity: 0.6, marginTop: 2 },
});
