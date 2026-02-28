/**
 * IPFS Storage via Pinata
 * 
 * Used for: Music files, call-in audio, temporary content
 * Cost: $0.15/GB/month
 */

const PINATA_API_KEY = process.env.EXPO_PUBLIC_PINATA_API_KEY || '';
const PINATA_SECRET_KEY = process.env.EXPO_PUBLIC_PINATA_SECRET_KEY || '';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

export interface IPFSUploadResult {
  success: boolean;
  ipfsHash: string | null;
  url: string | null;
  error?: string;
}

export interface IPFSMetadata {
  name: string;
  description?: string;
  category?: 'music' | 'call-in' | 'podcast' | 'voice-nft';
  duration?: number;
  stationId?: string;
}

/**
 * Upload a file to IPFS via Pinata
 */
export async function uploadToIPFS(
  fileUri: string,
  metadata: IPFSMetadata
): Promise<IPFSUploadResult> {
  try {
    // Read file and create form data
    const formData = new FormData();
    
    // For React Native, we need to handle the file URI
    const filename = fileUri.split('/').pop() || 'audio.mp3';
    formData.append('file', {
      uri: fileUri,
      type: 'audio/mpeg',
      name: filename,
    } as any);

    // Add metadata
    formData.append('pinataMetadata', JSON.stringify({
      name: metadata.name,
      keyvalues: {
        category: metadata.category || 'music',
        description: metadata.description || '',
        duration: metadata.duration?.toString() || '',
        stationId: metadata.stationId || '',
        uploadedAt: Date.now().toString(),
      },
    }));

    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_SECRET_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, ipfsHash: null, url: null, error };
    }

    const result = await response.json();
    return {
      success: true,
      ipfsHash: result.IpfsHash,
      url: `${PINATA_GATEWAY}/${result.IpfsHash}`,
    };
  } catch (error) {
    console.error('IPFS upload failed:', error);
    return {
      success: false,
      ipfsHash: null,
      url: null,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Get the gateway URL for an IPFS hash
 */
export function getIPFSUrl(ipfsHash: string): string {
  return `${PINATA_GATEWAY}/${ipfsHash}`;
}

/**
 * Check if Pinata credentials are configured
 */
export function isPinataConfigured(): boolean {
  return Boolean(PINATA_API_KEY && PINATA_SECRET_KEY);
}

/**
 * Unpin a file from IPFS (for cleanup)
 */
export async function unpinFromIPFS(ipfsHash: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.pinata.cloud/pinning/unpin/${ipfsHash}`, {
      method: 'DELETE',
      headers: {
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_SECRET_KEY,
      },
    });

    return response.ok;
  } catch (error) {
    console.error('IPFS unpin failed:', error);
    return false;
  }
}
