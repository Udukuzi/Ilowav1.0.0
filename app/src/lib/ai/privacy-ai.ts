/**
 * Privacy-First AI Service
 * 
 * Unified AI service that combines:
 * - Cohere Aya (multilingual LLM — cultural voice, 101+ languages)
 * - GLM-5 (open-source reasoning engine — trading, STEM, computation)
 * - Arcium MPC (encrypted prompts/responses)
 * - Lelapa AI (African language translation)
 * - Federated Learning (opt-in model improvement with rewards)
 * 
 * This is the main entry point for all AI interactions in Ilowa.
 */

import { chatWithAya, isAyaAvailable, translateWithAya, type ElderContext } from './cohere-aya';
import { isGLM5Available, queryGLM5 } from './glm5';
import { initArciumClient, isArciumEnabled, encryptPrompt, decryptResponse } from '../privacy/arcium-mpc';
import { initLelapa, isLelapaAvailable, translateText, detectLanguage, analyzeSentiment } from './lelapa';
import { 
  initFederatedLearning, 
  isFederatedLearningEnabled, 
  submitFeedback,
  getEarnings,
  claimRewards,
  getFederatedLearningStatus,
  type EarningsInfo,
} from './federated-learning';
import { chatWithElder as localChatWithElder } from './qwen3';
import { ELDERS } from '../../data/elders';

export interface PrivacyAIConfig {
  enableArcium: boolean;
  enableFederatedLearning: boolean;
  preferLelapaForAfrican: boolean;
  defaultLanguage: string;
  region: string;
}

export interface ChatRequest {
  message: string;
  elderId: string;
  language?: string;
  region?: string;
  includeContext?: boolean;
}

export interface ChatResponse {
  message: string;
  language: string;
  suggestions?: string[];
  wasEncrypted: boolean;
  source: 'aya' | 'glm5' | 'lelapa' | 'local';
  confidence: number;
}

export interface AIServiceStatus {
  aya: { available: boolean; enabled: boolean };
  glm5: { available: boolean; enabled: boolean };
  arcium: { available: boolean; enabled: boolean };
  lelapa: { available: boolean; enabled: boolean };
  federatedLearning: { enabled: boolean; contributions: number; pendingRewards: number };
}

let config: PrivacyAIConfig = {
  enableArcium: false,
  enableFederatedLearning: false,
  preferLelapaForAfrican: true,
  defaultLanguage: 'en',
  region: 'west-africa',
};

let isInitialized = false;

/**
 * Initialize all AI services
 */
export async function initPrivacyAI(customConfig?: Partial<PrivacyAIConfig>): Promise<void> {
  config = { ...config, ...customConfig };
  
  console.log('[PrivacyAI] Initializing services...');
  
  // Initialize all services in parallel
  await Promise.all([
    initArciumClient(),
    initFederatedLearning(),
  ]);
  
  // Initialize Lelapa with region
  initLelapa({ region: config.region });
  
  isInitialized = true;
  console.log('[PrivacyAI] All services initialized');
}

/**
 * Chat with an Elder using privacy-preserving AI
 */
export async function chatWithElderAI(request: ChatRequest): Promise<ChatResponse> {
  if (!isInitialized) {
    await initPrivacyAI();
  }

  const elder = ELDERS.find(e => e.id === request.elderId);
  const language = request.language || config.defaultLanguage;
  const region = request.region || config.region;
  
  // Build elder context for Aya
  const elderContext: ElderContext | undefined = elder ? {
    elderId: elder.id,
    elderName: elder.name,
    elderTitle: elder.title,
    region: elder.region,
    culturalBackground: (elder as any).culturalBackground || elder.title,
    wisdomStyle: (elder as any).wisdomStyle || 'traditional',
  } : undefined;

  let response: ChatResponse;

  try {
    // Route: GLM-5 for deep reasoning (trading, STEM, computation),
    // Aya for cultural voice + multilingual, local wisdom as fallback.
    const needsReasoning = detectReasoningQuery(request.message);
    
    if (needsReasoning && isGLM5Available()) {
      response = await chatWithGLM5Service(request, elderContext);
    } else if (isAyaAvailable()) {
      response = await chatWithAyaService(request, elderContext);
    } else {
      response = await chatWithLocalWisdom(request);
    }

    // Record interaction for federated learning if enabled
    if (isFederatedLearningEnabled()) {
      // Don't await - do in background
      recordInteractionForFL(request, response).catch(console.error);
    }

    return response;
  } catch (error) {
    console.error('[PrivacyAI] Chat failed, using local fallback:', error);
    return chatWithLocalWisdom(request);
  }
}

