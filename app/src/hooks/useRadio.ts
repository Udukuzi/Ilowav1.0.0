import { useState, useCallback, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { RadioStation } from '../types/radio';
import { RADIO_STATIONS } from '../data/radio-stations';
import {
  playStation,
  pauseStation,
  resumeStation,
  stopStation,
} from '../lib/radio/stream';

interface RadioState {
  currentStation: RadioStation | null;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useRadio() {
  const [state, setState] = useState<RadioState>({
    currentStation: RADIO_STATIONS[0] || null,
    isPlaying: false,
    isLoading: false,
    error: null,
  });

  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      stopStation();
    };
  }, []);

  const play = useCallback(async (station?: RadioStation) => {
    const target = station || state.currentStation;
    if (!target?.streamUrl) {
      setState((prev) => ({ ...prev, error: 'No stream URL configured' }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const sound = await playStation(target);
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) {
          if (status.error) {
            setState((prev) => ({ ...prev, isPlaying: false, error: status.error ?? null }));
          }
          return;
        }
        setState((prev) => ({ ...prev, isPlaying: status.isPlaying }));
      });

      setState((prev) => ({
        ...prev,
        currentStation: target,
        isPlaying: true,
        isLoading: false,
      }));
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false, error: 'Failed to play stream' }));
    }
  }, [state.currentStation]);

  const pause = useCallback(async () => {
    try {
      await pauseStation();
      setState((prev) => ({ ...prev, isPlaying: false }));
    } catch (error) {
      setState((prev) => ({ ...prev, error: 'Failed to pause' }));
    }
  }, []);

  const resume = useCallback(async () => {
    try {
      await resumeStation();
      setState((prev) => ({ ...prev, isPlaying: true }));
    } catch (error) {
      setState((prev) => ({ ...prev, error: 'Failed to resume' }));
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      await stopStation();
      soundRef.current = null;
      setState((prev) => ({ ...prev, isPlaying: false }));
    } catch (error) {
      setState((prev) => ({ ...prev, error: 'Failed to stop' }));
    }
  }, []);

  const togglePlay = useCallback(async () => {
    if (state.isPlaying) {
      await pause();
    } else if (soundRef.current) {
      await resume();
    } else {
      await play();
    }
  }, [state.isPlaying, play, pause, resume]);

  return {
    ...state,
    play,
    pause,
    resume,
    stop,
    togglePlay,
  };
}
