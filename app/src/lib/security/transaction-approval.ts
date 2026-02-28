import { Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TransactionRisk } from '../../types/security';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

const LARGE_TX_THRESHOLD = 1 * LAMPORTS_PER_SOL;
const DELAY_HOURS = 24;

export async function authenticateBiometric(prompt: string = 'Confirm transaction'): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: prompt,
    fallbackLabel: 'Use passcode',
    disableDeviceFallback: false,
  });
  return result.success;
}

export async function analyzeTransactionRisk(tx: Transaction): Promise<TransactionRisk> {
  try {
    const programIds = tx.instructions.map((ix) => ix.programId.toBase58());
    const response = await fetch(`${API_BASE_URL}/api/ai/qwen3`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: 'analyze_transaction',
        programIds,
        instructionCount: tx.instructions.length,
      }),
    });

    if (!response.ok) throw new Error('Risk analysis failed');
    return response.json();
  } catch {
    return {
      score: 0.5,
      scamReports: 0,
      isKnownDApp: false,
      elderEndorsed: false,
      warnings: ['Could not verify transaction safety — proceed with caution'],
    };
  }
}

function showElderWarning(risk: TransactionRisk): Promise<boolean> {
  return new Promise((resolve) => {
    const warningText = risk.warnings.length > 0
      ? risk.warnings.join('\n• ')
      : 'This transaction appears risky.';

    Alert.alert(
      '⚠️ Elder Warning',
      `Your Elder Guardian has flagged this transaction:\n\n• ${warningText}\n\nRisk score: ${Math.round(risk.score * 100)}%\nScam reports: ${risk.scamReports}`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Proceed Anyway', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: false }
    );
  });
}

function showDelayNotice(amount: number): Promise<boolean> {
  const solAmount = (amount / LAMPORTS_PER_SOL).toFixed(4);
  return new Promise((resolve) => {
    Alert.alert(
      '⏳ Time-Delayed Transfer',
      `This transfer of ${solAmount} SOL exceeds the safety threshold.\n\nIt will be held for ${DELAY_HOURS} hours before executing. You can cancel anytime during this period.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Schedule Transfer', onPress: () => resolve(true) },
      ],
      { cancelable: false }
    );
  });
}

export async function approveTransaction(tx: Transaction, amount: number): Promise<boolean> {
  // Layer 1: Biometric
  const biometric = await authenticateBiometric();
  if (!biometric) return false;

  // Layer 2: AI Risk Analysis
  const risk = await analyzeTransactionRisk(tx);
  if (risk.score > 0.7) {
    const proceed = await showElderWarning(risk);
    if (!proceed) return false;
  }

  // Layer 3: Time-delay for large transfers
  if (amount > LARGE_TX_THRESHOLD) {
    const scheduled = await showDelayNotice(amount);
    return scheduled;
  }

  return true;
}
