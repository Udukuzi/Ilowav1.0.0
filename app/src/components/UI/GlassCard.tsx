import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ILOWA_COLORS } from '../../theme/colors';

interface GlassCardProps {
  children: React.ReactNode;
  intensity?: number;
  style?: ViewStyle;
  borderColor?: string;
  padding?: number;
}

export function GlassCard({
  children,
  style,
  borderColor = 'rgba(255,255,255,0.15)',
  padding = 20,
}: GlassCardProps) {
  return (
    <View style={[styles.container, { borderColor }, style]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']}
        style={[styles.gradient, { padding }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {children}
      </LinearGradient>
    </View>
  );
}

interface GlassCardAccentProps extends GlassCardProps {
  accentColor?: string;
}

export function GlassCardAccent({
  children,
  style,
  accentColor = ILOWA_COLORS.cyan,
  padding = 20,
}: GlassCardAccentProps) {
  return (
    <View style={[styles.container, { borderColor: `${accentColor}30` }, style]}>
      <LinearGradient
        colors={[`${accentColor}12`, 'rgba(255,255,255,0.03)']}
        style={[styles.gradient, { padding }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {children}
      </LinearGradient>
      {/* Accent glow */}
      <View style={[styles.accentGlow, { backgroundColor: accentColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: ILOWA_COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  blur: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  accentGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.6,
  },
});
