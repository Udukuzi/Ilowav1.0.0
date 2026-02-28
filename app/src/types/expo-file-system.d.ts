declare module 'expo-file-system' {
  export enum EncodingType {
    UTF8 = 'utf8',
    Base64 = 'base64',
  }

  export function readAsStringAsync(
    fileUri: string,
    options?: { encoding?: EncodingType | 'utf8' | 'base64' }
  ): Promise<string>;

  export function writeAsStringAsync(
    fileUri: string,
    contents: string,
    options?: { encoding?: EncodingType | 'utf8' | 'base64' }
  ): Promise<void>;

  export function deleteAsync(
    fileUri: string,
    options?: { idempotent?: boolean }
  ): Promise<void>;

  export function getInfoAsync(
    fileUri: string
  ): Promise<{ exists: boolean; size?: number; uri: string }>;

  export const documentDirectory: string | null;
  export const cacheDirectory: string | null;
}

declare module 'expo-file-system/legacy' {
  export enum EncodingType {
    UTF8 = 'utf8',
    Base64 = 'base64',
  }

  export function readAsStringAsync(
    fileUri: string,
    options?: { encoding?: EncodingType | 'utf8' | 'base64' }
  ): Promise<string>;

  export function writeAsStringAsync(
    fileUri: string,
    contents: string,
    options?: { encoding?: EncodingType | 'utf8' | 'base64' }
  ): Promise<void>;

  export function deleteAsync(
    fileUri: string,
    options?: { idempotent?: boolean }
  ): Promise<void>;

  export function getInfoAsync(
    fileUri: string
  ): Promise<{ exists: boolean; size?: number; uri: string }>;

  export const documentDirectory: string | null;
  export const cacheDirectory: string | null;
}
