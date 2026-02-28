import * as SecureStore from 'expo-secure-store';
import { PublicKey, Transaction, Keypair } from '@solana/web3.js';
import { getConnection } from '../solana/connection';
import {
  initElderGuardianIx,
  setGuardianKeyIx,
  initiateRecoveryIx,
  cancelRecoveryIx,
} from '../solana/market-writer';

const GUARDIAN_STORE_KEY = 'elder-guardian';

export async function createElderGuardian(wallet: any): Promise<PublicKey> {
  if (!wallet?.publicKey) throw new Error('Wallet not connected');

  const guardianKeypair = Keypair.generate();

  await SecureStore.setItemAsync(
    GUARDIAN_STORE_KEY,
    JSON.stringify(Array.from(guardianKeypair.secretKey)),
    {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      requireAuthentication: true,
    }
  );

  const connection = getConnection();

  // Init elder guardian on-chain — raw borsh, no Anchor
  const initIx = initElderGuardianIx(wallet.publicKey);
  const setKeyIx = setGuardianKeyIx(wallet.publicKey, guardianKeypair.publicKey);

  const tx = new Transaction().add(initIx).add(setKeyIx);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  const signed = await wallet.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction(sig, 'confirmed');

  return guardianKeypair.publicKey;
}

export async function getStoredGuardianKey(): Promise<Uint8Array | null> {
  try {
    const stored = await SecureStore.getItemAsync(GUARDIAN_STORE_KEY, {
      requireAuthentication: true,
    });
    if (!stored) return null;
    return new Uint8Array(JSON.parse(stored));
  } catch {
    return null;
  }
}

export async function initiateRecovery(wallet: any, userWallet: PublicKey): Promise<string> {
  if (!wallet?.publicKey) throw new Error('Wallet not connected');
  const connection = getConnection();
  const ix = initiateRecoveryIx(wallet.publicKey, userWallet);
  const tx = new Transaction().add(ix);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  const signed = await wallet.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}

export async function cancelRecovery(wallet: any): Promise<string> {
  if (!wallet?.publicKey) throw new Error('Wallet not connected');
  const connection = getConnection();
  const ix = cancelRecoveryIx(wallet.publicKey);
  const tx = new Transaction().add(ix);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  const signed = await wallet.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}
