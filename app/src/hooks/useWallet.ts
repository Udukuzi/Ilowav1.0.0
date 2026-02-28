import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import Constants from 'expo-constants';
import { useUserTier } from './useUserTier';
import * as SecureStore from 'expo-secure-store';
import { PublicKey, Keypair, Transaction, Connection } from '@solana/web3.js';
// @ts-ignore - bs58 has no types
import bs58 from 'bs58';
import { fromUint8Array, toUint8Array } from 'js-base64';

// Detect if running in Expo Go (no native modules available)
const isExpoGo = Constants.appOwnership === 'expo';

// ── Hermes-safe transaction serializer ─────────────────────────────────
// Transaction.serialize() → compileMessage() → toBase58() blows Hermes's
// stack via bs58 → base-x → Buffer.from recursion. This manual serializer
// produces identical wire bytes using only flat Uint8Array math.

const B58_ALPHA = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const B58_MAP = new Uint8Array(256).fill(255);
for (let i = 0; i < 58; i++) B58_MAP[B58_ALPHA.charCodeAt(i)] = i;

function b58decodeRaw(str: string): Uint8Array {
  if (!str || str.length === 0) return new Uint8Array(0);
  let zeros = 0;
  while (zeros < str.length && str[zeros] === '1') zeros++;
  const size = ((str.length - zeros) * 733 / 1000 + 1) >>> 0;
  const b256 = new Uint8Array(size);
  let len = 0;
  for (let i = zeros; i < str.length; i++) {
    let carry = B58_MAP[str.charCodeAt(i)];
    if (carry === 255) throw new Error('Non-base58 char');
    let j = 0;
    for (let it = size - 1; (carry !== 0 || j < len) && it >= 0; it--, j++) {
      carry += 58 * b256[it];
      b256[it] = carry % 256;
      carry = (carry / 256) >>> 0;
    }
    len = j;
  }
  let skip = size - len;
  while (skip < size && b256[skip] === 0) skip++;
  const out = new Uint8Array(zeros + (size - skip));
  // leading zeros already 0
  out.set(b256.subarray(skip), zeros);
  return out;
}

function compactU16(val: number): number[] {
  const bytes: number[] = [];
  let rem = val;
  for (;;) {
    let b = rem & 0x7f;
    rem >>= 7;
    if (rem !== 0) b |= 0x80;
    bytes.push(b);
    if (rem === 0) break;
  }
  return bytes;
}

function pubkeyBytes(pk: PublicKey): Uint8Array {
  // toBytes() returns 32 bytes from the internal BN — no bs58 involved
  return pk.toBytes();
}

