import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ILOWA_COLORS, ElderRegionKey } from '../../theme/colors';
import { ELDERS, getElderByRegion } from '../../data/elders';
import { ElderAvatar } from '../../components/ElderAvatar';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 60) / 2;

interface RegionOption {
  key: ElderRegionKey;
  label: string;
  icon: string;
}

const REGIONS: RegionOption[] = [
  { key: 'westAfrica', label: 'West Africa', icon: '🌍' },
  { key: 'eastAfrica', label: 'East Africa', icon: '🌍' },
  { key: 'southernAfrica', label: 'Southern Africa', icon: '🌍' },
  { key: 'latinAmerica', label: 'Latin America', icon: '🌎' },
  { key: 'southAsia', label: 'South Asia', icon: '🌏' },
  { key: 'southeastAsia', label: 'Southeast Asia', icon: '🌏' },
  { key: 'mena', label: 'Middle East & North Africa', icon: '🌍' },
  { key: 'caribbean', label: 'Caribbean', icon: '🌎' },
  { key: 'pacific', label: 'Pacific Islands', icon: '🌏' },
];

function RegionCard({
  region,
  index,
  selected,
  onPress,
}: {
  region: RegionOption;
  index: number;
  selected: boolean;
  onPress: () => void;
}) {
  const elder = getElderByRegion(region.key);
  const colors = ILOWA_COLORS.elders[region.key];
  const scale = useSharedValue(1);
  const breathe = useSharedValue(1);

  // Subtle breathing animation when selected
  if (selected) {
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 1200 }),
        withTiming(1, { duration: 1200 }),
      ),
      -1,
      false,
    );
  } else {
    breathe.value = withSpring(1);
  }

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: selected ? breathe.value : scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(100 + index * 60).duration(400).springify()}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.96); }}
        onPressOut={() => { scale.value = withSpring(1); }}
      >
        <Animated.View
          style={[
            styles.regionCard,
            selected && {
              borderColor: colors.primary,
              backgroundColor: `${colors.primary}12`,
            },
            cardStyle,
          ]}
        >
          {elder && (
            <View style={styles.elderPreview}>
              <ElderAvatar elder={elder} size={56} showGlow={selected} />
            </View>
          )}
          <Text style={styles.regionEmoji}>{region.icon}</Text>
          <Text
            style={[
              styles.regionLabel,
              selected && { color: colors.primary },
            ]}
            numberOfLines={2}
          >
            {region.label}
          </Text>
          {elder && (
            <Text
              style={[
                styles.elderName,
                selected && { color: colors.primary, opacity: 1 },
              ]}
            >
              {elder.name}
            </Text>
          )}
          {selected && (
            <Animated.View
              entering={FadeInUp.duration(200)}
              style={[styles.checkBadge, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="checkmark" size={14} color={ILOWA_COLORS.deepBlack} />
            </Animated.View>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export default function RegionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<ElderRegionKey | null>(null);

  const selectedColors = selected ? ILOWA_COLORS.elders[selected] : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Animated.View entering={FadeInDown.delay(50).duration(500)}>
        <Text style={styles.title}>Choose Your Region</Text>
        <Text style={styles.subtitle}>
          Your Elder guide and language options are based on your region.
        </Text>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.grid}
      >
        {REGIONS.map((region, i) => (
          <RegionCard
            key={region.key}
            region={region}
            index={i}
            selected={selected === region.key}
            onPress={() => setSelected(region.key)}
          />
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={[
            styles.nextButton,
            !selected && styles.nextButtonDisabled,
            selected && selectedColors && { backgroundColor: selectedColors.primary },
          ]}
          disabled={!selected}
          onPress={() => {
            if (selected) {
              router.push({
                pathname: '/(onboarding)/language',
                params: { region: selected },
              });
            }
          }}
        >
          <Text style={styles.nextText}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color={ILOWA_COLORS.deepBlack} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ILOWA_COLORS.deepBlack, paddingHorizontal: 20 },
  title: {
    fontFamily: 'Sora-Bold', fontSize: 28, color: ILOWA_COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter', fontSize: 15, color: ILOWA_COLORS.textSecondary,
    lineHeight: 22, marginBottom: 20,
  },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    paddingBottom: 20,
  },
  regionCard: {
    width: CARD_WIDTH,
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 6,
    minHeight: 160,
    justifyContent: 'center',
  },
  elderPreview: {
    marginBottom: 4,
  },
  regionEmoji: {
    fontSize: 18,
  },
  regionLabel: {
    fontFamily: 'Sora-SemiBold', fontSize: 13, color: ILOWA_COLORS.textPrimary,
    textAlign: 'center',
  },
  elderName: {
    fontFamily: 'Inter', fontSize: 11, color: ILOWA_COLORS.textMuted,
    opacity: 0.7,
  },
  checkBadge: {
    position: 'absolute', top: 10, right: 10,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  footer: { paddingTop: 8 },
  nextButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ILOWA_COLORS.gold, paddingVertical: 16, borderRadius: 14,
  },
  nextButtonDisabled: { backgroundColor: ILOWA_COLORS.cardDark },
  nextText: { fontFamily: 'Sora-Bold', fontSize: 16, color: ILOWA_COLORS.deepBlack },
});
