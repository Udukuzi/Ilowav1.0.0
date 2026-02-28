import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS — locked down in production, permissive for local dev
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: ALLOWED_ORIGINS.length > 0
    ? ALLOWED_ORIGINS
    : true, // dev mode: allow everything
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-wallet-address', 'x-auth-signature', 'x-auth-message'],
  maxAge: 600,
}));
app.use(express.json({ limit: '1mb' }));

// ── Rate limiter (in-memory, good enough for single-instance VPS) ────
const _hits = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000; // 1 minute

function rateLimit(maxPerMinute: number) {
  return (req: any, res: any, next: any) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = _hits.get(ip);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + WINDOW_MS };
      _hits.set(ip, entry);
    }
    entry.count++;
    if (entry.count > maxPerMinute) {
      return res.status(429).json({ error: 'Too many requests — slow down' });
    }
    next();
  };
}

// Prune stale entries every 5 minutes so the map doesn't grow forever
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of _hits) {
    if (now > entry.resetAt) _hits.delete(ip);
  }
}, 300_000);

// Apply general limit to all routes, tighter limit on AI endpoints below
app.use(rateLimit(120));

const upload = multer({ dest: '/tmp/ilowa-uploads/' });

// ── Qwen3 Client ────────────────────────────────────────────

const qwen = new OpenAI({
  apiKey: process.env.QWEN_API_KEY || '',
  baseURL: process.env.QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
});

const QWEN_MODEL = process.env.QWEN_MODEL || 'qwen3-235b-a22b';

// ── Elder Personas ──────────────────────────────────────────

const ELDER_PERSONAS: Record<string, string> = {
  mama_nkechi: `You are Mama Nkechi, a wise Igbo elder woman from southeastern Nigeria. 
You speak with warmth and proverbs. You explain DeFi and crypto concepts using marketplace 
and trading analogies familiar to West African culture. You occasionally use Igbo proverbs 
and phrases. You are patient, nurturing, and protective of young people's finances.`,

  baba_toyin: `You are Baba Toyin, a respected Yoruba elder man and former university professor. 
You are analytical and methodical. You explain blockchain technology using academic analogies 
and Yoruba wisdom. You encourage critical thinking and warn against scams with fatherly concern.`,

  tante_amina: `You are Tante Amina, a Hausa elder woman who ran a successful textile business. 
You understand trade, markets, and risk. You explain prediction markets and betting using 
real-world business analogies. You speak with authority and practical wisdom.`,

  uncle_kwame: `You are Uncle Kwame, a Ghanaian elder who worked in banking for 30 years. 
You understand traditional and modern finance deeply. You bridge the gap between TradFi 
and DeFi with clear explanations. You use Akan proverbs and are known for your humor.`,

  grandma_fatou: `You are Grandma Fatou, a Senegalese elder who is a community leader. 
You focus on community safety and collective wealth building. You explain social recovery, 
guardianship, and security features using family and village analogies. You speak French 
and Wolof phrases occasionally.`,
};

// ── Routes ──────────────────────────────────────────────────

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', model: QWEN_MODEL });
});

// Unified AI endpoint
app.post('/api/ai/qwen3', async (req, res) => {
  const { task } = req.body;

  try {
    switch (task) {
      case 'elder_chat':
        return res.json(await handleElderChat(req.body));
      case 'validate_market':
        return res.json(await handleValidateMarket(req.body));
      case 'daily_trends':
        return res.json(await handleDailyTrends(req.body));
      case 'detect_language':
        return res.json(await handleDetectLanguage(req.body));
      case 'analyze_transaction':
        return res.json(await handleAnalyzeTransaction(req.body));
      default:
        return res.status(400).json({ error: `Unknown task: ${task}` });
    }
  } catch (error: any) {
    console.error(`[Qwen3] ${task} error:`, error.message);
    return res.status(500).json({ error: 'AI processing failed' });
  }
});

// Voice transcription endpoint
app.post('/api/stt/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const result = await handleTranscription(req.file.path);

    // Clean up temp file
    fs.unlink(req.file.path, () => {});

    return res.json(result);
  } catch (error: any) {
    console.error('[STT] Transcription error:', error.message);
    return res.status(500).json({ error: 'Transcription failed' });
  }
});

// Dedicated validate-market endpoint (used by qwen3-voice.ts)
app.post('/api/ai/validate-market', async (req, res) => {
  try {
    return res.json(await handleValidateMarket(req.body));
  } catch (error: any) {
    console.error('[Qwen3] validate-market error:', error.message);
    return res.status(500).json({ valid: false, reason: 'Validation service error' });
  }
});

