/**
 * Lelapa AI Integration
 * 
 * African language AI specialization for enhanced local language support.
 * Complements Cohere Aya with deeper African language understanding.
 * 
 * Supported capabilities:
 * - African language translation
 * - Sentiment analysis for local languages
 * - Named entity recognition for African context
 * - Text-to-speech for African languages
 * 
 * @see https://lelapa.ai
 */

const LELAPA_API_URL = process.env.EXPO_PUBLIC_LELAPA_URL || 'https://api.lelapa.ai/v1';

export interface LelapaConfig {
  apiKey: string | null;
  defaultLanguage: string;
  region: string;
}

export interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface TranslationResponse {
  translatedText: string;
  confidence: number;
  detectedLanguage?: string;
}

export interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  language: string;
}

export interface EntityResult {
  text: string;
  type: 'person' | 'location' | 'organization' | 'currency' | 'date' | 'other';
  confidence: number;
  startIndex: number;
  endIndex: number;
}

// African language codes supported by Lelapa (Vulavula API format)
// Maps ISO codes to Lelapa format (e.g., 'zu' -> 'zul_Latn')
export const LELAPA_LANGUAGES = {
  // South African languages
  'zu': { name: 'Zulu', region: 'southern-africa', lelapaCode: 'zul_Latn' },
  'xh': { name: 'Xhosa', region: 'southern-africa', lelapaCode: 'xho_Latn' },
  'af': { name: 'Afrikaans', region: 'southern-africa', lelapaCode: 'afr_Latn' },
  'st': { name: 'Sesotho', region: 'southern-africa', lelapaCode: 'sot_Latn' },
  'tn': { name: 'Setswana', region: 'southern-africa', lelapaCode: 'tsn_Latn' },
  'ss': { name: 'Swati', region: 'southern-africa', lelapaCode: 'ssw_Latn' },
  'ts': { name: 'Tsonga', region: 'southern-africa', lelapaCode: 'tso_Latn' },
  'nso': { name: 'Sepedi', region: 'southern-africa', lelapaCode: 'nso_Latn' },
  
  // East African languages
  'sw': { name: 'Swahili', region: 'east-africa', lelapaCode: 'swh_Latn' },
  
  // Common
  'en': { name: 'English', region: 'global', lelapaCode: 'eng_Latn' },
};

// Convert ISO language code to Lelapa format
function toLelapaCode(isoCode: string): string {
  const lang = LELAPA_LANGUAGES[isoCode as keyof typeof LELAPA_LANGUAGES];
  return lang?.lelapaCode || 'eng_Latn';
}

let config: LelapaConfig = {
  apiKey: null,
  defaultLanguage: 'en',
  region: 'west-africa',
};

// Track rate limit hits — once 429'd, stop calling until next app restart
let rateLimited = false;

/**
 * Initialize Lelapa AI client
 */
export function initLelapa(customConfig?: Partial<LelapaConfig>): void {
  config = {
    ...config,
    ...customConfig,
    apiKey: process.env.EXPO_PUBLIC_LELAPA_API_KEY || customConfig?.apiKey || null,
  };
  
  console.log('[Lelapa] Initialized:', { 
    hasApiKey: !!config.apiKey, 
    region: config.region 
  });
}

/**
 * Check if Lelapa is available
 */
export function isLelapaAvailable(): boolean {
  return !!config.apiKey && !rateLimited;
}

/**
 * Translate text between African languages
 */
