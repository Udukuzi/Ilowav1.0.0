// NOTE: All native package imports removed for Expo Go compatibility.
// Metro statically bundles require() even inside try/catch.
// Restore real implementations when using EAS custom dev build.

const VOSK_LANGUAGES = ['en', 'es', 'fr', 'pt', 'ar', 'hi', 'zh', 'sw', 'ta', 'te', 'ur', 'vi', 'th', 'ru'];

export async function isVoskModelAvailable(_language: string): Promise<boolean> {
  return false;
}

export async function downloadVoskModel(
  _language: string,
  _onProgress?: (progress: number) => void
): Promise<string> {
  throw new Error('Vosk not available in Expo Go. Build a custom dev client.');
}

export async function transcribeWithVosk(
  _audioUri: string,
  _language: string = 'en'
): Promise<VoskResult> {
  throw new Error('Vosk not available in Expo Go. Build a custom dev client.');
}

export async function preloadVoskModels(
  _languages: string[],
  _onProgress?: (language: string, progress: number) => void
): Promise<void> {
  // no-op in Expo Go
}

export function getAvailableVoskLanguages(): string[] {
  return VOSK_LANGUAGES;
}

export interface VoskResult {
  text: string;
  language: string;
  confidence: number;
  method: 'vosk';
  latency: number;
  offline: boolean;
}
