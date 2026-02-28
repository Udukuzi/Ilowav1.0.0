declare module '@lightprotocol/stateless.js' {
  import { Connection, PublicKey, Keypair } from '@solana/web3.js';

  export interface MerkleTreeConfig {
    authority: PublicKey;
    maxDepth: number;
    maxBufferSize: number;
    canopyDepth: number;
  }

  export interface MerkleTreeResult {
    publicKey: PublicKey;
    signature: string;
  }

  export function createMerkleTree(
    connection: Connection,
    config: MerkleTreeConfig
  ): Promise<MerkleTreeResult>;

  export function compressAccount(
    connection: Connection,
    merkleTree: PublicKey,
    data: Uint8Array
  ): Promise<string>;

  export function fetchCompressedAccounts(
    connection: Connection,
    merkleTree: PublicKey
  ): Promise<Array<{ data: Buffer; owner: PublicKey }>>;
}
