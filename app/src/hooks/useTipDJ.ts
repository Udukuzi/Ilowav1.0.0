import { useState, useCallback } from 'react';
import { PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { tipDjIx } from '../lib/solana/market-writer';
import { getConnection } from '../lib/solana/connection';

interface TipDJResult {
  success: boolean;
  signature?: string;
  error?: string;
}

interface UseTipDJReturn {
  tipDJ: (djWallet: string, amountSol: number) => Promise<TipDJResult>;
  loading: boolean;
  error: string | null;
}

export function useTipDJ(wallet: any): UseTipDJReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tipDJ = useCallback(async (djWallet: string, amountSol: number): Promise<TipDJResult> => {
    if (!wallet?.publicKey) {
      return { success: false, error: 'Wallet not connected' };
    }

    setLoading(true);
    setError(null);

    try {
      // Validate minimum tip (0.001 SOL as per program)
      if (amountSol < 0.001) {
        throw new Error('Minimum tip is 0.001 SOL');
      }

      const connection = getConnection();
      const djPubkey = new PublicKey(djWallet);
      const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

      // Build tip instruction — raw borsh, no Anchor
      const ix = tipDjIx(wallet.publicKey, djPubkey, amountLamports);

      // Create and send transaction
      const tx = new Transaction().add(ix);
      tx.feePayer = wallet.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      // Sign and send
      const signedTx = await wallet.signTransaction(tx);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      
      // Confirm transaction
      await connection.confirmTransaction(signature, 'confirmed');

      console.log('[TipDJ] Success:', signature);
      return { success: true, signature };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send tip';
      console.error('[TipDJ] Error:', errorMessage);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  return { tipDJ, loading, error };
}

// Stubbed version for Expo Go compatibility
export function useTipDJStub(): UseTipDJReturn {
  const [loading, setLoading] = useState(false);

  const tipDJ = useCallback(async (djWallet: string, amountSol: number): Promise<TipDJResult> => {
    setLoading(true);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log('[TipDJ Stub] Simulated tip:', amountSol, 'SOL to', djWallet);
    setLoading(false);
    
    return { 
      success: true, 
      signature: 'stub_' + Date.now().toString(36) 
    };
  }, []);

  return { tipDJ, loading, error: null };
}
