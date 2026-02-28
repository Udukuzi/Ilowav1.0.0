/**
 * DRiP NFT Publishing Service
 * 
 * Publish Voice NFTs and collectibles to DRiP
 * Note: Full DRiP integration requires API key - stubbed for Expo Go
 */

import * as SecureStore from 'expo-secure-store';

const DRIP_STORAGE_KEY = 'ilowa_drip_nfts';
const DRIP_CREATOR_ID = process.env.EXPO_PUBLIC_DRIP_CREATOR_ID || 'ilowa-radio';

export interface DripNFT {
  id: string;
  mint: string;
  title: string;
  description: string;
  imageUrl: string;
  audioUrl?: string;
  dripUrl: string;
  createdAt: Date;
  type: 'voice_prediction' | 'dj_show' | 'podcast' | 'collectible';
  metadata: Record<string, any>;
}

export interface DripPublishOptions {
  title: string;
  description: string;
  imageUrl: string;
  audioUrl?: string;
  type: DripNFT['type'];
  metadata?: Record<string, any>;
}

/**
 * Get stored DRiP NFTs (local storage for Expo Go)
 */
async function getStoredNFTs(): Promise<DripNFT[]> {
  try {
    const stored = await SecureStore.getItemAsync(DRIP_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((n: any) => ({
        ...n,
        createdAt: new Date(n.createdAt),
      }));
    }
  } catch (e) {
    console.warn('[DRiP] Failed to get NFTs:', e);
  }
  return [];
}

/**
 * Save NFTs to local storage
 */
async function saveNFTs(nfts: DripNFT[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(DRIP_STORAGE_KEY, JSON.stringify(nfts));
  } catch (e) {
    console.warn('[DRiP] Failed to save NFTs:', e);
  }
}

/**
 * Publish an NFT to DRiP
 * Note: In production, this would call the DRiP API
 */
export async function publishToDrip(
  nftMint: string,
  options: DripPublishOptions
): Promise<DripNFT> {
  console.log('[DRiP] Publishing NFT:', options.title);
  
  // Generate mock DRiP URL (in production, this comes from API)
  const dripId = `drip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const dripUrl = `https://drip.haus/${DRIP_CREATOR_ID}/${dripId}`;
  
  const nft: DripNFT = {
    id: dripId,
    mint: nftMint,
    title: options.title,
    description: options.description,
    imageUrl: options.imageUrl,
    audioUrl: options.audioUrl,
    dripUrl,
    createdAt: new Date(),
    type: options.type,
    metadata: options.metadata || {},
  };
  
  // Store locally
  const nfts = await getStoredNFTs();
  nfts.unshift(nft);
  await saveNFTs(nfts);
  
  console.log('[DRiP] Published:', dripUrl);
  return nft;
}

/**
 * Publish a winning voice prediction as NFT
 */
export async function publishVoicePrediction(
  nftMint: string,
  question: string,
  voiceUrl: string,
  winner: string
): Promise<DripNFT> {
  return publishToDrip(nftMint, {
    title: 'Winning Voice Prediction',
    description: `"${question}" - Predicted correctly by ${shortenWallet(winner)}`,
    imageUrl: 'https://ilowa.app/nft/voice-prediction.png', // Placeholder
    audioUrl: voiceUrl,
    type: 'voice_prediction',
    metadata: {
      question,
      winner,
      predictedAt: new Date().toISOString(),
    },
  });
}

/**
 * Publish a DJ show episode as collectible
 */
export async function publishDJShow(
  nftMint: string,
  showTitle: string,
  djName: string,
  audioUrl: string,
  coverImageUrl?: string
): Promise<DripNFT> {
  return publishToDrip(nftMint, {
    title: `${showTitle} - ${djName}`,
    description: `Live DJ show recorded on Ilowa Radio`,
    imageUrl: coverImageUrl || 'https://ilowa.app/nft/dj-show.png',
    audioUrl,
    type: 'dj_show',
    metadata: {
      showTitle,
      djName,
      recordedAt: new Date().toISOString(),
    },
  });
}

/**
 * Publish a podcast episode as NFT
 */
export async function publishPodcast(
  nftMint: string,
  episodeTitle: string,
  podcastName: string,
  audioUrl: string,
  coverImageUrl?: string
): Promise<DripNFT> {
  return publishToDrip(nftMint, {
    title: episodeTitle,
    description: `${podcastName} - Available on Ilowa`,
    imageUrl: coverImageUrl || 'https://ilowa.app/nft/podcast.png',
    audioUrl,
    type: 'podcast',
    metadata: {
      episodeTitle,
      podcastName,
      publishedAt: new Date().toISOString(),
    },
  });
}

/**
 * Get user's DRiP NFTs
 */
export async function getUserDripNFTs(): Promise<DripNFT[]> {
  return getStoredNFTs();
}

/**
 * Get NFT by mint address
 */
export async function getNFTByMint(mint: string): Promise<DripNFT | null> {
  const nfts = await getStoredNFTs();
  return nfts.find(n => n.mint === mint) || null;
}

/**
 * Get NFTs by type
 */
export async function getNFTsByType(type: DripNFT['type']): Promise<DripNFT[]> {
  const nfts = await getStoredNFTs();
  return nfts.filter(n => n.type === type);
}

/**
 * Check if DRiP is configured
 */
export function isDripConfigured(): boolean {
  return !!process.env.EXPO_PUBLIC_DRIP_CREATOR_ID;
}

/**
 * Get DRiP creator profile URL
 */
export function getDripCreatorUrl(): string {
  return `https://drip.haus/${DRIP_CREATOR_ID}`;
}

/**
 * Format NFT type for display
 */
export function formatNFTType(type: DripNFT['type']): string {
  switch (type) {
    case 'voice_prediction': return 'Voice Prediction';
    case 'dj_show': return 'DJ Show';
    case 'podcast': return 'Podcast';
    case 'collectible': return 'Collectible';
    default: return 'NFT';
  }
}

/**
 * Get NFT type icon
 */
export function getNFTTypeIcon(type: DripNFT['type']): string {
  switch (type) {
    case 'voice_prediction': return 'mic';
    case 'dj_show': return 'radio';
    case 'podcast': return 'headphones';
    case 'collectible': return 'image';
    default: return 'square';
  }
}

/**
 * Get NFT type color
 */
export function getNFTTypeColor(type: DripNFT['type']): string {
  switch (type) {
    case 'voice_prediction': return '#8B5CF6'; // Purple
    case 'dj_show': return '#00D9FF'; // Cyan
    case 'podcast': return '#10B981'; // Green
    case 'collectible': return '#FFD700'; // Gold
    default: return '#64748B'; // Gray
  }
}

/**
 * Shorten wallet address for display
 */
function shortenWallet(wallet: string): string {
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}
