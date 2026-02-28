import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ILOWA_COLORS } from '../../theme/colors';

export default function GuardiansScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="shield" size={48} color={ILOWA_COLORS.purple} />
        </View>

        <Text style={styles.title}>Elder Guardian Protection</Text>
        <Text style={styles.subtitle}>
          Choose 5 trusted people who can help recover your wallet if you lose access. 3 of 5 must approve.
        </Text>

        <View style={styles.guardianSlots}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Pressable key={i} style={styles.guardianSlot}>
              <View style={styles.guardianIcon}>
                <Ionicons name="person-add" size={20} color={ILOWA_COLORS.textMuted} />
              </View>
              <Text style={styles.guardianLabel}>Guardian {i}</Text>
              <Text style={styles.guardianStatus}>Tap to add</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={18} color={ILOWA_COLORS.cyan} />
          <Text style={styles.infoText}>
            Guardians can be Ilowa users, family, or friends with Solana wallets. You can change them later in Settings.
          </Text>
        </View>
      </Animated.View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={styles.setupButton}
          onPress={() => router.replace('/(tabs)/home')}
        >
          <Text style={styles.setupText}>Set Up Later</Text>
        </Pressable>
        <Pressable
          style={styles.enterButton}
          onPress={() => router.replace('/(tabs)/home')}
        >
          <Text style={styles.enterText}>Enter Ilowa</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ILOWA_COLORS.deepBlack, paddingHorizontal: 24 },
  content: { flex: 1, alignItems: 'center', paddingTop: 20 },
  iconCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(139,92,246,0.1)', alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontFamily: 'Sora-Bold', fontSize: 24, color: ILOWA_COLORS.textPrimary,
    textAlign: 'center', marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter', fontSize: 15, color: ILOWA_COLORS.textSecondary,
    textAlign: 'center', lineHeight: 22, marginBottom: 28,
  },
  guardianSlots: { alignSelf: 'stretch', gap: 10, marginBottom: 20 },
  guardianSlot: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: ILOWA_COLORS.cardDark, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderStyle: 'dashed',
  },
  guardianIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center',
  },
  guardianLabel: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: ILOWA_COLORS.textPrimary, flex: 1 },
  guardianStatus: { fontFamily: 'Inter', fontSize: 12, color: ILOWA_COLORS.textMuted },
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(0,217,255,0.06)', borderRadius: 12, padding: 14,
    alignSelf: 'stretch',
  },
  infoText: { fontFamily: 'Inter', fontSize: 13, color: ILOWA_COLORS.textSecondary, lineHeight: 20, flex: 1 },
  footer: { gap: 10, paddingTop: 12 },
  setupButton: { paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: ILOWA_COLORS.cardDark },
  setupText: { fontFamily: 'Sora', fontSize: 15, color: ILOWA_COLORS.textSecondary },
  enterButton: { paddingVertical: 16, alignItems: 'center', borderRadius: 14, backgroundColor: ILOWA_COLORS.gold },
  enterText: { fontFamily: 'Sora-Bold', fontSize: 16, color: ILOWA_COLORS.deepBlack },
});
