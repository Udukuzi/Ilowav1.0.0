declare module '@gladiaio/gladia' {
  export interface GladiaClientConfig {
    apiKey: string;
    baseURL?: string;
  }

  export interface TranscriptionOptions {
    audio: Buffer | Uint8Array;
    language?: string;
    enable_code_switching?: boolean;
    diarization?: boolean;
    subtitles?: boolean;
    detect_language?: boolean;
    callback_url?: string;
    custom_vocabulary?: string[];
  }

  export interface TranscriptionWord {
    word: string;
    start: number;
    end: number;
    confidence: number;
  }

  export interface TranscriptionResponse {
    transcription: {
      text: string;
      words?: TranscriptionWord[];
    };
    language?: string;
    confidence?: number;
    code_switching_detected?: boolean;
  }

  export interface StreamOptions {
    audio: ReadableStream;
    language?: string;
    enable_code_switching?: boolean;
  }

  export interface StreamChunk {
    text: string;
    partial: boolean;
  }

  export class GladiaClient {
    constructor(config: GladiaClientConfig);
    audio: {
      transcription: {
        create(options: TranscriptionOptions): Promise<TranscriptionResponse>;
        stream(options: StreamOptions): Promise<AsyncIterable<StreamChunk>>;
      };
    };
  }
}
