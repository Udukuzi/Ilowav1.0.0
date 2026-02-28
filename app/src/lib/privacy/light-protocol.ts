/**
 * Light Protocol ZK Compression
 * 
 * Compresses on-chain state for 1000x cheaper storage.
 * Used for: Scalable markets, compressed NFTs
 * 
 * NOTE: Requires custom dev client for full functionality.
 * In Expo Go, all functions are stubbed with clear error messages.
 */

const EXPO_GO_ERROR = 
  'Light Protocol requires custom dev client. ' +
  'Build with: npx expo prebuild && npx expo run:ios';

export interface CompressedMarketData {
  question: string;
  creator: string;
  resolveDate: Date;
  category: string;
  yesBets: number;
  noBets: number;
  isActive: boolean;
}

/**
 * Check if Light Protocol is available (always false in Expo Go)
 */
export function isLightProtocolAvailable(): boolean {
  return false;
}

/**
 * Initialize merkle tree - stubbed for Expo Go
 */
export async function initializeMerkleTree(
  program: unknown,
  connection: unknown
): Promise<string> {
  throw new Error(EXPO_GO_ERROR);
}

/**
 * Get merkle tree - stubbed for Expo Go
 */
export async function getMerkleTree(
  program: unknown,
  connection: unknown
): Promise<string> {
  throw new Error(EXPO_GO_ERROR);
}

/**
 * Create compressed market - stubbed for Expo Go
 */
export async function createCompressedMarket(
  question: string,
  resolveDate: Date,
  category: string,
  program: unknown,
  connection: unknown
): Promise<string> {
  // Validate inputs even in stub (for UI feedback)
  if (question.length < 10 || question.length > 280) {
    throw new Error('Question must be 10-280 characters');
  }
  if (resolveDate <= new Date()) {
    throw new Error('Resolve date must be in future');
  }
  throw new Error(EXPO_GO_ERROR);
}

/**
 * Fetch compressed markets - returns empty array in Expo Go
 */
export async function fetchCompressedMarkets(
  connection: unknown,
  merkleTreePubkey?: string
): Promise<CompressedMarketData[]> {
  // In Expo Go, return empty array (no markets available)
  return [];
}
