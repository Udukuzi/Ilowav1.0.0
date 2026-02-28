import { PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getConnection } from '../solana/connection';
import { tipDjIx } from '../solana/market-writer';

const PLATFORM_FEE_PERCENT = 10; // 10% platform fee on tips

export async function tipDJ(
  wallet: any,
  djWallet: PublicKey,
  amountSOL: number
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('Wallet not connected');

  const connection = getConnection();
  const lamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);

  const ix = tipDjIx(wallet.publicKey, djWallet, lamports);
  const tx = new Transaction().add(ix);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  const signed = await wallet.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}

export function calculateTipBreakdown(amountSOL: number) {
  const platformFee = amountSOL * PLATFORM_FEE_PERCENT / 100;
  const djReceives = amountSOL - platformFee;
  return { total: amountSOL, platformFee, djReceives };
}
