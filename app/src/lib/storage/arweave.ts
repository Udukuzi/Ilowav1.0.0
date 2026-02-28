/**
 * Arweave Permanent Storage
 * 
 * Used for: Podcasts, Voice NFTs, DJ show archives
 * Cost: $8/GB one-time (200+ year guarantee)
 */

// Note: Full Arweave integration requires arweave-js and a funded wallet
// This is a simplified version for React Native compatibility

const ARWEAVE_GATEWAY = 'https://arweave.net';

export interface ArweaveUploadResult {
  success: boolean;
  transactionId: string | null;
  url: string | null;
  error?: string;
}

export interface ArweaveMetadata {
  name: string;
  description?: string;
  contentType: string;
  category: 'podcast' | 'voice-nft' | 'archive';
  creator?: string;
  stationId?: string;
}

/**
 * Get the permanent URL for an Arweave transaction
 */
export function getArweaveUrl(transactionId: string): string {
  return `${ARWEAVE_GATEWAY}/${transactionId}`;
}

/**
 * Upload to Arweave via Bundlr/Irys (recommended for smaller files)
 * Note: This requires a backend API for signing transactions
 */
export async function uploadToArweave(
  fileUri: string,
  metadata: ArweaveMetadata
): Promise<ArweaveUploadResult> {
  // In production, this would call a backend API that:
  // 1. Receives the file
  // 2. Signs with Arweave wallet
  // 3. Uploads to Arweave network
  // 4. Returns transaction ID
  
  const API_URL = process.env.EXPO_PUBLIC_API_URL || '';
  
  try {
    const formData = new FormData();
    const filename = fileUri.split('/').pop() || 'audio.mp3';
    
    formData.append('file', {
      uri: fileUri,
      type: metadata.contentType,
      name: filename,
    } as any);
    
    formData.append('metadata', JSON.stringify(metadata));

    const response = await fetch(`${API_URL}/api/storage/arweave-upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, transactionId: null, url: null, error };
    }

    const result = await response.json();
    return {
      success: true,
      transactionId: result.transactionId,
      url: getArweaveUrl(result.transactionId),
    };
  } catch (error) {
    console.error('Arweave upload failed:', error);
    return {
      success: false,
      transactionId: null,
      url: null,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Check if content exists on Arweave
 */
export async function checkArweaveContent(transactionId: string): Promise<boolean> {
  try {
    const response = await fetch(`${ARWEAVE_GATEWAY}/${transactionId}`, {
      method: 'HEAD',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get Arweave transaction status
 */
export async function getTransactionStatus(transactionId: string): Promise<{
  confirmed: boolean;
  blockHeight: number | null;
}> {
  try {
    const response = await fetch(`${ARWEAVE_GATEWAY}/tx/${transactionId}/status`);
    if (!response.ok) {
      return { confirmed: false, blockHeight: null };
    }
    const data = await response.json();
    return {
      confirmed: data.number_of_confirmations > 0,
      blockHeight: data.block_height,
    };
  } catch {
    return { confirmed: false, blockHeight: null };
  }
}