// Dedicated detect-language endpoint (used by qwen3-voice.ts)
app.post('/api/ai/detect-language', async (req, res) => {
  try {
    return res.json(await handleDetectLanguage(req.body));
  } catch (error: any) {
    console.error('[Qwen3] detect-language error:', error.message);
    return res.status(500).json({ language: 'en' });
  }
});

// ElevenLabs proxy endpoint (Layer 3 — premium users)
app.post('/api/stt/elevenlabs', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsKey) {
      fs.unlink(req.file.path, () => {});
      return res.status(503).json({ error: 'ElevenLabs not configured' });
    }

    const audioBuffer = fs.readFileSync(req.file.path);
    const blob = new Blob([audioBuffer]);
    const formData = new FormData();
    formData.append('audio', blob, req.file.originalname || 'recording.m4a');
    formData.append('model', 'scribe_v1');
    if (req.body.language && req.body.language !== 'auto') {
      formData.append('language_code', req.body.language);
    }

    const elResponse = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': elevenLabsKey },
      body: formData as any,
    });

    fs.unlink(req.file.path, () => {});

    if (!elResponse.ok) {
      const errText = await elResponse.text();
      return res.status(elResponse.status).json({ error: errText });
    }

    const elResult = await elResponse.json() as any;
    return res.json({
      text: elResult.text,
      language: elResult.language_code || req.body.language || 'en',
      confidence: 0.99,
    });
  } catch (error: any) {
    console.error('[ElevenLabs] Proxy error:', error.message);
    return res.status(500).json({ error: 'ElevenLabs transcription failed' });
  }
});

// ── Handlers ────────────────────────────────────────────────

async function handleElderChat(body: {
  elderId: string;
  message: string;
  language: string;
}) {
  const { elderId, message, language } = body;
  const persona = ELDER_PERSONAS[elderId] || ELDER_PERSONAS.mama_nkechi;

  const systemPrompt = `${persona}

IMPORTANT RULES:
- Always respond in ${language === 'en' ? 'English' : language}. If the user writes in a local language, respond in that language.
- Keep responses concise (2-4 sentences max).
- If asked about a specific crypto/DeFi concept, explain it simply using cultural analogies.
- If the user seems to be falling for a scam, warn them firmly but kindly.
- End with a relevant proverb or wisdom when appropriate.
- You can suggest up to 3 follow-up questions the user might want to ask.`;

  const completion = await qwen.chat.completions.create({
    model: QWEN_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ],
    max_tokens: 300,
    temperature: 0.7,
  });

  const reply = completion.choices[0]?.message?.content || 'The ancestors are quiet right now.';

  // Extract suggestions if the model included them
  const suggestions = extractSuggestions(reply);

  return {
    message: suggestions.cleanMessage,
    language,
    suggestions: suggestions.items,
  };
}

async function handleValidateMarket(body: { question: string }) {
  const { question } = body;

  const completion = await qwen.chat.completions.create({
    model: QWEN_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are a prediction market validator. Analyze the question and respond with ONLY valid JSON:
{
  "valid": true/false,
  "reason": "brief explanation if invalid",
  "category": "one of: finance, politics, sports, entertainment, crypto, culture, weather, other",
  "suggestedExpiry": unix_timestamp_for_reasonable_expiry
}

Rules for valid markets:
- Must be a yes/no question about a future event
- Must be verifiable (has a clear resolution criteria)
- Must not promote violence, hate, or illegal activity
- Must have a reasonable timeframe (not too far in the future)`,
      },
      { role: 'user', content: question },
    ],
    max_tokens: 200,
    temperature: 0.1,
  });

  const text = completion.choices[0]?.message?.content || '';
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}

  return { valid: false, reason: 'Unable to validate question' };
}

async function handleDailyTrends(body: { region: string }) {
  const { region } = body;

  const regionNames: Record<string, string> = {
    westAfrica: 'West Africa (Nigeria, Ghana, Senegal)',
    eastAfrica: 'East Africa (Kenya, Tanzania, Ethiopia)',
    southernAfrica: 'Southern Africa (South Africa, Zimbabwe)',
    northAfrica: 'North Africa (Egypt, Morocco)',
    mena: 'Middle East and North Africa',
    latinAmerica: 'Latin America',
    southeastAsia: 'Southeast Asia',
    global: 'Global',
  };

  const regionName = regionNames[region] || 'Global';

  const completion = await qwen.chat.completions.create({
    model: QWEN_MODEL,
    messages: [
      {
        role: 'system',
        content: `Generate 5 trending prediction market questions relevant to ${regionName} today. 
Return ONLY a JSON array of strings. Each question must be a yes/no question about a near-future event.
Focus on: local politics, economy, sports, entertainment, crypto, and cultural events.
Example: ["Will the Naira reach 2000/USD by end of March?", "Will Burna Boy release a new album this month?"]`,
      },
      { role: 'user', content: `Generate trending prediction market questions for ${regionName}` },
    ],
    max_tokens: 400,
    temperature: 0.8,
  });

  const text = completion.choices[0]?.message?.content || '[]';
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) return { trends: JSON.parse(jsonMatch[0]) };
  } catch {}

  return { trends: [] };
}

async function handleDetectLanguage(body: { text: string }) {
  const { text } = body;

  const completion = await qwen.chat.completions.create({
    model: QWEN_MODEL,
    messages: [
      {
        role: 'system',
        content: `Detect the language of the text. Respond with ONLY the ISO 639-1 language code (e.g., "en", "fr", "yo", "ig", "ha", "sw", "ar", "pt", "es"). 
If it's a mix, return the dominant language. For Nigerian Pidgin, return "pcm".`,
      },
      { role: 'user', content: text },
    ],
    max_tokens: 10,
    temperature: 0.0,
  });

  const lang = (completion.choices[0]?.message?.content || 'en').trim().toLowerCase().slice(0, 3);
  return { language: lang };
}

