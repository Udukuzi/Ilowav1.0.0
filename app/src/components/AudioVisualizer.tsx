/**
 * AudioVisualizer Component
 * 
 * Real-time audio visualization that syncs with playback.
 * Uses Reanimated for smooth 60fps animations.
 * 
 * Since we can't access raw audio FFT data in Expo Go,
 * we simulate frequency bands based on audio metering levels.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { getCurrentSound } from '../lib/radio/stream';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Ilowa color palette
const ILOWA_COLORS = {
  gold: '#FFD700',
  purple: '#8B5CF6',
  cyan: '#00D9FF',
  magenta: '#FF006E',
  dark: '#0A0A0F',
};

interface AudioVisualizerProps {
  isPlaying: boolean;
  barCount?: number;
  height?: number;
  style?: any;
  colorScheme?: 'gradient' | 'cyan' | 'gold' | 'purple';
}

export function AudioVisualizer({
  isPlaying,
  barCount = 32,
  height = 100,
  style,
  colorScheme = 'gradient',
}: AudioVisualizerProps) {
  const [frequencies, setFrequencies] = useState<number[]>(
    Array(barCount).fill(0)
  );
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  const audioLevelRef = useRef(0);

  // Subscribe to audio metering when playing
  useEffect(() => {
    if (!isPlaying) {
      // Reset to flat when stopped
      setFrequencies(Array(barCount).fill(0));
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    // Get current sound and subscribe to status updates
    const sound = getCurrentSound();
    
    const updateVisualization = () => {
      // Generate frequencies based on audio level and simulated spectrum
      const newFreqs = generateFrequencies(barCount, audioLevelRef.current);
      setFrequencies(newFreqs);
    };

    // Set up audio metering listener
    const setupMetering = async () => {
      if (sound) {
        sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
          if (status.isLoaded && status.isPlaying) {
            // Use position change rate as proxy for audio activity
            // In a real implementation, we'd use native FFT
            const positionDelta = status.positionMillis % 1000;
            audioLevelRef.current = 0.5 + (Math.sin(positionDelta / 100) * 0.3) + (Math.random() * 0.2);
          }
        });
      }
    };

    setupMetering();

    // Animation loop (60fps target)
    animationRef.current = setInterval(updateVisualization, 50);

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [isPlaying, barCount]);

  return (
    <View style={[styles.container, { height }, style]}>
      <View style={styles.barsContainer}>
        {frequencies.map((freq, index) => (
          <VisualizerBar
            key={index}
            frequency={freq}
            index={index}
            total={barCount}
            maxHeight={height - 10}
            colorScheme={colorScheme}
            isPlaying={isPlaying}
          />
        ))}
      </View>
    </View>
  );
}

interface VisualizerBarProps {
  frequency: number;
  index: number;
  total: number;
  maxHeight: number;
  colorScheme: 'gradient' | 'cyan' | 'gold' | 'purple';
  isPlaying: boolean;
}

function VisualizerBar({
  frequency,
  index,
  total,
  maxHeight,
  colorScheme,
  isPlaying,
}: VisualizerBarProps) {
  const barHeight = useSharedValue(0);
  const barOpacity = useSharedValue(0.3);

  useEffect(() => {
    if (isPlaying) {
      barHeight.value = withSpring(frequency * maxHeight, {
        damping: 15,
        stiffness: 150,
      });
      barOpacity.value = withTiming(0.5 + frequency * 0.5, { duration: 100 });
    } else {
      barHeight.value = withTiming(0, { duration: 300 });
      barOpacity.value = withTiming(0.3, { duration: 300 });
    }
  }, [frequency, isPlaying, maxHeight]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: Math.max(4, barHeight.value),
    opacity: barOpacity.value,
  }));

  const barColor = getBarColor(index, total, colorScheme);
  const barWidth = Math.max(2, (SCREEN_WIDTH - 40) / total - 2);

  return (
    <Animated.View
      style={[
        styles.bar,
        animatedStyle,
        {
          width: barWidth,
          backgroundColor: barColor,
          shadowColor: barColor,
        },
      ]}
    />
  );
}

/**
 * Generate simulated frequency bands based on audio level
 * Creates a realistic-looking spectrum with bass emphasis
 */
