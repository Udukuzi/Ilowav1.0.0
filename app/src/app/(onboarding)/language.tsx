import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ILOWA_COLORS, ElderRegionKey } from '../../theme/colors';
import { getLanguagesByRegion } from '../../data/languages';
import { getElderByRegion } from '../../data/elders';
import { ElderAvatar } from '../../components/ElderAvatar';

export default function LanguageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { region } = useLocalSearchParams<{ region: string }>();
  const regionKey = (region || 'westAfrica') as ElderRegionKey;
  const [selected, setSelected] = useState<string | null>(null);

  const languages = getLanguagesByRegion(regionKey);
  const elder = getElderByRegion(regionKey);
  const colors = ILOWA_COLORS.elders[regionKey];

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {/* Elder header */}
      <Animated.View entering={FadeInDown.delay(50).duration(500)} style={styles.elderHeader}>
        {elder && <ElderAvatar elder={elder} size={48} showGlow />}
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Choose Your Language</Text>
          <Text style={styles.subtitle}>
            {elder ? `${elder.name} speaks these languages.` : 'Select your preferred language.'}
          </Text>
        </View>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.grid}
      >
        {languages.map((lang, i) => (
          <Animated.View key={lang.code} entering={FadeInDown.delay(100 + i * 40).duration(400)}>
            <Pressable
              onPress={() => setSelected(lang.code)}
              style={[
                styles.langCard,
                selected === lang.code && {
                  borderColor: colors.primary,
                  backgroundColor: `${colors.primary}12`,
                },
              ]}
            >
              <Text style={[
                styles.nativeName,
                selected === lang.code && { color: colors.primary },
              ]}>
                {lang.nativeName}
              </Text>
              <Text style={styles.langName}>{lang.name}</Text>
              {selected === lang.code && (
                <Animated.View entering={FadeInDown.duration(150)}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                </Animated.View>
              )}
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={[
            styles.nextButton,
            !selected && styles.nextButtonDisabled,
            selected && { backgroundColor: colors.primary },
          ]}
          disabled={!selected}
          onPress={() => {
            if (selected) {
              router.push({
                pathname: '/(onboarding)/reveal',
                params: { region: regionKey, language: selected },
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
  elderHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20,
  },
  title: {
    fontFamily: 'Sora-Bold', fontSize: 24, color: ILOWA_COLORS.textPrimary, marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Inter', fontSize: 14, color: ILOWA_COLORS.textSecondary, lineHeight: 20,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 20 },
  langCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12,
    backgroundColor: ILOWA_COLORS.cardDark, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)', minWidth: 140,
  },
  nativeName: {
    fontFamily: 'Sora-SemiBold', fontSize: 15, color: ILOWA_COLORS.textPrimary, flex: 1,
  },
  langName: { fontFamily: 'Inter', fontSize: 11, color: ILOWA_COLORS.textMuted },
  footer: { paddingTop: 8 },
  nextButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ILOWA_COLORS.gold, paddingVertical: 16, borderRadius: 14,
  },
  nextButtonDisabled: { backgroundColor: ILOWA_COLORS.cardDark },
  nextText: { fontFamily: 'Sora-Bold', fontSize: 16, color: ILOWA_COLORS.deepBlack },
});
