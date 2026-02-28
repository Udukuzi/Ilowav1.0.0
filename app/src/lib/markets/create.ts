import { 
  Connection, 
  PublicKey, 
  Transaction,
  SystemProgram,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { Alert } from 'react-native';
import { createMarketIx, findMarketPDA } from '../solana/market-writer';

const RPC_ENDPOINT = process.env.EXPO_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey('HYDwFwax9U6svCRYWD7Fqq3TXxSSQCQ6CwKrb3ZTkD3z');

interface WalletInterface {
  publicKey: PublicKey | null;
  connected: boolean;
  isDemoMode?: boolean;
  signAndSendTransaction: (txOrBuilder: Transaction | ((signer: PublicKey) => Promise<Transaction>)) => Promise<string>;
}

interface CreateMarketParams {
  question: string;
  resolveDate: Date;
  category: string;
  region: string;
  isPrivate: boolean;
  wallet: WalletInterface;
}

interface CreateMarketResult {
  marketId: string;
  signature: string;
}

/**
 * Create a prediction market with robust error handling and timeout protection
 */
export async function createMarket({
  question,
  resolveDate,
  category,
  region,
  isPrivate,
  wallet,
}: CreateMarketParams): Promise<CreateMarketResult> {
  if (!wallet.publicKey || !wallet.connected) {
    throw new Error('Wallet not connected');
  }

  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  const walletPublicKey = wallet.publicKey;
  const expiresAt = Math.floor(resolveDate.getTime() / 1000);

  try {
    console.log('[Markets] Creating market...', { question, category, region, isPrivate });

    // 1. Check balance FIRST (skip in demo mode)
    if (!wallet.isDemoMode) {
      const balance = await connection.getBalance(walletPublicKey);
      console.log('[Markets] Balance:', balance / 1e9, 'SOL');

      if (balance < 0.01 * 1e9) {
        Alert.alert(
          'Insufficient SOL',
          'You need at least 0.01 SOL for transaction fees. Please fund your wallet on devnet.',
          [{ text: 'OK' }]
        );
        throw new Error('Insufficient balance');
      }
    }

    // 2. Generate market PDA
    const [marketPDA] = findMarketPDA(walletPublicKey, expiresAt);
    console.log('[Markets] Market PDA:', marketPDA.toBase58());

    // 3. Build instruction — raw borsh, no Anchor Program constructor
    const instruction = createMarketIx(walletPublicKey, question, category, region, isPrivate, expiresAt);

    // 5. ADD COMPUTE BUDGET (prevents timeout on complex transactions)
    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400000,
    });

    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1,
    });

    // 6. Build transaction
    const transaction = new Transaction()
      .add(modifyComputeUnits)
      .add(addPriorityFee)
      .add(instruction);

    // 7. Get FRESH blockhash (prevents expiry)
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletPublicKey;

    console.log('[Markets] Transaction size:', transaction.serializeMessage().length, 'bytes');

    // 8. Sign and send with timeout protection
    console.log('[Markets] Requesting signature...');

    const signature = await Promise.race([
      wallet.signAndSendTransaction(transaction),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Wallet signing timeout after 60 seconds. Please approve the transaction.')),
          60000
        )
      ),
    ]);

    console.log('[Markets] Transaction sent:', signature);

    // 9. Wait for confirmation (skip in demo mode)
    if (!wallet.isDemoMode && !signature.startsWith('DemoTx')) {
      const confirmation = await Promise.race([
        connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Transaction confirmation timeout after 60 seconds')), 60000)
        ),
      ]);

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }
    }

    console.log('[Markets] Market created successfully!');

    Alert.alert('Market Created! 🎉', 'Your prediction market is now live.', [{ text: 'OK' }]);

    return {
      marketId: marketPDA.toBase58(),
      signature,
    };
  } catch (error: any) {
    console.error('[Markets] Create failed:', error);

    // User-friendly error messages
    let userMessage = 'Failed to create market. ';

    if (error.message.includes('User declined') || error.message.includes('Cancellation')) {
      userMessage += 'Transaction was cancelled. Please try again and approve in your wallet.';
    } else if (error.message.includes('timeout')) {
      userMessage += 'Transaction timed out. Check your internet connection and try again.';
    } else if (error.message.includes('Insufficient')) {
      userMessage += 'Not enough SOL for transaction fees. Fund your wallet on devnet.';
    } else if (error.message.includes('blockhash')) {
      userMessage += 'Transaction expired. Please try again.';
    } else {
      userMessage += error.message || 'Unknown error occurred.';
    }

    Alert.alert('Transaction Failed', userMessage, [{ text: 'OK' }]);

    throw error;
  }
}

/**
 * Estimate the cost of creating a market
 */
export async function estimateMarketCost(isPrivate: boolean): Promise<number> {
  const baseCost = 0.005; // ~0.005 SOL for account rent
  const privateFee = isPrivate ? 0.005 : 0; // Additional fee for private markets
  const txFee = 0.000005; // ~5000 lamports tx fee
  return baseCost + privateFee + txFee;
}
