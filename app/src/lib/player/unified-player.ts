/**
 * Unified Player Store (Zustand)
 * 
 * Single source of truth for all audio playback.
 * Ensures only ONE audio source plays at a time.
 * Sources: Radio station, Browse station, Audius track
 */

import { create } from 'zustand';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { AudiusTrack } from '../music/audius';
import { BrowseStation } from '../../types/radio';
import { RadioStation } from '../../types/radio';

export type PlayerSource = 'radio' | 'browse' | 'audius' | null;

export interface PlayerState {
  // Current state
  source: PlayerSource;
  isPlaying: boolean;
  isLoading: boolean;
  sound: Audio.Sound | null;

  // Current track metadata
  title: string | null;
  artist: string | null;
  artwork: string | null;

  // Source-specific data
  currentRadioStation: RadioStation | null;
  currentBrowseStation: BrowseStation | null;
  currentAudiusTrack: AudiusTrack | null;

  // Queue & playback options
  queue: AudiusTrack[];
  queueIndex: number;
  isRepeat: boolean;
  isShuffle: boolean;

  // Browse station list for next/prev navigation
  browseQueue: BrowseStation[];
  browseQueueIndex: number;

  // Playback position (seconds)
  position: number;
  duration: number;

  // Actions
  playRadio: (station: RadioStation, streamUrl: string) => Promise<void>;
  playBrowse: (station: BrowseStation) => Promise<void>;
  playAudius: (track: AudiusTrack, queue?: AudiusTrack[]) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  toggle: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seekTo: (positionSeconds: number) => Promise<void>;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  setQueue: (tracks: AudiusTrack[], startIndex?: number) => void;
  setBrowseQueue: (stations: BrowseStation[], startIndex?: number) => void;
}

let isInitialized = false;

async function initAudio() {
  if (isInitialized) return;
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    staysActiveInBackground: true,
    playsInSilentModeIOS: true,
  });
  isInitialized = true;
}