async function handleAnalyzeTransaction(body: {
  programIds: string[];
  instructionCount: number;
}) {
  const { programIds, instructionCount } = body;

  const completion = await qwen.chat.completions.create({
    model: QWEN_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are a Solana transaction security analyzer. Analyze the transaction details and respond with ONLY valid JSON:
{
  "score": 0.0-1.0 (risk score, 0=safe, 1=dangerous),
  "scamReports": number,
  "isKnownDApp": boolean,
  "elderEndorsed": boolean,
  "warnings": ["list of warning strings"]
}

Known safe programs: System Program (11111...), Token Program (TokenkegQf...), Associated Token (ATokenGPv...), Ilowa Program (HYDwFwax9U6svCRYWD7Fqq3TXxSSQCQ6CwKrb3ZTkD3z).
Flag unknown programs as moderate risk. Flag many instructions (>5) as slightly higher risk.`,
      },
      {
        role: 'user',
        content: `Program IDs: ${programIds.join(', ')}\nInstruction count: ${instructionCount}`,
      },
    ],
    max_tokens: 200,
    temperature: 0.1,
  });

  const text = completion.choices[0]?.message?.content || '';
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}

  return {
    score: 0.5,
    scamReports: 0,
    isKnownDApp: false,
    elderEndorsed: false,
    warnings: ['Could not fully analyze transaction'],
  };
}

async function handleTranscription(filePath: string) {
  // Use Qwen3's audio capabilities via the OpenAI-compatible API
  // If the endpoint supports whisper-compatible STT, use that
  try {
    const audioFile = fs.createReadStream(filePath);
    const transcription = await qwen.audio.transcriptions.create({
      model: 'whisper-1', // Falls back to available STT model
      file: audioFile,
    });

    return {
      text: transcription.text,
      language: 'auto',
      confidence: 0.9,
    };
  } catch {
    // Fallback: if audio API not available, return placeholder
    // In production, integrate Wispr Flow or ElevenLabs here
    return {
      text: '[Audio transcription requires STT API configuration]',
      language: 'en',
      confidence: 0,
    };
  }
}

// ── Supabase client (self-hosted on VPS) ────────────────────

const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_ANON_KEY || ''
);

const PYTHON_API = process.env.PYTHON_API_URL || 'http://localhost:8000';

// ── Wallet auth ───────────────────────────────────────────────
// Signs a timestamped message so we can verify the caller holds the key.
// Message format: "ilowa_AUTH_{timestamp}" — expires after 60s.

function verifyWalletSig(message: string, signatureHex: string, walletAddr: string): boolean {
  try {
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = Buffer.from(signatureHex, 'hex');
    const pubBytes = new PublicKey(walletAddr).toBytes();
    return nacl.sign.detached.verify(msgBytes, sigBytes, pubBytes);
  } catch (err) {
    console.error('[Auth] sig check threw:', err);
    return false;
  }
}

async function requireWallet(req: any, res: any, next: any) {
  // Body-based auth (POST/PUT routes with JSON body)
  // Header-based auth (NillionClient uses headers so GET/DELETE can also be authed)
  const wallet    = req.body?.wallet    || req.headers['x-wallet-address'];
  const signature = req.body?.signature || req.headers['x-auth-signature'];
  const message   = req.body?.message   || req.headers['x-auth-message'];

  if (!wallet || !signature || !message) {
    return res.status(401).json({ error: 'wallet, signature, and message are required' });
  }

  if (!verifyWalletSig(message as string, signature as string, wallet as string)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const parts = (message as string).split('_');
  const ts = parseInt(parts[parts.length - 1], 10);
  if (isNaN(ts) || Date.now() - ts > 60_000) {
    return res.status(401).json({ error: 'Auth message expired — regenerate and retry' });
  }

  req.wallet = wallet;
  next();
}

// ── Points routes ─────────────────────────────────────────────

app.post('/api/points/award', requireWallet, async (req, res) => {
  const { action, metadata } = req.body;
  try {
    const resp = await axios.post(`${PYTHON_API}/points/award`, {
      user_wallet: req.wallet,
      action,
      metadata: metadata || {},
    });
    res.json(resp.data);
  } catch (err: any) {
    console.error('[Points] award proxy failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Public — no auth needed for leaderboard reads
app.get('/api/points/:wallet', async (req, res) => {
  const { wallet } = req.params;
  try {
    const { data, error } = await supabase
      .from('user_points_cache')
      .select('wallet_address, total_points, tier, last_updated')
      .eq('wallet_address', wallet)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    console.error('[Points] get failed:', err.message);
    res.status(404).json({ error: 'Points not found' });
  }
});

// ── Governance routes ─────────────────────────────────────────

app.post('/api/governance/propose', requireWallet, async (req, res) => {
  const { title, description, votingDuration } = req.body;
  try {
    const resp = await axios.post(`${PYTHON_API}/governance/propose`, {
      title,
      description,
      proposer_wallet: req.wallet,
      voting_duration: votingDuration ?? 7,
    });
    res.json(resp.data);
  } catch (err: any) {
    console.error('[Governance] propose proxy failed:', err.message);
    // surface the Python error message if it has one
    const detail = err.response?.data?.detail || err.message;
    res.status(err.response?.status || 500).json({ error: detail });
  }
});

app.post('/api/governance/vote', requireWallet, async (req, res) => {
  const { proposalId, choice } = req.body;
  try {
    const resp = await axios.post(`${PYTHON_API}/governance/vote`, {
      proposal_id: proposalId,
      vote: choice,    // Python VoteBody uses 'vote', not 'choice'
    }, { headers: { 'x-wallet-address': req.wallet } });
    res.json(resp.data);
  } catch (err: any) {
    console.error('[Governance] vote proxy failed:', err.message);
    const detail = err.response?.data?.detail || err.message;
    res.status(err.response?.status || 500).json({ error: detail });
  }
});

// ── Nillion proxy routes ──────────────────────────────────────
// Mobile NillionClient.ts calls these — they forward to Python backend
// which handles actual Nillion SDK operations.

app.post('/api/nillion/store', requireWallet, async (req, res) => {
  const { secret_name, secret_value, allowed_users } = req.body;
  try {
    const resp = await axios.post(`${PYTHON_API}/nillion/store`, {
      wallet:       req.wallet,
      secret_name,
      secret_value,
      allowed_users: allowed_users || [],
    }, { headers: { 'x-wallet-address': req.wallet } });
    res.json(resp.data);
  } catch (err: any) {
    console.error('[Nillion] store proxy failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/nillion/retrieve', async (req, res) => {
  const { secret_name, wallet } = req.query as Record<string, string>;
  if (!secret_name || !wallet) {
    return res.status(400).json({ error: 'secret_name and wallet are required' });
  }
  try {
    const resp = await axios.get(`${PYTHON_API}/nillion/retrieve`, {
      params: { secret_name, wallet },
      headers: { 'x-wallet-address': wallet },
    });
    res.json(resp.data);
  } catch (err: any) {
    if (err.response?.status === 404) return res.status(404).json({ value: null });
    console.error('[Nillion] retrieve proxy failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/nillion/delete', requireWallet, async (req, res) => {
  const { secret_name } = req.body;
  try {
    await axios.delete(`${PYTHON_API}/nillion/delete`, {
      data:    { wallet: req.wallet, secret_name },
      headers: { 'x-wallet-address': req.wallet },
    });
    res.json({ deleted: true });
  } catch (err: any) {
    console.error('[Nillion] delete proxy failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Markets private-bet route ─────────────────────────────────

app.post('/api/markets/bet/private', requireWallet, async (req, res) => {
  const { marketId, amount } = req.body;
  try {
    const resp = await axios.post(`${PYTHON_API}/bets/store`, {
      market_id: marketId,
      amount_sol: amount,
      resolver_wallet: process.env.RESOLVER_WALLET || '',
    }, {
      headers: { 'x-wallet-address': req.wallet },
    });
    res.json(resp.data);
  } catch (err: any) {
    console.error('[Markets] private bet proxy failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Dark Pool / Confidential AMM ─────────────────────────────

app.post('/api/darkpool/order', requireWallet, async (req, res) => {
  const { marketId, side, encryptedAmount, commitmentHash } = req.body;
  try {
    const resp = await axios.post(`${PYTHON_API}/darkpool/order`, {
      market_id: marketId,
      side,
      encrypted_amount: encryptedAmount,
      commitment_hash: commitmentHash,
    }, { headers: { 'x-wallet-address': req.wallet } });
    res.json(resp.data);
  } catch (err: any) {
    console.error('[DarkPool] order proxy failed:', err.message);
    const detail = err.response?.data?.detail || err.message;
    res.status(err.response?.status || 500).json({ error: detail });
  }
});

app.get('/api/darkpool/pool/:marketId', async (req, res) => {
  try {
    const resp = await axios.get(`${PYTHON_API}/darkpool/pool/${req.params.marketId}`);
    res.json(resp.data);
  } catch (err: any) {
    console.error('[DarkPool] snapshot failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/darkpool/settle', requireWallet, async (req, res) => {
  const { marketId, outcome } = req.body;
  try {
    const resp = await axios.post(`${PYTHON_API}/darkpool/settle`, {
      market_id: marketId,
      outcome,
    }, { headers: { 'x-wallet-address': req.wallet } });
    res.json(resp.data);
  } catch (err: any) {
    console.error('[DarkPool] settle proxy failed:', err.message);
    const detail = err.response?.data?.detail || err.message;
    res.status(err.response?.status || 500).json({ error: detail });
  }
});

// ── Hybrid Oracle (Switchboard V3 + Pyth) ────────────────────

app.get('/api/oracle/price/:pair', async (req, res) => {
  try {
    const pair = decodeURIComponent(req.params.pair);
    const resp = await axios.get(`${PYTHON_API}/oracle/price/${encodeURIComponent(pair)}`);
    res.json(resp.data);
  } catch (err: any) {
    if (err.response?.status === 404) {
      return res.status(404).json({ error: 'Feed not found' });
    }
    console.error('[Oracle] price proxy failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/oracle/resolve', requireWallet, async (req, res) => {
  const { marketId, pair, threshold, above } = req.body;
  try {
    const resp = await axios.post(`${PYTHON_API}/oracle/resolve`, {
      market_id: marketId,
      pair,
      threshold,
      above,
    }, { headers: { 'x-wallet-address': req.wallet } });
    res.json(resp.data);
  } catch (err: any) {
    console.error('[Oracle] resolve proxy failed:', err.message);
    const detail = err.response?.data?.detail || err.message;
    res.status(err.response?.status || 500).json({ error: detail });
  }
});

// ── Helpers ─────────────────────────────────────────────────

function extractSuggestions(text: string): { cleanMessage: string; items: string[] } {
  const lines = text.split('\n');
  const suggestions: string[] = [];
  const messageLines: string[] = [];

  let inSuggestions = false;
  for (const line of lines) {
    if (line.match(/follow.?up|you (might|could|may) (also )?(ask|want)/i)) {
      inSuggestions = true;
      continue;
    }
    if (inSuggestions && line.match(/^[\s]*[-•\d.]\s*/)) {
      suggestions.push(line.replace(/^[\s]*[-•\d.]\s*/, '').trim());
    } else if (!inSuggestions) {
      messageLines.push(line);
    }
  }

  return {
    cleanMessage: messageLines.join('\n').trim(),
    items: suggestions.slice(0, 3),
  };
}

// ── Start ───────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🎙️ Ilowa API server running on port ${PORT}`);
  console.log(`   Model: ${QWEN_MODEL}`);
  console.log(`   Base URL: ${qwen.baseURL}`);
  if (!process.env.QWEN_API_KEY) {
    console.warn('   ⚠️  QWEN_API_KEY not set — AI features will fail');
  }
});