/**
 * Chat using Cohere Aya with optional Arcium encryption
 */
async function chatWithAyaService(
  request: ChatRequest, 
  elderContext?: ElderContext
): Promise<ChatResponse> {
  let message = request.message;
  let wasEncrypted = false;

  // Encrypt if Arcium is enabled
  if (isArciumEnabled()) {
    message = await encryptPrompt(message);
    wasEncrypted = true;
  }

  const ayaResponse = await chatWithAya({
    message,
    elderContext,
    language: request.language,
    temperature: 0.7,
  });

  let responseText = ayaResponse.text;

  // Decrypt if it was encrypted
  if (wasEncrypted) {
    responseText = await decryptResponse(responseText);
  }

  return {
    message: responseText,
    language: ayaResponse.language,
    suggestions: getSuggestionsForTopic(request.message),
    wasEncrypted,
    source: 'aya',
    confidence: ayaResponse.confidence,
  };
}

/**
 * Chat using Lelapa for African language specialization.
 * Vulavula translate has a per-request char ceiling (~5k) so we cap
 * Aya's output and chunk anything that overflows before translating.
 */
async function chatWithLelapa(
  request: ChatRequest,
  elderContext?: ElderContext
): Promise<ChatResponse> {
  const detectedLang = request.language || (await detectLanguage(request.message)).language;

  let message = request.message;

  // Translate user message to English for Aya processing
  if (detectedLang !== 'en') {
    const translated = await translateText({
      text: message,
      sourceLanguage: detectedLang,
      targetLanguage: 'en',
    });
    message = translated.translatedText;
  }

  // Cap below the normal 4096 because Vulavula has a per-request char ceiling,
  // but 1024 was too aggressive — gave shallow, truncated answers.
  // The chunked translator below handles anything up to ~10k chars fine.
  const ayaResponse = await chatWithAya({
    message,
    elderContext,
    language: 'en',
    maxTokens: 2048,
  });

  let responseText = ayaResponse.text;

  // Translate back, chunking if the response is long
  if (detectedLang !== 'en' && responseText) {
    const CHUNK_LIMIT = 3500; // safe margin below Vulavula's ceiling
    if (responseText.length <= CHUNK_LIMIT) {
      const translated = await translateText({
        text: responseText,
        sourceLanguage: 'en',
        targetLanguage: detectedLang,
      });
      responseText = translated.translatedText;
    } else {
      // Split on sentence boundaries, translate in batches
      const sentences = responseText.match(/[^.!?]+[.!?]+/g) || [responseText];
      const chunks: string[] = [];
      let current = '';
      for (const s of sentences) {
        if ((current + s).length > CHUNK_LIMIT) {
          if (current) chunks.push(current);
          current = s;
        } else {
          current += s;
        }
      }
      if (current) chunks.push(current);

      const translatedParts = await Promise.all(
        chunks.map(chunk =>
          translateText({ text: chunk, sourceLanguage: 'en', targetLanguage: detectedLang })
            .then(r => r.translatedText)
            .catch(() => chunk) // keep English on failure
        )
      );
      responseText = translatedParts.join(' ');
    }
  }

  return {
    message: responseText,
    language: detectedLang,
    suggestions: getSuggestionsForTopic(request.message),
    wasEncrypted: false,
    source: 'lelapa',
    confidence: 0.8,
  };
}

/**
 * Detect if a query needs deep reasoning (trading, math, STEM, computation)
 * vs cultural/language tasks that Aya handles better
 */
