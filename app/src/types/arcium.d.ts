declare module '@arcium/sdk' {
  export interface ArciumClientConfig {
    network: 'mainnet-beta' | 'devnet';
    apiKey?: string | null;
  }

  export interface EncryptOptions {
    data: string;
    recipients: string[];
    metadata?: Record<string, unknown>;
  }

  export interface EncryptedData {
    ciphertext: Uint8Array;
    nonce: Uint8Array;
    recipients: string[];
  }

  export interface ProofOptions {
    claim: string;
    privateInputs: Record<string, unknown>;
    publicInputs: Record<string, unknown>;
  }

  export interface ZkProof {
    proof: Uint8Array;
    publicInputs: Record<string, unknown>;
    verified: boolean;
  }

  export interface DecryptOptions {
    ciphertext: Uint8Array;
    privateKey: Uint8Array;
  }

  export interface DecryptedData {
    data: string;
  }

  export class ArciumClient {
    constructor(config: ArciumClientConfig);
    encrypt(options: EncryptOptions): Promise<EncryptedData>;
    decrypt(options: DecryptOptions): Promise<DecryptedData>;
    generateProof(options: ProofOptions): Promise<ZkProof>;
    health(): Promise<{ status: string }>;
  }
}
