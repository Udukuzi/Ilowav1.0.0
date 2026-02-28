/**
 * Call-In Feature for Radio
 * 
 * Users record voice → Upload to IPFS → DJ plays on air
 * Winners get Voice NFT minted on Arweave
 */

import { uploadToIPFS, IPFSUploadResult } from '../storage/ipfs';

export interface CallInRequest {
  id: string;
  userId: string;
  stationId: string;
  ipfsHash: string;
  ipfsUrl: string;
  transcription: string;
  duration: number;
  timestamp: number;
  status: 'pending' | 'played' | 'rejected';
  isPrediction: boolean;
  predictionQuestion?: string;
}

/**
 * Submit a call-in to the DJ queue
 */
export async function submitCallIn(
  audioUri: string,
  transcription: string,
  stationId: string,
  userId: string,
  duration: number
): Promise<{ success: boolean; callIn?: CallInRequest; error?: string }> {
  try {
    // Upload audio to IPFS
    const uploadResult: IPFSUploadResult = await uploadToIPFS(audioUri, {
      name: `call-in-${Date.now()}`,
      description: transcription,
      category: 'call-in',
      duration,
      stationId,
    });

    if (!uploadResult.success || !uploadResult.ipfsHash) {
      return { success: false, error: uploadResult.error || 'Upload failed' };
    }

    // Check if this is a prediction
    const isPrediction = detectPrediction(transcription);
    const predictionQuestion = isPrediction ? extractPredictionQuestion(transcription) : undefined;

    // Create call-in record
    const callIn: CallInRequest = {
      id: `callin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      stationId,
      ipfsHash: uploadResult.ipfsHash,
      ipfsUrl: uploadResult.url!,
      transcription,
      duration,
      timestamp: Date.now(),
      status: 'pending',
      isPrediction,
      predictionQuestion,
    };

    // In production, save to Supabase database
    // For now, return the call-in object
    return { success: true, callIn };
  } catch (error) {
    console.error('Call-in submission failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Submission failed',
    };
  }
}

/**
 * Detect if transcription contains a prediction
 */
function detectPrediction(text: string): boolean {
  const predictionKeywords = [
    'will', 'predict', 'bet', 'think', 'believe',
    'going to', 'gonna', 'expect', 'forecast',
    'naira', 'dollar', 'win', 'lose', 'reach',
    'tomorrow', 'next week', 'next month', 'by march',
  ];
  
  const lowerText = text.toLowerCase();
  return predictionKeywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Extract prediction question from transcription
 */
function extractPredictionQuestion(text: string): string {
  // Simple extraction - in production, use Gladia's NLP
  const cleaned = text.trim();
  
  // If it's already a question, use it
  if (cleaned.endsWith('?')) {
    return cleaned;
  }
  
  // Convert statement to question
  const questionWords = ['will', 'going to', 'gonna'];
  for (const word of questionWords) {
    if (cleaned.toLowerCase().includes(word)) {
      return `Will ${cleaned.replace(/^i (think|believe|predict) /i, '')}?`;
    }
  }
  
  return `${cleaned}?`;
}

/**
 * Get pending call-ins for a station (DJ view)
 */
export async function getPendingCallIns(stationId: string): Promise<CallInRequest[]> {
  // In production, fetch from Supabase
  // For now, return empty array
  return [];
}

/**
 * Mark a call-in as played
 */
export async function markCallInPlayed(callInId: string): Promise<boolean> {
  // In production, update Supabase and potentially mint Voice NFT
  return true;
}

/**
 * Mark a call-in as rejected
 */
export async function markCallInRejected(callInId: string): Promise<boolean> {
  // In production, update Supabase
  return true;
}
