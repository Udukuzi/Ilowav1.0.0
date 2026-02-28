/**
 * AI Privacy Settings Screen
 * 
 * Allows users to:
 * - Enable/disable Arcium MPC encryption
 * - Opt-in to federated learning
 * - View and claim earnings from contributions
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ILOWA_COLORS } from '../../theme/colors';
import { useWallet } from '../../hooks/useWallet';
import { 
  enableArcium, 
  disableArcium, 
  isArciumEnabled,
  getPrivacyStatus,
} from '../../lib/privacy/arcium-mpc';
import {
  enableFederatedLearning,
  disableFederatedLearning,
  isFederatedLearningEnabled,
  getEarnings,
  claimRewards,
  getFederatedLearningStatus,
  clearFederatedLearningData,
  type EarningsInfo,
} from '../../lib/ai/federated-learning';
import { getAIServiceStatus, type AIServiceStatus } from '../../lib/ai/privacy-ai';

export default function AIPrivacySettings() {
  const insets = useSafeAreaInsets();
  const { publicKey } = useWallet();
  
  const [arciumEnabled, setArciumEnabled] = useState(false);
  const [flEnabled, setFlEnabled] = useState(false);
  const [earnings, setEarnings] = useState<EarningsInfo | null>(null);
  const [aiStatus, setAiStatus] = useState<AIServiceStatus | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      setArciumEnabled(isArciumEnabled());
      setFlEnabled(isFederatedLearningEnabled());
      
      const [earningsData, statusData] = await Promise.all([
        getEarnings(),
        getAIServiceStatus(),
      ]);
      
      setEarnings(earningsData);
      setAiStatus(statusData);
    } catch (error) {
      console.error('[Settings] Failed to load:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleArcium = async (value: boolean) => {
    try {
      if (value) {
        await enableArcium();
      } else {
        await disableArcium();
      }
      setArciumEnabled(value);
    } catch (error) {
      console.error('[Settings] Arcium toggle failed:', error);
    }
  };

  const toggleFederatedLearning = async (value: boolean) => {
    if (value) {
      Alert.alert(
        'Enable Federated Learning',
        'Your interactions will help improve Ilowa AI. Only anonymized learning data is shared - your actual messages stay private.\n\nYou\'ll earn ILOWA tokens for your contributions!',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enable & Earn',
            onPress: async () => {
              await enableFederatedLearning();
              setFlEnabled(true);
              await loadSettings();
            },
          },
        ]
      );
    } else {
      await disableFederatedLearning();
      setFlEnabled(false);
    }
  };

  const handleClaimRewards = async () => {
    if (!publicKey) {
      Alert.alert('Wallet Required', 'Connect your wallet to claim rewards.');
      return;
    }

    if (!earnings || earnings.claimableAmount <= 0) {
      Alert.alert('No Rewards', 'You don\'t have any rewards to claim yet.');
      return;
    }

    setIsClaiming(true);
    try {
      const result = await claimRewards(publicKey.toBase58());
      
      if (result.success) {
        Alert.alert(
          'Rewards Claimed! 🎉',
          `You received ${result.amount.toFixed(4)} ILOWA tokens.\n\nTransaction: ${result.txSignature?.slice(0, 8)}...`
        );
        await loadSettings();
      } else {
        Alert.alert('Claim Failed', result.error || 'Please try again later.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to claim rewards. Please try again.');
    } finally {
      setIsClaiming(false);
    }
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear Learning Data',
      'This will delete all your federated learning contributions and pending rewards. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearFederatedLearningData();
            await loadSettings();
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={ILOWA_COLORS.gold} />
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={ILOWA_COLORS.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>AI & Privacy</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* AI Status Section */}
      <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
        <Text style={styles.sectionTitle}>AI Services</Text>
        
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusInfo}>
              <Text style={styles.statusLabel}>Cohere Aya</Text>
              <Text style={styles.statusDesc}>Multilingual AI (101 languages)</Text>
            </View>
            <View style={[
              styles.statusBadge,
              aiStatus?.aya.available ? styles.statusActive : styles.statusInactive
            ]}>
              <Text style={styles.statusBadgeText}>
                {aiStatus?.aya.available ? 'Active' : 'Offline'}
              </Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            <View style={styles.statusInfo}>
              <Text style={styles.statusLabel}>GLM-5</Text>
              <Text style={styles.statusDesc}>Reasoning & analytics engine (Together/DeepInfra)</Text>
            </View>
            <View style={[
              styles.statusBadge,
              aiStatus?.glm5?.available ? styles.statusActive : styles.statusInactive
            ]}>
              <Text style={styles.statusBadgeText}>
                {aiStatus?.glm5?.available ? 'Active' : 'Unavailable'}
              </Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            <View style={styles.statusInfo}>
              <Text style={styles.statusLabel}>Lelapa AI</Text>
              <Text style={styles.statusDesc}>African language specialist</Text>
            </View>
            <View style={[
              styles.statusBadge,
              aiStatus?.lelapa.available ? styles.statusActive : styles.statusInactive
            ]}>
              <Text style={styles.statusBadgeText}>
                {aiStatus?.lelapa.available ? 'Active' : 'Offline'}
              </Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            <View style={styles.statusInfo}>
              <Text style={styles.statusLabel}>Elder Wisdom</Text>
              <Text style={styles.statusDesc}>Local fallback (always available)</Text>
            </View>
            <View style={[styles.statusBadge, styles.statusActive]}>
              <Text style={styles.statusBadgeText}>Active</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Privacy Section */}
      <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy</Text>
        
        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Ionicons name="shield-checkmark" size={24} color={ILOWA_COLORS.purple} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Arcium MPC Encryption</Text>
              <Text style={styles.settingDesc}>
                Encrypt your AI conversations using multi-party computation
              </Text>
            </View>
            <Switch
              value={arciumEnabled}
              onValueChange={toggleArcium}
              trackColor={{ false: '#475569', true: ILOWA_COLORS.purple }}
              thumbColor={arciumEnabled ? '#fff' : '#94A3B8'}
            />
          </View>

          {arciumEnabled && (
            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={16} color={ILOWA_COLORS.cyan} />
              <Text style={styles.infoText}>
                Your prompts are encrypted before leaving your device. No one can read your conversations.
              </Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* Federated Learning Section */}
      <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
        <Text style={styles.sectionTitle}>Earn While You Chat</Text>
        
        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Ionicons name="analytics" size={24} color={ILOWA_COLORS.gold} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Federated Learning</Text>
              <Text style={styles.settingDesc}>
                Help improve Ilowa AI and earn ILOWA tokens
              </Text>
            </View>
            <Switch
              value={flEnabled}
              onValueChange={toggleFederatedLearning}
              trackColor={{ false: '#475569', true: ILOWA_COLORS.gold }}
              thumbColor={flEnabled ? '#fff' : '#94A3B8'}
            />
          </View>

          {flEnabled && earnings && (
            <>
              <View style={styles.earningsCard}>
                <View style={styles.earningsRow}>
                  <Text style={styles.earningsLabel}>Total Earned</Text>
                  <Text style={styles.earningsValue}>
                    {earnings.totalEarned.toFixed(4)} ILOWA
                  </Text>
                </View>
                <View style={styles.earningsRow}>
                  <Text style={styles.earningsLabel}>Contributions</Text>
                  <Text style={styles.earningsValue}>{earnings.contributionCount}</Text>
                </View>
                <View style={styles.earningsRow}>
                  <Text style={styles.earningsLabel}>Pending Rewards</Text>
                  <Text style={[styles.earningsValue, styles.pendingValue]}>
                    {earnings.pendingRewards.toFixed(4)} ILOWA
                  </Text>
                </View>
              </View>

              <Pressable
                style={[
                  styles.claimButton,
                  earnings.claimableAmount <= 0 && styles.claimButtonDisabled
                ]}
                onPress={handleClaimRewards}
                disabled={isClaiming || earnings.claimableAmount <= 0}
              >
                {isClaiming ? (
                  <ActivityIndicator size="small" color={ILOWA_COLORS.deepBlack} />
                ) : (
                  <>
                    <Ionicons name="wallet" size={18} color={ILOWA_COLORS.deepBlack} />
                    <Text style={styles.claimButtonText}>
                      Claim {earnings.claimableAmount.toFixed(4)} ILOWA
                    </Text>
                  </>
                )}
              </Pressable>

              <View style={styles.infoBox}>
                <Ionicons name="lock-closed" size={16} color={ILOWA_COLORS.truth} />
                <Text style={styles.infoText}>
                  Your messages stay on your device. Only anonymized learning signals are shared.
                </Text>
              </View>
            </>
          )}
        </View>
      </Animated.View>

      {/* Data Management */}
      <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
        <Text style={styles.sectionTitle}>Data Management</Text>
        
        <Pressable style={styles.dangerButton} onPress={handleClearData}>
          <Ionicons name="trash-outline" size={20} color={ILOWA_COLORS.doubt} />
          <Text style={styles.dangerButtonText}>Clear Learning Data</Text>
        </Pressable>
      </Animated.View>

      <View style={{ height: insets.bottom + 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ILOWA_COLORS.deepBlack,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    marginBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Sora-Bold',
    fontSize: 18,
    color: ILOWA_COLORS.textPrimary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'Sora-Bold',
    fontSize: 14,
    color: ILOWA_COLORS.textMuted,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statusCard: {
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusInfo: {
    flex: 1,
  },
  statusLabel: {
    fontFamily: 'Sora',
    fontSize: 14,
    color: ILOWA_COLORS.textPrimary,
  },
  statusDesc: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  statusInactive: {
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
  },
  statusBadgeText: {
    fontFamily: 'Sora',
    fontSize: 11,
    color: ILOWA_COLORS.textSecondary,
  },
  settingCard: {
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 16,
    padding: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontFamily: 'Sora',
    fontSize: 15,
    color: ILOWA_COLORS.textPrimary,
  },
  settingDesc: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.textMuted,
    marginTop: 2,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
  },
  infoText: {
    flex: 1,
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.textMuted,
    lineHeight: 18,
  },
  earningsCard: {
    marginTop: 16,
    padding: 16,
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.15)',
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  earningsLabel: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: ILOWA_COLORS.textMuted,
  },
  earningsValue: {
    fontFamily: 'Sora-Bold',
    fontSize: 14,
    color: ILOWA_COLORS.textPrimary,
  },
  pendingValue: {
    color: ILOWA_COLORS.gold,
  },
  claimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    padding: 14,
    backgroundColor: ILOWA_COLORS.gold,
    borderRadius: 12,
  },
  claimButtonDisabled: {
    opacity: 0.5,
  },
  claimButtonText: {
    fontFamily: 'Sora-Bold',
    fontSize: 14,
    color: ILOWA_COLORS.deepBlack,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  dangerButtonText: {
    fontFamily: 'Sora',
    fontSize: 14,
    color: ILOWA_COLORS.doubt,
  },
});