async function cleanupSound(sound: Audio.Sound | null) {
  if (!sound) return;
  try {
    await sound.stopAsync();
  } catch {}
  try {
    await sound.unloadAsync();
  } catch {}
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  source: null,
  isPlaying: false,
  isLoading: false,
  sound: null,
  title: null,
  artist: null,
  artwork: null,
  currentRadioStation: null,
  currentBrowseStation: null,
  currentAudiusTrack: null,
  queue: [],
  queueIndex: 0,
  isRepeat: false,
  isShuffle: false,
  browseQueue: [],
  browseQueueIndex: 0,
  position: 0,
  duration: 0,

  playRadio: async (station, streamUrl) => {
    const { sound: oldSound, isLoading } = get();
    if (isLoading) return;

    set({ isLoading: true });
    await cleanupSound(oldSound);
    await initAudio();

    try {
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: streamUrl },
        { shouldPlay: true, isLooping: false }
      );
      set({
        sound: newSound,
        source: 'radio',
        isPlaying: true,
        isLoading: false,
        title: station.name,
        artist: station.currentDJ?.name || 'Live Radio',
        artwork: null,
        currentRadioStation: station,
        currentBrowseStation: null,
        currentAudiusTrack: null,
      });
    } catch (err) {
      console.error('[UnifiedPlayer] Radio play error:', err);
      set({ isLoading: false, isPlaying: false, source: null });
    }
  },

  playBrowse: async (station) => {
    const { sound: oldSound, isLoading } = get();
    if (isLoading) return;

    set({ isLoading: true });
    await cleanupSound(oldSound);
    await initAudio();

    try {
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: station.url_resolved },
        { shouldPlay: true, isLooping: false }
      );
      set({
        sound: newSound,
        source: 'browse',
        isPlaying: true,
        isLoading: false,
        title: station.name,
        artist: station.country,
        artwork: station.favicon || null,
        currentRadioStation: null,
        currentBrowseStation: station,
        currentAudiusTrack: null,
      });
    } catch (err) {
      console.error('[UnifiedPlayer] Browse play error:', err);
      set({ isLoading: false, isPlaying: false, source: null });
    }
  },

  playAudius: async (track, queue?) => {
    const { sound: oldSound, isLoading, isRepeat } = get();
    if (isLoading) return;

    set({ isLoading: true });
    await cleanupSound(oldSound);
    await initAudio();

    try {
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: track.streamUrl },
        { shouldPlay: true, isLooping: isRepeat }
      );

      // Set up playback status listener — use get().isRepeat to avoid stale closure
      newSound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (status.isLoaded) {
          set({
            position: status.positionMillis / 1000,
            duration: (status.durationMillis ?? 0) / 1000,
          });
          if (status.didJustFinish && !get().isRepeat) {
            get().next();
          }
        }
      });

      // Always ensure the track is in the queue so next/prev work even for single tracks
      const newQueue = queue || (get().queue.length > 0 ? get().queue : [track]);
      const existingIndex = newQueue.findIndex(t => t.id === track.id);
      const newIndex = existingIndex >= 0 ? existingIndex : 0;

      set({
        sound: newSound,
        source: 'audius',
        isPlaying: true,
        isLoading: false,
        title: track.title,
        artist: track.artist,
        artwork: track.artwork || null,
        currentRadioStation: null,
        currentBrowseStation: null,
        currentAudiusTrack: track,
        queue: newQueue,
        queueIndex: newIndex >= 0 ? newIndex : 0,
      });
    } catch (err) {
      console.error('[UnifiedPlayer] Audius play error:', err);
      set({ isLoading: false, isPlaying: false, source: null });
    }
  },

  pause: async () => {
    const { sound } = get();
    if (sound) {
      try {
        await sound.pauseAsync();
        set({ isPlaying: false });
      } catch (err) {
        console.error('[UnifiedPlayer] Pause error:', err);
      }
    }
  },

  resume: async () => {
    const { sound } = get();
    if (sound) {
      try {
        await sound.playAsync();
        set({ isPlaying: true });
      } catch (err) {
        console.error('[UnifiedPlayer] Resume error:', err);
      }
    }
  },

  stop: async () => {
    const { sound } = get();
    await cleanupSound(sound);
    set({
      sound: null,
      source: null,
      isPlaying: false,
      isLoading: false,
      title: null,
      artist: null,
      artwork: null,
      currentRadioStation: null,
      currentBrowseStation: null,
      currentAudiusTrack: null,
      position: 0,
      duration: 0,
    });
  },

  seekTo: async (positionSeconds: number) => {
    const { sound } = get();
    if (sound) {
      try {
        await sound.setPositionAsync(positionSeconds * 1000);
        set({ position: positionSeconds });
      } catch (err) {
        console.error('[UnifiedPlayer] Seek error:', err);
      }
    }
  },

  toggle: async () => {
    const { isPlaying, pause, resume } = get();
    if (isPlaying) {
      await pause();
    } else {
      await resume();
    }
  },

  next: async () => {
    const { queue, queueIndex, isShuffle, playAudius, source, browseQueue, browseQueueIndex, playBrowse } = get();

    if (source === 'audius') {
      if (queue.length === 0) return;
      let nextIndex: number;
      if (isShuffle) {
        nextIndex = Math.floor(Math.random() * queue.length);
      } else {
        nextIndex = (queueIndex + 1) % queue.length;
      }
      const nextTrack = queue[nextIndex];
      if (nextTrack) {
        set({ queueIndex: nextIndex });
        await playAudius(nextTrack);
      }
    } else if (source === 'browse' && browseQueue.length > 1) {
      const nextIdx = isShuffle
        ? Math.floor(Math.random() * browseQueue.length)
        : (browseQueueIndex + 1) % browseQueue.length;
      set({ browseQueueIndex: nextIdx });
      await playBrowse(browseQueue[nextIdx]);
    }
  },

  previous: async () => {
    const { queue, queueIndex, playAudius, source, browseQueue, browseQueueIndex, playBrowse } = get();

    if (source === 'audius') {
      if (queue.length === 0) return;
      const prevIndex = queueIndex <= 0 ? queue.length - 1 : queueIndex - 1;
      const prevTrack = queue[prevIndex];
      if (prevTrack) {
        set({ queueIndex: prevIndex });
        await playAudius(prevTrack);
      }
    } else if (source === 'browse' && browseQueue.length > 1) {
      const prevIdx = browseQueueIndex <= 0 ? browseQueue.length - 1 : browseQueueIndex - 1;
      set({ browseQueueIndex: prevIdx });
      await playBrowse(browseQueue[prevIdx]);
    }
  },

  toggleRepeat: () => {
    const { isRepeat, sound } = get();
    const newRepeat = !isRepeat;
    set({ isRepeat: newRepeat });
    if (sound) {
      sound.setIsLoopingAsync(newRepeat).catch(() => {});
    }
  },

  toggleShuffle: () => {
    set({ isShuffle: !get().isShuffle });
  },

  setQueue: (tracks, startIndex = 0) => {
    set({ queue: tracks, queueIndex: startIndex });
  },

  setBrowseQueue: (stations: BrowseStation[], startIndex = 0) => {
    set({ browseQueue: stations, browseQueueIndex: startIndex });
  },
}));