function hermesSerializeTx(tx: Transaction): Uint8Array {
  const feePayer = tx.feePayer!;
  const ixs = tx.instructions;

  // ── collect + dedup account metas ──────────────────────────────────
  type AcctMeta = { pk: Uint8Array; key: string; isSigner: boolean; isWritable: boolean };
  const metaMap = new Map<string, AcctMeta>();

  // fee payer first
  const fpBytes = pubkeyBytes(feePayer);
  const fpKey = fpBytes.join(',');
  metaMap.set(fpKey, { pk: fpBytes, key: fpKey, isSigner: true, isWritable: true });

  // program IDs (track separately — they're non-signer, non-writable)
  const programIdKeys = new Set<string>();

  for (const ix of ixs) {
    for (const meta of ix.keys) {
      const bytes = pubkeyBytes(meta.pubkey);
      const k = bytes.join(',');
      const existing = metaMap.get(k);
      if (existing) {
        existing.isSigner = existing.isSigner || meta.isSigner;
        existing.isWritable = existing.isWritable || meta.isWritable;
      } else {
        metaMap.set(k, { pk: bytes, key: k, isSigner: meta.isSigner, isWritable: meta.isWritable });
      }
    }
    const pidBytes = pubkeyBytes(ix.programId);
    const pidKey = pidBytes.join(',');
    programIdKeys.add(pidKey);
    if (!metaMap.has(pidKey)) {
      metaMap.set(pidKey, { pk: pidBytes, key: pidKey, isSigner: false, isWritable: false });
    }
  }

  // ── sort: signers first (writable before readonly), then non-signers ─
  const all = Array.from(metaMap.values());
  // pull fee payer out — always index 0
  const fpIdx = all.findIndex(a => a.key === fpKey);
  const [fpMeta] = all.splice(fpIdx, 1);

  all.sort((a, b) => {
    if (a.isSigner !== b.isSigner) return a.isSigner ? -1 : 1;
    if (a.isWritable !== b.isWritable) return a.isWritable ? -1 : 1;
    // stable tie-break by raw bytes
    for (let i = 0; i < 32; i++) {
      if (a.pk[i] !== b.pk[i]) return a.pk[i] - b.pk[i];
    }
    return 0;
  });
  const accounts = [fpMeta, ...all];

  // build key→index lookup
  const keyIndex = new Map<string, number>();
  accounts.forEach((a, i) => keyIndex.set(a.key, i));

  // ── header counts ──────────────────────────────────────────────────
  let numRequiredSigs = 0;
  let numReadonlySigned = 0;
  let numReadonlyUnsigned = 0;
  for (const a of accounts) {
    if (a.isSigner) {
      numRequiredSigs++;
      if (!a.isWritable) numReadonlySigned++;
    } else {
      if (!a.isWritable) numReadonlyUnsigned++;
    }
  }

  // ── encode instructions ────────────────────────────────────────────
  const encodedIxs: Uint8Array[] = [];
  for (const ix of ixs) {
    const pidBytes = pubkeyBytes(ix.programId);
    const pidKey = pidBytes.join(',');
    const pidIndex = keyIndex.get(pidKey)!;

    const acctIndices: number[] = [];
    for (const meta of ix.keys) {
      const mBytes = pubkeyBytes(meta.pubkey);
      acctIndices.push(keyIndex.get(mBytes.join(','))!);
    }

    const data = ix.data;
    const parts: number[] = [
      pidIndex,
      ...compactU16(acctIndices.length),
      ...acctIndices,
      ...compactU16(data.length),
      ...Array.from(data),
    ];
    encodedIxs.push(new Uint8Array(parts));
  }

  // ── blockhash bytes ────────────────────────────────────────────────
  const blockhashBytes = b58decodeRaw(tx.recentBlockhash!);

  // ── assemble message ───────────────────────────────────────────────
  const numKeysEnc = compactU16(accounts.length);
  const numIxsEnc = compactU16(ixs.length);

  let msgSize = 3 + numKeysEnc.length + accounts.length * 32 + 32 + numIxsEnc.length;
  for (const eix of encodedIxs) msgSize += eix.length;

  const msg = new Uint8Array(msgSize);
  let off = 0;
  msg[off++] = numRequiredSigs;
  msg[off++] = numReadonlySigned;
  msg[off++] = numReadonlyUnsigned;
  for (const b of numKeysEnc) msg[off++] = b;
  for (const a of accounts) { msg.set(a.pk, off); off += 32; }
  msg.set(blockhashBytes, off); off += 32;
  for (const b of numIxsEnc) msg[off++] = b;
  for (const eix of encodedIxs) { msg.set(eix, off); off += eix.length; }

  // ── wrap in transaction envelope (1 empty sig slot) ────────────────
  const sigCountEnc = compactU16(numRequiredSigs);
  const wireSize = sigCountEnc.length + numRequiredSigs * 64 + msg.length;
  const wire = new Uint8Array(wireSize);
  let wOff = 0;
  for (const b of sigCountEnc) wire[wOff++] = b;
  // signature slots stay zero (wallet will sign)
  wOff += numRequiredSigs * 64;
  wire.set(msg, wOff);

  return wire;
}

