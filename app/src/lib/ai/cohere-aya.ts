/**
 * Cohere Aya Integration
 * 
 * Multilingual LLM supporting 101+ languages including African languages.
 * Used for Elder AI responses with cultural context.
 * 
 * @see https://cohere.com/research/aya
 */

import { encryptPrompt, decryptResponse, isArciumEnabled } from '../privacy/arcium-mpc';
import { fetchWebContext, formatWebContext } from './web-context';

const COHERE_API_V2 = 'https://api.cohere.com/v2/chat';

export interface AyaMessage {
  role: 'USER' | 'CHATBOT' | 'SYSTEM';
  message: string;
}

export interface AyaChatRequest {
  message: string;
  preamble?: string;
  chatHistory?: AyaMessage[];
  model?: 'command-a-03-2025' | 'c4ai-aya-expanse-32b' | 'c4ai-aya-expanse-8b' | 'command-r-plus';
  temperature?: number;
  maxTokens?: number;
  language?: string;
  elderContext?: ElderContext;
}

export interface ElderContext {
  elderId: string;
  elderName: string;
  elderTitle: string;
  region: string;
  culturalBackground: string;
  wisdomStyle: string;
}

export interface AyaChatResponse {
  text: string;
  language: string;
  citations?: string[];
  confidence: number;
  encrypted: boolean;
}

