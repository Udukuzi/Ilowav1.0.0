import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Animated, { 
  FadeIn, 
  FadeOut, 
  SlideInDown,
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ILOWA_COLORS } from '../theme/colors';

interface TipDJButtonProps {
  djName: string;
  djWallet?: string;
  isLive: boolean;
  walletConnected?: boolean;
  onTip?: (amount: number) => Promise<void>;
}

const QUICK_AMOUNTS = [0.01, 0.05, 0.1, 0.5];

export function TipDJButton({ djName, djWallet, isLive, walletConnected = true, onTip }: TipDJButtonProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [amount, setAmount] = useState('0.05');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Button is disabled if DJ is not live OR wallet is not connected
  const isDisabled = !isLive || !walletConnected;
  
  const scale = useSharedValue(1);
  const coinY = useSharedValue(0);
  const coinOpacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const coinStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: coinY.value }],
    opacity: coinOpacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handleOpen = async () => {
    if (isDisabled) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalVisible(true);
  };

  const handleQuickAmount = async (amt: number) => {
    await Haptics.selectionAsync();
    setAmount(amt.toString());
  };

  const handleSendTip = async () => {
    const tipAmount = parseFloat(amount);
    if (isNaN(tipAmount) || tipAmount <= 0) return;
    
    setSending(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (onTip) {
        await onTip(tipAmount);
      } else {
        // Simulated delay for demo
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      // Success animation
      setSuccess(true);
      coinY.value = 0;
      coinOpacity.value = 1;
      coinY.value = withSequence(
        withTiming(-80, { duration: 600 }),
        withTiming(-100, { duration: 200 })
      );
      coinOpacity.value = withSequence(
        withTiming(1, { duration: 600 }),
        withTiming(0, { duration: 400 })
      );
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      setTimeout(() => {
        setSuccess(false);
        setModalVisible(false);
      }, 1500);
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Animated.View style={animatedStyle}>
        <Pressable
          style={[styles.button, isDisabled && styles.buttonDisabled]}
          onPress={handleOpen}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={isDisabled}
        >
          <Ionicons 
            name="gift" 
            size={22} 
            color={isDisabled ? ILOWA_COLORS.textMuted : ILOWA_COLORS.gold} 
          />
          <Text style={[styles.buttonText, isDisabled && styles.buttonTextDisabled]}>
            {!walletConnected ? 'Connect Wallet' : !isLive ? 'Off Air' : 'Tip'}
          </Text>
        </Pressable>
      </Animated.View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable 
            style={styles.modalBackdrop} 
            onPress={() => !sending && setModalVisible(false)} 
          />
          <Animated.View 
            entering={SlideInDown.springify().damping(15)}
            style={styles.modalContentOuter}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.03)', 'rgba(0,0,0,0.2)']}
              style={styles.modalContent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
            {success ? (
              <Animated.View entering={FadeIn} style={styles.successContainer}>
                <Animated.View style={coinStyle}>
                  <Text style={styles.successEmoji}>🪙</Text>
                </Animated.View>
                <Text style={styles.successText}>Tip sent!</Text>
                <Text style={styles.successAmount}>{amount} SOL to {djName}</Text>
              </Animated.View>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <Ionicons name="gift" size={28} color={ILOWA_COLORS.gold} />
                  <Text style={styles.modalTitle}>Tip {djName}</Text>
                  <Text style={styles.modalSubtitle}>
                    Show some love to your favorite DJ
                  </Text>
                </View>

                <View style={styles.quickAmounts}>
                  {QUICK_AMOUNTS.map((amt) => (
                    <Pressable
                      key={amt}
                      style={[
                        styles.quickButton,
                        parseFloat(amount) === amt && styles.quickButtonActive,
                      ]}
                      onPress={() => handleQuickAmount(amt)}
                    >
                      <Text style={[
                        styles.quickButtonText,
                        parseFloat(amount) === amt && styles.quickButtonTextActive,
                      ]}>
                        {amt} SOL
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.customAmount}>
                  <Text style={styles.customLabel}>Custom amount</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.amountInput}
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={ILOWA_COLORS.textMuted}
                    />
                    <Text style={styles.solLabel}>SOL</Text>
                  </View>
                </View>

                <Pressable
                  style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                  onPress={handleSendTip}
                  disabled={sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color={ILOWA_COLORS.deepBlack} />
                  ) : (
                    <>
                      <Ionicons name="send" size={18} color={ILOWA_COLORS.deepBlack} />
                      <Text style={styles.sendButtonText}>Send Tip</Text>
                    </>
                  )}
                </Pressable>

                <Text style={styles.feeNote}>
                  15% platform fee • Instant delivery
                </Text>
              </>
            )}
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: ILOWA_COLORS.cardDark,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  buttonDisabled: {
    opacity: 0.5,
    borderColor: 'transparent',
  },
  buttonText: {
    fontFamily: 'Sora',
    fontSize: 12,
    color: ILOWA_COLORS.gold,
  },
  buttonTextDisabled: {
    color: ILOWA_COLORS.textMuted,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContentOuter: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 215, 0, 0.15)',
  },
  modalContent: {
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontFamily: 'Sora-Bold',
    fontSize: 20,
    color: ILOWA_COLORS.textPrimary,
    marginTop: 12,
  },
  modalSubtitle: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: ILOWA_COLORS.textMuted,
    marginTop: 4,
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  quickButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
  },
  quickButtonActive: {
    backgroundColor: ILOWA_COLORS.gold,
  },
  quickButtonText: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 13,
    color: ILOWA_COLORS.textSecondary,
  },
  quickButtonTextActive: {
    color: ILOWA_COLORS.deepBlack,
  },
  customAmount: {
    marginBottom: 20,
  },
  customLabel: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.textMuted,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  amountInput: {
    flex: 1,
    fontFamily: 'Sora-Bold',
    fontSize: 24,
    color: ILOWA_COLORS.textPrimary,
    paddingVertical: 16,
  },
  solLabel: {
    fontFamily: 'Sora',
    fontSize: 16,
    color: ILOWA_COLORS.textMuted,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ILOWA_COLORS.gold,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  sendButtonText: {
    fontFamily: 'Sora-Bold',
    fontSize: 16,
    color: ILOWA_COLORS.deepBlack,
  },
  feeNote: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.textMuted,
    textAlign: 'center',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  successEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  successText: {
    fontFamily: 'Sora-Bold',
    fontSize: 24,
    color: ILOWA_COLORS.truth,
    marginBottom: 4,
  },
  successAmount: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: ILOWA_COLORS.textMuted,
  },
});
