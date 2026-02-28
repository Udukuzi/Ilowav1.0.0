/**
 * Gladia Voice Transcription
 * 
 * Works in Expo Go by sending audio to Gladia API directly.
 * Get API key: https://app.gladia.io
 */

import * as FileSystem from 'expo-file-system/legacy';

const GLADIA_API_KEY = process.env.EXPO_PUBLIC_GLADIA_API_KEY || '';

export interface GladiaResult {
  text: string;
  language: string;
  confidence: number;
  method: 'gladia' | 'gladia-stream';
  latency: number;
  metadata?: {
    words?: number;
    codeSwitch?: boolean;
  };
}

export async function isGladiaAvailable(): Promise<boolean> {
  if (!GLADIA_API_KEY) {
    console.log('[Gladia] No API key configured');
    return false;
  }
  
  // Just check if we have the API key - actual API errors will be caught during transcription
  // This avoids failing the availability check due to network timing issues
  console.log('[Gladia] API key present, assuming available');
  return true;
}

export async function transcribeWithGladia(
  audioUri: string,
  language: string = 'auto'
): Promise<GladiaResult> {
  if (!GLADIA_API_KEY) {
    throw new Error('Gladia API key not configured. Add EXPO_PUBLIC_GLADIA_API_KEY to .env');
  }

  const startTime = Date.now();

  try {
    // Step 1: Upload audio file to Gladia via multipart form-data
    // Docs: POST https://api.gladia.io/v2/upload
    console.log('[Gladia] Uploading audio file...');
    const uploadForm = new FormData();
    uploadForm.append('audio', {
      uri: audioUri,
      type: 'audio/m4a',
      name: 'recording.m4a',
    } as any);

    const uploadRes = await fetch('https://api.gladia.io/v2/upload', {
      method: 'POST',
      headers: {
        'x-gladia-key': GLADIA_API_KEY,
      },
      body: uploadForm,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error('[Gladia] Upload error:', uploadRes.status, errText);
      throw new Error(`Upload failed (${uploadRes.status}): ${errText}`);
    }

    const uploadData = await uploadRes.json();
    const audioUrl = uploadData.audio_url;
    console.log('[Gladia] Upload success, audio_url:', audioUrl);

    // Step 2: Start transcription via POST /v2/pre-recorded
    // Docs: https://docs.gladia.io/api-reference/v2/pre-recorded/init
    console.log('[Gladia] Starting transcription...');
    const transcriptionBody: Record<string, any> = {
      audio_url: audioUrl,
    };

    // Only add language_config if a specific language is requested
    if (language !== 'auto') {
      transcriptionBody.language_config = {
        languages: [language],
        code_switching: false,
      };
    }

    const transcribeRes = await fetch('https://api.gladia.io/v2/pre-recorded', {
      method: 'POST',
      headers: {
        'x-gladia-key': GLADIA_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transcriptionBody),
    });

    if (!transcribeRes.ok) {
      const errText = await transcribeRes.text();
      console.error('[Gladia] Transcription request error:', transcribeRes.status, errText);
      throw new Error(`Transcription request failed (${transcribeRes.status}): ${errText}`);
    }

    const transcribeData = await transcribeRes.json();
    const resultUrl = transcribeData.result_url;
    const transcriptionId = transcribeData.id;
    console.log('[Gladia] Transcription started, id:', transcriptionId);

    // Step 3: Poll result_url until status === 'done' (max 60s)
    let result: any = null;
    for (let i = 0; i < 60; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const pollRes = await fetch(resultUrl, {
        headers: { 'x-gladia-key': GLADIA_API_KEY },
      });

      if (!pollRes.ok) {
        console.warn('[Gladia] Poll response not ok:', pollRes.status);
        continue;
      }

      const pollData = await pollRes.json();
      console.log('[Gladia] Poll status:', pollData.status);

      if (pollData.status === 'done') {
        result = pollData;
        break;
      } else if (pollData.status === 'error') {
        throw new Error(`Transcription error: ${JSON.stringify(pollData.error_message || pollData.error)}`);
      }
      // 'queued' or 'processing' → keep polling
    }

    if (!result) {
      throw new Error('Transcription timed out after 60s');
    }

    const latency = Date.now() - startTime;

    // Extract transcript from result
    const transcription = result.result?.transcription?.full_transcript || '';
    const detectedLang = result.result?.transcription?.languages?.[0]?.language || language;

    console.log('[Gladia] Done in', latency, 'ms:', transcription.substring(0, 80));

    return {
      text: transcription,
      language: detectedLang,
      confidence: 0.95,
      method: 'gladia',
      latency,
      metadata: {
        words: transcription.split(' ').length,
      },
    };
  } catch (error) {
    console.error('[Gladia] Transcription failed:', error);
    throw error;
  }
}

export async function transcribeStreamWithGladia(
  _audioStream: any,
  _onPartial: (text: string) => void,
  _language: string = 'auto'
): Promise<GladiaResult> {
  throw new Error('Streaming not supported in Expo Go. Use transcribeWithGladia instead.');
}
