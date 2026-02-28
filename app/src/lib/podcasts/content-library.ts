/**
 * Podcast Content Library
 * 
 * Pre-authored educational content that the regional Elder AI voice
 * reads aloud via Lelapa TTS. Each episode is a script — the TTS
 * engine generates audio on-demand keyed to the user's region + language.
 * 
 * Audio is cached locally after first generation so repeat listens
 * don't hit the API again.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
// expo-file-system v19 broke legacy API types, so we use fetch + base64 instead
import { getTextToSpeech } from '../ai/lelapa';
// expo-speech — native module missing on Android Expo Go, safe to skip here
// (actual Speech.speak() calls live in podcast/[id].tsx)
let Speech: typeof import('expo-speech') | null = null;
try { Speech = require('expo-speech'); } catch { /* no-op */ }

export interface PodcastEpisode {
  id: string;
  title: string;
  description: string;
  category: 'crypto' | 'defi' | 'culture' | 'health' | 'business' | 'governance';
  script: string; // the text the Elder reads
  durationEstimate: number; // seconds, rough estimate based on word count
  regions: string[]; // which regions this is relevant for ('all' = everywhere)
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface GeneratedEpisode extends PodcastEpisode {
  audioUrl: string | null;
  language: string;
  elderName: string;
  generatedAt: number;
}

const AUDIO_CACHE_KEY = (epId: string, lang: string) => `@ilowa/pod_audio/${epId}_${lang}`;

// ── Free TTS via Google Translate ────────────────────────────────────
// ~200 char limit per request, so we split into sentence-sized chunks.
// expo-av on Android can't stream these URLs directly (missing headers),
// so we download each chunk to a local .mp3 file first.

const GTTS = 'https://translate.google.com/translate_tts';
const MAX_CHUNK = 180;

function chunkScript(text: string): string[] {
  const lines = text.replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  let buf = '';
  for (const ln of lines) {
    if ((buf + ' ' + ln).trim().length > MAX_CHUNK) {
      if (buf) out.push(buf.trim());
      if (ln.length > MAX_CHUNK) {
        // brute force split long sentences on word boundary
        const words = ln.split(' ');
        let sub = '';
        for (const w of words) {
          if ((sub + ' ' + w).trim().length > MAX_CHUNK) {
            if (sub) out.push(sub.trim());
            sub = w;
          } else sub = sub ? sub + ' ' + w : w;
        }
        buf = sub;
      } else buf = ln;
    } else buf = buf ? buf + ' ' + ln : ln;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function ttsUrl(text: string, lang: string): string {
  const tl = lang.split('-')[0];
  return `${GTTS}?ie=UTF-8&client=tw-ob&tl=${tl}&q=${encodeURIComponent(text)}`;
}

// Fetch audio blob from Google TTS and return a base64 data URI
// that expo-av can play without any filesystem writes
async function fetchTTSDataUri(text: string, lang: string): Promise<string | null> {
  try {
    const resp = await fetch(ttsUrl(text, lang));
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Download all chunks as base64 data URIs
async function downloadTTSChunks(epId: string, text: string, lang: string): Promise<string[] | null> {
  const chunks = chunkScript(text);
  if (!chunks.length) return null;

  const uris: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const dataUri = await fetchTTSDataUri(chunks[i], lang);
    if (dataUri && dataUri.length > 100) {
      uris.push(dataUri);
    } else {
      console.warn(`[TTS] chunk ${i}/${chunks.length} failed`);
    }
  }
  return uris.length > 0 ? uris : null;
}

// ── Content Library ─────────────────────────────────────────────────

export const PODCAST_LIBRARY: PodcastEpisode[] = [
  {
    id: 'crypto-101',
    title: 'Crypto 101',
    description: 'What is cryptocurrency? A gentle introduction to digital money, wallets, and why it matters for everyday people.',
    category: 'crypto',
    script: `Welcome, my friend. Today we talk about cryptocurrency — digital money that lives on the internet, not in a bank vault.

Imagine you send money to your cousin in another city. Normally, a bank or mobile money agent sits in the middle, taking a small fee and sometimes days to deliver. With cryptocurrency, the money moves directly — person to person — in minutes, not days.

The magic behind this is called a blockchain. Think of it as a giant notebook that everyone in the world can read, but nobody can erase or change. Every transaction is written down permanently.

Bitcoin was the first cryptocurrency, created in 2009. Since then, thousands more have appeared. Solana, which powers this app, can process thousands of transactions per second — faster than most banks.

Your crypto wallet is like a digital pocket. It has two parts: a public address, which is like your phone number that anyone can send money to, and a private key, which is the password that only you should know. Never share your private key with anyone.

Remember: you don't need to understand every technical detail to use crypto. Just like you don't need to know how a phone tower works to make a call. Start small, learn as you go, and always protect your private key.`,
    durationEstimate: 180,
    regions: ['all'],
    difficulty: 'beginner',
  },
  {
    id: 'defi-explained',
    title: 'DeFi Explained',
    description: 'Decentralized Finance in plain language — lending, borrowing, and earning without banks.',
    category: 'defi',
    script: `Let me tell you about DeFi — Decentralized Finance. It sounds complicated, but the idea is beautifully simple.

In traditional finance, banks decide who gets a loan, what interest rate you pay, and they keep a good portion of the profits. In DeFi, computer programs called smart contracts replace the bank. These programs run on blockchain and follow rules that nobody can change secretly.

Here is how lending works in DeFi: You deposit your cryptocurrency into a lending pool. Borrowers can take loans from this pool by putting up their own crypto as collateral. You earn interest automatically — no paperwork, no credit score, no waiting weeks for approval.

Prediction markets, like the ones in this app, are also DeFi. You stake tokens on the outcome of an event. If you're right, you earn. The smart contract handles everything fairly.

The beauty of DeFi is access. A farmer in rural Nigeria and a banker in London have the same access to the same financial tools. No discrimination, no gatekeeping. Your phone and an internet connection are your bank branch.

But be careful — DeFi also means you are your own bank. If you lose your private key or send money to the wrong address, there is no customer service to call. Always double-check addresses, start with small amounts, and never invest more than you can afford to lose.`,
    durationEstimate: 200,
    regions: ['all'],
    difficulty: 'beginner',
  },
  {
    id: 'mobile-money-to-crypto',
    title: 'From Mobile Money to Crypto',
    description: 'How cryptocurrency builds on the mobile money revolution that Africa pioneered.',
    category: 'crypto',
    script: `Africa did something remarkable. Before most of the world figured out digital payments, Kenya launched M-Pesa in 2007, and mobile money spread like wildfire across the continent.

Mobile money proved that you don't need a bank account to participate in the digital economy. A simple phone — not even a smartphone — was enough. Millions of people who had never seen the inside of a bank could suddenly send money, pay bills, and save.

Cryptocurrency is the next chapter of this same story. Mobile money still relies on a central company — Safaricom, MTN, or whoever runs the service. They set the fees, they control your account, and they can freeze it.

With crypto on Solana, there is no central company. The network is run by thousands of computers around the world. Transaction fees are fractions of a cent. And nobody can freeze your wallet.

The transition from mobile money to crypto doesn't have to be sudden. Many people will use both for years. But as smartphones become cheaper and internet access spreads, crypto will become as natural as topping up airtime.

This app, Ilowa, is built for exactly this transition — bringing the power of decentralized finance to the people who need it most, in languages they speak, with cultural context they understand.`,
    durationEstimate: 190,
    regions: ['west-africa', 'east-africa', 'southern-africa'],
    difficulty: 'beginner',
  },
  {
    id: 'prediction-markets-guide',
    title: 'How Prediction Markets Work',
    description: 'Learn how to use prediction markets wisely — place bets, understand odds, and earn from your knowledge.',
    category: 'defi',
    script: `Prediction markets are one of the oldest forms of collective intelligence. The idea is simple: people put money behind what they believe will happen, and the market price tells you what the crowd thinks.

In Ilowa, you can create a market about anything — will it rain in Lagos tomorrow? Will the national team win the match? Will maize prices go up this month?

When you see a market showing 70 percent for "Yes," it means the crowd collectively believes there's a 70 percent chance of that outcome. If you think the real probability is higher, buying "Yes" is a good bet. If you think it's lower, buy "No."

The price you pay is your risk. If you buy "Yes" at 0.30 SOL and the outcome is indeed Yes, you receive 1.0 SOL — a profit of 0.70. If the outcome is No, you lose your 0.30.

Here are some tips from an old hand: First, only bet what you can afford to lose. Second, pay attention to when a market resolves — a bet that ties up your money for six months is different from one that resolves tomorrow. Third, local knowledge is your superpower. You know your region better than anyone sitting in a distant office.

Prediction markets work best when many people participate honestly. The more diverse the crowd, the more accurate the prediction. Your participation makes the whole system smarter.`,
    durationEstimate: 210,
    regions: ['all'],
    difficulty: 'intermediate',
  },
  {
    id: 'ubuntu-economics',
    title: 'Ubuntu Economics',
    description: 'How the philosophy of Ubuntu applies to decentralized communities and collective prosperity.',
    category: 'culture',
    script: `Ubuntu. "I am because we are." This ancient Southern African philosophy holds a profound truth about how communities thrive.

In the Western model, economics is about individual competition — maximize your own gain. But Ubuntu teaches that individual prosperity is inseparable from community well-being. When your neighbor succeeds, you succeed. When the community is strong, every member benefits.

This philosophy maps beautifully onto decentralized systems. In a blockchain network, every participant strengthens the network for everyone else. When you contribute to federated learning in this app, you're not just helping yourself — you're improving the AI for every user.

Stokvels — rotating savings clubs — are a perfect example of Ubuntu economics in practice. A group of people pool their money, and each member takes turns receiving the full pot. No bank needed, no interest charged. Trust and community are the collateral.

DeFi protocols work on similar principles. Liquidity pools are essentially digital stokvels — everyone contributes, everyone benefits from the fees generated.

The future of finance isn't just about faster transactions or lower fees. It's about building systems that embody Ubuntu — where the success of the individual and the success of the community are one and the same.`,
    durationEstimate: 195,
    regions: ['southern-africa', 'east-africa'],
    difficulty: 'intermediate',
  },
  {
    id: 'staying-safe-online',
    title: 'Staying Safe in Crypto',
    description: 'Protect yourself from scams, phishing, and common crypto pitfalls.',
    category: 'crypto',
    script: `My friend, let me share some hard-earned wisdom about staying safe in the world of cryptocurrency. Scammers are clever, but knowledge is your shield.

Rule number one: Nobody legitimate will ever ask for your private key or seed phrase. Not customer support, not a friend, not even this app. Your seed phrase is like the master key to your house — if someone has it, they can take everything.

Rule number two: If something sounds too good to be true, it is. "Send me 1 SOL and I'll send back 10" is always a scam. Always. Real investment opportunities don't need to chase you on social media.

Rule number three: Double-check every address before sending money. Scammers create fake websites that look identical to real ones. One wrong letter in a web address can send your money to a thief.

Rule number four: Use secure connections. Avoid doing crypto transactions on public Wi-Fi. Your home network or mobile data is safer.

Rule number five: Start small. When trying a new platform or feature, send a tiny amount first. Once you confirm it works, send the rest.

This app uses Arcium encryption and on-device processing to protect your privacy. Your AI conversations stay between you and your Elder. But technology alone cannot protect you — awareness and caution are your best tools.

If something feels wrong, trust your instinct. Ask your community. There is no shame in being careful — only wisdom.`,
    durationEstimate: 220,
    regions: ['all'],
    difficulty: 'beginner',
  },
];

// ── Generation & Caching ────────────────────────────────────────────

/**
 * Generate audio for an episode using the Elder's voice via Lelapa TTS.
 * Caches the audio URL locally so subsequent plays are instant.
 */
export async function generateEpisodeAudio(
  episode: PodcastEpisode,
  language: string,
  elderName: string,
): Promise<GeneratedEpisode> {
  // Only cache Lelapa URLs (small strings). Data URIs are too big for AsyncStorage.
  const cacheKey = AUDIO_CACHE_KEY(episode.id, language);
  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached && cached.startsWith('http') && !cached.includes('translate.google.com')) {
    // valid Lelapa TTS URL from previous run
    return {
      ...episode,
      audioUrl: cached,
      language,
      elderName,
      generatedAt: Date.now(),
    };
  }
  // anything else in cache is stale — wipe it
  if (cached) await AsyncStorage.removeItem(cacheKey).catch(() => {});

  // 1) Try Lelapa TTS (African language specialist)
  let audioUrl: string | null = null;
  try {
    audioUrl = await getTextToSpeech(episode.script, language);
    if (audioUrl) {
      await AsyncStorage.setItem(cacheKey, audioUrl).catch(() => {});
    }
  } catch (e) {
    console.warn('[Podcast] Lelapa TTS unavailable, trying Google fallback');
  }

  // 2) Google TTS → fetch as base64 data URIs (no filesystem needed)
  if (!audioUrl) {
    try {
      const dataUris = await downloadTTSChunks(episode.id, episode.script, language);
      if (dataUris && dataUris.length > 0) {
        audioUrl = JSON.stringify(dataUris);
      }
    } catch (e) {
      console.warn('[Podcast] Google TTS download failed:', e);
    }
  }

  // 'device-speech' = last resort (iOS only, Android expo-speech is broken)
  return {
    ...episode,
    audioUrl: audioUrl || 'device-speech',
    language,
    elderName,
    generatedAt: Date.now(),
  };
}

/**
 * Get episodes relevant to a user's region.
 */
export function getEpisodesForRegion(region: string): PodcastEpisode[] {
  return PODCAST_LIBRARY.filter(
    ep => ep.regions.includes('all') || ep.regions.includes(region)
  );
}

/**
 * Estimate reading duration from word count (avg 150 wpm for narration).
 */
export function estimateDuration(text: string): number {
  const words = text.split(/\s+/).length;
  return Math.ceil((words / 150) * 60);
}
