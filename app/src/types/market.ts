export type MarketStatus = 'active' | 'resolved' | 'expired' | 'disputed';
export type MarketOutcome = 'yes' | 'no' | null;

export interface Market {
  id: string;
  pubkey: string;
  creator: string;
  question: string;
  voiceUri?: string;
  category: string;
  region: string;
  isPrivate: boolean;
  isLight?: boolean;
  status: MarketStatus;
  outcome: MarketOutcome;
  yesPool: number;
  noPool: number;
  totalBets: number;
  shieldedBetCount?: number;
  createdAt: number;
  expiresAt: number;
  resolvedAt?: number;
  // oracle-resolved markets (Pyth/Switchboard relay)
  oracleAuthority?: string;
  oracleThreshold?: number;
  oracleAbove?: boolean;
}

export interface Bet {
  id: string;
  marketId: string;
  user: string;
  outcome: 'yes' | 'no';
  amount: number;
  isShielded: boolean;
  timestamp: number;
  claimed: boolean;
}

export interface UserBetPosition {
  bet: Bet | null;
  potentialWinnings: number;
  isWinner: boolean;
}

export interface MarketCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}
