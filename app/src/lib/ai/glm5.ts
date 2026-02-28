// GLM-5 Integration — Z.ai's open-source reasoning/agentic model (MIT License)
// Used for: complex reasoning, trading analysis, computation, STEM, agentic tasks
// Complements Aya (multilingual/cultural) with deep analytical capabilities
// API compatible with OpenAI chat completions format via Together AI / DeepInfra

const GLM5_PROVIDERS = [
  { name: 'together', url: 'https://api.together.xyz/v1/chat/completions', envKey: 'EXPO_PUBLIC_TOGETHER_API_KEY', model: 'THUDM/GLM-5-0805' },
  { name: 'deepinfra', url: 'https://api.deepinfra.com/v1/openai/chat/completions', envKey: 'EXPO_PUBLIC_DEEPINFRA_API_KEY', model: 'THUDM/GLM-5-0805' },
] as const;

export interface GLM5Request {
  message: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  context?: string; // additional context (market data, chain state, etc.)
}

export interface GLM5Response {
  text: string;
  provider: string;
  tokensUsed?: number;
  confidence: number;
}

// cache which provider works so we don't retry dead ones every call
let lastWorkingProvider: number = 0;

function getApiKey(envKey: string): string | null {
  return (process.env as any)[envKey] || null;
}

function findProvider(): { url: string; apiKey: string; model: string; name: string; idx: number } | null {
  // try last working provider first, then cycle
  for (let i = 0; i < GLM5_PROVIDERS.length; i++) {
    const idx = (lastWorkingProvider + i) % GLM5_PROVIDERS.length;
    const p = GLM5_PROVIDERS[idx];
    const key = getApiKey(p.envKey);
    if (key) return { url: p.url, apiKey: key, model: p.model, name: p.name, idx };
  }
  return null;
}

export function isGLM5Available(): boolean {
  return findProvider() !== null;
}

// The reasoning system prompt — tells GLM-5 its role in the Ilowa stack
const REASONING_SYSTEM = `You are the reasoning engine inside Ilowa, a Solana-based prediction market and cultural SocialFi platform for the Global South.

Your role: deep analytical reasoning, trading analysis, computation, STEM explanations, and agentic task decomposition.
You work alongside cultural AI Elders who handle language and wisdom — your job is the hard thinking.

Guidelines:
- Be precise and quantitative when discussing markets, prices, probabilities
- Show your reasoning chain — don't just state conclusions
- For trading: consider liquidity, volatility, macro context, on-chain metrics
- For STEM: explain mechanisms, show equations where relevant
- For computation: verify your math, break complex problems into steps
- Keep responses focused and actionable — no filler
- You can reference Solana ecosystem specifics (TVL, validator count, TPS, etc.)`;

export async function queryGLM5(request: GLM5Request): Promise<GLM5Response> {
  const provider = findProvider();
  if (!provider) {
    return { text: '', provider: 'none', confidence: 0 };
  }

  const systemPrompt = request.systemPrompt || REASONING_SYSTEM;
  let userContent = request.message;
  if (request.context) {
    userContent += `\n\n---\nCONTEXT:\n${request.context}\n---`;
  }

  try {
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: request.temperature ?? 0.6,
        max_tokens: request.maxTokens ?? 4096,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.warn(`[GLM5] ${provider.name} returned ${res.status}: ${errBody.slice(0, 200)}`);
      // try next provider on failure
      lastWorkingProvider = (provider.idx + 1) % GLM5_PROVIDERS.length;
      return { text: '', provider: provider.name, confidence: 0 };
    }

    const data = await res.json();
    lastWorkingProvider = provider.idx;

    const text = data.choices?.[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens;

    return { text, provider: provider.name, tokensUsed, confidence: 0.92 };
  } catch (err: any) {
    console.error(`[GLM5] ${provider.name} request failed:`, err?.message);
    lastWorkingProvider = (provider.idx + 1) % GLM5_PROVIDERS.length;
    return { text: '', provider: provider.name, confidence: 0 };
  }
}

// Convenience wrappers for specific use cases

export async function analyzeMarket(question: string, poolData?: string): Promise<string> {
  const resp = await queryGLM5({
    message: `Analyze this prediction market question and provide directional insight:\n"${question}"`,
    context: poolData,
    temperature: 0.5,
  });
  return resp.text || 'Analysis unavailable — reasoning engine offline.';
}

export async function deepReason(prompt: string): Promise<string> {
  const resp = await queryGLM5({ message: prompt, temperature: 0.4, maxTokens: 6144 });
  return resp.text || '';
}

export async function computeAnalysis(data: string, question: string): Promise<string> {
  const resp = await queryGLM5({
    message: question,
    context: data,
    systemPrompt: `${REASONING_SYSTEM}\n\nFocus on quantitative analysis. Show calculations step-by-step.`,
    temperature: 0.3,
  });
  return resp.text || '';
}
