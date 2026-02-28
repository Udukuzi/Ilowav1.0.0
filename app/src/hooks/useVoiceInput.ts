import { useState, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { transcribeVoice, VoiceMethod } from '../lib/voice/hybrid';

interface VoiceInputState {
  isRecording: boolean;
  duration: number;
  audioUri: string | null;
  transcription: string | null;
  isTranscribing: boolean;
  method: VoiceMethod | null;
  confidence: number;
  latency: number;
  error: string | null;
}

export function useVoiceInput() {
  const [state, setState] = useState<VoiceInputState>({
    isRecording: false,
    duration: 0,
    audioUri: null,
    transcription: null,
    isTranscribing: false,
    method: null,
    confidence: 0,
    latency: 0,
    error: null,
  });

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setState((prev) => ({ ...prev, error: 'Microphone permission denied' }));
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setState((prev) => ({ ...prev, isRecording: true, duration: 0, error: null }));

      timerRef.current = setInterval(() => {
        setState((prev) => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    } catch (error) {
      setState((prev) => ({ ...prev, error: 'Failed to start recording' }));
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return null;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      setState((prev) => ({ ...prev, isRecording: false, audioUri: uri }));
      return uri;
    } catch (error) {
      setState((prev) => ({ ...prev, isRecording: false, error: 'Failed to stop recording' }));
      return null;
    }
  }, []);

  const transcribe = useCallback(async (audioUri: string) => {
    setState((prev) => ({ ...prev, isTranscribing: true, error: null }));
    try {
      const result = await transcribeVoice(audioUri);
      setState((prev) => ({
        ...prev,
        transcription: result.text,
        isTranscribing: false,
        method: result.method,
        confidence: result.confidence,
        latency: result.latency,
      }));
      return result.text;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Transcription failed';
      setState((prev) => ({ ...prev, isTranscribing: false, error: msg }));
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      isRecording: false,
      duration: 0,
      audioUri: null,
      transcription: null,
      isTranscribing: false,
      method: null,
      confidence: 0,
      latency: 0,
      error: null,
    });
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    transcribe,
    reset,
  };
}