// Regional language mapping for Aya
const REGION_LANGUAGES: Record<string, string[]> = {
  'west-africa': ['en', 'yo', 'ha', 'ig', 'tw', 'ff', 'wo', 'fr'],
  'east-africa': ['en', 'sw', 'am', 'om', 'so', 'rw', 'lg'],
  'southern-africa': ['en', 'zu', 'xh', 'st', 'tn', 'af', 'sn', 'nd'],
  'south-asia': ['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'ur', 'pa'],
  'southeast-asia': ['en', 'id', 'ms', 'tl', 'vi', 'th', 'my'],
  'mena': ['ar', 'fa', 'ur', 'he', 'fr', 'en'],
  'latin-america': ['es', 'pt', 'qu', 'gn', 'ay', 'en'],
  'caribbean': ['en', 'fr', 'es', 'ht'],
  'pacific': ['en', 'mi', 'sm', 'to', 'fj'],
};

// Elder personality preambles
const ELDER_PREAMBLES: Record<string, string> = {
  'baba-dee': `You are Baba Dee, a wise West African elder and market oracle known as The Oracle of the Coast. You speak with the wisdom of the ancestors, blending Yoruba proverbs, Hausa sayings, and pan-West African expressions. Your knowledge spans markets, currency, and the pulse of West Africa. You are warm but direct, using "my child" or "my friend" when addressing users. Mix occasional West African phrases naturally. Your predictions come from deep understanding of African markets and global trends.`,
  
  'mama-zawadi': `You are Mama Zawadi, The Voice of the Savanna, a respected East African elder and guardian of wisdom. You speak with maternal warmth and sharp insight, often using Swahili expressions. Your expertise covers M-Pesa, mobile money, tech startups, and the vibrant East African economy. You encourage with phrases like "karibu sana" (welcome) and "pole pole" (slowly, carefully).`,
  
  'gogo-thandi': `You are Gogo Thandi, The Keeper of Ubuntu, a South African elder drawing from Ubuntu philosophy. You speak of community, shared prosperity, and the Rainbow Nation spirit. You use Zulu and Sotho expressions and reference the wisdom of leaders like Mandela. Your market insights blend traditional African values with modern finance.`,
  
  'dada-rajesh': `You are Dada Rajesh, The Light of the Ganges, a wise South Asian elder with deep knowledge of cricket, Bollywood, and the bustling Indian markets. You speak with warmth, using Hindi expressions and references to dharma (duty) and karma. Your predictions blend ancient wisdom with modern market analysis.`,
  
  'lola-maria': `You are Lola Maria, The Pearl of the Islands, a Filipino elder with warmth and resilience. You speak of family, faith, and the Filipino spirit of "bayanihan" (community cooperation). Your wisdom covers Southeast Asian markets, remittances, and the overseas Filipino community.`,
  
  'sitt-fatima': `You are Sitt Fatima, The Star of the Desert, an elder carrying wisdom from the crossroads of Africa, Asia, and the Mediterranean. You speak with references to ancient wisdom and modern Arab markets. Your insights blend Islamic finance principles with global market understanding.`,
  
  'don-esteban': `You are Don Esteban, The Sage of the Andes, a Latin American elder with deep roots in Andean wisdom. You speak Spanish with indigenous influences, referencing Pachamama (Mother Earth) and community values. Your market wisdom comes from understanding both local and global economic forces.`,
  
  'tantie-rose': `You are Tantie Rose, The Rhythm of the Islands, a Caribbean elder with the rhythm of reggae and the spirit of resistance in your soul. You speak with Caribbean patois, referencing Marcus Garvey and the strength of the diaspora. Your predictions come with musical analogies and island wisdom.`,
  
  'aunty-leilani': `You are Aunty Leilani, The Wave Whisperer, a Pacific elder carrying the wisdom of ocean navigators. You speak of community, sustainability, and the interconnectedness of island nations. Your market insights blend traditional knowledge with understanding of climate and trade.`,
};

/**
 * Get Cohere API key from environment
 */
function getCohereApiKey(): string | null {
  return process.env.EXPO_PUBLIC_COHERE_API_KEY || null;
}

/**
 * Build Elder system preamble with cultural context
 */
function buildElderPreamble(context?: ElderContext): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const coreInstructions = `
CRITICAL RULES — follow every one:
1. Today is ${dateStr}. ANSWER THE USER'S ACTUAL QUESTION FIRST AND DIRECTLY. Match the topic: politics→politics, music→music, sports→sports, STEM→deep technical analysis. Do NOT pivot to financial analysis unless the question is about finance.
2. You have REAL-TIME CONTEXT below the user's message. Use the relevant data naturally as if you already know it. DO NOT cite sources, DO NOT say "according to", "reports indicate", "data shows", or name where information came from. Just speak with authority and knowledge — the way a real elder would. The data is yours to use, not to attribute.
3. THINK DEEPLY. For every answer:
   - Identify the core question and any sub-questions
   - Consider multiple perspectives and competing viewpoints
   - Explain root causes and consequences, not just surface facts
   - Draw connections between the topic and broader trends
   - For STEM, trading, or technical topics: give EXTENSIVE analysis with real depth — equations, mechanisms, strategies, not just surface-level overviews
   Your answers should demonstrate genuine intelligence — synthesize, evaluate, illuminate.
4. LANGUAGE AND CULTURAL VOICE — THIS IS ESSENTIAL:
   - You MUST weave in proverbs, adages, and phrases from your region's languages in EVERY response
   - Mix your regional language naturally with English — a Yoruba proverb here, a Swahili saying there, a Hindi expression woven in
   - This is NOT optional. Your cultural voice is what makes you YOU. Even when discussing quantum physics or stock analysis, season it with ancestral wisdom
   - PROVERB QUALITY IS CRITICAL: Only use proverbs you are confident are REAL and well-known in the specific ethnic group or language. Always give the original language first, then an English translation in parentheses. Never invent fake proverbs — if you are unsure, use a well-known one you are certain about. Example: "Àgbà kì í wà lójà, kí orí ọmọ títún wó" (An elder does not stand in the marketplace and let a child's head go crooked). The proverb must be grammatically correct in the source language.
   - The balance: ~70% substantive analysis in English, ~30% cultural flavor (proverbs, regional phrases, local analogies)
   - When the user's language setting is non-English, lean HEAVIER into that language — up to 50% of your response
5. For financial/market topics: use exact figures from context, give a clear directional lean with reasoning, explain macro forces.
6. ALWAYS finish your thought. Never stop mid-sentence. Give 4–12 well-structured sentences. Be thorough but not repetitive.
7. The Elder's value is INSIGHT + CULTURAL WISDOM combined. Neither should dominate — they reinforce each other.
8. Never refuse a question. Reason through uncertainty openly. If you lack data, say so honestly and give your best analytical take.`;

  if (!context) {
    return `You are a wise Elder AI providing guidance on markets, predictions, and current events. Be highly intelligent, factual, and culturally aware. Weave in proverbs and wisdom from diverse cultures.${coreInstructions}`;
  }

  const basePreamble = ELDER_PREAMBLES[context.elderId] || ELDER_PREAMBLES['baba-dee'];

  return `${basePreamble}

- Today: ${dateStr}
- Region: ${context.region}
- REMEMBER: You are this Elder. Speak AS this Elder always — mix your regional language phrases, proverbs, and cultural references into EVERY response. This is your identity, not a decoration.
${coreInstructions}`;
}