function generateFrequencies(barCount: number, audioLevel: number): number[] {
  const frequencies: number[] = [];
  const time = Date.now() / 1000;

  for (let i = 0; i < barCount; i++) {
    const position = i / barCount;
    
    // Bass (left) reacts more than treble (right)
    const bassWeight = 1 - position * 0.5;
    
    // Add some wave motion for visual interest
    const wave1 = Math.sin(time * 3 + i * 0.3) * 0.15;
    const wave2 = Math.sin(time * 5 + i * 0.5) * 0.1;
    
    // Random variation (simulates audio dynamics)
    const random = (Math.random() - 0.5) * 0.2;
    
    // Combine all factors
    let value = audioLevel * bassWeight + wave1 + wave2 + random;
    
    // Clamp to 0-1
    value = Math.max(0, Math.min(1, value));
    
    frequencies.push(value);
  }

  return frequencies;
}

/**
 * Get bar color based on position and color scheme
 */
function getBarColor(
  index: number,
  total: number,
  scheme: 'gradient' | 'cyan' | 'gold' | 'purple'
): string {
  const position = index / total;

  switch (scheme) {
    case 'cyan':
      return ILOWA_COLORS.cyan;
    case 'gold':
      return ILOWA_COLORS.gold;
    case 'purple':
      return ILOWA_COLORS.purple;
    case 'gradient':
    default:
      // Gradient: Gold (bass) → Purple (mids) → Cyan (treble)
      if (position < 0.33) {
        return ILOWA_COLORS.gold;
      } else if (position < 0.66) {
        return ILOWA_COLORS.purple;
      } else {
        return ILOWA_COLORS.cyan;
      }
  }
}

/**
 * Mini visualizer for compact spaces (now playing cards, etc.)
 */
export function MiniVisualizer({
  isPlaying,
  barCount = 5,
  height = 24,
  style,
}: {
  isPlaying: boolean;
  barCount?: number;
  height?: number;
  style?: any;
}) {
  return (
    <AudioVisualizer
      isPlaying={isPlaying}
      barCount={barCount}
      height={height}
      style={style}
      colorScheme="cyan"
    />
  );
}

/**
 * Circular visualizer for album art overlay
 */
export function CircularVisualizer({
  isPlaying,
  size = 200,
  style,
}: {
  isPlaying: boolean;
  size?: number;
  style?: any;
}) {
  const [rings, setRings] = useState<number[]>([0, 0, 0]);
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      setRings([0, 0, 0]);
      if (animationRef.current) clearInterval(animationRef.current);
      return;
    }

    animationRef.current = setInterval(() => {
      setRings([
        0.3 + Math.random() * 0.4,
        0.2 + Math.random() * 0.5,
        0.4 + Math.random() * 0.3,
      ]);
    }, 100);

    return () => {
      if (animationRef.current) clearInterval(animationRef.current);
    };
  }, [isPlaying]);

  return (
    <View style={[styles.circularContainer, { width: size, height: size }, style]}>
      {rings.map((ring, index) => (
        <CircularRing key={index} scale={ring} index={index} size={size} isPlaying={isPlaying} />
      ))}
    </View>
  );
}

function CircularRing({
  scale,
  index,
  size,
  isPlaying,
}: {
  scale: number;
  index: number;
  size: number;
  isPlaying: boolean;
}) {
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0);

  useEffect(() => {
    if (isPlaying) {
      ringScale.value = withSpring(1 + scale * 0.3, { damping: 10 });
      ringOpacity.value = withTiming(0.3 + scale * 0.4, { duration: 150 });
    } else {
      ringScale.value = withTiming(1, { duration: 300 });
      ringOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [scale, isPlaying]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const ringSize = size - index * 30;
  const colors = [ILOWA_COLORS.gold, ILOWA_COLORS.purple, ILOWA_COLORS.cyan];

  return (
    <Animated.View
      style={[
        styles.circularRing,
        animatedStyle,
        {
          width: ringSize,
          height: ringSize,
          borderRadius: ringSize / 2,
          borderColor: colors[index],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'hidden',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },
  bar: {
    borderRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  circularContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  circularRing: {
    position: 'absolute',
    borderWidth: 2,
  },
});

export default AudioVisualizer;
