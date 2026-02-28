/**
 * Premium Toggle with Cultural Pattern Track
 * 
 * Smooth sliding toggle with cultural textile patterns woven into the track.
 * The patterns (Kente, Batik, Ndebele, etc.) appear in the slider background,
 * giving each region a unique premium feel.
 */

import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolateColor,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, Pattern, Rect, G } from 'react-native-svg';
import { getCulturalPattern, CulturalPattern } from '../theme/cultural-patterns';
import { ILOWA_COLORS } from '../theme/colors';

interface PremiumToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  regionKey?: string;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
}

// Cultural pattern SVG — OFF: subtle weave texture only, ON: full rich pattern
function CulturalPatternTrack({
  pattern, width, height, active,
}: { pattern: CulturalPattern; width: number; height: number; active: boolean; }) {
  if (!active) {
    return (
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="off-weave" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
            <Path d="M0,0 L6,6 M6,0 L0,6" stroke="rgba(255,255,255,0.09)" strokeWidth="0.8" />
            <Path d="M3,0 L3,6 M0,3 L6,3"  stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#off-weave)" rx={height / 2} />
      </Svg>
    );
  }
  const S = 20; // ON: 20×20 tile
  
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern id={`kp-${pattern.id}`} x="0" y="0" width={S} height={S} patternUnits="userSpaceOnUse">
          {pattern.id === 'west-africa' && (
            <G>
              {/* Kente: vertical warp bands */}
              <Rect x="0"  y="0" width="5"  height={S} fill="#006B3F" />
              <Rect x="5"  y="0" width="5"  height={S} fill="#FCD116" />
              <Rect x="10" y="0" width="5"  height={S} fill="#CE1126" />
              <Rect x="15" y="0" width="5"  height={S} fill="#000000" />
              {/* Weft strips */}
              <Rect x="0" y="0"  width={S} height="3" fill="#FCD116" opacity="0.9" />
              <Rect x="0" y="5"  width={S} height="2" fill="#000"    opacity="0.7" />
              <Rect x="0" y="9"  width={S} height="3" fill="#CE1126" opacity="0.8" />
              <Rect x="0" y="14" width={S} height="2" fill="#006B3F" opacity="0.7" />
              <Rect x="0" y="17" width={S} height="3" fill="#FCD116" opacity="0.9" />
              {/* Centre Adinkra diamond */}
              <Path d="M10,3 L15,10 L10,17 L5,10 Z"  fill="#FCD116" />
              <Path d="M10,6 L13,10 L10,14 L7,10 Z"  fill="#000000" />
              <Rect  x="9" y="9" width="2" height="2" fill="#FCD116" />
              {/* Corner step triangles */}
              <Path d="M0,0 L4,0 L0,4 Z"   fill="#FCD116" />
              <Path d="M20,0 L20,4 L16,0 Z" fill="#FCD116" />
            </G>
          )}
          {pattern.id === 'east-africa' && (
            <G>
              <Rect x="0" y="0"  width={S} height="4" fill={pattern.primaryColor} />
              <Rect x="0" y="4"  width={S} height="1" fill="#FFFFFF" opacity="0.5" />
              <Rect x="0" y="5"  width={S} height="4" fill={pattern.secondaryColor} />
              <Rect x="0" y="9"  width={S} height="2" fill="#000" opacity="0.5" />
              <Rect x="0" y="11" width={S} height="4" fill={pattern.accentColor} />
              <Rect x="0" y="15" width={S} height="1" fill="#FFFFFF" opacity="0.5" />
              <Rect x="0" y="16" width={S} height="4" fill={pattern.primaryColor} />
              {[2,5,8,11,14,17].map((x: number) => <Rect key={x} x={x} y="9" width="1.5" height="2" fill="#FCD116" rx="0.75" />)}
            </G>
          )}
          {pattern.id === 'southern-africa' && (
            <G>
              <Rect x="0" y="0" width={S} height={S} fill={pattern.primaryColor} />
              <Rect x="2" y="2" width="16" height="16" fill={pattern.secondaryColor} />
              <Rect x="4" y="4" width="12" height="12" fill={pattern.primaryColor} />
              <Rect x="6" y="6" width="8"  height="8"  fill={pattern.accentColor} />
              <Rect x="8" y="8" width="4"  height="4"  fill="#FFFFFF" />
              <Rect x="9" y="9" width="2"  height="2"  fill="#000000" />
            </G>
          )}
          {pattern.id === 'southeast-asia' && (
            <G>
              <Rect x="0" y="0" width={S} height={S} fill={pattern.primaryColor} opacity="0.9" />
              <Path d="M0,5 Q5,10 10,5 Q15,0 20,5"   fill="none" stroke={pattern.secondaryColor} strokeWidth="2.5" />
              <Path d="M0,15 Q5,20 10,15 Q15,10 20,15" fill="none" stroke={pattern.secondaryColor} strokeWidth="2.5" />
              <Path d="M0,0 Q5,5 10,0 Q15,-5 20,0"     fill="none" stroke={pattern.accentColor} strokeWidth="1.5" />
              <Path d="M0,10 Q5,15 10,10 Q15,5 20,10"  fill="none" stroke={pattern.accentColor} strokeWidth="1.5" />
              <Rect x="3"  y="4"  width="2" height="2" fill="#FCD116" rx="1" />
              <Rect x="13" y="14" width="2" height="2" fill="#FCD116" rx="1" />
            </G>
          )}
          {pattern.id === 'south-asia' && (
            <G>
              <Rect x="0" y="0" width={S} height={S} fill={pattern.primaryColor} />
              <Path d="M10,0 L20,10 L10,20 L0,10 Z"  fill={pattern.secondaryColor} />
              <Path d="M10,4 L16,10 L10,16 L4,10 Z"  fill={pattern.primaryColor} />
              <Path d="M10,7 L13,10 L10,13 L7,10 Z"  fill={pattern.accentColor} />
              <Rect x="9" y="9" width="2" height="2" fill="#FFD700" />
            </G>
          )}
          {pattern.id === 'mena' && (
            <G>
              <Rect x="0" y="0" width={S} height={S} fill={pattern.primaryColor} />
              <Path d="M10,0 L12,8 L20,10 L12,12 L10,20 L8,12 L0,10 L8,8 Z" fill={pattern.secondaryColor} />
              <Path d="M10,5 L11,9 L15,10 L11,11 L10,15 L9,11 L5,10 L9,9 Z" fill={pattern.accentColor} />
              <Rect x="9" y="9" width="2" height="2" fill="#FFD700" />
            </G>
          )}
          {pattern.id === 'latin-america' && (
            <G>
              <Rect x="0" y="0" width={S} height={S} fill={pattern.primaryColor} />
              <Path d="M0,0 L8,0 L8,8 L4,8 L4,4 L0,4 Z" fill={pattern.secondaryColor} />
              <Path d="M12,20 L20,20 L20,12 L16,12 L16,16 L12,16 Z" fill={pattern.secondaryColor} />
              <Rect x="8" y="8" width="4" height="4" fill={pattern.accentColor} />
              <Rect x="9" y="9" width="2" height="2" fill="#FFD700" />
            </G>
          )}
          {pattern.id === 'caribbean' && (
            <G>
              <Rect x="0" y="0" width={S} height={S} fill={pattern.primaryColor} />
              <Path d="M0,5 L10,0 L20,5"  fill="none" stroke={pattern.secondaryColor} strokeWidth="3" />
              <Path d="M0,10 L10,5 L20,10" fill="none" stroke={pattern.accentColor}   strokeWidth="3" />
              <Path d="M0,15 L10,10 L20,15" fill="none" stroke={pattern.secondaryColor} strokeWidth="3" />
              <Path d="M0,20 L10,15 L20,20" fill="none" stroke="#FFD700" strokeWidth="2" />
            </G>
          )}
          {pattern.id === 'pacific' && (
            <G>
              <Rect x="0"  y="0"  width="10" height="10" fill={pattern.primaryColor} />
              <Rect x="10" y="10" width="10" height="10" fill={pattern.primaryColor} />
              <Rect x="10" y="0"  width="10" height="10" fill={pattern.secondaryColor} />
              <Rect x="0"  y="10" width="10" height="10" fill={pattern.secondaryColor} />
              <Path d="M0,10 L20,10 M10,0 L10,20" stroke={pattern.accentColor} strokeWidth="2.5" />
              <Path d="M2,2 L8,8 M18,2 L12,8 M2,18 L8,12 M18,18 L12,12" stroke="#000" strokeWidth="1.5" />
            </G>
          )}
          {!['west-africa','east-africa','southern-africa','southeast-asia','south-asia','mena','latin-america','caribbean','pacific'].includes(pattern.id) && (
            <G>
              <Rect x="0" y="0" width={S} height={S} fill={pattern.primaryColor} opacity="0.7" />
              <Path d={`M${S/2},0 L${S},${S/2} L${S/2},${S} L0,${S/2} Z`} fill={pattern.secondaryColor} />
              <Rect x={S/2-2} y={S/2-2} width="4" height="4" fill={pattern.accentColor} />
            </G>
          )}
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill={`url(#kp-${pattern.id})`} rx={height / 2} />
    </Svg>
  );
}

