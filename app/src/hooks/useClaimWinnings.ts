import { useState, useCallback } from 'react';
import { PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { claimWinningsIx } from '../lib/solana/market-writer';
import { getConnection } from '../lib/solana/connection';

interface ClaimResult {
  success: boolean;
  signature?: string;
  amountClaimed?: number;
  error?: string;
}

interface UseClaimWinningsReturn {
  claimWinnings: (marketPubkey: string) => Promise<ClaimResult>;
  loading: boolean;
  error: string | null;
}

export function useClaimWinnings(wallet: any): UseClaimWinningsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claimWinnings = useCallback(async (marketPubkey: string): Promise<ClaimResult> => {
    if (!wallet?.publicKey) {
      return { success: false, error: 'Wallet not connected' };
    }

    setLoading(true);
    setError(null);

    try {
      const connection = getConnection();
      const marketPDA = new PublicKey(marketPubkey);

      // Build claim instruction — raw borsh, no Anchor
      const ix = claimWinningsIx(wallet.publicKey, marketPDA);

      // Get balance before claim for calculating amount
      const balanceBefore = await connection.getBalance(wallet.publicKey);

      // Create and send transaction
      const tx = new Transaction().add(ix);
      tx.feePayer = wallet.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      // Sign and send
      const signedTx = await wallet.signTransaction(tx);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      
      // Confirm transaction
      await connection.confirmTransaction(signature, 'confirmed');

      // Get balance after claim
      const balanceAfter = await connection.getBalance(wallet.publicKey);
      const amountClaimed = (balanceAfter - balanceBefore) / LAMPORTS_PER_SOL;

      console.log('[ClaimWinnings] Success:', signature, 'Amount:', amountClaimed);
      return { success: true, signature, amountClaimed };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to claim winnings';
      console.error('[ClaimWinnings] Error:', errorMessage);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  return { claimWinnings, loading, error };
}

// Stubbed version for Expo Go compatibility
export function useClaimWinningsStub(): UseClaimWinningsReturn {
  const [loading, setLoading] = useState(false);

  const claimWinnings = useCallback(async (marketPubkey: string): Promise<ClaimResult> => {
    setLoading(true);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('[ClaimWinnings Stub] Simulated claim for market:', marketPubkey);
    setLoading(false);
    
    return { 
      success: true, 
      signature: 'stub_claim_' + Date.now().toString(36),
      amountClaimed: 0.5, // Demo amount
    };
  }, []);

  return { claimWinnings, loading, error: null };
}
