import { PublicKey } from '@solana/web3.js';
import { transcribeWithGladia, isGladiaAvailable } from './gladia';
import { transcribeWithVosk, isVoskModelAvailable } from './vosk';

export type VoiceMethod = 'gladia' | 'vosk';

export interface TranscriptionResult {
  text: string;
  language: string;
  confidence: number;
  method: VoiceMethod;
  latency: number;
  offline: boolean;
  metadata?: {
    words?: number;
    codeSwitch?: boolean;
  };
}

export interface MarketFromVoice {
  question: string;
  language: string;
  category: string;
  resolveDate: Date;
  voiceUri: string;
  method: VoiceMethod;
  confidence: number;
  offline: boolean;
}

// Gladia API key from environment
const GLADIA_KEY = process.env.EXPO_PUBLIC_GLADIA_API_KEY || '';

/**
 * MASTER VOICE FUNCTION
 * Try Gladia (if internet) → Fallback to Vosk (offline) → Demo mode
 */
export async function transcribeVoice(
  audioUri: string,
  language: string = 'auto',
): Promise<TranscriptionResult> {
  console.log('[Voice] Starting hybrid transcription...');
  console.log('[Voice] Language:', language);

  // ── LAYER 1: Gladia (best quality, requires internet) ──
  try {
    console.log('[Voice] Attempting Gladia (Layer 1)...');
    const gladiaReady = await isGladiaAvailable();
    if (gladiaReady) {
      const result = await transcribeWithGladia(audioUri, language);
      console.log('[Voice] ✅ Gladia succeeded');
      return {
        text: result.text,
        language: result.language,
        confidence: result.confidence,
        method: 'gladia',
        latency: result.latency,
        offline: false,
        metadata: result.metadata,
      };
    }
    console.log('[Voice] ⚠️ No internet, trying Vosk offline...');
  } catch (gladiaError) {
    console.warn('[Voice] ❌ Gladia failed:', gladiaError);
  }

  // ── LAYER 2: Vosk (offline, 100% private) ──
  try {
    console.log('[Voice] Attempting Vosk (Layer 2 - Offline)...');
    const voskLang = mapToVoskLanguage(language);
    const modelReady = await isVoskModelAvailable(voskLang);
    if (modelReady) {
      const result = await transcribeWithVosk(audioUri, voskLang);
      console.log('[Voice] ✅ Vosk succeeded (offline mode)');
      return {
        text: result.text,
        language: result.language,
        confidence: result.confidence,
        method: 'vosk',
        latency: result.latency,
        offline: true,
      };
    }
  } catch (voskError) {
    console.warn('[Voice] ❌ Vosk failed:', voskError);
  }

  throw new Error(
    'Voice transcription failed.\n' +
    '1. Check internet connection (for Gladia)\n' +
    '2. Download language model (for offline mode)\n' +
    '3. Check microphone permissions'
  );
}

/**
 * Complete voice → market workflow.
 * Transcribes voice, validates client-side, extracts market parameters.
 */
export async function voiceToMarket(
  audioUri: string,
  language: string = 'auto',
  _userWallet?: PublicKey,
): Promise<MarketFromVoice> {
  const transcription = await transcribeVoice(audioUri, language);
  console.log('[Voice] Transcription:', transcription.text);

  const validated = validateMarketBasic(transcription.text);
  if (!validated.valid) {
    throw new Error(`Invalid market: ${validated.reason}`);
  }

  const params = extractMarketParameters(transcription.text);

  return {
    question: transcription.text,
    language: transcription.language,
    category: params.category,
    resolveDate: params.resolveDate,
    voiceUri: audioUri,
    method: transcription.method,
    confidence: transcription.confidence,
    offline: transcription.offline,
  };
}

function mapToVoskLanguage(language: string): string {
  const mapping: Record<string, string> = {
    auto: 'en', en: 'en', es: 'es', fr: 'fr', pt: 'pt',
    ar: 'ar', hi: 'hi', zh: 'zh', sw: 'sw', ta: 'ta',
    te: 'te', ur: 'ur', vi: 'vi', th: 'th', ru: 'ru',
  };
  return mapping[language] || 'en';
}

function validateMarketBasic(question: string): { valid: boolean; reason: string } {
  if (question.length < 10) {
    return { valid: false, reason: 'Question too short (min 10 characters)' };
  }
  if (question.length > 280) {
    return { valid: false, reason: 'Question too long (max 280 characters)' };
  }
  const isQuestion =
    question.includes('?') ||
    /\b(will|is|can|does|would|should)\b/i.test(question);
  if (!isQuestion) {
    return { valid: false, reason: 'Must be a predictive question (e.g., "Will X happen?")' };
  }
  return { valid: true, reason: '' };
}

function extractMarketParameters(question: string): {
  category: string;
  resolveDate: Date;
} {
  let category = 'other';
  if (/\b(naira|dollar|euro|pound|currency|exchange)\b/i.test(question)) {
    category = 'currency';
  } else if (/\b(rain|weather|temperature|storm|sunny)\b/i.test(question)) {
    category = 'weather';
  } else if (/\b(election|president|vote|government|politics)\b/i.test(question)) {
    category = 'politics';
  } else if (/\b(bitcoin|ethereum|solana|crypto|blockchain)\b/i.test(question)) {
    category = 'crypto';
  } else if (/\b(match|game|team|score|win|championship)\b/i.test(question)) {
    category = 'sports';
  }

  const months = 'january|february|march|april|may|june|july|august|september|october|november|december';
  const dateMatch = question.match(new RegExp(`\\b(${months})\\s+(\\d{1,2})`, 'i'));
  let resolveDate: Date;

  if (dateMatch) {
    const monthIndex = new Date(Date.parse(dateMatch[1] + ' 1, 2000')).getMonth();
    resolveDate = new Date(2026, monthIndex, parseInt(dateMatch[2]));
  } else {
    resolveDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  return { category, resolveDate };
}