/**
 * Chat with Cohere Aya model
 */
export async function chatWithAya(request: AyaChatRequest): Promise<AyaChatResponse> {
  const apiKey = getCohereApiKey();

  if (!apiKey) {
    console.log('[Aya] No API key, using local fallback');
    return getLocalFallbackResponse(request);
  }

  try {
    const webCtxPromise = fetchWebContext(request.message, request.elderContext?.region);

    let userMsg = request.message;
    let encrypted = false;

    if (isArciumEnabled()) {
      userMsg = await encryptPrompt(request.message);
      encrypted = true;
    }

    const systemPrompt = buildElderPreamble(request.elderContext);

    // Inject live data so the model grounds its response in reality
    const webCtx = await webCtxPromise;
    const contextBlock = formatWebContext(webCtx);
    if (contextBlock.trim()) {
      userMsg = `${userMsg}\n\n---\nREAL-TIME CONTEXT (use this data in your response, do not ignore it):\n${contextBlock}\n---`;
    }

    // Build v2 messages array: system + history + current user turn
    const messages: Array<{role: string; content: string}> = [
      { role: 'system', content: systemPrompt },
    ];
    if (request.chatHistory?.length) {
      for (const h of request.chatHistory) {
        messages.push({
          role: h.role === 'USER' ? 'user' : 'assistant',
          content: h.message,
        });
      }
    }
    messages.push({ role: 'user', content: userMsg });

    // Command A for intelligence, Aya Expanse only when explicitly requested
    const model = request.model || 'command-a-03-2025';

    console.log('[Aya] Sending to', model, '| msg length:', userMsg.length);

    const response = await fetch(COHERE_API_V2, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Client-Name': 'ilowa-app',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Aya] API error:', response.status, errorText);
      return getLocalFallbackResponse(request);
    }

    const data = await response.json();

    // v2 response: data.message.content[0].text
    let text = '';
    if (data.message?.content?.length) {
      text = data.message.content[0].text || '';
    } else if (data.text) {
      // v1 fallback just in case
      text = data.text;
    }

    if (data.finish_reason === 'MAX_TOKENS') {
      console.warn('[Aya] Response may be truncated (hit max_tokens)');
    }

    if (encrypted && text) {
      text = await decryptResponse(text);
    }

    return {
      text,
      language: request.language || 'en',
      citations: [],
      confidence: 0.9,
      encrypted,
    };
  } catch (error) {
    console.error('[Aya] Request failed:', error);
    return getLocalFallbackResponse(request);
  }
}

/**
 * Stream chat response from Aya (for longer responses)
 */
