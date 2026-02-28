import { useState, useCallback, useEffect, useRef } from 'react';
import { PublicKey, Transaction, LAMPORTS_PER_SOL, ComputeBudgetProgram } from '@solana/web3.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { autoAwardPoints } from '../lib/points/PointsRules';
import { encryptBetAmount, generateZkProof } from '../lib/privacy/arcium';
import { Market } from '../types/market';

import {
  createMarketIx,
  createLightMarketIx,
  placeBetIx,
  placeLightBetIx,
  shieldedBetIx,
  placeShieldedLightBetIx,
  resolveLightMarketIx,
  claimLightWinningsIx,
  findMarketPDA,
  findLightMarketPDA,
  findBetPDA,
  findTreasuryPDA,
  findVaultPDA,
} from '../lib/solana/market-writer';
import { fetchMarketsRaw, fetchLightMarketsRaw } from '../lib/solana/market-reader';

// ── local question text cache ───────────────────────────────────
// Light markets store a SHA-256 hash on-chain, not the original question.
// We persist the question text locally keyed by market PDA so that even
// after an RPC re-fetch the card shows the real question.
const Q_PREFIX = 'ilowa_mktq_';

async function cacheQuestion(pda: string, text: string) {
  try { await AsyncStorage.setItem(Q_PREFIX + pda, text); } catch {}
}

async function loadCachedQuestions(pdas: string[]): Promise<Record<string, string>> {
  if (!pdas.length) return {};
  try {
    const keys = pdas.map(p => Q_PREFIX + p);
    const pairs = await AsyncStorage.multiGet(keys);
    const out: Record<string, string> = {};
    for (const [k, v] of pairs) {
      if (v) out[k.slice(Q_PREFIX.length)] = v;
    }
    return out;
  } catch { return {}; }
}

interface MarketsState {
  markets: Market[];
  loading: boolean;
  error: string | null;
}

interface WalletInterface {
  publicKey: PublicKey | null;
  connected: boolean;
  isDemoMode?: boolean;
  signAndSendTransaction: (txOrBuilder: Transaction | ((signer: PublicKey) => Promise<Transaction>)) => Promise<string>;
  signMessage?: (msg: Uint8Array) => Promise<Uint8Array>;
}

// Demo markets for Expo Go testing
const now = Math.floor(Date.now() / 1000);
const DEMO_MARKETS: Market[] = [
  {
    id: 'demo-1', pubkey: 'Demo1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    creator: 'DemoCreator1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    question: 'Will Nigeria win AFCON 2026?',
    category: 'sports', region: 'west-africa', isPrivate: false,
    status: 'active', outcome: null,
    yesPool: 12.5, noPool: 8.3, totalBets: 47,
    createdAt: now - 86400 * 3, expiresAt: now + 86400 * 30,
  },
  {
    id: 'demo-2', pubkey: 'Demo2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    creator: 'DemoCreator2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    question: 'Will SOL reach $500 by March 2026?',
    category: 'crypto', region: 'global', isPrivate: false,
    status: 'active', outcome: null,
    yesPool: 45.2, noPool: 23.1, totalBets: 156,
    createdAt: now - 86400 * 7, expiresAt: now + 86400 * 14,
  },
  {
    id: 'demo-3', pubkey: 'Demo3xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    creator: 'DemoCreator3xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    question: 'Will Burna Boy release a new album before April?',
    category: 'music', region: 'west-africa', isPrivate: false,
    status: 'active', outcome: null,
    yesPool: 5.8, noPool: 3.2, totalBets: 28,
    createdAt: now - 86400 * 2, expiresAt: now + 86400 * 45,
  },
  {
    id: 'demo-4', pubkey: 'Demo4xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    creator: 'DemoCreator4xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    question: 'Will Kenya M-Pesa integrate with Solana in 2026?',
    category: 'tech', region: 'east-africa', isPrivate: true,
    status: 'active', outcome: null,
    yesPool: 8.0, noPool: 15.5, totalBets: 63,
    createdAt: now - 86400 * 5, expiresAt: now + 86400 * 60,
  },
  {
    id: 'demo-5', pubkey: 'Demo5xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    creator: 'DemoCreator5xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    question: 'Will the Naira strengthen against USD this quarter?',
    category: 'finance', region: 'west-africa', isPrivate: false,
    status: 'active', outcome: null,
    yesPool: 3.1, noPool: 22.7, totalBets: 89,
    createdAt: now - 86400, expiresAt: now + 86400 * 90,
  },
  {
    id: 'demo-6', pubkey: 'Demo6xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    creator: 'DemoCreator6xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    question: 'Will Amapiano top Billboard Global this year?',
    category: 'afrobeats', region: 'southern-africa', isPrivate: false,
    status: 'active', outcome: null,
    yesPool: 18.4, noPool: 6.2, totalBets: 112,
    createdAt: now - 86400 * 10, expiresAt: now + 86400 * 120,
  },
];

