import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ILOWA_COLORS, ElderRegionKey } from '../../theme/colors';
import { getElderByRegion } from '../../data/elders';
import { getLanguagesByRegion } from '../../data/languages';
import { ElderAvatar } from '../../components/ElderAvatar';
import { useRegion } from '../../hooks/useRegion';

interface RegionOption {
  key: ElderRegionKey;
  label: string;
}

const REGIONS: RegionOption[] = [
  { key: 'westAfrica', label: 'West Africa' },
  { key: 'eastAfrica', label: 'East Africa' },
  { key: 'southernAfrica', label: 'Southern Africa' },
  { key: 'latinAmerica', label: 'Latin America' },
  { key: 'southAsia', label: 'South Asia' },
  { key: 'southeastAsia', label: 'Southeast Asia' },
  { key: 'mena', label: 'Middle East & North Africa' },
  { key: 'caribbean', label: 'Caribbean' },
  { key: 'pacific', label: 'Pacific Islands' },
];

export default function RegionSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { config, setRegion, activeElder, elderColors } = useRegion();
  const [selectedRegion, setSelectedRegion] = useState<ElderRegionKey | null>(
    config?.region ?? null,
  );
  const [selectedLang, setSelectedLang] = useState<string | null>(
    config?.languageCode ?? null,
  );

  const languages = selectedRegion ? getLanguagesByRegion(selectedRegion) : [];
  const previewElder = selectedRegion ? getElderByRegion(selectedRegion) : null;
  const previewColors = selectedRegion ? ILOWA_COLORS.elders[selectedRegion] : null;

  const handleSave = async () => {
    if (!selectedRegion || !selectedLang) return;
    await setRegion(selectedRegion, selectedLang);
    Alert.alert('Region Updated', 'Your Elder and language have been updated.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  const hasChanges =
    selectedRegion !== config?.region || selectedLang !== config?.languageCode;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={ILOWA_COLORS.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Region & Elder</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Current Elder preview */}
        {previewElder && previewColors && (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.previewCard}>
            <ElderAvatar elder={previewElder} size={64} showGlow />
            <View style={{ flex: 1 }}>
              <Text style={[styles.previewName, { color: previewColors.primary }]}>
                {previewElder.name}
              </Text>
              <Text style={styles.previewTitle}>{previewElder.title}</Text>
              <Text style={styles.previewRegion}>{previewElder.regionLabel}</Text>
            </View>
          </Animated.View>
        )}

        {/* Region list */}
        <Text style={styles.sectionLabel}>SELECT REGION</Text>
        {REGIONS.map((region, i) => {
          const elder = getElderByRegion(region.key);
          const colors = ILOWA_COLORS.elders[region.key];
          const isSelected = selectedRegion === region.key;

          return (
            <Animated.View key={region.key} entering={FadeInDown.delay(i * 30).duration(300)}>
              <Pressable
                style={[styles.regionRow, isSelected && { borderColor: colors.primary }]}
                onPress={() => {
                  setSelectedRegion(region.key);
                  // Auto-select first language of new region
                  const langs = getLanguagesByRegion(region.key);
                  setSelectedLang(langs[0]?.code ?? 'en');
                }}
              >
                {elder && <ElderAvatar elder={elder} size={36} showGlow={isSelected} />}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.regionName, isSelected && { color: colors.primary }]}>
                    {region.label}
                  </Text>
                  {elder && (
                    <Text style={styles.elderHint}>{elder.name}</Text>
                  )}
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                )}
              </Pressable>
            </Animated.View>
          );
        })}

        {/* Language picker for selected region */}
        {languages.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>LANGUAGE</Text>
            <View style={styles.langGrid}>
              {languages.map((lang) => {
                const isActive = selectedLang === lang.code;
                return (
                  <Pressable
                    key={lang.code}
                    style={[
                      styles.langChip,
                      isActive && previewColors && {
                        borderColor: previewColors.primary,
                        backgroundColor: `${previewColors.primary}15`,
                      },
                    ]}
                    onPress={() => setSelectedLang(lang.code)}
                  >
                    <Text
                      style={[
                        styles.langChipText,
                        isActive && previewColors && { color: previewColors.primary },
                      ]}
                    >
                      {lang.nativeName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Save button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={[
            styles.saveButton,
            !hasChanges && styles.saveButtonDisabled,
            hasChanges && previewColors && { backgroundColor: previewColors.primary },
          ]}
          disabled={!hasChanges}
          onPress={handleSave}
        >
          <Text style={styles.saveText}>
            {hasChanges ? 'Save Changes' : 'No Changes'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ILOWA_COLORS.deepBlack },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Sora-Bold', fontSize: 18, color: ILOWA_COLORS.textPrimary },
  scroll: { paddingHorizontal: 20 },
  previewCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: ILOWA_COLORS.cardDark, borderRadius: 16, padding: 16,
    marginBottom: 24,
  },
  previewName: { fontFamily: 'Sora-Bold', fontSize: 18 },
  previewTitle: { fontFamily: 'Inter', fontSize: 13, color: ILOWA_COLORS.textSecondary },
  previewRegion: {
    fontFamily: 'Sora', fontSize: 10, color: ILOWA_COLORS.textMuted,
    letterSpacing: 1, textTransform: 'uppercase', marginTop: 2,
  },
  sectionLabel: {
    fontFamily: 'Sora', fontSize: 11, color: ILOWA_COLORS.textMuted,
    letterSpacing: 1.5, marginBottom: 12,
  },
  regionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: ILOWA_COLORS.cardDark, borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1.5, borderColor: 'transparent',
  },
  regionName: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: ILOWA_COLORS.textPrimary },
  elderHint: { fontFamily: 'Inter', fontSize: 11, color: ILOWA_COLORS.textMuted },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: ILOWA_COLORS.cardDark, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  langChipText: { fontFamily: 'Sora', fontSize: 13, color: ILOWA_COLORS.textPrimary },
  footer: { paddingHorizontal: 20, paddingTop: 8 },
  saveButton: {
    backgroundColor: ILOWA_COLORS.gold, paddingVertical: 16, borderRadius: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: { backgroundColor: ILOWA_COLORS.cardDark },
  saveText: { fontFamily: 'Sora-Bold', fontSize: 16, color: ILOWA_COLORS.deepBlack },
});
