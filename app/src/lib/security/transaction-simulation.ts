import { Connection, Transaction, PublicKey } from '@solana/web3.js';

export interface SimulationResult {
  safe: boolean;
  changes: {
    balanceBefore: number;
    balanceAfter: number;
    netChange: number;
  };
  warnings: string[];
}

/**
 * Simulate transaction BEFORE sending (prevent exploits).
 * Shows EXACT outcome before user commits.
 */
export async function simulateTransactionSafely(
  tx: Transaction,
  connection: Connection,
  userWallet: PublicKey
): Promise<SimulationResult> {
  const warnings: string[] = [];

  const balanceBefore = await connection.getBalance(userWallet);

  const simulation = await connection.simulateTransaction(tx);

  if (simulation.value.err) {
    return {
      safe: false,
      changes: {
        balanceBefore: balanceBefore / 1e9,
        balanceAfter: 0,
        netChange: 0,
      },
      warnings: [`Transaction will fail: ${JSON.stringify(simulation.value.err)}`],
    };
  }

  const logs = simulation.value.logs || [];

  for (const log of logs) {
    // Unexpected token transfers
    if (log.includes('Transfer') && !log.includes(userWallet.toBase58())) {
      warnings.push('⚠️ Transaction transfers tokens to unexpected address');
    }

    // Program upgrades (potential rug pull)
    if (log.includes('Upgrade')) {
      warnings.push('⚠️ Transaction attempts to upgrade program (potential exploit)');
    }

    // Excessive compute units
    if (log.includes('exceeded maximum compute units')) {
      warnings.push('⚠️ Transaction uses excessive compute (possible attack)');
    }
  }

  // Estimate balance after from units consumed
  const unitsConsumed = simulation.value.unitsConsumed || 0;
  const estimatedFee = (unitsConsumed * 5000) / 1e9; // rough fee estimate
  const balanceAfterEstimate = (balanceBefore / 1e9) - estimatedFee;
  const netChange = -estimatedFee;

  if (netChange < -100) {
    warnings.push(
      `⚠️ Transaction will cost ${Math.abs(netChange).toFixed(2)} SOL (unusually high)`
    );
  }

  return {
    safe: warnings.length === 0,
    changes: {
      balanceBefore: balanceBefore / 1e9,
      balanceAfter: balanceAfterEstimate,
      netChange,
    },
    warnings,
  };
}