// Conditionally import wallet adapter (only works in dev client builds)
// Two transact functions:
//   transact       — web3js wrapper (Proxy adds Transaction <-> base64 conversion)
//   transactRaw    — raw base protocol (no Proxy, wallet.signAndSendTransactions
//                    accepts { payloads: base64[] } directly)
// We use transactRaw for signAndSendTransaction because our manual serializer
// already produces base64 payloads. The wrapper would try to re-serialize
// Transaction objects via Transaction.serialize() which overflows Hermes's stack.
let transact: any = null;
let transactRaw: any = null;
let Web3MobileWallet: any = null;

if (!isExpoGo) {
  try {
    const walletAdapter = require('@solana-mobile/mobile-wallet-adapter-protocol-web3js');
    transact = walletAdapter.transact;
    Web3MobileWallet = walletAdapter.Web3MobileWallet;
  } catch (e) {
    console.warn('[Wallet] Mobile wallet adapter not available');
  }
  try {
    const baseProtocol = require('@solana-mobile/mobile-wallet-adapter-protocol');
    transactRaw = baseProtocol.transact;
  } catch (e) {
    console.warn('[Wallet] Base MWA protocol not available');
  }
}

const APP_IDENTITY = {
  name: 'Ilowa',
  uri: 'https://ilowa.app',
  // icon omitted until domain is live — Phantom flags dapps whose icon URL 404s
};

const WALLET_KEY = 'ilowa_wallet_pubkey';
const DEMO_MODE_KEY = 'ilowa_demo_mode';
const AUTH_TOKEN_KEY = 'ilowa_wallet_auth_token';
const RPC_URL = process.env.EXPO_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';

// raw JSON-RPC helper — avoids @solana/web3.js response parsing which overflows Hermes
async function rpcFetch(method: string, params: any[]): Promise<any> {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
  const resp = await fetch(RPC_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  });
  const json = await resp.json();
  if (json.error) throw new Error(`RPC ${method}: ${json.error.message}`);
  return json.result;
}

