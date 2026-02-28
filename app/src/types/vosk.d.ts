declare module 'react-native-vosk' {
  export interface RecognizerConfig {
    model: string;
    sampleRate: number;
  }

  export interface TranscriptionResult {
    text: string;
    confidence?: number;
  }

  export interface Recognizer {
    transcribe(audioBase64: string): Promise<TranscriptionResult>;
    release(): Promise<void>;
  }

  const Vosk: {
    createRecognizer(config: RecognizerConfig): Promise<Recognizer>;
  };

  export default Vosk;
}

declare module 'react-native-fs' {
  export const DocumentDirectoryPath: string;
  export const CachesDirectoryPath: string;

  export function exists(path: string): Promise<boolean>;
  export function mkdir(path: string, options?: Record<string, unknown>): Promise<void>;
  export function readFile(path: string, encoding?: string): Promise<string>;
  export function unlink(path: string): Promise<void>;
  export function unzip(source: string, target: string): Promise<void>;

  export interface DownloadProgressResult {
    bytesWritten: number;
    contentLength: number;
  }

  export interface DownloadFileOptions {
    fromUrl: string;
    toFile: string;
    progress?: (res: DownloadProgressResult) => void;
  }

  export interface DownloadResult {
    statusCode: number;
  }

  export function downloadFile(options: DownloadFileOptions): {
    promise: Promise<DownloadResult>;
  };
}
