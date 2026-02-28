// Ilowa prediction market pricing — pool-ratio AMM
// On-chain payout: winner gets netStake * totalPool / winningPool
// Platform fee: 0.5% deducted before funds enter the pool.

const PLATFORM_FEE_BPS = 50; // 0.5% — must match programs/ilowa constants

export interface PoolOdds {
  yesProb: number;      // 0–1
  noProb: number;
  yesPriceSol: number;  // implied cost per 1 SOL of payout
  noPriceSol: number;
}

export interface PayoutEstimate {
  grossPayout: number;   // SOL you'd receive if your side wins
  profit: number;        // net gain over your original stake (pre-fee)
  roi: number;           // profit / original stake as a percentage
  fee: number;           // platform fee deducted
  newYesProb: number;    // probability after your bet goes in
  newNoProb: number;
  isFirstBet: boolean;   // true when opposing pool is empty
}

// Base probabilities from current pool state
export function poolOdds(yesPool: number, noPool: number): PoolOdds {
  const total = yesPool + noPool;
  if (total <= 0) {
    return { yesProb: 0.5, noProb: 0.5, yesPriceSol: 0.5, noPriceSol: 0.5 };
  }
  const yp = yesPool / total;
  const np = noPool / total;
  return {
    yesProb: yp,
    noProb: np,
    yesPriceSol: yp,
    noPriceSol: np,
  };
}

// Accurate payout estimate mirroring on-chain claim_winnings math.
// Accounts for the 0.5% platform fee deducted before pool entry.
export function estimatePayout(
  yesPool: number,
  noPool: number,
  stake: number,
  side: 'yes' | 'no',
): PayoutEstimate {
  const fee = stake * PLATFORM_FEE_BPS / 10_000;
  const net = stake - fee;

  // pool sizes after this bet lands (net of fee)
  const newYes = side === 'yes' ? yesPool + net : yesPool;
  const newNo  = side === 'no'  ? noPool  + net : noPool;
  const newTotal = newYes + newNo;

  const winningPool = side === 'yes' ? newYes : newNo;
  const losingPool  = side === 'yes' ? newNo  : newYes;
  const isFirstBet  = losingPool <= 0;

  // proportional claim: net * totalPool / winningPool
  const gross = winningPool > 0 ? (net / winningPool) * newTotal : 0;
  const profit = gross - stake; // profit relative to original stake

  const newYesProb = newTotal > 0 ? newYes / newTotal : 0.5;
  const newNoProb  = 1 - newYesProb;

  return {
    grossPayout: gross,
    profit,
    roi: stake > 0 ? (profit / stake) * 100 : 0,
    fee,
    newYesProb,
    newNoProb,
    isFirstBet,
  };
}

// How many SOL does a bettor need to move the market to a target probability?
// Useful for "impact" displays — not shown yet but handy to have.
export function stakeToReachProb(
  yesPool: number,
  noPool: number,
  targetProb: number,
  side: 'yes' | 'no',
): number {
  if (targetProb <= 0 || targetProb >= 1) return 0;
  const total = yesPool + noPool;
  if (side === 'yes') {
    // (yesPool + x) / (total + x) = targetProb
    // yesPool + x = targetProb * total + targetProb * x
    // x(1 - targetProb) = targetProb * total - yesPool
    const num = targetProb * total - yesPool;
    const denom = 1 - targetProb;
    return denom > 0 ? Math.max(0, num / denom) : 0;
  } else {
    const num = (1 - targetProb) * total - noPool;
    const denom = targetProb;
    return denom > 0 ? Math.max(0, num / denom) : 0;
  }
}

// Human-readable probability string, e.g. "67%" or "50%"
export function probLabel(prob: number): string {
  return `${Math.round(prob * 100)}%`;
}

// Arrow showing odds movement: "↑ +3%" style label for UI
export function oddsShiftLabel(before: number, after: number): string {
  const delta = Math.round((after - before) * 100);
  if (delta === 0) return '';
  return delta > 0 ? `↑ +${delta}%` : `↓ ${delta}%`;
}