function detectReasoningQuery(message: string): boolean {
  const lower = message.toLowerCase();

  // strong signals — any ONE of these triggers GLM-5
  const strongTriggers = [
    'calculate', 'technical analysis', 'analyze', 'trading signal',
    'price prediction', 'price target', 'market cap', 'tokenomics',
    'memecoin', 'meme coin', 'meme token', 'pump and dump',
    'entry point', 'exit strategy', 'stop loss', 'take profit',
    'chart pattern', 'support resistance', 'rsi', 'macd', 'bollinger',
    'yield farm', 'impermanent loss', 'liquidity pool',
    'step by step', 'deep dive', 'break down how',
    'solve', 'equation', 'formula', 'integral', 'derivative',
    'backtest', 'portfolio', 'risk reward', 'sharpe ratio',
  ];
  if (strongTriggers.some(t => lower.includes(t))) return true;

  // softer signals — need 2+ hits to trigger
  const softKeywords = [
    'trade', 'strategy', 'probability', 'statistics', 'algorithm',
    'optimize', 'debug', 'code', 'program', 'api',
    'roi', 'profit', 'loss', 'hedge', 'vector', 'matrix',
    'blockchain', 'smart contract', 'solana', 'defi', 'tvl',
    'machine learning', 'neural', 'training', 'regression',
    'compare', 'how does', 'why does', 'explain how',
    'signal', 'volume', 'whale', 'airdrop', 'staking apy',
    'correlation', 'engineering', 'computation', 'architecture',
  ];
  const hits = softKeywords.filter(kw => lower.includes(kw));
  return hits.length >= 2;
}

/**
 * Chat using GLM-5 for deep reasoning, then optionally wrap with Elder cultural voice via Aya
 */
async function chatWithGLM5Service(
  request: ChatRequest,
  elderContext?: ElderContext
): Promise<ChatResponse> {
  const glmResponse = await queryGLM5({
    message: request.message,
    temperature: 0.5,
    maxTokens: 4096,
  });

  if (!glmResponse.text) {
    // GLM-5 failed — fall back to Aya
    if (isAyaAvailable()) return chatWithAyaService(request, elderContext);
    return chatWithLocalWisdom(request);
  }

  // Optionally have Aya add cultural flavor to the analytical response
  // Only if Aya is available and the response isn't already long
  let finalText = glmResponse.text;
  if (isAyaAvailable() && elderContext && finalText.length < 3000) {
    try {
      const culturalWrap = await chatWithAya({
        message: `You are ${elderContext.elderName}. A reasoning engine produced this analytical response to the user's question "${request.message}":\n\n${finalText}\n\nRewrite this response in YOUR Elder voice — keep ALL the analysis and numbers intact, but add your cultural personality, a relevant proverb, and your regional warmth. Do NOT remove any data or conclusions.`,
        elderContext,
        language: request.language,
        temperature: 0.7,
        maxTokens: 4096,
      });
      if (culturalWrap.text && culturalWrap.text.length > 50) {
        finalText = culturalWrap.text;
      }
    } catch {
      // cultural wrap failed, use raw GLM-5 output — still good
    }
  }

  return {
    message: finalText,
    language: request.language || 'en',
    suggestions: getSuggestionsForTopic(request.message),
    wasEncrypted: false,
    source: 'glm5',
    confidence: glmResponse.confidence,
  };
}

/**
 * Chat using local wisdom database (offline fallback)
 */
async function chatWithLocalWisdom(request: ChatRequest): Promise<ChatResponse> {
  const localResponse = await localChatWithElder(
    request.elderId,
    request.message,
    request.language
  );

  return {
    message: localResponse.message,
    language: localResponse.language,
    suggestions: localResponse.suggestions,
    wasEncrypted: false,
    source: 'local',
    confidence: 0.6,
  };
}

/**
 * Check if language is African
 */
async function checkIfAfricanLanguage(languageCode: string): Promise<boolean> {
  const africanLanguages = [
    'yo', 'ha', 'ig', 'tw', 'wo', 'ff', // West Africa
    'sw', 'am', 'om', 'so', 'rw', 'lg', // East Africa
    'zu', 'xh', 'af', 'st', 'tn', 'sn', // Southern Africa
    'ar', // MENA (partial)
  ];
  return africanLanguages.includes(languageCode);
}

/**
 * Record interaction for federated learning
 */
async function recordInteractionForFL(
  request: ChatRequest,
  response: ChatResponse
): Promise<void> {
  // We don't send the actual message, just a hash
  const promptHash = simpleHash(request.message);
  
  await submitFeedback(
    promptHash,
    0, // Quality will be set by user feedback
    true,
    response.language,
    request.region || config.region,
    detectCategory(request.message)
  );
}

/**
 * Submit user feedback on AI response
 */
export async function submitAIFeedback(
  message: string,
  quality: number,
  wasHelpful: boolean,
  language: string,
  region: string,
  correction?: string
): Promise<boolean> {
  if (!isFederatedLearningEnabled()) {
    return false;
  }

  return submitFeedback(
    simpleHash(message),
    quality,
    wasHelpful,
    language,
    region,
    detectCategory(message),
    correction
  );
}

