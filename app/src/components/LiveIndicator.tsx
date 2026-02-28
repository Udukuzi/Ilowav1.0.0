/**
 * Live Indicator Component
 * 
 * Shows when DJ is live on radio
 */

import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { ILOWA_COLORS } from '../theme/colors';

interface LiveIndicatorProps {
  isLive: boolean;
  djName?: string;
  viewerCount?: number;
  size?: 'small' | 'medium' | 'large';
}

export function LiveIndicator({ 
  isLive, 
  djName, 
  viewerCount = 0,
  size = 'medium' 
}: LiveIndicatorProps) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (isLive) {
      pulse.value = withRepeat(
        withTiming(0.5, { duration: 800 }),
        -1,
        true
      );
    } else {
      pulse.value = 1;
    }
  }, [isLive]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  const sizeStyles = {
    small: { dot: 6, text: 10, padding: 4 },
    medium: { dot: 8, text: 12, padding: 6 },
    large: { dot: 10, text: 14, padding: 8 },
  };

  const s = sizeStyles[size];

  if (!isLive) {
    return (
      <View style={[styles.container, { paddingHorizontal: s.padding }]}>
        <View style={[styles.dot, styles.dotOffline, { width: s.dot, height: s.dot }]} />
        <Text style={[styles.text, styles.textOffline, { fontSize: s.text }]}>
          OFF AIR
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, styles.containerLive, { paddingHorizontal: s.padding }]}>
        <Animated.View 
          style={[
            styles.dot, 
            styles.dotLive, 
            { width: s.dot, height: s.dot },
            pulseStyle
          ]} 
        />
        <Text style={[styles.text, styles.textLive, { fontSize: s.text }]}>
          LIVE
        </Text>
      </View>
      
      {djName && (
        <Text style={[styles.djName, { fontSize: s.text }]}>
          {djName}
        </Text>
      )}
      
      {viewerCount > 0 && (
        <Text style={[styles.viewerCount, { fontSize: s.text - 2 }]}>
          👁 {formatViewerCount(viewerCount)}
        </Text>
      )}
    </View>
  );
}

function formatViewerCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    paddingVertical: 4,
  },
  containerLive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  dot: {
    borderRadius: 999,
  },
  dotLive: {
    backgroundColor: '#EF4444',
  },
  dotOffline: {
    backgroundColor: '#666',
  },
  text: {
    fontWeight: '700',
    letterSpacing: 1,
  },
  textLive: {
    color: '#EF4444',
  },
  textOffline: {
    color: '#666',
  },
  djName: {
    color: '#fff',
    fontWeight: '500',
  },
  viewerCount: {
    color: '#888',
  },
});