export async function translateText(request: TranslationRequest): Promise<TranslationResponse> {
  if (!isLelapaAvailable()) {
    // Fallback: return original text
    return {
      translatedText: request.text,
      confidence: 0,
      detectedLanguage: request.sourceLanguage,
    };
  }

  try {
    const response = await fetch(`${LELAPA_API_URL}/translate/process`, {
      method: 'POST',
      headers: {
        'X-CLIENT-TOKEN': config.apiKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input_text: request.text,
        source_lang: toLelapaCode(request.sourceLanguage),
        target_lang: toLelapaCode(request.targetLanguage),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Lelapa] API response:', response.status, errorText);
      if (response.status === 429) {
        rateLimited = true;
        console.warn('[Lelapa] Monthly limit hit — disabling for this session, falling back to Aya');
      }
      throw new Error(`Lelapa API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Lelapa returns: { translation: [{ translated_text: "..." }] }
    const translatedText = data.translation?.[0]?.translated_text || request.text;
    
    return {
      translatedText,
      confidence: 0.9,
      detectedLanguage: request.sourceLanguage,
    };
  } catch (error) {
    console.error('[Lelapa] Translation failed:', error);
    return {
      translatedText: request.text,
      confidence: 0,
    };
  }
}

/**
 * Detect language of text
 */
export async function detectLanguage(text: string): Promise<{ language: string; confidence: number }> {
  if (!isLelapaAvailable()) {
    return { language: 'en', confidence: 0 };
  }

  try {
    const response = await fetch(`${LELAPA_API_URL}/detect-language`, {
      method: 'POST',
      headers: {
        'X-CLIENT-TOKEN': config.apiKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      if (response.status === 429) { rateLimited = true; }
      throw new Error(`Lelapa API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      language: data.language || 'en',
      confidence: data.confidence || 0,
    };
  } catch (error) {
    console.error('[Lelapa] Language detection failed:', error);
    return { language: 'en', confidence: 0 };
  }
}

/**
 * Analyze sentiment of text in African languages
 */
export async function analyzeSentiment(text: string, language?: string): Promise<SentimentResult> {
  if (!isLelapaAvailable()) {
    return {
      sentiment: 'neutral',
      confidence: 0,
      language: language || 'en',
    };
  }

  try {
    const response = await fetch(`${LELAPA_API_URL}/sentiment`, {
      method: 'POST',
      headers: {
        'X-CLIENT-TOKEN': config.apiKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        text,
        language: language || config.defaultLanguage,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) { rateLimited = true; }
      throw new Error(`Lelapa API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      sentiment: data.sentiment || 'neutral',
      confidence: data.confidence || 0,
      language: data.language || language || 'en',
    };
  } catch (error) {
    console.error('[Lelapa] Sentiment analysis failed:', error);
    return {
      sentiment: 'neutral',
      confidence: 0,
      language: language || 'en',
    };
  }
}

/**
 * Extract named entities from text
 */
export async function extractEntities(text: string, language?: string): Promise<EntityResult[]> {
  if (!config.apiKey) {
    return [];
  }

  try {
    const response = await fetch(`${LELAPA_API_URL}/ner`, {
      method: 'POST',
      headers: {
        'X-CLIENT-TOKEN': config.apiKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        text,
        language: language || config.defaultLanguage,
      }),
    });

    if (!response.ok) {
      throw new Error(`Lelapa API error: ${response.status}`);
    }

    const data = await response.json();
    
    return (data.entities || []).map((e: any) => ({
      text: e.text,
      type: e.type || 'other',
      confidence: e.confidence || 0.8,
      startIndex: e.start || 0,
      endIndex: e.end || 0,
    }));
  } catch (error) {
    console.error('[Lelapa] Entity extraction failed:', error);
    return [];
  }
}

/**
 * Get text-to-speech audio URL for African language text
 */
export async function getTextToSpeech(
  text: string, 
  language: string,
  voice?: string
): Promise<string | null> {
  if (!config.apiKey) {
    return null;
  }

  try {
    const response = await fetch(`${LELAPA_API_URL}/tts`, {
      method: 'POST',
      headers: {
        'X-CLIENT-TOKEN': config.apiKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        text,
        language,
        voice: voice || 'default',
      }),
    });

    if (!response.ok) {
      throw new Error(`Lelapa API error: ${response.status}`);
    }

    const data = await response.json();
    return data.audio_url || null;
  } catch (error) {
    console.error('[Lelapa] TTS failed:', error);
    return null;
  }
}

/**
 * Get supported languages for a region
 */
export function getLanguagesForRegion(regionId: string): Array<{ code: string; name: string }> {
  return Object.entries(LELAPA_LANGUAGES)
    .filter(([_, info]) => info.region === regionId || info.region === 'global')
    .map(([code, info]) => ({ code, name: info.name }));
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(languageCode: string): boolean {
  return languageCode in LELAPA_LANGUAGES;
}

/**
 * Get language info
 */
export function getLanguageInfo(languageCode: string): { name: string; region: string } | null {
  return LELAPA_LANGUAGES[languageCode as keyof typeof LELAPA_LANGUAGES] || null;
}
