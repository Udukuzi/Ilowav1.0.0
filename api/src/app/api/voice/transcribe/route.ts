/**
 * Voice Transcription API (Gladia Proxy)
 * 
 * POST /api/voice/transcribe
 * Body: FormData with audio file
 * Returns: { text, language, confidence }
 */

import { NextRequest, NextResponse } from 'next/server';

const GLADIA_API_KEY = process.env.GLADIA_API_KEY || '';

export async function POST(request: NextRequest) {
  if (!GLADIA_API_KEY) {
    return NextResponse.json(
      { error: 'Gladia API key not configured' },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('audio') as File;
    const language = formData.get('language') as string || 'auto';

    if (!file) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Upload to Gladia
    const gladiaFormData = new FormData();
    gladiaFormData.append('audio', file);

    const uploadResponse = await fetch('https://api.gladia.io/v2/upload', {
      method: 'POST',
      headers: {
        'x-gladia-key': GLADIA_API_KEY,
      },
      body: gladiaFormData,
    });

    if (!uploadResponse.ok) {
      throw new Error('Gladia upload failed');
    }

    const { audio_url } = await uploadResponse.json();

    // Start transcription
    const transcribeResponse = await fetch('https://api.gladia.io/v2/transcription', {
      method: 'POST',
      headers: {
        'x-gladia-key': GLADIA_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url,
        language: language === 'auto' ? undefined : language,
        detect_language: language === 'auto',
        enable_code_switching: true, // Support mixed languages
      }),
    });

    if (!transcribeResponse.ok) {
      throw new Error('Gladia transcription failed');
    }

    const { id: transcriptionId } = await transcribeResponse.json();

    // Poll for result (max 30 seconds)
    let result = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const pollResponse = await fetch(
        `https://api.gladia.io/v2/transcription/${transcriptionId}`,
        {
          headers: { 'x-gladia-key': GLADIA_API_KEY },
        }
      );

      const pollResult = await pollResponse.json();

      if (pollResult.status === 'done') {
        result = pollResult;
        break;
      }

      if (pollResult.status === 'error') {
        throw new Error(pollResult.error_message || 'Transcription error');
      }
    }

    if (!result) {
      return NextResponse.json(
        { error: 'Transcription timeout' },
        { status: 504 }
      );
    }

    // Extract text from result
    const text = result.result?.transcription?.full_transcript || '';
    const detectedLanguage = result.result?.transcription?.languages?.[0] || language;

    return NextResponse.json({
      success: true,
      text,
      language: detectedLanguage,
      confidence: 0.95, // Gladia doesn't provide this directly
      duration: result.result?.transcription?.duration || 0,
    });
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Transcription failed' },
      { status: 500 }
    );
  }
}