export function useWallet() {
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const { tier: userTier, limits: tierLimits, isPro } = useUserTier();

  // Restore wallet from secure storage on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(WALLET_KEY);
        const demoMode = await SecureStore.getItemAsync(DEMO_MODE_KEY);
        const storedToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
        if (stored) {
          // Validate stored key before using it
          let restoredKey: PublicKey;
          try {
            restoredKey = new PublicKey(stored);
          } catch {
            console.warn('[Wallet] Stored key invalid, clearing');
            await SecureStore.deleteItemAsync(WALLET_KEY);
            await SecureStore.deleteItemAsync(DEMO_MODE_KEY);
            return;
          }
          setPublicKey(restoredKey);
          setConnected(true);
          setIsDemoMode(demoMode === 'true');
          if (storedToken) setAuthToken(storedToken);
          console.log('[Wallet] Restored:', restoredKey.toBase58().slice(0, 8) + '...');
        }
      } catch (e) {
        console.warn('[Wallet] Failed to restore:', e);
      }
    })();
  }, []);

  const connect = useCallback(async () => {
    if (connecting) return;
    setConnecting(true);

    try {
      // Demo mode for Expo Go (native MWA modules not available)
      if (isExpoGo || !transact) {
        console.log('[Wallet] Using demo mode (Expo Go)');
        // Generate a valid random demo keypair — Keypair.generate() always produces a valid 32-byte key
        const demoKeypair = Keypair.generate();
        const demoPubkey = demoKeypair.publicKey;

        // Simulate the MWA authorization dialog so user sees the auth flow
        await new Promise<void>((resolve) => {
          Alert.alert(
            '🔐 Authorize Ilowa',
            `Ilowa wants to connect to your Solana wallet and authorize you to sign transactions.\n\nAddress: ${demoPubkey.toBase58().slice(0, 8)}...${demoPubkey.toBase58().slice(-6)}\n\n(Demo mode — Expo Go detected. Use a dev client build for real MWA.)`,
            [
              { text: 'Decline', style: 'cancel', onPress: () => { setConnecting(false); resolve(); } },
              { text: 'Authorize & Connect', onPress: () => resolve() },
            ],
          );
        });

        if (!connecting) return; // User declined
        await SecureStore.setItemAsync(WALLET_KEY, demoPubkey.toBase58());
        await SecureStore.setItemAsync(DEMO_MODE_KEY, 'true');
        setPublicKey(demoPubkey);
        setConnected(true);
        setIsDemoMode(true);
        console.log('[Wallet] Demo wallet authorized:', demoPubkey.toBase58());
        return;
      }

      // Real wallet connection for dev client builds
      const authResult = await transact(async (wallet: any) => {
        const result = await wallet.authorize({
          cluster: 'devnet',
          identity: APP_IDENTITY,
        });
        return result;
      });

      // MWA base protocol returns account.address as a base64-encoded string
      // (the web3js wrapper does NOT intercept authorize, only sign methods)
      const account = authResult.accounts[0];
      const addressRaw = account.address;
      
      // Decode base64 string → bytes → PublicKey
      // Use globalThis.atob for React Native compatibility
      const addressBytes = new Uint8Array(
        globalThis.atob(addressRaw)
          .split('')
          .map((c: string) => c.charCodeAt(0))
      );
      const pubkey = new PublicKey(addressBytes);
      const token = authResult.auth_token || '';
      console.log('[Wallet] Connected address:', pubkey.toBase58());
      
      await SecureStore.setItemAsync(WALLET_KEY, pubkey.toBase58());
      await SecureStore.setItemAsync(DEMO_MODE_KEY, 'false');
      if (token) await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
      setPublicKey(pubkey);
      setAuthToken(token);
      setConnected(true);
      setIsDemoMode(false);
      console.log('[Wallet] Connected:', pubkey.toBase58());
    } catch (e) {
      console.error('[Wallet] Connect failed:', e);
      throw e;
    } finally {
      setConnecting(false);
    }
  }, [connecting]);

  const disconnect = useCallback(async () => {
    try {
      // Only try real deauthorization if not in demo mode and transact is available
      if (!isDemoMode && transact && authToken) {
        await transact(async (wallet: any) => {
          await wallet.deauthorize({ auth_token: authToken });
        });
      }
    } catch (e) {
      // Ignore deauthorize errors
    }
    await SecureStore.deleteItemAsync(WALLET_KEY);
    await SecureStore.deleteItemAsync(DEMO_MODE_KEY);
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    setPublicKey(null);
    setAuthToken(null);
    setConnected(false);
    setIsDemoMode(false);
  }, [isDemoMode, authToken]);

  // txInput can be either a pre-built Transaction (legacy callers) OR a builder
  // function that receives the *actual* signer pubkey from Phantom's auth response.
  // Builder mode is the preferred path — it derives PDAs inside the MWA session
  // so the seeds always match the key Phantom will actually sign with.
  const signAndSendTransaction = useCallback(async (
    txInput: Transaction | ((signer: PublicKey) => Promise<Transaction>)
  ): Promise<string> => {
    if (!publicKey) throw new Error('Wallet not connected');

    if (isDemoMode || !transactRaw) {
      console.log('[Wallet] Demo mode - simulating transaction');
      return 'DemoTx' + Math.random().toString(36).substring(2, 15);
    }

    const isBuilder = typeof txInput === 'function';

    let capturedToken: string | null = null;
    let capturedSig    = '';
    let actualSigner: PublicKey = publicKey;
    let blockhash = '';
    let lastValidBlockHeight = 0;

    // ── blockhash + tx build OUTSIDE the MWA session ──────────────────────
    // fetch() is blocked on some devices while a transactRaw session is open,
    // so we grab blockhash and pre-build the tx *before* opening Phantom.
    console.log('[Wallet] STEP:blockhash — raw RPC fetch (pre-session)');
    try {
      const bhResult = await rpcFetch('getLatestBlockhash', [{ commitment: 'confirmed' }]);
      blockhash = bhResult.value.blockhash;
      lastValidBlockHeight = bhResult.value.lastValidBlockHeight;
    } catch (e: any) {
      console.error('[Wallet] STEP:blockhash FAILED:', e.message);
      throw new Error('[STEP:blockhash] ' + (e.message || e));
    }
    console.log('[Wallet] STEP:blockhash — got', blockhash.slice(0, 12) + '…', 'height', lastValidBlockHeight);

    // pre-build with the stored pubkey — works as long as Phantom returns the
    // same account (which it will 99% of the time)
    console.log('[Wallet] STEP:build — constructing tx (pre-session), isBuilder:', isBuilder);
    let preTx: Transaction;
    try {
      if (isBuilder) {
        preTx = await (txInput as (s: PublicKey) => Promise<Transaction>)(publicKey);
      } else {
        preTx = txInput as Transaction;
      }
      preTx.recentBlockhash = blockhash;
      preTx.feePayer = publicKey;
    } catch (e: any) {
      console.error('[Wallet] STEP:build FAILED:', e.message);
      throw new Error('[STEP:build] ' + (e.message || e));
    }
    console.log('[Wallet] STEP:build — done, instructions:', preTx.instructions.length);

    // pre-serialize
    console.log('[Wallet] STEP:serialize — hermesSerializeTx (pre-session)');
    let payload: string;
    try {
      const wireBytes = hermesSerializeTx(preTx);
      payload = fromUint8Array(wireBytes);
    } catch (e: any) {
      console.error('[Wallet] STEP:serialize FAILED:', e.message);
      throw new Error('[STEP:serialize] ' + (e.message || e));
    }
    console.log('[Wallet] STEP:serialize — payload length:', payload.length);

    // ── simulate before opening Phantom — catch program errors early ──────
    console.log('[Wallet] STEP:simulate — checking tx against RPC');
    try {
      const simResult = await rpcFetch('simulateTransaction', [
        payload, { encoding: 'base64', sigVerify: false, commitment: 'confirmed' },
      ]);
      if (simResult?.value?.err) {
        const logs = simResult.value.logs || [];
        const errLog = logs.find((l: string) => l.includes('Error') || l.includes('failed'))
                    || JSON.stringify(simResult.value.err);
        console.error('[Wallet] STEP:simulate FAILED:', errLog);
        console.error('[Wallet] simulation logs:', logs.slice(-5).join('\n'));
        throw new Error('Transaction simulation failed: ' + errLog);
      }
      console.log('[Wallet] STEP:simulate — passed, CU:', simResult?.value?.unitsConsumed ?? '?');
    } catch (simErr: any) {
      if (simErr.message.includes('simulation failed')) throw simErr;
      // non-fatal — if sim RPC itself errors, still try sending via Phantom
      console.warn('[Wallet] simulation RPC error (non-fatal):', simErr.message);
    }

    // ── MWA session: auth + send only ─────────────────────────────────────
    console.log('[Wallet] ── entering transactRaw session ──');
    await transactRaw(async (mwaWallet: any) => {
      // ── auth ────────────────────────────────────────────────────────────
      console.log('[Wallet] STEP:auth — starting');
      let authResult: any;
      try {
        if (authToken) {
          try {
            authResult = await mwaWallet.reauthorize({ auth_token: authToken, identity: APP_IDENTITY });
          } catch {
            authResult = await mwaWallet.authorize({ cluster: 'devnet', identity: APP_IDENTITY });
          }
        } else {
          authResult = await mwaWallet.authorize({ cluster: 'devnet', identity: APP_IDENTITY });
        }
      } catch (e: any) {
        console.error('[Wallet] STEP:auth FAILED:', e.message);
        throw new Error('[STEP:auth] ' + (e.message || e));
      }
      console.log('[Wallet] STEP:auth — done, token:', authResult.auth_token ? 'yes' : 'no');
      capturedToken = authResult.auth_token ?? null;

      // extract signer from auth response
      console.log('[Wallet] STEP:pubkey — extracting signer');
      try {
        const account = authResult.accounts[0];
        const signerBytes = new Uint8Array(
          globalThis.atob(account.address).split('').map((c: string) => c.charCodeAt(0))
        );
        actualSigner = new PublicKey(signerBytes);
      } catch (e: any) {
        console.error('[Wallet] STEP:pubkey FAILED:', e.message);
        throw new Error('[STEP:pubkey] ' + (e.message || e));
      }
      console.log('[Wallet] STEP:pubkey — signer:', actualSigner.toBase58().slice(0, 8) + '…');

      // if Phantom returned a different account, rebuild tx inside the session
      // (no fetch() needed — blockhash is already fetched)
      if (!actualSigner.equals(publicKey)) {
        console.warn('[Wallet] signer changed — rebuilding tx inside session');
        try {
          let rebuilt: Transaction;
          if (isBuilder) {
            rebuilt = await (txInput as (s: PublicKey) => Promise<Transaction>)(actualSigner);
          } else {
            rebuilt = txInput as Transaction;
          }
          rebuilt.recentBlockhash = blockhash;
          rebuilt.feePayer = actualSigner;
          const wireBytes = hermesSerializeTx(rebuilt);
          payload = fromUint8Array(wireBytes);
        } catch (e: any) {
          console.error('[Wallet] rebuild FAILED:', e.message);
          throw new Error('[STEP:rebuild] ' + (e.message || e));
        }
      }

      console.log('[Wallet] STEP:send — calling signAndSendTransactions');
      try {
        const result = await mwaWallet.signAndSendTransactions({
          payloads: [payload],
          options: { min_context_slot: 0 },
        });
        console.log('[Wallet] STEP:send — got result:', JSON.stringify(result).slice(0, 120));

        const base64Sigs: string[] = result.signatures;
        const sigBytes = toUint8Array(base64Sigs[0]);

        // Phantom returns 64 zero-bytes when simulation fails
        const allZeros = sigBytes.every(b => b === 0);
        if (allZeros) {
          throw new Error('Transaction simulation failed — Phantom rejected the tx before sending');
        }

        capturedSig = bs58.encode(sigBytes);
      } catch (e: any) {
        console.error('[Wallet] STEP:send FAILED:', e.message);
        throw new Error('[STEP:send] ' + (e.message || e));
      }
      console.log('[Wallet] STEP:send — sig:', capturedSig.slice(0, 16) + '…');
    }).catch((e: any) => {
      console.error('[Wallet] transactRaw session error:', e.message);
      throw e;
    });
    console.log('[Wallet] ── transactRaw session complete ──');

    if (!capturedSig) throw new Error('Wallet did not return a transaction signature');

    // Sync state if Phantom handed back a different account than what we had stored
    if (!actualSigner.equals(publicKey)) {
      console.warn('[Wallet] signer key refreshed:', actualSigner.toBase58().slice(0, 8) + '…');
      setPublicKey(actualSigner);
      SecureStore.setItemAsync(WALLET_KEY, actualSigner.toBase58()).catch(() => {});
    }
    if (capturedToken && capturedToken !== authToken) {
      setAuthToken(capturedToken);
      SecureStore.setItemAsync(AUTH_TOKEN_KEY, capturedToken).catch(() => {});
    }

    // poll for confirmation via raw RPC — avoids Connection.confirmTransaction
    // which uses web3.js internals that can choke on Hermes
    console.log('[Wallet] polling confirmation for', capturedSig.slice(0, 16) + '…');
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      try {
        const statuses = await rpcFetch('getSignatureStatuses', [[capturedSig]]);
        const st = statuses?.value?.[0];
        if (st && st.confirmationStatus) {
          if (st.err) throw new Error('Transaction failed on-chain: ' + JSON.stringify(st.err));
          console.log('[Wallet] Transaction confirmed (' + st.confirmationStatus + '):', capturedSig);
          return capturedSig;
        }
      } catch (pollErr: any) {
        console.warn('[Wallet] confirm poll error:', pollErr.message);
      }
      await new Promise(r => setTimeout(r, 400));
    }
    // tx didn't confirm within 30s — it likely failed simulation or was dropped
    console.error('[Wallet] confirm timed out for sig:', capturedSig);
    throw new Error('Transaction was not confirmed on-chain. It may have been rejected by the network.');
  }, [publicKey, isDemoMode, authToken]);

  const signTransaction = useCallback(async (transaction: Transaction): Promise<Transaction> => {
    if (!publicKey) throw new Error('Wallet not connected');

    // Demo mode - return transaction as-is
    if (isDemoMode || !transact) {
      console.log('[Wallet] Demo mode - simulating sign');
      return transaction;
    }

    const connection = new Connection(RPC_URL, 'confirmed');
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;

    const signedTx = await transact(async (wallet: any) => {
      if (authToken) {
        try {
          await wallet.reauthorize({ auth_token: authToken, identity: APP_IDENTITY });
        } catch {
          await wallet.authorize({ cluster: 'devnet', identity: APP_IDENTITY });
        }
      } else {
        await wallet.authorize({ cluster: 'devnet', identity: APP_IDENTITY });
      }

      const signed = await wallet.signTransactions({
        transactions: [transaction],
      });
      return signed[0];
    });

    return signedTx;
  }, [publicKey, isDemoMode, authToken]);

  const signAllTransactions = useCallback(async (transactions: Transaction[]): Promise<Transaction[]> => {
    if (!publicKey) throw new Error('Wallet not connected');

    // Demo mode - return transactions as-is
    if (isDemoMode || !transact) {
      console.log('[Wallet] Demo mode - simulating signAll');
      return transactions;
    }

    const connection = new Connection(RPC_URL, 'confirmed');
    const { blockhash } = await connection.getLatestBlockhash();

    transactions.forEach(tx => {
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;
    });

    const signedTxs = await transact(async (wallet: any) => {
      if (authToken) {
        try {
          await wallet.reauthorize({ auth_token: authToken, identity: APP_IDENTITY });
        } catch {
          await wallet.authorize({ cluster: 'devnet', identity: APP_IDENTITY });
        }
      } else {
        await wallet.authorize({ cluster: 'devnet', identity: APP_IDENTITY });
      }
      return wallet.signTransactions({ transactions });
    });

    return signedTxs;
  }, [publicKey, isDemoMode, authToken]);

  const signMessage = useCallback(async (message: Uint8Array): Promise<Uint8Array> => {
    if (!publicKey) throw new Error('Wallet not connected');

    // Demo mode - return fake signature
    if (isDemoMode || !transact) {
      console.log('[Wallet] Demo mode - simulating signMessage');
      return new Uint8Array(64).fill(0);
    }

    const signature = await transact(async (wallet: any) => {
      if (authToken) {
        try {
          await wallet.reauthorize({ auth_token: authToken, identity: APP_IDENTITY });
        } catch {
          await wallet.authorize({ cluster: 'devnet', identity: APP_IDENTITY });
        }
      } else {
        await wallet.authorize({ cluster: 'devnet', identity: APP_IDENTITY });
      }

      const signed = await wallet.signMessages({
        addresses: [publicKey.toBase58()],
        payloads: [message],
      });
      return signed[0];
    });

    return new Uint8Array(signature);
  }, [publicKey, isDemoMode, authToken]);

  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : null;

  return {
    publicKey,
    connected,
    connecting,
    isDemoMode,
    shortAddress,
    userTier,
    tierLimits,
    isPro,
    connect,
    disconnect,
    signAndSendTransaction,
    signTransaction,
    signAllTransactions,
    signMessage,
  };
}
