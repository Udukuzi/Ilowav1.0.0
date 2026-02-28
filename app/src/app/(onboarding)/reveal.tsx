import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withSequence,
  runOnJS,
  Easing,
  FadeIn,
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ILOWA_COLORS, ElderRegionKey } from '../../theme/colors';
import { ELDERS, getElderByRegion } from '../../data/elders';
import { ElderAvatar } from '../../components/ElderAvatar';
import { useRegion } from '../../hooks/useRegion';
import { Elder } from '../../types/elder';

const { width, height } = Dimensions.get('window');

// Phases: cycling → landing → greeting → ready
type Phase = 'cycling' | 'landing' | 'greeting' | 'ready';

const CYCLE_INTERVAL = 180; // ms per Elder during fast flip
const CYCLE_COUNT = ELDERS.length * 2 + 3; // ~2 full rotations + overshoot

export default function RevealScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { region, language } = useLocalSearchParams<{ region: string; language: string }>();
  const regionKey = (region || 'westAfrica') as ElderRegionKey;
  const langCode = language || 'en';
  const { setRegion } = useRegion();

  const targetElder = getElderByRegion(regionKey) ?? ELDERS[0];
  const targetColors = ILOWA_COLORS.elders[regionKey];

  const [phase, setPhase] = useState<Phase>('cycling');
  const [displayElder, setDisplayElder] = useState<Elder>(ELDERS[0]);
  const cycleIndex = useRef(0);

  // Animation values
  const cardScale = useSharedValue(0.8);
  const cardOpacity = useSharedValue(0);
  const flipRotateY = useSharedValue(0);
  const glowRadius = useSharedValue(0);
  const greetingOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);
  const bgFlash = useSharedValue(0);

  // Phase 1: Rapid cycling through all Elders
  useEffect(() => {
    cardOpacity.value = withTiming(1, { duration: 300 });
    cardScale.value = withSpring(1, { damping: 15 });

    let count = 0;
    const targetIndex = ELDERS.findIndex((e) => e.region === regionKey);

    const interval = setInterval(() => {
      count++;
      const idx = count % ELDERS.length;
      setDisplayElder(ELDERS[idx]);

      // Flip animation per card
      flipRotateY.value = withSequence(
        withTiming(90, { duration: CYCLE_INTERVAL * 0.4, easing: Easing.in(Easing.ease) }),
        withTiming(0, { duration: CYCLE_INTERVAL * 0.4, easing: Easing.out(Easing.ease) }),
      );

      if (count >= CYCLE_COUNT) {
        clearInterval(interval);
        // Land on the target Elder
        setDisplayElder(ELDERS[targetIndex >= 0 ? targetIndex : 0]);
        setPhase('landing');
      }
    }, CYCLE_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  // Phase 2: Landing — zoom + glow
  useEffect(() => {
    if (phase !== 'landing') return;

    cardScale.value = withSequence(
      withSpring(1.15, { damping: 8, stiffness: 150 }),
      withSpring(1.05, { damping: 12 }),
    );

    bgFlash.value = withSequence(
      withTiming(0.3, { duration: 200 }),
      withTiming(0, { duration: 600 }),
    );

    glowRadius.value = withTiming(40, { duration: 800 });

    const timer = setTimeout(() => setPhase('greeting'), 900);
    return () => clearTimeout(timer);
  }, [phase]);

  // Phase 3: Greeting text appears
  useEffect(() => {
    if (phase !== 'greeting') return;

    greetingOpacity.value = withDelay(100, withTiming(1, { duration: 600 }));

    const timer = setTimeout(() => setPhase('ready'), 1200);
    return () => clearTimeout(timer);
  }, [phase]);

  // Phase 4: Button appears
  useEffect(() => {
    if (phase !== 'ready') return;
    buttonOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));
  }, [phase]);

  const handleEnter = async () => {
    await setRegion(regionKey, langCode);
    router.replace('/(tabs)/home');
  };

  // Animated styles
  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: cardScale.value },
      { perspective: 800 },
      { rotateY: `${flipRotateY.value}deg` },
    ],
    opacity: cardOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    shadowRadius: glowRadius.value,
    shadowOpacity: glowRadius.value > 0 ? 0.8 : 0,
  }));

  const greetingStyle = useAnimatedStyle(() => ({
    opacity: greetingOpacity.value,
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: (1 - buttonOpacity.value) * 20 }],
  }));

  const bgFlashStyle = useAnimatedStyle(() => ({
    opacity: bgFlash.value,
  }));

  const displayColors = ILOWA_COLORS.elders[displayElder.region];
  const greeting = targetElder.greeting[langCode] || targetElder.greeting.en || '';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Background flash on landing */}
      <Animated.View
        style={[
          styles.bgFlash,
          { backgroundColor: targetColors.primary },
          bgFlashStyle,
        ]}
      />

      {/* Phase label */}
      {phase === 'cycling' && (
        <Animated.Text entering={FadeIn.duration(300)} style={styles.phaseLabel}>
          Summoning the Elders...
        </Animated.Text>
      )}

      {/* Elder card */}
      <Animated.View
        style={[
          styles.elderCard,
          { shadowColor: displayColors.primary },
          cardAnimStyle,
          glowStyle,
        ]}
      >
        <View style={[styles.cardBorder, { borderColor: displayColors.primary }]}>
          <ElderAvatar
            elder={displayElder}
            size={140}
            showGlow={phase !== 'cycling'}
          />
          <Text style={[styles.cardName, { color: displayColors.primary }]}>
            {displayElder.name}
          </Text>
          <Text style={styles.cardTitle}>{displayElder.title}</Text>
          <Text style={styles.cardRegion}>{displayElder.regionLabel}</Text>
        </View>
      </Animated.View>

      {/* Greeting */}
      {(phase === 'greeting' || phase === 'ready') && (
        <Animated.View style={[styles.greetingContainer, greetingStyle]}>
          <Text style={[styles.greetingText, { color: targetColors.primary }]}>
            "{greeting}"
          </Text>
          <Text style={styles.greetingAuthor}>— {targetElder.name}</Text>
        </Animated.View>
      )}

      {/* Enter button */}
      {phase === 'ready' && (
        <Animated.View style={[styles.buttonContainer, buttonStyle]}>
          <Pressable
            onPress={handleEnter}
            style={[styles.enterButton, { backgroundColor: targetColors.primary }]}
          >
            <Text style={styles.enterText}>Enter Ilowa</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Wisdom hint */}
      {phase === 'ready' && (
        <Animated.Text
          entering={FadeInUp.delay(600).duration(500)}
          style={styles.wisdomHint}
        >
          {targetElder.wisdom[0]}
        </Animated.Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ILOWA_COLORS.deepBlack,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  bgFlash: {
    ...StyleSheet.absoluteFillObject,
  },
  phaseLabel: {
    position: 'absolute',
    top: 100,
    fontFamily: 'Sora',
    fontSize: 14,
    color: ILOWA_COLORS.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  elderCard: {
    alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 0,
    shadowOpacity: 0,
    elevation: 20,
  },
  cardBorder: {
    alignItems: 'center',
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 24,
    borderWidth: 2,
    paddingVertical: 32,
    paddingHorizontal: 40,
    gap: 8,
    minWidth: width * 0.7,
  },
  cardName: {
    fontFamily: 'Sora-Bold',
    fontSize: 26,
    letterSpacing: -0.5,
    marginTop: 12,
  },
  cardTitle: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: ILOWA_COLORS.textSecondary,
  },
  cardRegion: {
    fontFamily: 'Sora',
    fontSize: 11,
    color: ILOWA_COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  greetingContainer: {
    marginTop: 28,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  greetingText: {
    fontFamily: 'Inter',
    fontSize: 18,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 6,
  },
  greetingAuthor: {
    fontFamily: 'Sora',
    fontSize: 13,
    color: ILOWA_COLORS.textMuted,
  },
  buttonContainer: {
    marginTop: 32,
    width: '100%',
  },
  enterButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  enterText: {
    fontFamily: 'Sora-Bold',
    fontSize: 18,
    color: ILOWA_COLORS.deepBlack,
    letterSpacing: 1,
  },
  wisdomHint: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: ILOWA_COLORS.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 32,
  },
});
