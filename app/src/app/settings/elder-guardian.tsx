/**
 * Elder Guardian Settings
 * 
 * On-chain timelock guardian — protects wallet recovery with a trusted key.
 * Uses raw instruction builders from market-writer.ts (no Anchor runtime).
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
import { ArrowLeft, Shield, Clock, Key, AlertTriangle } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { PublicKey } from '@solana/web3.js';
import { ILOWA_COLORS } from '../../theme/colors';
import { useWallet } from '../../hooks/useWallet';
import { useGuardians } from '../../hooks/useGuardians';

export default function ElderGuardianSettings() {
  const insets = useSafeAreaInsets();
  const wallet = useWallet();
  const {
    elderGuardian,
    loading,
    initElderGuardian,
    setGuardianKey,
    initiateRecovery,
    cancelRecovery,
    loadGuardianState,
  } = useGuardians(wallet);

  const [guardianInput, setGuardianInput] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (wallet.connected) loadGuardianState();
  }, [wallet.connected]);

  const handleInit = async () => {
    if (!wallet.connected) {
      Alert.alert('Wallet Required', 'Connect your wallet first.');
      return;
    }
    setBusy(true);
    try {
      await initElderGuardian();
      await loadGuardianState();
      Alert.alert('Guardian Initialized', 'Your Elder Guardian account is now active on-chain. Set a guardian key to enable recovery.');
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not initialize guardian.');
    } finally {
      setBusy(false);
    }
  };

  const handleSetKey = async () => {
    if (!guardianInput.trim()) {
      Alert.alert('Enter Key', 'Paste the guardian wallet address.');
      return;
    }
    try {
      const key = new PublicKey(guardianInput.trim());
      setBusy(true);
      await setGuardianKey(key);
      await loadGuardianState();
      setGuardianInput('');
      Alert.alert('Guardian Key Set', `Recovery key set to ${key.toBase58().slice(0, 8)}...`);
    } catch (e: any) {
      Alert.alert('Invalid Key', e?.message || 'Check the wallet address and try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelRecovery = async () => {
    Alert.alert('Cancel Recovery?', 'This will abort the in-progress recovery.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Recovery',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await cancelRecovery();
            await loadGuardianState();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to cancel recovery.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const isSetup = elderGuardian?.isInitialized === true;

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
        <Text style={styles.headerTitle}>Elder Guardian</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Explainer */}
      <Animated.View entering={FadeInDown.delay(100)} style={styles.explainer}>
        <Shield size={32} color={ILOWA_COLORS.gold} strokeWidth={1.8} />
        <Text style={styles.explainerTitle}>On-Chain Wallet Protection</Text>
        <Text style={styles.explainerText}>
          Elder Guardian is a Solana-native timelock recovery system. Assign a trusted guardian key — if you lose access, they can initiate recovery with a 24-hour delay so you can cancel any unauthorized attempts.
        </Text>
      </Animated.View>

      {!wallet.connected ? (
        <Animated.View entering={FadeInDown.delay(200)} style={styles.card}>
          <Text style={styles.cardText}>Connect your wallet to set up Elder Guardian.</Text>
        </Animated.View>
      ) : !isSetup ? (
        <Animated.View entering={FadeInDown.delay(200)} style={styles.card}>
          <Text style={styles.cardLabel}>Step 1: Initialize Guardian Account</Text>
          <Text style={styles.cardDesc}>
            Creates your Elder Guardian PDA on Solana. One-time transaction — costs a small rent deposit.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={handleInit} disabled={busy}>
            {busy ? (
              <ActivityIndicator color={ILOWA_COLORS.deepBlack} />
            ) : (
              <Text style={styles.primaryBtnText}>Initialize Guardian</Text>
            )}
          </Pressable>
        </Animated.View>
      ) : (
        <>
          {/* Status */}
          <Animated.View entering={FadeInDown.delay(200)} style={styles.card}>
            <Text style={styles.cardLabel}>Guardian Status</Text>
            <View style={styles.statusRow}>
              <Shield size={16} color={ILOWA_COLORS.truth} />
              <Text style={styles.statusText}>Active on-chain</Text>
            </View>
            <View style={styles.statusRow}>
              <Key size={16} color={ILOWA_COLORS.textMuted} />
              <Text style={styles.statusText}>
                Key: {elderGuardian.guardianKey?.slice(0, 8) || 'Not set'}...
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Clock size={16} color={ILOWA_COLORS.textMuted} />
              <Text style={styles.statusText}>Timelock: 24 hours</Text>
            </View>
            {elderGuardian.recoveryInitiated && (
              <View style={styles.warningBox}>
                <AlertTriangle size={16} color="#EF4444" />
                <Text style={styles.warningText}>Recovery in progress!</Text>
                <Pressable style={styles.cancelBtn} onPress={handleCancelRecovery}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
              </View>
            )}
          </Animated.View>

          {/* Set / Change Guardian Key */}
          <Animated.View entering={FadeInDown.delay(300)} style={styles.card}>
            <Text style={styles.cardLabel}>Set Guardian Key</Text>
            <Text style={styles.cardDesc}>
              Paste a trusted wallet address. This key holder can initiate recovery if you lose access.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Guardian wallet address..."
              placeholderTextColor="#555"
              value={guardianInput}
              onChangeText={setGuardianInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable style={styles.primaryBtn} onPress={handleSetKey} disabled={busy}>
              {busy ? (
                <ActivityIndicator color={ILOWA_COLORS.deepBlack} />
              ) : (
                <Text style={styles.primaryBtnText}>Update Guardian Key</Text>
              )}
            </Pressable>
          </Animated.View>
        </>
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
    backgroundColor: 'rgba(255,215,0,0.06)', borderRadius: 16, padding: 20,
    alignItems: 'center', gap: 10, marginBottom: 20, borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.12)',
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
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontFamily: 'Inter', fontSize: 13, color: ILOWA_COLORS.textSecondary },
  warningBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 10, padding: 12, marginTop: 4,
  },
  warningText: { fontFamily: 'Inter-Medium', fontSize: 13, color: '#EF4444', flex: 1 },
  cancelBtn: { backgroundColor: '#EF4444', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  cancelBtnText: { fontFamily: 'Sora-Bold', fontSize: 12, color: 'white' },
  input: {
    backgroundColor: '#1a1a2e', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: ILOWA_COLORS.textPrimary, fontFamily: 'Inter', fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  primaryBtn: {
    backgroundColor: ILOWA_COLORS.gold, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { fontFamily: 'Sora-Bold', fontSize: 14, color: ILOWA_COLORS.deepBlack },
});
