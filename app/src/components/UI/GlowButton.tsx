import React, { useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ILOWA_COLORS } from '../../theme/colors';

interface GlowButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  color?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function GlowButton({
  onPress,
  children,
  color = ILOWA_COLORS.gold,
  style,
  textStyle,
  disabled = false,
  size = 'medium',
}: GlowButtonProps) {
  const glowOpacity = useSharedValue(0.4);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (Platform.OS === 'android') return; // skip looping glow on Android
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1500 }),
        withTiming(0.4, { duration: 1500 })
      ),
      -1,
      true
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: disabled ? 0.2 : glowOpacity.value,
    transform: [{ scale: scale.value }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.96, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 100 });
  };

  const sizeStyles = {
    small: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
    medium: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
    large: { paddingHorizontal: 32, paddingVertical: 18, borderRadius: 20 },
  };

  const textSizes = {
    small: 13,
    medium: 15,
    large: 17,
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      activeOpacity={0.9}
      style={[styles.container, style]}
    >
      {/* Glow layer */}
      <Animated.View style={[styles.glow, glowStyle]}>
        <LinearGradient
          colors={[`${color}60`, `${color}00`]}
          style={styles.glowGradient}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* Button */}
      <Animated.View style={buttonStyle}>
        <LinearGradient
          colors={disabled ? ['#475569', '#334155'] : [color, `${color}CC`]}
          style={[styles.button, sizeStyles[size]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {typeof children === 'string' ? (
            <Text style={[styles.text, { fontSize: textSizes[size] }, textStyle]}>
              {children}
            </Text>
          ) : (
            children
          )}
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 24,
  },
  glowGradient: {
    flex: 1,
    borderRadius: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    fontFamily: 'Sora-Bold',
    color: '#0F172A',
    textAlign: 'center',
  },
});