/**
 * Get AI service status
 */
export async function getAIServiceStatus(): Promise<AIServiceStatus> {
  const flStatus = getFederatedLearningStatus();
  const earnings = await getEarnings();

  return {
    aya: {
      available: isAyaAvailable(),
      enabled: true,
    },
    glm5: {
      available: isGLM5Available(),
      enabled: true, // always enabled when key is set — routing decides when to use it
    },
    arcium: {
      available: true, // Always available, just might not be enabled
      enabled: isArciumEnabled(),
    },
    lelapa: {
      available: isLelapaAvailable(),
      enabled: config.preferLelapaForAfrican,
    },
    federatedLearning: {
      enabled: isFederatedLearningEnabled(),
      contributions: flStatus.contributionCount,
      pendingRewards: earnings.pendingRewards,
    },
  };
}

/**
 * Get federated learning earnings
 */
export async function getFLEarnings(): Promise<EarningsInfo> {
  return getEarnings();
}

/**
 * Claim federated learning rewards
 */
export async function claimFLRewards(walletAddress: string): Promise<{
  success: boolean;
  amount: number;
  txSignature?: string;
  error?: string;
}> {
  return claimRewards(walletAddress);
}

/**
 * Translate text using best available service
 */
export async function translateMessage(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string
): Promise<string> {
  // Prefer Lelapa for African languages
  const isTargetAfrican = await checkIfAfricanLanguage(targetLanguage);
  
  if (isTargetAfrican && isLelapaAvailable()) {
    try {
      const result = await translateText({
        text,
        sourceLanguage: sourceLanguage || 'en',
        targetLanguage,
      });
      return result.translatedText;
    } catch (e: any) {
      console.warn('[PrivacyAI] translateMessage Lelapa failed, trying Aya:', e?.message);
    }
  }
  
  // Fallback to Aya
  if (isAyaAvailable()) {
    return translateWithAya(text, targetLanguage, sourceLanguage);
  }
  
  // No translation available
  return text;
}

/**
 * Analyze sentiment of text
 */
export async function analyzeMessageSentiment(
  text: string,
  language?: string
): Promise<{ sentiment: string; confidence: number }> {
  if (isLelapaAvailable()) {
    try {
      const result = await analyzeSentiment(text, language);
      return { sentiment: result.sentiment, confidence: result.confidence };
    } catch (e: any) {
      console.warn('[PrivacyAI] analyzeSentiment Lelapa failed, using local:', e?.message);
    }
  }
  
  // Simple local sentiment (very basic)
  const positiveWords = ['good', 'great', 'excellent', 'happy', 'love', 'best'];
  const negativeWords = ['bad', 'terrible', 'hate', 'worst', 'angry', 'sad'];
  
  const lower = text.toLowerCase();
  const posCount = positiveWords.filter(w => lower.includes(w)).length;
  const negCount = negativeWords.filter(w => lower.includes(w)).length;
  
  if (posCount > negCount) return { sentiment: 'positive', confidence: 0.5 };
  if (negCount > posCount) return { sentiment: 'negative', confidence: 0.5 };
  return { sentiment: 'neutral', confidence: 0.5 };
}

// Helper functions

function getSuggestionsForTopic(message: string): string[] {
  const lower = message.toLowerCase();
  
  if (lower.includes('naira') || lower.includes('currency')) {
    return ['Predict Naira rate', 'Market analysis', 'Currency trends'];
  }
  if (lower.includes('crypto') || lower.includes('bitcoin') || lower.includes('solana')) {
    return ['SOL price', 'Crypto wisdom', 'DeFi trends'];
  }
  if (lower.includes('football') || lower.includes('match')) {
    return ['Match predictions', 'AFCON updates', 'Player stats'];
  }
  if (lower.includes('market') || lower.includes('predict')) {
    return ['Create prediction', 'View trending', 'Market wisdom'];
  }
  
  return ['Ask about markets', 'Get wisdom', 'Make prediction'];
}

function detectCategory(message: string): string {
  const lower = message.toLowerCase();
  
  if (lower.includes('naira') || lower.includes('dollar')) return 'currency';
  if (lower.includes('crypto') || lower.includes('bitcoin')) return 'crypto';
  if (lower.includes('football') || lower.includes('afcon')) return 'football';
  if (lower.includes('election') || lower.includes('president')) return 'politics';
  if (lower.includes('weather') || lower.includes('rain')) return 'weather';
  
  return 'general';
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
