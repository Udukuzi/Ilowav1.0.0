export interface ElderGuardianState {
  isInitialized: boolean;
  userWallet?: string;
  guardianKey: string;
  timelock: number;
  recoveryInitiated: boolean;
  recoveryTimestamp?: number;
  canceled?: boolean;
}

export interface SocialRecoveryState {
  userWallet: string;
  guardians: string[];
  threshold: number;
  recoveryInProgress: boolean;
  approvals: string[];
  newWallet: string | null;
}

export interface TransactionRisk {
  score: number;
  scamReports: number;
  isKnownDApp: boolean;
  elderEndorsed: boolean;
  warnings: string[];
}

export interface DAppRegistryEntry {
  pubkey: string;
  domain: string;
  verified: boolean;
  elderEndorsed: boolean;
  riskScore: number;
  totalUsers: number;
  scamReports: number;
  dateVerified: number;
}

export type SecurityTier = 'basic' | 'pro' | 'stealth';
