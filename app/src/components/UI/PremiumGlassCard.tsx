import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface PremiumGlassCardProps {
  children: React.ReactNode;
  glowColor?: string;
  style?: ViewStyle;
  padding?: number;
  animate?: boolean;
}

export function PremiumGlassCard({
  children,
  glowColor = '#FFD700',
  style,
  padding = 20,
  animate = true,
}: PremiumGlassCardProps) {
  const glowOpacity = useSharedValue(0.3);
  const topLineOpacity = useSharedValue(0.6);

  useEffect(() => {
    // on Android the per-card looping anims murder the UI thread when many cards are visible
    if (!animate || Platform.OS === 'android') return;
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.65, { duration: 2200, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
        withTiming(0.25, { duration: 2200, easing: Easing.bezier(0.4, 0, 0.2, 1) })
      ),
      -1,
      true
    );
    topLineOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 1800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [animate]);

  const outerGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const topLineStyle = useAnimatedStyle(() => ({
    opacity: topLineOpacity.value,
  }));

  return (
    <View style={[styles.wrapper, style]}>
      {/* Outer ambient glow */}
      <Animated.View
        style={[
          styles.outerGlow,
          outerGlowStyle,
          { shadowColor: glowColor },
        ]}
        pointerEvents="none"
      />

      {/* Card body */}
      <View style={[styles.container, { borderColor: `${glowColor}28` }]}>
        <LinearGradient
          colors={[
            'rgba(255,255,255,0.11)',
            'rgba(255,255,255,0.05)',
            'rgba(255,255,255,0.08)',
          ]}
          style={[styles.gradient, { padding }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Top highlight line (glass rim) */}
          <Animated.View
            style={[
              styles.topLine,
              topLineStyle,
              { backgroundColor: glowColor },
            ]}
            pointerEvents="none"
          />

          {/* Inner top shadow for depth */}
          <View style={styles.innerTopShadow} pointerEvents="none" />

          {children}
        </LinearGradient>

        {/* Bottom accent glow strip */}
        <View
          style={[styles.bottomAccent, { backgroundColor: `${glowColor}18` }]}
          pointerEvents="none"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  outerGlow: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 0,
  },
  container: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: 'rgba(14, 14, 22, 0.92)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: Platform.OS === 'android' ? 2 : 8,
  },
  gradient: {
    borderRadius: 18,
    position: 'relative',
  },
  topLine: {
    position: 'absolute',
    top: 0,
    left: '10%',
    right: '10%',
    height: 1.5,
    borderRadius: 1,
    opacity: 0.7,
  },
  innerTopShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  bottomAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
});
