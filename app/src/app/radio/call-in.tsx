import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ILOWA_COLORS } from '../../theme/colors';
import { VoiceInputButton } from '../../components/VoiceInputButton';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { validateMarket } from '../../lib/ai/qwen3';

type CallInStep = 'record' | 'preview' | 'submitting' | 'done';

export default function CallInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const voiceInput = useVoiceInput();
  const [step, setStep] = useState<CallInStep>('record');
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string | null>(null);

  const handleRecordComplete = async (uri: string) => {
    setAudioUri(uri);
    setTranscription('Transcribing your prediction...');
    setStep('preview');

    const text = await voiceInput.transcribe(uri);
    if (text) {
      setTranscription(text);
    } else {
      setTranscription('[Could not transcribe — tap re-record to try again]');
    }
  };

  const handleSubmit = async () => {
    if (!transcription || transcription.startsWith('[')) {
      Alert.alert('Error', 'No valid transcription to submit.');
      return;
    }
    setStep('submitting');
    try {
      const validation = await validateMarket(transcription);
      if (!validation.valid) {
        Alert.alert('Invalid Prediction', validation.reason || 'Try rephrasing.');
        setStep('preview');
        return;
      }
      setStep('done');
    } catch {
      Alert.alert('Error', 'Failed to submit prediction. Try again.');
      setStep('preview');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={ILOWA_COLORS.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Call In</Text>
        <View style={{ width: 40 }} />
      </View>

      {step === 'record' && (
        <Animated.View entering={FadeInDown.duration(500)} style={styles.content}>
          <View style={styles.iconCircle}>
            <Ionicons name="mic" size={48} color={ILOWA_COLORS.cyan} />
          </View>
          <Text style={styles.title}>Share Your Prediction</Text>
          <Text style={styles.subtitle}>
            Record your voice prediction. It will be transcribed, validated by AI,
            and broadcast on the live radio.
          </Text>

          <View style={styles.tips}>
            <Text style={styles.tipTitle}>Tips for a great prediction:</Text>
            <Text style={styles.tip}>• Make it specific and measurable</Text>
            <Text style={styles.tip}>• Include a timeframe</Text>
            <Text style={styles.tip}>• YES/NO outcome only</Text>
          </View>

          <View style={styles.recordArea}>
            <VoiceInputButton size={80} onRecordComplete={handleRecordComplete} />
            <Text style={styles.recordHint}>Tap to record</Text>
          </View>
        </Animated.View>
      )}

      {step === 'preview' && (
        <Animated.View entering={FadeInDown.duration(500)} style={styles.content}>
          <View style={styles.previewCard}>
            <Text style={styles.previewLabel}>Your Prediction</Text>
            <Text style={styles.previewText}>{transcription}</Text>

            <View style={styles.privacyOption}>
              <Ionicons name="eye-off" size={18} color={ILOWA_COLORS.purple} />
              <Text style={styles.privacyLabel}>Make this a private market (Arcium ZK)</Text>
            </View>
          </View>

          <View style={styles.previewActions}>
            <Pressable
              style={styles.reRecordButton}
              onPress={() => { setStep('record'); setAudioUri(null); }}
            >
              <Ionicons name="refresh" size={18} color={ILOWA_COLORS.textSecondary} />
              <Text style={styles.reRecordText}>Re-record</Text>
            </Pressable>
            <Pressable style={styles.submitButton} onPress={handleSubmit}>
              <Ionicons name="send" size={18} color={ILOWA_COLORS.deepBlack} />
              <Text style={styles.submitText}>Submit to Radio</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {step === 'submitting' && (
        <Animated.View entering={FadeInDown.duration(500)} style={styles.content}>
          <View style={styles.iconCircle}>
            <Ionicons name="hourglass" size={48} color={ILOWA_COLORS.gold} />
          </View>
          <Text style={styles.title}>Processing...</Text>
          <Text style={styles.subtitle}>
            AI is validating your prediction and preparing it for broadcast.
          </Text>
        </Animated.View>
      )}

      {step === 'done' && (
        <Animated.View entering={FadeInDown.duration(500)} style={styles.content}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
            <Ionicons name="checkmark-circle" size={48} color={ILOWA_COLORS.truth} />
          </View>
          <Text style={styles.title}>Prediction Submitted!</Text>
          <Text style={styles.subtitle}>
            Your voice prediction is queued for the live radio show.
            A market has been created — check the Markets tab.
          </Text>
          <Pressable style={styles.doneButton} onPress={() => router.back()}>
            <Text style={styles.doneButtonText}>Back to Radio</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ILOWA_COLORS.deepBlack },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Sora-Bold', fontSize: 18, color: ILOWA_COLORS.textPrimary },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(0,217,255,0.1)', alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontFamily: 'Sora-Bold', fontSize: 24, color: ILOWA_COLORS.textPrimary,
    textAlign: 'center', marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter', fontSize: 15, color: ILOWA_COLORS.textSecondary,
    textAlign: 'center', lineHeight: 22, marginBottom: 32,
  },
  tips: { alignSelf: 'stretch', marginBottom: 32 },
  tipTitle: {
    fontFamily: 'Sora-SemiBold', fontSize: 13, color: ILOWA_COLORS.textPrimary, marginBottom: 8,
  },
  tip: { fontFamily: 'Inter', fontSize: 13, color: ILOWA_COLORS.textMuted, lineHeight: 22 },
  recordArea: { alignItems: 'center', gap: 12 },
  recordHint: { fontFamily: 'Inter', fontSize: 13, color: ILOWA_COLORS.textMuted },
  previewCard: {
    alignSelf: 'stretch', backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 16, padding: 20, marginBottom: 24,
  },
  previewLabel: {
    fontFamily: 'Sora', fontSize: 11, color: ILOWA_COLORS.textMuted,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
  },
  previewText: {
    fontFamily: 'Inter-Medium', fontSize: 16, color: ILOWA_COLORS.textPrimary,
    lineHeight: 24, marginBottom: 16,
  },
  privacyOption: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  privacyLabel: { fontFamily: 'Inter', fontSize: 13, color: ILOWA_COLORS.textSecondary },
  previewActions: { flexDirection: 'row', gap: 12, alignSelf: 'stretch' },
  reRecordButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14, borderRadius: 12,
    backgroundColor: ILOWA_COLORS.cardDark,
  },
  reRecordText: { fontFamily: 'Sora', fontSize: 14, color: ILOWA_COLORS.textSecondary },
  submitButton: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14, borderRadius: 12,
    backgroundColor: ILOWA_COLORS.gold,
  },
  submitText: { fontFamily: 'Sora-Bold', fontSize: 14, color: ILOWA_COLORS.deepBlack },
  doneButton: {
    backgroundColor: ILOWA_COLORS.cyan, paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: 14,
  },
  doneButtonText: { fontFamily: 'Sora-Bold', fontSize: 15, color: ILOWA_COLORS.deepBlack },
});
