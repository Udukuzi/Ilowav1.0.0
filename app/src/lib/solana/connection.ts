import { Connection, PublicKey } from '@solana/web3.js';

export const SOLANA_NETWORK = 'devnet';
export const PROGRAM_ID = new PublicKey('HYDwFwax9U6svCRYWD7Fqq3TXxSSQCQ6CwKrb3ZTkD3z');

const RPC_URL = process.env.EXPO_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';

let connectionInstance: Connection | null = null;

export function getConnection(): Connection {
  if (!connectionInstance) {
    connectionInstance = new Connection(RPC_URL, 'confirmed');
  }
  return connectionInstance;
}

export function setCustomRPC(url: string) {
  connectionInstance = new Connection(url, 'confirmed');
}
