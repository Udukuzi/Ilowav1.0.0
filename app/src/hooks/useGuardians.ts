import { useState, useCallback } from 'react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { ElderGuardianState, SocialRecoveryState } from '../types/security';
import {
  initElderGuardianIx,
  setGuardianKeyIx,
  initiateRecoveryIx,
  cancelRecoveryIx,
  initSocialRecoveryIx,
  findElderGuardianPDA,
} from '../lib/solana/market-writer';
import { getConnection } from '../lib/solana/connection';

export function useGuardians(wallet?: any) {
  const [elderGuardian, setElderGuardian] = useState<ElderGuardianState | null>(null);
  const [socialRecovery, setSocialRecovery] = useState<SocialRecoveryState | null>(null);
  const [loading, setLoading] = useState(false);

  const sendTx = useCallback(async (ix: any) => {
    if (!wallet?.publicKey) throw new Error('Wallet not connected');
    const connection = getConnection();
    const tx = new Transaction().add(ix);
    tx.feePayer = wallet.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    const signed = await wallet.signTransaction(tx);
    const sig = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(sig, 'confirmed');
    return sig;
  }, [wallet]);

  const loadGuardianState = useCallback(async () => {
    if (!wallet?.publicKey) return;
    try {
      // Raw RPC read — no Anchor fetch
      const connection = getConnection();
      const [pda] = findElderGuardianPDA(wallet.publicKey);
      const info = await connection.getAccountInfo(pda);
      if (!info?.data) { setElderGuardian(null); return; }
      const buf = Buffer.isBuffer(info.data) ? info.data : Buffer.from(info.data);
      // ElderGuardian layout: 8 disc + 32 user + 32 guardian_key + 8 timelock + 1 recovery_initiated + 1 bump
      if (buf.length < 82) { setElderGuardian(null); return; }
      const guardianKeyBytes = buf.subarray(40, 72);
      const timelockLo = buf.readUInt32LE(72);
      const timelockHi = buf.readInt32LE(76);
      const timelock = timelockHi * 0x1_0000_0000 + timelockLo;
      const recoveryInitiated = buf.readUInt8(80) !== 0;
      setElderGuardian({
        isInitialized: true,
        guardianKey: new PublicKey(guardianKeyBytes).toBase58(),
        timelock,
        recoveryInitiated,
      });
    } catch {
      setElderGuardian(null);
    }
  }, [wallet]);

  const initElderGuardian = useCallback(async () => {
    if (!wallet?.publicKey) throw new Error('Wallet not connected');
    setLoading(true);
    try {
      const ix = initElderGuardianIx(wallet.publicKey);
      await sendTx(ix);
      // reload state so the UI flips to green immediately
      await loadGuardianState();
      setLoading(false);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }, [wallet, sendTx, loadGuardianState]);

  const setGuardianKey = useCallback(async (guardianKey: PublicKey) => {
    if (!wallet?.publicKey) throw new Error('Wallet not connected');
    setLoading(true);
    try {
      const ix = setGuardianKeyIx(wallet.publicKey, guardianKey);
      await sendTx(ix);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }, [wallet, sendTx]);

  const initSocialRecovery = useCallback(async (guardians: string[]) => {
    if (!wallet?.publicKey) throw new Error('Wallet not connected');
    if (guardians.length !== 5) throw new Error('Need exactly 5 guardians');
    setLoading(true);
    try {
      const guardianPubkeys = guardians.map((g) => new PublicKey(g));
      const ix = initSocialRecoveryIx(wallet.publicKey, guardianPubkeys);
      await sendTx(ix);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }, [wallet, sendTx]);

  const initiateRecovery = useCallback(async (userWallet: PublicKey) => {
    if (!wallet?.publicKey) throw new Error('Wallet not connected');
    const ix = initiateRecoveryIx(wallet.publicKey, userWallet);
    await sendTx(ix);
  }, [wallet, sendTx]);

  const cancelRecovery = useCallback(async () => {
    if (!wallet?.publicKey) throw new Error('Wallet not connected');
    const ix = cancelRecoveryIx(wallet.publicKey);
    await sendTx(ix);
  }, [wallet, sendTx]);

  return {
    elderGuardian,
    socialRecovery,
    loading,
    initElderGuardian,
    setGuardianKey,
    initSocialRecovery,
    initiateRecovery,
    cancelRecovery,
    loadGuardianState,
  };
}