export function useMarkets(wallet?: WalletInterface) {
  const [state, setState] = useState<MarketsState>({
    markets: [],
    loading: false,
    error: null,
  });

  // always-fresh refs — avoids stale closure inside useCallback handlers
  const marketsRef = useRef<Market[]>([]);
  marketsRef.current = state.markets;
  const walletRef = useRef<WalletInterface | undefined>(wallet);
  walletRef.current = wallet;

  // optimistic cards that haven't appeared in RPC yet
  const pendingOptimistic = useRef<Map<string, Market>>(new Map());

  // Stable reference for wallet public key
  const walletPubkeyStr = wallet?.publicKey?.toBase58() ?? null;

  const fetchMarkets = useCallback(async () => {
    // Always read from ref so we never use a stale wallet snapshot
    const w = walletRef.current;
    const pubkeyStr = w?.publicKey?.toBase58() ?? null;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      if (w?.publicKey && pubkeyStr) {
        // Raw RPC reads — no Anchor Program constructor, no Hermes stack overflow
        const [regularResult, lightResult] = await Promise.allSettled([
          fetchMarketsRaw(),
          fetchLightMarketsRaw(),
        ]);

        if (regularResult.status === 'rejected')
          console.warn('[Markets] raw market fetch failed:', regularResult.reason);
        if (lightResult.status === 'rejected')
          console.warn('[Markets] raw light market fetch failed:', lightResult.reason);

        const regular = regularResult.status === 'fulfilled' ? regularResult.value : [];
        const light = lightResult.status === 'fulfilled' ? lightResult.value : [];

        console.log(`[Markets] fetched regular=${regular.length} light=${light.length}`);

        const merged = [...regular, ...light];

        // overlay cached question text on light markets (on-chain has only hash)
        const lightPdas = light.map(m => m.pubkey);
        const qCache = await loadCachedQuestions(lightPdas);
        for (const m of merged) {
          if (qCache[m.pubkey]) m.question = qCache[m.pubkey];
        }

        // prune optimistic cards that RPC now knows about
        const mergedIds = new Set(merged.map(m => m.id));
        for (const pid of pendingOptimistic.current.keys()) {
          if (mergedIds.has(pid)) pendingOptimistic.current.delete(pid);
        }

        // stitch any still-pending optimistic cards in front
        const stillPending = [...pendingOptimistic.current.values()];
        const final = [...stillPending, ...merged];

        if (final.length > 0) {
          setState({ markets: final, loading: false, error: null });
        } else {
          setState(prev => ({
            markets: prev.markets.length > 0 ? prev.markets : DEMO_MARKETS,
            loading: false, error: null,
          }));
        }
      } else {
        console.log('[Markets] No wallet, showing demo markets');
        setState({ markets: DEMO_MARKETS, loading: false, error: null });
      }
    } catch (error: any) {
      console.error('[Markets] Fetch failed, showing demo markets:', error);
      setState({ markets: DEMO_MARKETS, loading: false, error: null });
    }
  }, []); // walletRef always has the latest — no deps needed

  useEffect(() => {
    fetchMarkets();
  }, [walletPubkeyStr]); // re-fetch when wallet connects/changes

  const createMarket = useCallback(async (
    question: string,
    category: string,
    region: string,
    isPrivate: boolean,
    expiresAt: number,
    isCompressed: boolean = false,
  ): Promise<string> => {
    if (!wallet?.publicKey || !wallet.connected) {
      throw new Error('Wallet not connected');
    }

    // Demo mode: simulate market creation without touching Anchor or blockchain
    if (wallet.isDemoMode) {
      console.log('[Markets] Demo mode — simulating', isCompressed ? 'compressed' : 'public', 'market creation');
      const fakePDA = 'UserMkt' + Math.random().toString(36).substring(2, 10).toUpperCase() + 'x'.repeat(34);
      const demoMarket: Market = {
        id: fakePDA, pubkey: fakePDA,
        creator: wallet.publicKey!.toBase58().slice(0, 8) + '…',
        question, category, region,
        isPrivate: isPrivate || isCompressed,
        isLight: isCompressed,
        status: 'active', outcome: null,
        yesPool: 0, noPool: 0, totalBets: 0,
        createdAt: Date.now(),
        expiresAt: expiresAt * 1000,
      };
      setState(prev => ({
        markets: [demoMarket, ...prev.markets],
        loading: false, error: null,
      }));
      return fakePDA;
    }

    try {
      // No Anchor Program needed — raw TransactionInstruction builders
      let resolvedMarketPDA: PublicKey | null = null as PublicKey | null;

      const signature = await wallet.signAndSendTransaction(async (signer: PublicKey) => {
        // each step isolated so we know exactly which one overflows
        let ix: any;

        try { void signer.toBytes(); } catch (e: any) {
          throw new Error('[B:toBytes] ' + (e.message || e));
        }

        if (isCompressed) {
          try { [resolvedMarketPDA] = findLightMarketPDA(signer, expiresAt); } catch (e: any) {
            throw new Error('[B:lightPDA] ' + (e.message || e));
          }
          try { ix = createLightMarketIx(signer, question, category, region, expiresAt); } catch (e: any) {
            throw new Error('[B:lightIx] ' + (e.message || e));
          }
        } else {
          try { [resolvedMarketPDA] = findMarketPDA(signer, expiresAt); } catch (e: any) {
            throw new Error('[B:marketPDA] ' + (e.message || e));
          }
          try { ix = createMarketIx(signer, question, category, region, isPrivate, expiresAt); } catch (e: any) {
            throw new Error('[B:marketIx] ' + (e.message || e));
          }
        }

        try {
          const tx = new Transaction()
            .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
            .add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000 }))
            .add(ix);
          return tx;
        } catch (e: any) {
          throw new Error('[B:txBuild] ' + (e.message || e));
        }
      });

      const pdaStr = resolvedMarketPDA?.toBase58() ?? 'unknown';
      console.log('[Markets] Created market:', pdaStr, 'tx:', signature, isCompressed ? '(compressed)' : '');

      // cache question text for every market type — light markets need it
      // because on-chain is just a hash, and public markets benefit during
      // the RPC indexing lag window when only the optimistic card exists
      cacheQuestion(pdaStr, question);

      // Optimistic card — stays visible until RPC indexes the account
      const creatorStr = wallet.publicKey!.toBase58();
      const optimisticMarket: Market = {
        id: pdaStr, pubkey: pdaStr,
        creator: creatorStr.slice(0, 8) + '…',
        question, category, region,
        isPrivate: isPrivate || isCompressed,
        isLight: isCompressed,
        status: 'active', outcome: null,
        yesPool: 0, noPool: 0, totalBets: 0,
        createdAt: Date.now(),
        expiresAt: expiresAt * 1000,
      };
      pendingOptimistic.current.set(pdaStr, optimisticMarket);
      setState(prev => ({
        markets: [optimisticMarket, ...prev.markets.filter(m => !m.id.startsWith('demo-'))],
        loading: false, error: null,
      }));

      // Background re-sync — staggered retries so RPC has time to index
      setTimeout(() => fetchMarkets(), 4000);
      setTimeout(() => fetchMarkets(), 10000);

      // Don't pass signMessage here — it would open a second MWA session
      // immediately after the transaction one, which Phantom rejects.
      autoAwardPoints(wallet.publicKey.toBase58(), 'market_created').catch(() => {});

      return pdaStr;
    } catch (error: any) {
      console.error('[Markets] Create failed:', error);
      throw error;
    }
  }, [wallet, fetchMarkets]);

  const resolveLightMarket = useCallback(async (
    marketPubkey: string,
    outcome: boolean,
  ): Promise<string> => {
    if (!wallet?.publicKey || !wallet.connected) throw new Error('Wallet not connected');
    const marketPDA = new PublicKey(marketPubkey);
    const sig = await wallet.signAndSendTransaction(async (signer: PublicKey) => {
      const ix = resolveLightMarketIx(signer, marketPDA, outcome);
      return new Transaction()
        .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }))
        .add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000 }))
        .add(ix);
    });
    setTimeout(() => fetchMarkets(), 2000);
    return sig;
  }, [wallet, fetchMarkets]);

  const claimLightWinnings = useCallback(async (
    marketPubkey: string,
  ): Promise<string> => {
    if (!wallet?.publicKey || !wallet.connected) throw new Error('Wallet not connected');
    const marketPDA = new PublicKey(marketPubkey);
    const sig = await wallet.signAndSendTransaction(async (signer: PublicKey) => {
      const ix = claimLightWinningsIx(signer, marketPDA);
      return new Transaction()
        .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }))
        .add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000 }))
        .add(ix);
    });
    setTimeout(() => fetchMarkets(), 2000);

    // reward the winner — don't pass signMessage to avoid re-opening MWA
    autoAwardPoints(wallet.publicKey!.toBase58(), 'prediction_won').catch(() => {});

    return sig;
  }, [wallet, fetchMarkets]);

  const placeBet = useCallback(async (
    marketPubkey: string,
    outcome: boolean,
    amountSOL: number,
    shielded: boolean,
  ): Promise<string> => {
    if (!wallet?.publicKey || !wallet.connected) {
      throw new Error('Wallet not connected');
    }

    try {
      const marketPDA = new PublicKey(marketPubkey);
      const amountLamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);

      // Check if the target market is a light/compressed market
      const targetMarket = marketsRef.current.find(m => m.pubkey === marketPubkey);
      const isLightMarket = targetMarket?.isLight ?? false;

      console.log('[Markets] placeBet:', {
        market: marketPubkey.slice(0, 8) + '…',
        isLight: isLightMarket,
        shielded,
        outcome,
        amountSOL,
        amountLamports,
      });

      const signature = await wallet.signAndSendTransaction(async (signer: PublicKey) => {
        console.log('[Markets] bet builder — signer:', signer.toBase58().slice(0, 12) + '…');
        console.log('[Markets] bet builder — market:', marketPDA.toBase58().slice(0, 12) + '…');
        if (!isLightMarket && !shielded) {
          const [betPDA] = findBetPDA(marketPDA, signer);
          const [treasuryPDA] = findTreasuryPDA();
          const [vaultPDA] = findVaultPDA(marketPDA);
          console.log('[Markets] bet PDAs — bet:', betPDA.toBase58().slice(0, 12),
            'treasury:', treasuryPDA.toBase58().slice(0, 12),
            'vault:', vaultPDA.toBase58().slice(0, 12));
        }
        let ix;
        if (isLightMarket && shielded) {
          const [enc, zkp] = await Promise.all([
            encryptBetAmount(amountSOL, signer.toBytes()),
            generateZkProof(amountSOL, signer.toBase58(), marketPDA.toBase58()),
          ]);
          ix = placeShieldedLightBetIx(
            signer, marketPDA,
            Array.from(enc.ciphertext), Array.from(zkp.proof), outcome
          );
        } else if (isLightMarket) {
          ix = placeLightBetIx(signer, marketPDA, amountLamports, outcome);
        } else if (shielded) {
          const [enc, zkp] = await Promise.all([
            encryptBetAmount(amountSOL, signer.toBytes()),
            generateZkProof(amountSOL, signer.toBase58(), marketPDA.toBase58()),
          ]);
          ix = shieldedBetIx(
            signer, marketPDA,
            Array.from(enc.ciphertext), Array.from(zkp.proof), outcome
          );
        } else {
          ix = placeBetIx(signer, marketPDA, amountLamports, outcome);
        }
        return new Transaction()
          .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }))
          .add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000 }))
          .add(ix);
      });

      await fetchMarkets();
      console.log('[Markets] Placed bet:', signature);

      autoAwardPoints(wallet.publicKey!.toBase58(), 'bet_placed', { amountSOL }).catch(() => {});

      return signature;
    } catch (error: any) {
      console.error('[Markets] Bet failed:', error);
      throw error;
    }
  }, [wallet, fetchMarkets]);

  return {
    ...state,
    fetchMarkets,
    createMarket,
    placeBet,
    resolveLightMarket,
    claimLightWinnings,
  };
}
