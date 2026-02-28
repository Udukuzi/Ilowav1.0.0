import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { ILOWA_COLORS } from '../theme/colors';
import { useVoiceInput } from '../hooks/useVoiceInput';

// NetInfo removed — Metro statically bundles require() even in try/catch, crashing Expo Go.
// Defaults to online. Restore when using EAS custom dev build.

const METHOD_LABELS: Record<string, string> = {
  gladia: '🌐 Gladia',
  vosk: '🔒 Vosk (Offline)',
};

const WAVEFORM_BARS = 16;

interface VoiceInputButtonProps {
  size?: number;
  showMethodIndicator?: boolean;
  onRecordComplete: (audioUri: string) => void;
}

export function VoiceInputButton({
  size = 56,
  showMethodIndicator = false,
  onRecordComplete,
}: VoiceInputButtonProps) {
  const voice = useVoiceInput();
  const [waveform, setWaveform] = useState<number[]>(new Array(WAVEFORM_BARS).fill(0.1));
  const [online, setOnline] = useState(true);
  const waveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pulseScale = useSharedValue(1);
  const waveOpacity = useSharedValue(0);

  // NetInfo removed for Expo Go — always default to online

  // Simulated waveform while recording (real metering requires native module)
  useEffect(() => {
    if (voice.isRecording) {
      waveIntervalRef.current = setInterval(() => {
        setWaveform((prev) =>
          prev.map(() => 0.15 + Math.random() * 0.85)
        );
      }, 120);
    } else {
      if (waveIntervalRef.current) {
        clearInterval(waveIntervalRef.current);
        waveIntervalRef.current = null;
      }
      setWaveform(new Array(WAVEFORM_BARS).fill(0.1));
    }
    return () => {
      if (waveIntervalRef.current) clearInterval(waveIntervalRef.current);
    };
  }, [voice.isRecording]);

  const handleStart = async () => {
    await voice.startRecording();

    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 600, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
        withTiming(1, { duration: 600, easing: Easing.bezier(0.4, 0, 0.2, 1) })
      ),
      -1,
      true
    );
    waveOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 600 }),
        withTiming(0.2, { duration: 600 })
      ),
      -1,
      true
    );
  };

  const handleStop = async () => {
    pulseScale.value = withTiming(1, { duration: 200 });
    waveOpacity.value = withTiming(0, { duration: 200 });

    const uri = await voice.stopRecording();
    if (uri) {
      onRecordComplete(uri);
    }
  };

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const waveStyle = useAnimatedStyle(() => ({
    opacity: waveOpacity.value,
  }));

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isDisabled = voice.isTranscribing;

  return (
    <View style={styles.container}>
      {/* Network status */}
      <View style={styles.networkRow}>
        <View style={[styles.networkDot, { backgroundColor: online ? '#10B981' : ILOWA_COLORS.purple }]} />
        <Text style={styles.networkText}>
          {online ? 'Online (Gladia)' : 'Offline (Vosk)'}
        </Text>
      </View>

      {/* Method indicator */}
      {showMethodIndicator && voice.method && (
        <Text style={styles.methodText}>
          {METHOD_LABELS[voice.method] || voice.method}
          {voice.latency > 0 ? ` · ${voice.latency}ms` : ''}
        </Text>
      )}

      {/* Waveform visualization */}
      {voice.isRecording && (
        <View style={styles.waveformRow}>
          {waveform.map((level, i) => (
            <View
              key={i}
              style={[
                styles.waveformBar,
                { height: Math.max(3, level * 28) },
              ]}
            />
          ))}
        </View>
      )}

      {/* Pulse ring */}
      {voice.isRecording && (
        <Animated.View
          style={[
            styles.wave,
            {
              width: size + 24,
              height: size + 24,
              borderRadius: (size + 24) / 2,
            },
            waveStyle,
          ]}
        />
      )}

      {/* Main button */}
      <Animated.View style={pulseStyle}>
        <Pressable
          onPress={voice.isRecording ? handleStop : handleStart}
          disabled={isDisabled}
          style={[
            styles.button,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: isDisabled
                ? ILOWA_COLORS.wisdom
                : voice.isRecording
                ? ILOWA_COLORS.doubt
                : ILOWA_COLORS.cyan,
              opacity: isDisabled ? 0.6 : 1,
            },
          ]}
        >
          {voice.isTranscribing ? (
            <ActivityIndicator size="small" color={ILOWA_COLORS.deepBlack} />
          ) : (
            <Ionicons
              name={voice.isRecording ? 'stop' : 'mic'}
              size={size * 0.4}
              color={ILOWA_COLORS.deepBlack}
            />
          )}
        </Pressable>
      </Animated.View>

      {/* Status text */}
      {voice.isRecording && (
        <Text style={styles.duration}>{formatDuration(voice.duration)}</Text>
      )}
      {voice.isTranscribing && (
        <Text style={styles.statusText}>Processing voice...</Text>
      )}
      {voice.error && (
        <Text style={styles.errorText}>{voice.error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  networkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  networkText: {
    fontFamily: 'Inter',
    fontSize: 10,
    color: ILOWA_COLORS.textMuted,
  },
  methodText: {
    fontFamily: 'Inter',
    fontSize: 10,
    color: ILOWA_COLORS.purple,
    marginBottom: 6,
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    marginBottom: 8,
    gap: 2,
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: ILOWA_COLORS.cyan,
  },
  wave: {
    position: 'absolute',
    backgroundColor: ILOWA_COLORS.cyan,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ILOWA_COLORS.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  duration: {
    fontFamily: 'Sora',
    fontSize: 12,
    color: ILOWA_COLORS.doubt,
    marginTop: 6,
  },
  statusText: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: ILOWA_COLORS.gold,
    marginTop: 6,
  },
  errorText: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: ILOWA_COLORS.doubt,
    marginTop: 4,
  },
});
