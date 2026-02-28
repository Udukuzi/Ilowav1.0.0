/**
 * Premium Wave Visualizer — Mirrored Waveform
 *
 * 40 thin bars radiating up AND down from the centre line, like wavesurfer.js.
 * One time SharedValue drives all bars (unique freq+phase per bar).
 * No separate "cap" rect — each bar is a single rounded rect that grows
 * symmetrically so there are no flat tips.
 * Accent color fades from full opacity in the centre to 60% at the edges.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  Easing,
  SharedValue,
} from 'react-native-reanimated';
import Svg, { Rect, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { LinearGradient as ExpoGradient } from 'expo-linear-gradient';
import { ILOWA_COLORS } from '../theme/colors';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_W     = 4;    // Thin bars
const BAR_GAP   = 2;    // Tight gaps
// Fill the entire container width — no gap on either side
const BAR_COUNT = Math.floor((SCREEN_WIDTH + BAR_GAP) / (BAR_W + BAR_GAP));

interface PremiumWaveVisualizerProps {
  isPlaying: boolean;
  height?: number;
  style?: any;
  accentColor?: string;
}

function getBarParams(i: number, total: number) {
  // Three layers of oscillation — prevents the "looping" feel
  const freq   = 1.1 + (i % 7) * 0.31 + (i % 3) * 0.18;
  const phase  = (i / total) * Math.PI * 6.8;
  const freq2  = freq * 1.618 + (i % 5) * 0.14;   // golden ratio offset
  const phase2 = phase * 0.73;
  const freq3  = freq * 0.37 + (i % 11) * 0.09;   // slow drift layer
  const phase3 = phase * 1.41;
  // Bell-curve amplitude: bars near centre hit harder, edges are quieter
  const norm  = i / Math.max(total - 1, 1);
  const bell  = Math.sin(norm * Math.PI);
  const amplitudeScale = 0.32 + bell * 0.68;
  // Opacity: brighter towards the centre
  const opacity = 0.52 + bell * 0.48;
  return { freq, phase, freq2, phase2, freq3, phase3, amplitudeScale, opacity };
}

// Single mirrored bar — extends symmetrically above AND below the centre
function WaveBar({
  time,
  barIndex,
  barX,
  centreY,
  maxHalf,      // max half-height (bar grows ±maxHalf from centreY)
  color,
  opacity,
}: {
  time: SharedValue<number>;
  barIndex: number;
  barX: number;
  centreY: number;
  maxHalf: number;
  color: string;
  opacity: number;
}) {
  const { freq, phase, freq2, phase2, freq3, phase3, amplitudeScale } = getBarParams(barIndex, BAR_COUNT);
  const minHalf = maxHalf * 0.05;  // never fully flat

  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const s1  = Math.sin(time.value * freq  + phase);
    const s2  = Math.sin(time.value * freq2 + phase2);
    const s3  = Math.sin(time.value * freq3 + phase3);  // slow drift
    // Three-layer mix: main + detail + drift — creates non-repeating motion
    const raw = (s1 * 0.48 + s2 * 0.32 + s3 * 0.20 + 1) / 2;
    // Sharpen peaks so bars snap up and down more dynamically
    const shaped = raw * raw * (3 - 2 * raw); // smoothstep for punchier peaks
    const half = minHalf + (maxHalf - minHalf) * shaped * amplitudeScale;
    return {
      y:      centreY - half,
      height: half * 2,
    };
  });

  return (
    <AnimatedRect
      animatedProps={animatedProps}
      x={barX}
      width={BAR_W}
      rx={BAR_W / 2}            // fully rounded ends — no flat tip
      fill={color}
      opacity={opacity}
    />
  );
}

export function PremiumWaveVisualizer({
  isPlaying,
  height = 150,
  style,
  accentColor = ILOWA_COLORS.gold,
}: PremiumWaveVisualizerProps) {
  const totalW = (BAR_W + BAR_GAP) * BAR_COUNT - BAR_GAP;
  const svgWidth = Math.max(SCREEN_WIDTH, totalW);
  const centreY = height / 2;
  const maxHalf = height * 0.44;  // bars can reach 44% above/below centre
  const time = useSharedValue(0);

  useEffect(() => {
    if (isPlaying) {
      // Much longer cycle (200π) so the three-layer mix never truly repeats visibly
      time.value = withRepeat(
        withTiming(Math.PI * 200, { duration: 140_000, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      time.value = withTiming(0, { duration: 900, easing: Easing.out(Easing.quad) });
    }
  }, [isPlaying]);

  // Bars start at 0 — fill the full width, no centering offset
  const startX = 0;

  return (
    <View style={[styles.container, { height }, style]}>
      {/* Dark glass background */}
      <ExpoGradient
        colors={['rgba(10,10,24,0.97)', 'rgba(5,5,14,1)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Horizontal ambient glow band */}
      <View style={[styles.ambientGlow, { opacity: isPlaying ? 1 : 0.15 }]}>
        <ExpoGradient
          colors={[
            'transparent',
            `${accentColor}1A`,
            '#00D9FF12',
            `${ILOWA_COLORS.purple}10`,
            'transparent',
          ]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        />
      </View>

      {/* Waveform SVG */}
      <Svg width={svgWidth} height={height} style={StyleSheet.absoluteFill}>
        {/* Centre reference line — full width */}
        <Rect
          x={0}
          y={centreY - 0.5}
          width={svgWidth}
          height={1}
          fill={`${accentColor}28`}
        />
        {/* Mirrored bars */}
        {Array.from({ length: BAR_COUNT }, (_, i) => {
          const { opacity } = getBarParams(i, BAR_COUNT);
          const barX = startX + i * (BAR_W + BAR_GAP);
          return (
            <WaveBar
              key={i}
              time={time}
              barIndex={i}
              barX={barX}
              centreY={centreY}
              maxHalf={maxHalf}
              color={accentColor}
              opacity={opacity}
            />
          );
        })}
      </Svg>

      {/* Glass top sheen */}
      <View style={styles.glassOverlay} pointerEvents="none">
        <ExpoGradient
          colors={['rgba(255,255,255,0.06)', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.3 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  ambientGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
});

export default PremiumWaveVisualizer;