export function PremiumToggle({
  value,
  onChange,
  regionKey = 'west-africa',
  disabled = false,
  size = 'medium',
}: PremiumToggleProps) {
  const pattern = getCulturalPattern(regionKey);
  const progress = useSharedValue(value ? 1 : 0);

  // Size configurations
  const sizes = {
    small: { width: 44, height: 24, thumbSize: 20, padding: 2 },
    medium: { width: 56, height: 30, thumbSize: 26, padding: 2 },
    large: { width: 68, height: 36, thumbSize: 32, padding: 2 },
  };
  const config = sizes[size];
  const thumbTravel = config.width - config.thumbSize - config.padding * 2;

  React.useEffect(() => {
    // Smooth, non-pulsing spring animation
    progress.value = withSpring(value ? 1 : 0, {
      damping: 20,
      stiffness: 180,
      mass: 0.6,
      overshootClamping: true,
    });
  }, [value]);

  const handlePress = () => {
    if (!disabled) {
      onChange(!value);
    }
  };

  // Animated thumb position - no scale to avoid pulsing
  const thumbStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: progress.value * thumbTravel },
      ],
    };
  });

  // Animated track background
  const trackStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      progress.value,
      [0, 1],
      ['rgba(60, 60, 80, 0.6)', `${pattern.primaryColor}40`]
    );
    return { backgroundColor };
  });

  // Animated thumb color
  const thumbInnerStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      progress.value,
      [0, 1],
      ['#6B7280', pattern.primaryColor]
    );
    return { backgroundColor };
  });

  // Glow effect when active - subtle, no scale pulsing
  const glowStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(value ? 0.35 : 0, { duration: 250 }),
    };
  });

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={[styles.container, { width: config.width, height: config.height }]}
    >
      {/* Outer glow ring (active state) */}
      <Animated.View
        style={[
          styles.glow,
          {
            width: config.width + 10,
            height: config.height + 10,
            borderRadius: (config.height + 10) / 2,
          },
          glowStyle,
          { backgroundColor: pattern.primaryColor },
        ]}
      />

      {/* TRACK — pressed-in channel look */}
      <Animated.View
        style={[
          styles.track,
          { width: config.width, height: config.height, borderRadius: config.height / 2 },
          trackStyle,
        ]}
      >
        {/* Kente / cultural pattern — always visible */}
        <CulturalPatternTrack
          pattern={pattern}
          width={config.width}
          height={config.height}
          active={value}
        />

        {/* Inset channel gradient: dark top → transparent mid → dark bottom */}
        <LinearGradient
          colors={[
            'rgba(0,0,0,0.55)',
            'rgba(0,0,0,0.05)',
            'rgba(0,0,0,0.08)',
            'rgba(0,0,0,0.4)',
          ]}
          style={[StyleSheet.absoluteFill, { borderRadius: config.height / 2 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />

        {/* Left inner edge shadow (light comes from top-right) */}
        <LinearGradient
          colors={['rgba(0,0,0,0.35)', 'transparent']}
          style={[StyleSheet.absoluteFill, { borderRadius: config.height / 2 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.4, y: 0 }}
        />
      </Animated.View>

      {/* THUMB — raised, metallic sphere */}
      <Animated.View
        style={[
          styles.thumb,
          {
            width: config.thumbSize,
            height: config.thumbSize,
            borderRadius: config.thumbSize / 2,
            left: config.padding,
            top: config.padding,
            elevation: value ? 14 : 10,
            shadowColor: value ? pattern.primaryColor : '#000',
            shadowOpacity: value ? 0.7 : 0.5,
            shadowRadius: value ? 8 : 5,
          },
          thumbStyle,
        ]}
      >
        {/* Base thumb surface */}
        <Animated.View style={[styles.thumbBase, { borderRadius: config.thumbSize / 2 }, thumbInnerStyle]} />

        {/* Convex sphere highlight — top-left bright arc */}
        <LinearGradient
          colors={[
            'rgba(255,255,255,0.9)',
            'rgba(255,255,255,0.35)',
            'rgba(255,255,255,0)',
          ]}
          style={[StyleSheet.absoluteFill, { borderRadius: config.thumbSize / 2 }]}
          start={{ x: 0.1, y: 0.05 }}
          end={{ x: 0.7, y: 0.85 }}
        />

        {/* Bottom darkening — simulates underside of sphere */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.45)']}
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: config.thumbSize / 2, top: '50%' },
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />

        {/* Specular hot-spot (top-left white dot) */}
        <View
          style={[
            styles.specular,
            {
              width: config.thumbSize * 0.28,
              height: config.thumbSize * 0.18,
              top: config.thumbSize * 0.12,
              left: config.thumbSize * 0.18,
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    top: -5,
    left: -5,
    opacity: 0,
  },
  track: {
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.55)',
    // Raised outer lip shadow (elevation on Android)
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
  thumb: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 5 },
    // elevation set inline (varies with value)
  },
  thumbBase: {
    ...StyleSheet.absoluteFillObject,
  },
  specular: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 100,
  },
});

export default PremiumToggle;
