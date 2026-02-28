import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
// expo-speech needs a native module that Android Expo Go doesn't ship —
// lazy-load so the screen doesn't blow up on import
let Speech: typeof import('expo-speech') | null = null;
try { Speech = require('expo-speech'); } catch { /* Android Expo Go */ }
import { Ionicons } from '@expo/vector-icons';
import { ILOWA_COLORS } from '../../theme/colors';
import { useRegion } from '../../hooks/useRegion';
import {
  PODCAST_LIBRARY,
  getEpisodesForRegion,
  generateEpisodeAudio,
  GeneratedEpisode,
} from '../../lib/podcasts/content-library';

export default function PodcastDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeElder, activeLanguage, config } = useRegion();

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedEpisode | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkQueueRef = useRef<string[]>([]);
  const chunkIdxRef = useRef(0);

  // find episode from library, build ordered list for next/back
  const regionEpisodes = getEpisodesForRegion(config?.region ?? 'west-africa');
  const epList = regionEpisodes.length > 0 ? regionEpisodes : PODCAST_LIBRARY;
  const currentIdx = epList.findIndex(ep => ep.id === id);
  const episode = currentIdx >= 0 ? epList[currentIdx] : (PODCAST_LIBRARY.find(ep => ep.id === id) ?? PODCAST_LIBRARY[0]);
  const elderName = activeElder?.name ?? 'Elder';
  const lang = activeLanguage?.code ?? 'en';

  // cleanup on unmount
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
      Speech?.stop();
      if (intervalRef.current) clearInterval(intervalRef.current);
      chunkQueueRef.current = [];
    };
  }, []);

  // plays through a queue of audio URLs one after another
  const playChunkQueue = async (urls: string[]) => {
    chunkQueueRef.current = urls;
    chunkIdxRef.current = 0;
    setIsPlaying(true);
    const startTime = Date.now();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setProgress(Math.floor((Date.now() - startTime) / 1000));
    }, 500);
    await playNextChunk();
  };

  const playNextChunk = async () => {
    const urls = chunkQueueRef.current;
    const idx = chunkIdxRef.current;
    if (idx >= urls.length) {
      // done with all chunks
      setIsPlaying(false);
      setProgress(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    try {
      // unload previous chunk
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: urls[idx] },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          chunkIdxRef.current += 1;
          playNextChunk();
        }
      });
    } catch (err) {
      console.warn(`[Podcast] chunk ${idx} failed, skipping:`, err);
      chunkIdxRef.current += 1;
      playNextChunk();
    }
  };

  const handlePlay = async () => {
    if (isPlaying && soundRef.current) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // resume if already loaded
    if (soundRef.current && !isPlaying) {
      await soundRef.current.playAsync();
      setIsPlaying(true);
      startProgressTracker();
      return;
    }

    // generate TTS audio
    setGenerating(true);
    try {
      const result = await generateEpisodeAudio(episode, lang, elderName);
      setGenerated(result);

      if (result.audioUrl && result.audioUrl !== 'device-speech') {
        // could be a single URL (Lelapa) or a JSON array of chunk URLs (Google TTS)
        let urls: string[] = [];
        try {
          const parsed = JSON.parse(result.audioUrl);
          if (Array.isArray(parsed)) urls = parsed;
        } catch {
          // not JSON — it's a single Lelapa URL
          urls = [result.audioUrl];
        }

        if (urls.length === 1) {
          // single audio file — straightforward playback
          const { sound } = await Audio.Sound.createAsync(
            { uri: urls[0] },
            { shouldPlay: true }
          );
          soundRef.current = sound;
          setIsPlaying(true);
          startProgressTracker();
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              setIsPlaying(false);
              setProgress(0);
              if (intervalRef.current) clearInterval(intervalRef.current);
            }
          });
        } else if (urls.length > 1) {
          // chunked audio (Google TTS) — play sequentially
          await playChunkQueue(urls);
        }
      } else {
        // last resort — device speech (iOS only)
        Speech?.speak(episode.script, {
          language: lang,
          rate: 0.9,
          onDone: () => { setIsPlaying(false); setProgress(0); },
          onStopped: () => { setIsPlaying(false); },
        });
        setIsPlaying(true);
        const startTime = Date.now();
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          setProgress(elapsed);
          if (elapsed >= episode.durationEstimate) {
            clearInterval(intervalRef.current!);
          }
        }, 500);
      }
    } catch (err) {
      console.warn('[Podcast] TTS generation failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  const startProgressTracker = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(async () => {
      if (!soundRef.current) return;
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded) {
        setProgress(Math.floor(status.positionMillis / 1000));
      }
    }, 500);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const dur = episode.durationEstimate;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/home')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={ILOWA_COLORS.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Podcast</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.coverArt}>
          <Ionicons name="headset" size={64} color={ILOWA_COLORS.cyan} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.info}>
          <Text style={styles.title}>{episode.title}</Text>
          <Text style={styles.narrator}>Narrated by {elderName} (AI Elder)</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaBadge}>
              <Text style={styles.metaText}>{episode.category}</Text>
            </View>
            <View style={[styles.metaBadge, { backgroundColor: 'rgba(139,92,246,0.12)' }]}>
              <Text style={[styles.metaText, { color: '#8B5CF6' }]}>{episode.difficulty}</Text>
            </View>
            <Text style={styles.duration}>{formatTime(dur)}</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.description}>
          <Text style={styles.descText}>{episode.description}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.playerSection}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min((progress / dur) * 100, 100)}%` }]} />
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(progress)}</Text>
            <Text style={styles.timeText}>{formatTime(dur)}</Text>
          </View>

          <View style={styles.controls}>
            <Pressable
              style={styles.controlButton}
              onPress={() => {
                const prevIdx = (currentIdx > 0 ? currentIdx - 1 : epList.length - 1);
                soundRef.current?.unloadAsync().catch(() => {});
                Speech?.stop();
                if (intervalRef.current) clearInterval(intervalRef.current);
                router.replace(`/podcast/${epList[prevIdx].id}` as any);
              }}
            >
              <Ionicons name="play-back" size={28} color={ILOWA_COLORS.textSecondary} />
            </Pressable>
            <Pressable
              style={styles.playButton}
              onPress={handlePlay}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator size="small" color={ILOWA_COLORS.deepBlack} />
              ) : (
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={32}
                  color={ILOWA_COLORS.deepBlack}
                />
              )}
            </Pressable>
            <Pressable
              style={styles.controlButton}
              onPress={() => {
                const nextIdx = (currentIdx < epList.length - 1 ? currentIdx + 1 : 0);
                soundRef.current?.unloadAsync().catch(() => {});
                Speech?.stop();
                if (intervalRef.current) clearInterval(intervalRef.current);
                router.replace(`/podcast/${epList[nextIdx].id}` as any);
              }}
            >
              <Ionicons name="play-forward" size={28} color={ILOWA_COLORS.textSecondary} />
            </Pressable>
          </View>

          {generating && (
            <Text style={styles.generatingText}>
              {elderName} is preparing the narration...
            </Text>
          )}

          <View style={styles.extraControls}>
            <Pressable style={styles.extraButton}>
              <Ionicons name="timer-outline" size={20} color={ILOWA_COLORS.textMuted} />
              <Text style={styles.extraText}>Sleep Timer</Text>
            </Pressable>
            <Pressable style={styles.extraButton}>
              <Ionicons name="speedometer-outline" size={20} color={ILOWA_COLORS.textMuted} />
              <Text style={styles.extraText}>1x Speed</Text>
            </Pressable>
          </View>
        </Animated.View>
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
  content: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 40 },
  generatingText: {
    fontFamily: 'Inter', fontSize: 12, color: ILOWA_COLORS.cyan,
    textAlign: 'center', marginBottom: 16, fontStyle: 'italic',
  },
  coverArt: {
    width: 180, height: 180, borderRadius: 24,
    backgroundColor: ILOWA_COLORS.cardDark, alignItems: 'center', justifyContent: 'center',
    marginTop: 20, marginBottom: 24,
    shadowColor: ILOWA_COLORS.cyan, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2, shadowRadius: 20,
  },
  info: { alignItems: 'center', marginBottom: 20 },
  title: {
    fontFamily: 'Sora-Bold', fontSize: 22, color: ILOWA_COLORS.textPrimary,
    textAlign: 'center', marginBottom: 6,
  },
  narrator: { fontFamily: 'Inter', fontSize: 14, color: ILOWA_COLORS.textSecondary, marginBottom: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metaBadge: {
    backgroundColor: 'rgba(0,217,255,0.12)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8,
  },
  metaText: { fontFamily: 'Sora', fontSize: 11, color: ILOWA_COLORS.cyan },
  duration: { fontFamily: 'Inter', fontSize: 13, color: ILOWA_COLORS.textMuted },
  description: { alignSelf: 'stretch', marginBottom: 32 },
  descText: {
    fontFamily: 'Inter', fontSize: 14, color: ILOWA_COLORS.textSecondary,
    lineHeight: 22, textAlign: 'center',
  },
  playerSection: { alignSelf: 'stretch' },
  progressBar: {
    height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 8,
  },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: ILOWA_COLORS.cyan },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  timeText: { fontFamily: 'Inter', fontSize: 11, color: ILOWA_COLORS.textMuted },
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 32, marginBottom: 24,
  },
  controlButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  playButton: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: ILOWA_COLORS.cyan,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: ILOWA_COLORS.cyan, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  extraControls: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  extraButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  extraText: { fontFamily: 'Inter', fontSize: 12, color: ILOWA_COLORS.textMuted },
});
