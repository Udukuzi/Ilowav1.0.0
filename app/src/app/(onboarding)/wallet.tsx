import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ILOWA_COLORS } from '../../theme/colors';
import { useWallet } from '../../hooks/useWallet';

export default function WalletScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const wallet = useWallet();
  const [busy, setBusy] = useState(false);

  const handleConnect = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await wallet.connect();
      router.push('/(onboarding)/region');
    } catch (err: any) {
      Alert.alert('Connection Failed', err?.message ?? 'Could not connect wallet. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="wallet" size={48} color={ILOWA_COLORS.gold} />
        </View>

        <Text style={styles.title}>Connect Your Wallet</Text>
        <Text style={styles.subtitle}>
          Ilowa uses your Solana wallet for identity. No email, no phone number — just your wallet.
        </Text>

        <View style={styles.features}>
          <FeatureRow icon="shield-checkmark" text="No seed phrases to remember" />
          <FeatureRow icon="finger-print" text="Biometric-secured on device" />
          <FeatureRow icon="people" text="Elder Guardian recovery if lost" />
          <FeatureRow icon="lock-closed" text="Military-grade encryption" />
        </View>
      </Animated.View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={[styles.connectButton, busy && styles.connectButtonDisabled]}
          onPress={handleConnect}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator size="small" color={ILOWA_COLORS.deepBlack} />
          ) : (
            <Ionicons name="wallet" size={20} color={ILOWA_COLORS.deepBlack} />
          )}
          <Text style={styles.connectText}>
            {busy ? 'Connecting...' : 'Connect Solana Wallet'}
          </Text>
        </Pressable>

        {__DEV__ && (
          <Pressable
            style={styles.devSkip}
            onPress={() => router.push('/(onboarding)/region')}
          >
            <Text style={styles.devSkipText}>Skip — Dev Mode</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function FeatureRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.featureRow}>
      <Ionicons name={icon} size={20} color={ILOWA_COLORS.gold} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ILOWA_COLORS.deepBlack, paddingHorizontal: 24 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  iconCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,215,0,0.1)', alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontFamily: 'Sora-Bold', fontSize: 28, color: ILOWA_COLORS.textPrimary,
    textAlign: 'center', marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter', fontSize: 15, color: ILOWA_COLORS.textSecondary,
    textAlign: 'center', lineHeight: 22, marginBottom: 32,
  },
  features: { alignSelf: 'stretch', gap: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureText: { fontFamily: 'Inter', fontSize: 14, color: ILOWA_COLORS.textPrimary },
  footer: { gap: 12, paddingTop: 12 },
  connectButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ILOWA_COLORS.gold, paddingVertical: 16, borderRadius: 14,
  },
  connectButtonDisabled: { opacity: 0.7 },
  connectText: { fontFamily: 'Sora-Bold', fontSize: 16, color: ILOWA_COLORS.deepBlack },
  devSkip: { paddingVertical: 12, alignItems: 'center' },
  devSkipText: { fontFamily: 'Inter', fontSize: 13, color: ILOWA_COLORS.textMuted, opacity: 0.5 },
});
