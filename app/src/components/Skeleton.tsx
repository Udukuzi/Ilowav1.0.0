import { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { ILOWA_COLORS } from '../theme/colors';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ 
  width = '100%', 
  height = 16, 
  borderRadius = 8,
  style 
}: SkeletonProps) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1200 }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.6, 0.3]),
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function MarketCardSkeleton() {
  return (
    <View style={styles.marketCard}>
      <View style={styles.marketHeader}>
        <Skeleton width={60} height={20} borderRadius={8} />
        <Skeleton width={50} height={16} borderRadius={8} />
      </View>
      <Skeleton width="90%" height={18} style={{ marginBottom: 8 }} />
      <Skeleton width="70%" height={18} style={{ marginBottom: 16 }} />
      <Skeleton width="100%" height={6} borderRadius={3} style={{ marginBottom: 12 }} />
      <View style={styles.marketPoolRow}>
        <Skeleton width={80} height={14} />
        <Skeleton width={80} height={14} />
      </View>
      <View style={styles.marketFooter}>
        <Skeleton width={60} height={12} />
        <Skeleton width={80} height={12} />
      </View>
    </View>
  );
}

export function RadioPlayerSkeleton() {
  return (
    <View style={styles.radioPlayer}>
      <View style={styles.radioTop}>
        <Skeleton width={80} height={80} borderRadius={12} />
        <View style={styles.radioInfo}>
          <Skeleton width={120} height={18} style={{ marginBottom: 8 }} />
          <Skeleton width={160} height={14} style={{ marginBottom: 4 }} />
          <Skeleton width={100} height={12} />
        </View>
      </View>
      <Skeleton width="100%" height={48} borderRadius={24} style={{ marginTop: 16 }} />
    </View>
  );
}

export function ChatMessageSkeleton() {
  return (
    <View style={styles.chatMessage}>
      <Skeleton width={32} height={32} borderRadius={16} />
      <View style={styles.chatBubble}>
        <Skeleton width={60} height={12} style={{ marginBottom: 4 }} />
        <Skeleton width={180} height={14} />
      </View>
    </View>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.listItem}>
          <Skeleton width={48} height={48} borderRadius={12} />
          <View style={styles.listItemContent}>
            <Skeleton width="60%" height={16} style={{ marginBottom: 6 }} />
            <Skeleton width="40%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: ILOWA_COLORS.cardDark,
  },
  marketCard: {
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  marketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  marketPoolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  marketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 10,
  },
  radioPlayer: {
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  radioTop: {
    flexDirection: 'row',
    gap: 16,
  },
  radioInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  chatMessage: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  chatBubble: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 10,
  },
  list: {
    gap: 12,
  },
  listItem: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 12,
    padding: 12,
  },
  listItemContent: {
    flex: 1,
    justifyContent: 'center',
  },
});
