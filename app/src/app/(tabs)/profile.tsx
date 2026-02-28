import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Zap, Crown, Mic2, Coins, Shield, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import type { LucideIcon } from 'lucide-react-native';
import { ILOWA_COLORS } from '../../theme/colors';
import { ElderAvatar } from '../../components/ElderAvatar';
import { NFTGallery } from '../../components/NFTGallery';
import { useWallet } from '../../hooks/useWallet';
import { useRegion } from '../../hooks/useRegion';
import { useMarkets } from '../../hooks/useMarkets';
import { useGuardians } from '../../hooks/useGuardians';
import { PointsDisplay } from '../../components/Points/PointsDisplay';

const MENU_ROUTES: Record<string, string> = {
  'Region & Elder':   '/settings/region',
  'Voice & Language': '/settings/voice',
  'AI & Privacy':     '/settings/ai-privacy',
  'Governance':       '/governance',
  'Elder Guardians':  '/settings/elder-guardian',
  'Social Recovery':  '/settings/social-recovery',
  'Security':         '/settings/security',
  'About Ilowa':      '/settings/about',
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const wallet = useWallet();
  const { activeElder, elderColors } = useRegion();
  const { markets } = useMarkets(wallet);
  const guardians = useGuardians(wallet);

  // Security feature status
  const [hasBiometric, setHasBiometric] = useState(false);
  const [hasVoiceBio, setHasVoiceBio] = useState(false);

  useEffect(() => {
    // Load guardian state from chain when wallet connects
    if (wallet.connected) guardians.loadGuardianState();

    // Check device biometric capability + enrollment
    LocalAuthentication.hasHardwareAsync().then(hw => {
      if (hw) LocalAuthentication.isEnrolledAsync().then(setHasBiometric);
    });

    // Check if voice biometric sample exists in SecureStore
    SecureStore.getItemAsync('ilowa_voice_bio_enrolled').then(v => setHasVoiceBio(v === 'true'));
  }, [wallet.connected]);

  // Count markets created by this wallet (strip demo entries)
  const myPubkeyShort = wallet.publicKey?.toBase58().slice(0, 8) ?? null;
  const myMarkets = myPubkeyShort
    ? markets.filter(m => !m.id.startsWith('demo-') && m.creator.startsWith(myPubkeyShort))
    : [];

  const resolvedWins = myMarkets.filter(m => m.status === 'resolved' && m.outcome != null).length;
  const winRate = myMarkets.length > 0 ? Math.round((resolvedWins / myMarkets.length) * 100) : null;

  const stats: { label: string; value: string; Icon: LucideIcon; gradient: [string, string] }[] = [
    { label: 'Predictions', value: String(myMarkets.length), Icon: Zap, gradient: ['#FFD700', '#FF8C00'] },
    { label: 'Win Rate', value: winRate != null ? `${winRate}%` : '—', Icon: Crown, gradient: ['#8B5CF6', '#EC4899'] },
    { label: 'Voice NFTs', value: '0', Icon: Mic2, gradient: ['#00D9FF', '#0099FF'] },
    { label: 'SOL Earned', value: '0', Icon: Coins, gradient: ['#FFD700', '#FFA500'] },
  ];

  const menuItems = [
    { label: 'Governance', icon: 'people-circle' as const, color: '#10B981' },
    { label: 'Elder Guardians', icon: 'shield-checkmark' as const, color: ILOWA_COLORS.gold },
    { label: 'Social Recovery', icon: 'people' as const, color: ILOWA_COLORS.purple },
    { label: 'Voice NFT Gallery', icon: 'images' as const, color: ILOWA_COLORS.cyan },
    { label: 'Region & Elder', icon: 'globe' as const, color: '#10B981' },
    { label: 'Voice & Language', icon: 'language' as const, color: '#06B6D4' },
    { label: 'AI & Privacy', icon: 'sparkles' as const, color: '#8B5CF6' },
    { label: 'Security', icon: 'finger-print' as const, color: ILOWA_COLORS.gold },
    { label: 'About Ilowa', icon: 'information-circle' as const, color: ILOWA_COLORS.textMuted },
  ];

  const handleMenuPress = (label: string) => {
    const route = MENU_ROUTES[label];
    if (route) {
      router.push(route as any);
    } else {
      Alert.alert(label, 'Coming soon');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </Animated.View>

        {/* Profile Card */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.profileCard}>
          <ElderAvatar elder={activeElder} size={72} showGlow />
          <View style={styles.profileInfo}>
            <Text style={styles.walletLabel}>Wallet</Text>
            <Text style={styles.walletAddress}>
              {wallet.connected ? wallet.shortAddress : 'Not Connected'}
            </Text>
            {wallet.connected && (
              <View style={styles.tierBadge}>
                <Text style={styles.tierText}>
                  {wallet.userTier === 'stealth' ? '🥷 Stealth' : wallet.userTier === 'pro' ? '⭐ Pro' : '🆓 Free'}
                </Text>
              </View>
            )}
            {wallet.connected ? (
              <Pressable
                style={[styles.connectButton, { backgroundColor: ILOWA_COLORS.doubt }]}
                onPress={() => wallet.disconnect()}
              >
                <Ionicons name="log-out" size={14} color={ILOWA_COLORS.deepBlack} />
                <Text style={styles.connectText}>Disconnect</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.connectButton, { backgroundColor: elderColors.primary }]}
                onPress={() => wallet.connect().catch((e: Error) => Alert.alert('Error', e.message))}
              >
                <Ionicons name="wallet" size={14} color={ILOWA_COLORS.deepBlack} />
                <Text style={styles.connectText}>Connect Wallet</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>

        {/* Stats Grid */}
        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.statsGrid}>
          {stats.map((stat, i) => (
            <View key={i} style={styles.statCard}>
              <LinearGradient
                colors={stat.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.statIconGradient}
              >
                <stat.Icon size={20} color="white" strokeWidth={2.5} />
              </LinearGradient>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Points & Airdrop */}
        {wallet.connected && wallet.publicKey && (
          <Animated.View entering={FadeInDown.delay(350).duration(500)} style={{ marginBottom: 20 }}>
            <PointsDisplay userWallet={wallet.publicKey.toBase58()} />
          </Animated.View>
        )}

        {/* Security Status */}
        <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.securityCard}>
          <View style={styles.securityHeader}>
            <Ionicons name="shield" size={20} color={ILOWA_COLORS.gold} />
            <Text style={styles.securityTitle}>Security Status</Text>
          </View>
          <View style={styles.securityItems}>
            <SecurityItem label="Elder Guardian" status={guardians.elderGuardian?.isInitialized ? 'active' : 'not_setup'} />
            <SecurityItem label="Social Recovery" status={guardians.socialRecovery ? 'active' : 'not_setup'} />
            <SecurityItem label="Biometric Auth" status={hasBiometric ? 'active' : 'not_setup'} />
            <SecurityItem label="Voice Biometrics" status={hasVoiceBio ? 'active' : 'not_setup'} />
          </View>
          <Pressable
            style={styles.setupButton}
            onPress={() => {
              if (!wallet.connected) {
                Alert.alert('Connect Wallet', 'Please connect your wallet to set up security.');
                return;
              }
              // Route to the security setup — menu item handles it
              handleMenuPress('Security');
            }}
          >
            <Text style={styles.setupButtonText}>Set Up Security</Text>
          </Pressable>
        </Animated.View>

        {/* NFT Gallery */}
        <Animated.View entering={FadeInDown.delay(450).duration(500)} style={{ marginTop: 16 }}>
          <NFTGallery />
        </Animated.View>

        {/* Menu */}
        <Animated.View entering={FadeInDown.delay(500).duration(500)} style={styles.menuSection}>
          {menuItems.map((item, i) => (
            <Pressable key={i} style={styles.menuItem} onPress={() => handleMenuPress(item.label)}>
              <View style={[styles.menuIcon, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={ILOWA_COLORS.textMuted} />
            </Pressable>
          ))}
        </Animated.View>

        {/* Version */}
        <View style={styles.version}>
          <Text style={styles.versionText}>Ilowa v1.0.0</Text>
          <Text style={styles.versionSubtext}>The Voice of the Global South</Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function SecurityItem({ label, status }: { label: string; status: 'active' | 'not_setup' }) {
  return (
    <View style={secStyles.item}>
      <View
        style={[
          secStyles.dot,
          { backgroundColor: status === 'active' ? ILOWA_COLORS.truth : ILOWA_COLORS.textMuted },
        ]}
      />
      <Text style={secStyles.label}>{label}</Text>
      <Text
        style={[
          secStyles.status,
          { color: status === 'active' ? ILOWA_COLORS.truth : ILOWA_COLORS.doubt },
        ]}
      >
        {status === 'active' ? 'Active' : 'Not Set Up'}
      </Text>
    </View>
  );
}

const secStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: ILOWA_COLORS.textSecondary,
    flex: 1,
  },
  status: {
    fontFamily: 'Sora',
    fontSize: 11,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ILOWA_COLORS.deepBlack,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    paddingVertical: 16,
  },
  headerTitle: {
    fontFamily: 'Sora-Bold',
    fontSize: 28,
    color: ILOWA_COLORS.textPrimary,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 16,
    padding: 20,
    gap: 16,
    marginBottom: 20,
  },
  profileInfo: {
    flex: 1,
  },
  walletLabel: {
    fontFamily: 'Sora',
    fontSize: 11,
    color: ILOWA_COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  walletAddress: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: ILOWA_COLORS.textSecondary,
    marginBottom: 6,
  },
  tierBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 8,
  },
  tierText: {
    fontFamily: 'Sora',
    fontSize: 11,
    color: ILOWA_COLORS.purple,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  connectText: {
    fontFamily: 'Sora-Bold',
    fontSize: 12,
    color: ILOWA_COLORS.deepBlack,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    width: '48%',
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    flexGrow: 1,
    flexBasis: '45%',
  },
  statIconGradient: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontFamily: 'Sora-Bold',
    fontSize: 22,
    color: ILOWA_COLORS.textPrimary,
  },
  statLabel: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: ILOWA_COLORS.textMuted,
  },
  securityCard: {
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.15)',
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  securityTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 16,
    color: ILOWA_COLORS.textPrimary,
  },
  securityItems: {
    marginBottom: 16,
  },
  setupButton: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  setupButtonText: {
    fontFamily: 'Sora-Bold',
    fontSize: 13,
    color: ILOWA_COLORS.gold,
  },
  menuSection: {
    gap: 4,
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 15,
    color: ILOWA_COLORS.textPrimary,
    flex: 1,
  },
  aboutCard: {
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  aboutTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 15,
    color: ILOWA_COLORS.textPrimary,
    marginBottom: 8,
  },
  aboutText: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: ILOWA_COLORS.textSecondary,
    lineHeight: 20,
  },
  version: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    fontFamily: 'Sora',
    fontSize: 12,
    color: ILOWA_COLORS.textMuted,
  },
  versionSubtext: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: ILOWA_COLORS.textMuted,
    opacity: 0.6,
    marginTop: 2,
  },
});
