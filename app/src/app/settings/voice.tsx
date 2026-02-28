import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { ILOWA_COLORS } from '../../theme/colors';
import { isVoskModelAvailable, downloadVoskModel, getAvailableVoskLanguages } from '../../lib/voice/vosk';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', pt: 'Portuguese',
  ar: 'Arabic', hi: 'Hindi', zh: 'Chinese', sw: 'Swahili',
  ta: 'Tamil', te: 'Telugu', ur: 'Urdu', vi: 'Vietnamese',
  th: 'Thai', ru: 'Russian',
};

export default function VoiceSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [gladiaKey, setGladiaKey] = useState('');
  const [gladiaKeyMasked, setGladiaKeyMasked] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [models, setModels] = useState<Record<string, boolean>>({});
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    (async () => {
      const key = await SecureStore.getItemAsync('gladia_api_key');
      if (key) {
        setGladiaKeyMasked(`${key.slice(0, 8)}...${key.slice(-4)}`);
      }

      const langs = getAvailableVoskLanguages();
      const status: Record<string, boolean> = {};
      for (const lang of langs) {
        status[lang] = await isVoskModelAvailable(lang);
      }
      setModels(status);
    })();
  }, []);

  const saveGladiaKey = useCallback(async () => {
    if (!gladiaKey.trim()) return;
    setSavingKey(true);
    try {
      await SecureStore.setItemAsync('gladia_api_key', gladiaKey.trim());
      setGladiaKeyMasked(`${gladiaKey.trim().slice(0, 8)}...${gladiaKey.trim().slice(-4)}`);
      setGladiaKey('');
      Alert.alert('Saved', 'Gladia API key stored securely.');
    } catch {
      Alert.alert('Error', 'Failed to save API key.');
    } finally {
      setSavingKey(false);
    }
  }, [gladiaKey]);

  const handleDownloadModel = useCallback(async (lang: string) => {
    setDownloading(lang);
    setDownloadProgress(0);
    try {
      await downloadVoskModel(lang, (progress) => {
        setDownloadProgress(progress);
      });
      setModels((prev) => ({ ...prev, [lang]: true }));
      Alert.alert('Downloaded', `${LANGUAGE_NAMES[lang] || lang} model ready for offline use.`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(null);
      setDownloadProgress(0);
    }
  }, []);

  const availableLanguages = getAvailableVoskLanguages();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={ILOWA_COLORS.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Voice & Language</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Gladia API Key */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cloud" size={18} color={ILOWA_COLORS.cyan} />
            <Text style={styles.sectionTitle}>Gladia API (Online Voice)</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Gladia provides 100+ language support with code-switching. Free tier: 10 hours/month.
          </Text>

          {gladiaKeyMasked ? (
            <View style={styles.keyRow}>
              <Ionicons name="checkmark-circle" size={16} color={ILOWA_COLORS.truth} />
              <Text style={styles.keyText}>Key: {gladiaKeyMasked}</Text>
              <Pressable onPress={() => setGladiaKeyMasked('')}>
                <Text style={styles.changeText}>Change</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Enter Gladia API key..."
                placeholderTextColor={ILOWA_COLORS.textMuted}
                value={gladiaKey}
                onChangeText={setGladiaKey}
                secureTextEntry
                autoCapitalize="none"
              />
              <Pressable
                style={[styles.saveButton, !gladiaKey.trim() && styles.saveButtonDisabled]}
                onPress={saveGladiaKey}
                disabled={!gladiaKey.trim() || savingKey}
              >
                {savingKey ? (
                  <ActivityIndicator size="small" color={ILOWA_COLORS.deepBlack} />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </Pressable>
            </View>
          )}

          <Pressable
            onPress={() => Alert.alert('Get API Key', 'Sign up at gladia.io to get your free API key.\n\nFree tier: 10 hours/month\nPro: $0.61/hour')}
            style={styles.helpLink}
          >
            <Ionicons name="help-circle-outline" size={14} color={ILOWA_COLORS.cyan} />
            <Text style={styles.helpText}>How to get a Gladia API key</Text>
          </Pressable>
        </Animated.View>

        {/* Vosk Offline Models */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="download" size={18} color={ILOWA_COLORS.purple} />
            <Text style={styles.sectionTitle}>Offline Voice Models (Vosk)</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Download language models for 100% offline, private voice recognition. ~50MB each.
          </Text>

          {availableLanguages.map((lang) => (
            <View key={lang} style={styles.modelRow}>
              <View style={styles.modelInfo}>
                <Text style={styles.modelName}>{LANGUAGE_NAMES[lang] || lang}</Text>
                <Text style={styles.modelCode}>{lang}</Text>
              </View>

              {models[lang] ? (
                <View style={styles.downloadedBadge}>
                  <Ionicons name="checkmark" size={14} color={ILOWA_COLORS.truth} />
                  <Text style={styles.downloadedText}>Ready</Text>
                </View>
              ) : downloading === lang ? (
                <View style={styles.progressRow}>
                  <ActivityIndicator size="small" color={ILOWA_COLORS.purple} />
                  <Text style={styles.progressText}>{downloadProgress.toFixed(0)}%</Text>
                </View>
              ) : (
                <Pressable
                  style={styles.downloadButton}
                  onPress={() => handleDownloadModel(lang)}
                  disabled={downloading !== null}
                >
                  <Ionicons name="cloud-download" size={16} color={ILOWA_COLORS.cyan} />
                  <Text style={styles.downloadText}>Download</Text>
                </Pressable>
              )}
            </View>
          ))}
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ILOWA_COLORS.deepBlack },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Sora-Bold', fontSize: 18, color: ILOWA_COLORS.textPrimary },
  scrollContent: { paddingHorizontal: 20 },
  section: {
    backgroundColor: ILOWA_COLORS.cardDark, borderRadius: 16, padding: 20, marginBottom: 20,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: { fontFamily: 'Sora-SemiBold', fontSize: 16, color: ILOWA_COLORS.textPrimary },
  sectionDesc: {
    fontFamily: 'Inter', fontSize: 13, color: ILOWA_COLORS.textMuted, lineHeight: 18, marginBottom: 16,
  },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  keyText: { fontFamily: 'Inter', fontSize: 13, color: ILOWA_COLORS.textSecondary, flex: 1 },
  changeText: { fontFamily: 'Sora', fontSize: 12, color: ILOWA_COLORS.cyan },
  inputRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Inter', fontSize: 13,
    color: ILOWA_COLORS.textPrimary,
  },
  saveButton: {
    backgroundColor: ILOWA_COLORS.cyan, paddingHorizontal: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { fontFamily: 'Sora-Bold', fontSize: 13, color: ILOWA_COLORS.deepBlack },
  helpLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 },
  helpText: { fontFamily: 'Inter', fontSize: 12, color: ILOWA_COLORS.cyan },
  modelRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  modelInfo: { flex: 1 },
  modelName: { fontFamily: 'Inter-Medium', fontSize: 14, color: ILOWA_COLORS.textPrimary },
  modelCode: { fontFamily: 'Inter', fontSize: 11, color: ILOWA_COLORS.textMuted, marginTop: 2 },
  downloadedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  downloadedText: { fontFamily: 'Sora', fontSize: 11, color: ILOWA_COLORS.truth },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progressText: { fontFamily: 'Sora', fontSize: 11, color: ILOWA_COLORS.purple },
  downloadButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  downloadText: { fontFamily: 'Sora', fontSize: 12, color: ILOWA_COLORS.cyan },
});
