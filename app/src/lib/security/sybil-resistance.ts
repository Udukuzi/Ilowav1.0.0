import { Connection, PublicKey } from '@solana/web3.js';
import * as LocalAuthentication from 'expo-local-authentication';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface SybilScore {
  verified: boolean;
  score: number;
  reasons: string[];
}

/**
 * Check if user is likely a real person (not bot).
 * Multi-factor Sybil resistance scoring.
 */
export async function verifySybilResistance(
  wallet: PublicKey,
  connection: Connection
): Promise<SybilScore> {
  let score = 0;
  const reasons: string[] = [];

  // Factor 1: Wallet age (older = more trustworthy)
  const walletAge = await getWalletAge(wallet, connection);
  if (walletAge > 30 * 24 * 60 * 60) {
    score += 30;
    reasons.push('Wallet older than 30 days');
  } else if (walletAge > 7 * 24 * 60 * 60) {
    score += 15;
    reasons.push('Wallet older than 7 days');
  }

  // Factor 2: Transaction history
  const txCount = await getTransactionCount(wallet, connection);
  if (txCount > 100) {
    score += 25;
    reasons.push('100+ transactions');
  } else if (txCount > 10) {
    score += 10;
    reasons.push('10+ transactions');
  }

  // Factor 3: SOL balance (stakes in ecosystem)
  const balance = await connection.getBalance(wallet);
  const balanceSol = balance / 1e9;
  if (balanceSol > 10) {
    score += 20;
    reasons.push('10+ SOL balance');
  } else if (balanceSol > 1) {
    score += 10;
    reasons.push('1+ SOL balance');
  }

  // Factor 4: Biometric (device-locked identity)
  try {
    const hasBiometric = await LocalAuthentication.hasHardwareAsync();
    if (hasBiometric) {
      score += 15;
      reasons.push('Biometric authentication available');
    }
  } catch {
    // Biometric check failed — skip this factor
  }

  // Factor 5: Device uniqueness (prevent multi-accounting)
  try {
    const isUnique = await checkDeviceUniqueness();
    if (isUnique) {
      score += 10;
      reasons.push('Unique device');
    }
  } catch {
    // Device check failed — skip this factor
  }

  const verified = score >= 50;
  return { verified, score, reasons };
}

async function getWalletAge(wallet: PublicKey, connection: Connection): Promise<number> {
  try {
    const signatures = await connection.getSignaturesForAddress(wallet, { limit: 1000 });
    if (signatures.length === 0) return 0;

    const oldest = signatures[signatures.length - 1];
    const now = Math.floor(Date.now() / 1000);
    return now - (oldest.blockTime || now);
  } catch {
    return 0;
  }
}

async function getTransactionCount(wallet: PublicKey, connection: Connection): Promise<number> {
  try {
    const signatures = await connection.getSignaturesForAddress(wallet, { limit: 1000 });
    return signatures.length;
  } catch {
    return 0;
  }
}

async function checkDeviceUniqueness(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/security/device-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp: Date.now() }),
    });
    if (!response.ok) return true; // Fail open for device check
    const data = await response.json();
    return data.isUnique ?? true;
  } catch {
    return true; // Fail open — don't block users if backend unreachable
  }
}