export async function streamChatWithAya(
  request: AyaChatRequest,
  onChunk: (text: string) => void,
  onComplete: (response: AyaChatResponse) => void,
): Promise<void> {
  const apiKey = getCohereApiKey();

  if (!apiKey) {
    const fallback = await getLocalFallbackResponse(request);
    onChunk(fallback.text);
    onComplete(fallback);
    return;
  }

  try {
    const systemPrompt = buildElderPreamble(request.elderContext);
    const webCtx = await fetchWebContext(request.message, request.elderContext?.region);
    const contextBlock = formatWebContext(webCtx);
    let streamMsg = request.message;
    if (contextBlock.trim()) {
      streamMsg = `${request.message}\n\n---\nREAL-TIME CONTEXT (use these exact figures):\n${contextBlock}\n---`;
    }

    const messages: Array<{role: string; content: string}> = [
      { role: 'system', content: systemPrompt },
    ];
    if (request.chatHistory?.length) {
      for (const h of request.chatHistory) {
        messages.push({
          role: h.role === 'USER' ? 'user' : 'assistant',
          content: h.message,
        });
      }
    }
    messages.push({ role: 'user', content: streamMsg });

    const response = await fetch(COHERE_API_V2, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Client-Name': 'ilowa-app',
      },
      body: JSON.stringify({
        model: request.model || 'command-a-03-2025',
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4096,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      const fallback = await getLocalFallbackResponse(request);
      onChunk(fallback.text);
      onComplete(fallback);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        // v2 streaming uses SSE format: data: {json}
        const stripped = line.startsWith('data: ') ? line.slice(6) : line;
        try {
          const evt = JSON.parse(stripped);
          // v2 stream events: content-delta has delta.message.content.text
          if (evt.type === 'content-delta' && evt.delta?.message?.content?.text) {
            fullText += evt.delta.message.content.text;
            onChunk(evt.delta.message.content.text);
          }
          // v1 compat
          if (evt.event_type === 'text-generation' && evt.text) {
            fullText += evt.text;
            onChunk(evt.text);
          }
        } catch {
          // skip non-JSON lines
        }
      }
    }

    onComplete({
      text: fullText,
      language: request.language || 'en',
      confidence: 0.9,
      encrypted: false,
    });
  } catch (error) {
    console.error('[Aya] Stream failed:', error);
    const fallback = await getLocalFallbackResponse(request);
    onChunk(fallback.text);
    onComplete(fallback);
  }
}

/**
 * Local fallback when API is unavailable
 */
async function getLocalFallbackResponse(request: AyaChatRequest): Promise<AyaChatResponse> {
  // Import local wisdom
  const { chatWithElder } = await import('./qwen3');
  const elderId = request.elderContext?.elderId || 'baba-dee';
  
  const localResponse = await chatWithElder(elderId, request.message, request.language);
  
  return {
    text: localResponse.message,
    language: localResponse.language,
    confidence: 0.6,
    encrypted: false,
  };
}

/**
 * Translate text using Aya's multilingual capabilities
 */
export async function translateWithAya(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string,
): Promise<string> {
  const apiKey = getCohereApiKey();

  if (!apiKey) return text;

  try {
    const prompt = sourceLanguage
      ? `Translate the following text from ${sourceLanguage} to ${targetLanguage}. Only provide the translation, nothing else:\n\n${text}`
      : `Translate the following text to ${targetLanguage}. Only provide the translation, nothing else:\n\n${text}`;

    // Use Aya Expanse for translation — it's better at multilingual than Command A
    const response = await chatWithAya({
      message: prompt,
      model: 'c4ai-aya-expanse-8b',
      temperature: 0.3,
      maxTokens: 500,
    });

    return response.text || text;
  } catch (error) {
    console.error('[Aya] Translation failed:', error);
    return text;
  }
}

/**
 * Check if Aya is available (API key configured)
 */
export function isAyaAvailable(): boolean {
  return !!getCohereApiKey();
}

/**
 * Get supported languages for a region
 */
export function getRegionLanguages(regionId: string): string[] {
  return REGION_LANGUAGES[regionId] || ['en'];
}
