/**
 * Social Recovery Settings
 * 
 * 3-of-5 multisig recovery — assign 5 trusted wallets,
 * any 3 can approve recovery if owner loses access.
 */

import React, { useState, useEffect } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Users, UserPlus, Trash2, CheckCircle2 } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ILOWA_COLORS } from '../../theme/colors';
import { useWallet } from '../../hooks/useWallet';
import { useGuardians } from '../../hooks/useGuardians';

export default function SocialRecoverySettings() {
  const insets = useSafeAreaInsets();
  const wallet = useWallet();
  const { socialRecovery, loading, initSocialRecovery } = useGuardians(wallet);

  const [guardians, setGuardians] = useState<string[]>(['', '', '', '', '']);
  const [busy, setBusy] = useState(false);

  const updateGuardian = (index: number, value: string) => {
    const updated = [...guardians];
    updated[index] = value;
    setGuardians(updated);
  };

  const filledCount = guardians.filter(g => g.trim().length > 30).length;
  const allFilled = filledCount === 5;

  const handleSetup = async () => {
    if (!wallet.connected) {
      Alert.alert('Wallet Required', 'Connect your wallet first.');
      return;
    }
    if (!allFilled) {
      Alert.alert('Incomplete', 'All 5 guardian wallet addresses are required.');
      return;
    }

    // Basic validation — check they look like base58 pubkeys
    const trimmed = guardians.map(g => g.trim());
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed[i].length < 32 || trimmed[i].length > 44) {
        Alert.alert('Invalid Address', `Guardian ${i + 1} doesn't look like a valid Solana address.`);
        return;
      }
    }

    // No duplicates
    const unique = new Set(trimmed);
    if (unique.size !== 5) {
      Alert.alert('Duplicates', 'Each guardian must be a different wallet.');
      return;
    }

    setBusy(true);
    try {
      await initSocialRecovery(trimmed);
      Alert.alert(
        'Recovery Set Up',
        'Your 5 guardians have been registered on-chain. Any 3 of them can approve wallet recovery.'
      );
    } catch (e: any) {
      Alert.alert('Setup Failed', e?.message || 'Transaction failed. Check addresses and try again.');
    } finally {
      setBusy(false);
    }
  };

  const isActive = !!socialRecovery;

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
        <Text style={styles.headerTitle}>Social Recovery</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Explainer */}
      <Animated.View entering={FadeInDown.delay(100)} style={styles.explainer}>
        <Users size={32} color={ILOWA_COLORS.purple} strokeWidth={1.8} />
        <Text style={styles.explainerTitle}>Community-Backed Recovery</Text>
        <Text style={styles.explainerText}>
          Assign 5 trusted people as recovery guardians. If you lose wallet access, any 3 of the 5 can approve a recovery transaction to restore your account. No single person can recover alone.
        </Text>
      </Animated.View>

      {!wallet.connected ? (
        <Animated.View entering={FadeInDown.delay(200)} style={styles.card}>
          <Text style={styles.cardText}>Connect your wallet to set up Social Recovery.</Text>
        </Animated.View>
      ) : isActive ? (
        <Animated.View entering={FadeInDown.delay(200)} style={styles.card}>
          <View style={styles.activeHeader}>
            <CheckCircle2 size={20} color={ILOWA_COLORS.truth} />
            <Text style={styles.activeTitle}>Social Recovery Active</Text>
          </View>
          <Text style={styles.cardDesc}>
            {socialRecovery.guardians.length} guardians registered. Threshold: {socialRecovery.threshold} of {socialRecovery.guardians.length} approvals needed.
          </Text>
          {socialRecovery.guardians.map((g: string, i: number) => (
            <View key={i} style={styles.guardianRow}>
              <Text style={styles.guardianNum}>#{i + 1}</Text>
              <Text style={styles.guardianAddr}>{g.slice(0, 6)}...{g.slice(-4)}</Text>
            </View>
          ))}
          {socialRecovery.recoveryInProgress && (
            <View style={styles.recoveryBanner}>
              <Text style={styles.recoveryText}>
                Recovery in progress — {socialRecovery.approvals.length} of {socialRecovery.threshold} approvals received
              </Text>
            </View>
          )}
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInDown.delay(200)} style={styles.card}>
          <Text style={styles.cardLabel}>Assign 5 Guardian Wallets</Text>
          <Text style={styles.cardDesc}>
            Choose people you trust — family, close friends, community elders. They only have power when 3 agree together.
          </Text>

          {guardians.map((g, i) => (
            <View key={i} style={styles.inputRow}>
              <Text style={styles.inputLabel}>Guardian {i + 1}</Text>
              <TextInput
                style={styles.input}
                placeholder="Solana wallet address..."
                placeholderTextColor="#555"
                value={g}
                onChangeText={(v) => updateGuardian(i, v)}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          ))}

          <Text style={styles.counterText}>{filledCount}/5 guardians entered</Text>

          <Pressable
            style={[styles.primaryBtn, !allFilled && styles.primaryBtnDisabled]}
            onPress={handleSetup}
            disabled={!allFilled || busy}
          >
            {busy ? (
              <ActivityIndicator color={ILOWA_COLORS.deepBlack} />
            ) : (
              <Text style={styles.primaryBtnText}>Register Guardians On-Chain</Text>
            )}
          </Pressable>
        </Animated.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ILOWA_COLORS.deepBlack },
  content: { paddingHorizontal: 20, paddingBottom: 80 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Sora-Bold', fontSize: 20, color: ILOWA_COLORS.textPrimary },
  explainer: {
    backgroundColor: 'rgba(139,92,246,0.06)', borderRadius: 16, padding: 20,
    alignItems: 'center', gap: 10, marginBottom: 20, borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.12)',
  },
  explainerTitle: { fontFamily: 'Sora-SemiBold', fontSize: 16, color: ILOWA_COLORS.textPrimary },
  explainerText: {
    fontFamily: 'Inter', fontSize: 13, color: ILOWA_COLORS.textSecondary,
    textAlign: 'center', lineHeight: 20,
  },
  card: {
    backgroundColor: ILOWA_COLORS.cardDark, borderRadius: 16, padding: 20,
    marginBottom: 16, gap: 12,
  },
  cardLabel: { fontFamily: 'Sora-SemiBold', fontSize: 15, color: ILOWA_COLORS.textPrimary },
  cardDesc: { fontFamily: 'Inter', fontSize: 13, color: ILOWA_COLORS.textSecondary, lineHeight: 20 },
  cardText: { fontFamily: 'Inter', fontSize: 14, color: ILOWA_COLORS.textMuted, textAlign: 'center' },
  activeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeTitle: { fontFamily: 'Sora-SemiBold', fontSize: 16, color: ILOWA_COLORS.truth },
  guardianRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 10,
  },
  guardianNum: { fontFamily: 'Sora-Bold', fontSize: 12, color: ILOWA_COLORS.purple, width: 24 },
  guardianAddr: { fontFamily: 'Inter', fontSize: 13, color: ILOWA_COLORS.textSecondary },
  recoveryBanner: {
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: 12,
  },
  recoveryText: { fontFamily: 'Inter-Medium', fontSize: 13, color: '#EF4444' },
  inputRow: { gap: 4 },
  inputLabel: { fontFamily: 'Sora', fontSize: 11, color: ILOWA_COLORS.textMuted, letterSpacing: 0.5 },
  input: {
    backgroundColor: '#1a1a2e', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: ILOWA_COLORS.textPrimary, fontFamily: 'Inter', fontSize: 13,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  counterText: { fontFamily: 'Inter', fontSize: 12, color: ILOWA_COLORS.textMuted, textAlign: 'right' },
  primaryBtn: {
    backgroundColor: ILOWA_COLORS.purple, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { fontFamily: 'Sora-Bold', fontSize: 14, color: 'white' },
});
