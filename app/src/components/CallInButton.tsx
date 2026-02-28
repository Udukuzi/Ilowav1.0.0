/**
 * Call-In Button for Radio
 * 
 * Records voice → Uploads to IPFS → Adds to DJ queue
 */

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { ILOWA_COLORS } from '../theme/colors';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { submitCallIn } from '../lib/radio/call-in';

interface CallInButtonProps {
  stationId: string;
  userId?: string;
  isLive: boolean;
  onCallInSubmitted?: (transcription: string) => void;
}

export function CallInButton({ 
  stationId, 
  userId, 
  isLive,
  onCallInSubmitted 
}: CallInButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const voiceInput = useVoiceInput();
  const scale = useSharedValue(1);
  const ringScale = useSharedValue(1);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: 2 - ringScale.value,
  }));

  const handlePressIn = async () => {
    if (!userId) {
      Alert.alert('Connect Wallet', 'Connect your wallet to call in to the radio.');
      return;
    }

    scale.value = withTiming(0.95, { duration: 100 });
    ringScale.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 600 }),
        withTiming(1, { duration: 0 })
      ),
      -1
    );

    try {
      await voiceInput.startRecording();
    } catch (error) {
      Alert.alert('Microphone Error', 'Could not access microphone. Please check permissions.');
    }
  };

  const handlePressOut = async () => {
    scale.value = withTiming(1, { duration: 100 });
    ringScale.value = 1;

    if (!voiceInput.isRecording) return;

    const recordingDuration = voiceInput.duration;

    try {
      // Stop recording - returns audio URI
      const audioUri = await voiceInput.stopRecording();
      
      if (!audioUri) {
        Alert.alert('No Audio', 'No audio was recorded. Please try again.');
        return;
      }

      setIsSubmitting(true);

      // Transcribe the audio
      const transcription = await voiceInput.transcribe(audioUri);
      
      if (!transcription) {
        Alert.alert('Transcription Failed', 'Could not transcribe audio. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // Submit call-in to IPFS and DJ queue
      const submission = await submitCallIn(
        audioUri,
        transcription,
        stationId,
        userId!,
        recordingDuration
      );

      if (submission.success) {
        Alert.alert(
          'Call-In Submitted! 📻',
          `Your message has been sent to the DJ queue.\n\n"${transcription}"`,
          [{ text: 'OK' }]
        );
        onCallInSubmitted?.(transcription);
      } else {
        Alert.alert('Submission Failed', submission.error || 'Could not submit call-in.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to process call-in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDisabled = isSubmitting || !isLive;

  return (
    <View style={styles.container}>
      <View style={styles.buttonWrapper}>
        {voiceInput.isRecording && (
          <Animated.View style={[styles.ring, ringStyle]} />
        )}
        
        <Animated.View style={buttonStyle}>
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={isDisabled}
            style={[
              styles.button,
              voiceInput.isRecording && styles.buttonRecording,
              isDisabled && styles.buttonDisabled,
            ]}
          >
            <Ionicons
              name={voiceInput.isRecording ? 'radio' : 'call'}
              size={24}
              color={isDisabled ? '#666' : '#fff'}
            />
          </Pressable>
        </Animated.View>
      </View>

      <Text
        style={[styles.label, isDisabled && styles.labelDisabled]}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        numberOfLines={1}
      >
        {isSubmitting 
          ? 'Submitting...' 
          : voiceInput.isRecording 
            ? `Recording ${voiceInput.duration}s`
            : isLive 
              ? 'Call In'
              : 'DJ Offline'
        }
      </Text>

      {!isLive && (
        <Text 
          style={styles.hint}
          adjustsFontSizeToFit={true}
          minimumFontScale={0.85}
          numberOfLines={1}
        >
          Call-ins available when DJ is live
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
    minWidth: 64,
  },
  buttonWrapper: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: ILOWA_COLORS.gold,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ILOWA_COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ILOWA_COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonRecording: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  buttonDisabled: {
    backgroundColor: '#333',
    shadowOpacity: 0,
  },
  label: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  labelDisabled: {
    color: '#666',
  },
  hint: {
    color: '#666',
    fontSize: 10,
    textAlign: 'center',
  },
});
