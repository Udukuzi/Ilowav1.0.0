/**
 * Web Context Fetcher for AI Elders
 *
 * Pulls live data from MULTIPLE free public APIs BEFORE each AI query so the
 * Elder gives factually current, grounded answers on ANY topic — not just finance.
 *
 * SOURCE STRATEGY (all free, no auth required, privacy-preserving):
 *   - FX rates     → open.er-api.com + hardcoded fallback
 *   - Crypto       → CoinGecko API v3 + hardcoded fallback
 *   - Wikipedia    → REST Summary API — general knowledge, bios, history
 *   - News         → Wikimedia "In the news" — current events
 *   - DDG Instant  → DuckDuckGo Instant Answer API — quick facts (NOT for prices)
 *   - Open-Meteo   → weather for regional context
 *   - Reddit       → Public JSON API — trending topics, Global South subreddits
 *   - Hacker News  → Firebase API — tech/science trending
 *
 * Social media sources are fetched WITHOUT user auth — only public trending data.
 * No personal data is collected or sent. Global South outlook first.
 * DDG is NOT used for financial queries (returns stale article prices).
 */

const FX_URL = 'https://open.er-api.com/v6/latest/USD';
const CRYPTO_URL =
  'https://api.coingecko.com/api/v3/simple/price' +
  '?ids=solana,bitcoin,ethereum,binancecoin,ripple,cardano,tron,dogecoin' +
  '&vs_currencies=usd&include_24hr_change=true&include_market_cap=false';
const WIKI_SUMMARY = (title: string) =>
  `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
const DDG_INSTANT = (q: string) =>
  `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
const OPEN_METEO = (lat: number, lon: number) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;

// Social media — public endpoints, no auth, no user data
const REDDIT_HOT = (sub: string) =>
  `https://www.reddit.com/r/${sub}/hot.json?limit=5`;
const HN_TOP = 'https://hacker-news.firebaseio.com/v0/topstories.json';
const HN_ITEM = (id: number) =>
  `https://hacker-news.firebaseio.com/v0/item/${id}.json`;

// Global South-first subreddit rotation — picks based on user's region
// These are PUBLIC read-only feeds, no login needed
const REGION_SUBREDDITS: Record<string, string[]> = {
  'west-africa':    ['africa', 'Nigeria', 'Ghana', 'worldnews'],
  'east-africa':    ['africa', 'Kenya', 'Ethiopia', 'worldnews'],
  'southern-africa':['africa', 'southafrica', 'worldnews'],
  'south-asia':     ['india', 'pakistan', 'worldnews'],
  'southeast-asia': ['Philippines', 'indonesia', 'worldnews'],
  'mena':           ['arabs', 'Egypt', 'worldnews'],
  'latin-america':  ['LatinAmerica', 'brazil', 'worldnews'],
  'caribbean':      ['Caribbean', 'Jamaica', 'worldnews'],
  'pacific':        ['newzealand', 'australia', 'worldnews'],
};
const DEFAULT_SUBS = ['GlobalSouth', 'worldnews', 'africa'];

// FALLBACK rates (updated Feb 25, 2026) — used when live API fails on device
// Kept close to real values so the model doesn't hallucinate wildly
const FX_FALLBACK: Record<string, number> = {
  NGN: 1356, ZAR: 15.86, KES: 129, GHS: 14.8, UGX: 3680, TZS: 2640,
  ETB: 127,  EGP: 50.5,  MAD: 9.8,  SAR: 3.75, AED: 3.67,
  INR: 85.8, PKR: 278,  BDT: 119, IDR: 16200,PHP: 57.3, VND: 25500,
  THB: 34.2, MYR: 4.45, LKR: 298,
  BRL: 5.75, MXN: 20.4, COP: 4180,ARS: 1065, PEN: 3.74,
  JMD: 156,  TTD: 6.78,
  EUR: 0.95, GBP: 0.80, JPY: 149, CAD: 1.44, AUD: 1.59,
};
const CRYPTO_FALLBACK: Record<string, number> = {
  bitcoin: 68000, solana: 88, ethereum: 2046, binancecoin: 590,
  ripple: 2.2, cardano: 0.68, tron: 0.21, dogecoin: 0.18,
};

const FX_KEYWORDS = [
  'naira','ngn','rand','zar','shilling','kes','cedi','ghs','rupee','inr',
  'real','brl','peso','cop','mxn','php','ringgit','myr','baht','thb',
  'dong','vnd','pound','gbp','euro','eur','dollar','usd','exchange',
  'rate','forex','currency','inflation','devaluation','fx','remittance',
  'transfer','send money','convert','economy','economic',
];
const CRYPTO_KEYWORDS = [
  'solana','sol','bitcoin','btc','ethereum','eth','crypto','token',
  'blockchain','nft','defi','web3','price','coin','bnb','xrp','ada',
  'cardano','doge','dogecoin','market cap','trading','on-chain',
];
// Broad triggers that mean "give me financial context" even without
// naming a specific currency or coin
const MARKET_KEYWORDS = [
  'market','analysis','predict','forecast','invest','stock','trade',
  'finance','financial','bull','bear','trend','rally','crash','dip',
  'portfolio','hedge','yield','interest rate','gdp','growth','recession',
  'oil','commodity','gold','silver','wheat','inflation rate','central bank',
  'fed','ecb','boe','imf','world bank','debt','bond','treasury',
  'ipo','earnings','revenue','profit','loss','valuation','p/e',
  'technical analysis','support','resistance','moving average','rsi',
  'volume','breakout','consolidation','fibonacci','candlestick',
];
const GENERAL_KNOWLEDGE_KEYWORDS = [
  'who is','what is','explain','tell me about','history of','invented',
  'founded','born','died','located','capital of','population',
];
const NEWS_KEYWORDS = [
  'news','latest','today','yesterday','this week','breaking','announced',
  'killed','arrested','released','signed','launched',
];
const POLITICS_KEYWORDS = [
  'election','president','minister','government','war','conflict',
  'summit','coup','protest','sanctions','treaty','vote','parliament',
  'senate','congress','democracy','dictator','regime','opposition',
  'political','policy','legislation','bill','law','constitution',
  'diplomat','ambassador','un','nato','african union','ecowas',
  'asean','eu','immigration','refugee','border','sovereignty',
];
const SPORTS_KEYWORDS = [
  'football','soccer','basketball','cricket','tennis','boxing','mma',
  'athletics','olympics','world cup','afcon','premier league','la liga',
  'champions league','serie a','bundesliga','nba','ipl','t20',
  'scored','won','champion','tournament','cup','league','match',
  'game','team','player','coach','transfer','injury','fixture',
  'goal','penalty','red card','var','halftime','final','semi-final',
];
const SCIENCE_KEYWORDS = [
  'climate','space','nasa','ai','artificial intelligence','quantum',
  'discovery','research','study','vaccine','disease','species','ocean',
  'planet','satellite','genome','evolution','physics','chemistry',
  'engineering','mathematics','biology','medicine','health','cancer',
  'surgery','dna','crispr','telescope','mars','moon','solar','nuclear',
  'renewable','energy','battery','fusion','robotics','algorithm',
  'machine learning','neural network','data science','statistics',
  'stem','science','laboratory','experiment','theory','hypothesis',
];
const CULTURE_KEYWORDS = [
  'music','album','movie','film','book','artist','singer','actor',
  'award','grammy','oscar','netflix','spotify','concert','festival',
  'painting','museum','literature','poetry','dance','theater',
];
const SOCIAL_KEYWORDS = [
  'trending','viral','social media','twitter','x.com','reddit','tiktok',
  'instagram','facebook','meta','threads','meme','hashtag','influencer',
  'online','internet','post','tweet','retweet','share','reaction',
  'controversy','drama','cancel','debate','opinion','popular',
  'what are people saying','what do people think','public opinion',
];
const TECH_KEYWORDS = [
  'tech','technology','startup','silicon valley','app','software',
  'hardware','robot','drone','autonomous','self-driving','chatbot',
  'open source','github','programming','developer','coding','hack',
  'cybersecurity','data breach','privacy','surveillance',
];
// Regional city coords for weather context
const REGION_COORDS: Record<string, { lat: number; lon: number; city: string }> = {
  'west-africa':    { lat: 6.52,  lon: 3.38,  city: 'Lagos' },
  'east-africa':    { lat: -1.29, lon: 36.82, city: 'Nairobi' },
  'southern-africa':{ lat: -26.20,lon: 28.04, city: 'Johannesburg' },
  'south-asia':     { lat: 19.08, lon: 72.88, city: 'Mumbai' },
  'southeast-asia': { lat: 14.60, lon: 120.98,city: 'Manila' },
  'mena':           { lat: 30.04, lon: 31.24, city: 'Cairo' },
  'latin-america':  { lat: -23.55,lon: -46.63,city: 'São Paulo' },
  'caribbean':      { lat: 18.01, lon: -76.80,city: 'Kingston' },
  'pacific':        { lat: -36.85,lon: 174.76,city: 'Auckland' },
};

export interface WebContext {
  fx?: Record<string, number>;
  fxSource?: 'live' | 'fallback';
  crypto?: Record<string, { usd: number; usd_24h_change?: number }>;
  cryptoSource?: 'live' | 'fallback';
  wiki?: string;
  ddgFact?: string;
  newsHeadlines?: string[];
  weather?: { temp: number; description: string; city: string };
  socialTrending?: { source: string; title: string; sub?: string }[];
  techTrending?: string[];
  fetchedAt: string;
}

function lowerIncludes(text: string, keywords: string[]): boolean {
  const t = text.toLowerCase();
  return keywords.some((k) => t.includes(k));
}

async function safeFetch(url: string, timeoutMs = 8000, extraHeaders?: Record<string, string>): Promise<any | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json', ...extraHeaders },
    });
    if (!res.ok) {
      console.warn('[WebCtx] fetch failed:', url.slice(0, 60), 'status:', res.status);
      return null;
    }
    return await res.json();
  } catch (err: any) {
    console.warn('[WebCtx] fetch error:', url.slice(0, 60), err?.message || err);
    return null;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Fetch live web context relevant to the user's query.
 * Always injects grounded data — falls back to current hardcoded rates
 * so the model NEVER uses its stale training data for financial facts.
 */
export async function fetchWebContext(query: string, region?: string): Promise<WebContext> {
  const ctx: WebContext = { fetchedAt: new Date().toISOString() };
  const q = query.toLowerCase();
  const broadMarket = lowerIncludes(q, MARKET_KEYWORDS);
  const needsFx = lowerIncludes(q, FX_KEYWORDS) || broadMarket;
  const needsCrypto = lowerIncludes(q, CRYPTO_KEYWORDS) || broadMarket;
  const needsWiki = lowerIncludes(q, GENERAL_KNOWLEDGE_KEYWORDS);
  const needsNews = lowerIncludes(q, NEWS_KEYWORDS);
  const needsPolitics = lowerIncludes(q, POLITICS_KEYWORDS);
  const needsSports = lowerIncludes(q, SPORTS_KEYWORDS);
  const needsScience = lowerIncludes(q, SCIENCE_KEYWORDS);
  const needsCulture = lowerIncludes(q, CULTURE_KEYWORDS);
  const needsSocial = lowerIncludes(q, SOCIAL_KEYWORDS);
  const needsTech = lowerIncludes(q, TECH_KEYWORDS);
  // If the query doesn't match ANY keyword set, treat it as general knowledge
  // so we always give the model SOMETHING to ground on
  const needsWeather = q.includes('weather') || q.includes('temperature') || q.includes('climate') || q.includes('rain') || q.includes('storm') || q.includes('hot') || q.includes('cold') || q.includes('forecast');
  const isUnknownTopic = !needsFx && !needsCrypto && !needsWiki && !needsNews && !needsPolitics && !needsSports && !needsScience && !needsCulture && !needsSocial && !needsTech && !needsWeather;

  const promises: Promise<void>[] = [];

  // FX rates — live first, fallback to hardcoded if API fails
  if (needsFx) {
    promises.push(
      safeFetch(FX_URL).then((data) => {
        if (data?.rates && typeof data.rates === 'object') {
          const keep = Object.keys(FX_FALLBACK);
          const live = Object.fromEntries(
            Object.entries(data.rates as Record<string, number>)
              .filter(([k]) => keep.includes(k))
          );
          if (Object.keys(live).length > 5) {
            ctx.fx = live;
            ctx.fxSource = 'live';
          } else {
            ctx.fx = FX_FALLBACK;
            ctx.fxSource = 'fallback';
          }
        } else {
          ctx.fx = FX_FALLBACK;
          ctx.fxSource = 'fallback';
        }
      })
    );
  }

  // Crypto prices — live first, fallback to hardcoded if API fails
  if (needsCrypto) {
    promises.push(
      safeFetch(CRYPTO_URL).then((data) => {
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
          // CoinGecko returns { "bitcoin": { "usd": 96000, "usd_24h_change": 1.2 }, ... }
          const parsed: Record<string, { usd: number; usd_24h_change?: number }> = {};
          for (const [id, val] of Object.entries(data as Record<string, any>)) {
            if (val?.usd && typeof val.usd === 'number' && val.usd > 0) {
              parsed[id] = { usd: val.usd, usd_24h_change: val.usd_24h_change };
            }
          }
          if (Object.keys(parsed).length > 0) {
            ctx.crypto = parsed;
            ctx.cryptoSource = 'live';
          } else {
            ctx.crypto = Object.fromEntries(
              Object.entries(CRYPTO_FALLBACK).map(([k, v]) => [k, { usd: v }])
            );
            ctx.cryptoSource = 'fallback';
          }
        } else {
          ctx.crypto = Object.fromEntries(
            Object.entries(CRYPTO_FALLBACK).map(([k, v]) => [k, { usd: v }])
          );
          ctx.cryptoSource = 'fallback';
        }
      })
    );
  }

  // Wikipedia summary — for knowledge, science, culture, or unknown topics
  if (needsWiki || needsScience || needsCulture || isUnknownTopic) {
    const subject = extractWikiSubject(query);
    if (subject) {
      promises.push(
        safeFetch(WIKI_SUMMARY(subject)).then((data) => {
          if (data?.extract && typeof data.extract === 'string') {
            ctx.wiki = data.extract.slice(0, 600);
          }
        })
      );
    }
  }

  // DuckDuckGo Instant Answers — quick factual grounding for non-financial queries
  // Gives structured answers: person bios, definitions, place info, etc.
  if ((needsWiki || needsScience || needsCulture || isUnknownTopic) && !needsFx) {
    const ddgQ = extractDDGQuery(query);
    if (ddgQ) {
      promises.push(
        safeFetch(DDG_INSTANT(ddgQ)).then((data) => {
          if (!data) return;
          // DDG returns AbstractText for direct answers, or RelatedTopics for related
          const abstract = data.AbstractText || data.Answer || '';
          if (abstract && abstract.length > 20) {
            ctx.ddgFact = abstract.slice(0, 500);
          } else if (data.RelatedTopics?.length) {
            // Grab the first 2-3 related topic texts
            const topics = data.RelatedTopics
              .filter((t: any) => t.Text)
              .slice(0, 3)
              .map((t: any) => t.Text)
              .join(' | ');
            if (topics.length > 20) ctx.ddgFact = topics.slice(0, 500);
          }
        })
      );
    }
  }

  // News headlines — for current events, politics, sports, and "what's happening" queries
  // Uses Wikipedia's featured content feed which includes "In the news" items
  if (needsNews || needsPolitics || needsSports || isUnknownTopic) {
    const today = new Date();
    const dateSlug = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
    promises.push(
      safeFetch(`https://en.wikipedia.org/api/rest_v1/feed/featured/${dateSlug}`).then((data) => {
        if (!data?.news?.length) return;
        const headlines: string[] = [];
        for (const item of data.news.slice(0, 5)) {
          // Each news item has a .story (html-ish text) and .links[]
          if (item.story) {
            // Strip basic HTML tags
            const clean = item.story.replace(/<[^>]+>/g, '').trim();
            if (clean.length > 10) headlines.push(clean);
          }
        }
        if (headlines.length > 0) ctx.newsHeadlines = headlines;
      })
    );
  }

  // Reddit trending — social media pulse, Global South first
  // Fetches from region-specific subreddits for culturally relevant context
  if (needsSocial || needsNews || needsPolitics || needsSports || isUnknownTopic) {
    const subs = region && REGION_SUBREDDITS[region]
      ? REGION_SUBREDDITS[region]
      : DEFAULT_SUBS;
    // Pick 2 subs to keep it fast (parallel fetches)
    const pickSubs = subs.slice(0, 2);
    for (const sub of pickSubs) {
      promises.push(
        safeFetch(REDDIT_HOT(sub), 6000, { 'User-Agent': 'Ilowa/1.0 (Global South AI)' }).then((data) => {
          if (!data?.data?.children?.length) return;
          const posts = data.data.children
            .filter((p: any) => p.data && !p.data.stickied && p.data.title)
            .slice(0, 3)
            .map((p: any) => ({
              source: 'reddit',
              title: p.data.title.slice(0, 120),
              sub: p.data.subreddit,
            }));
          if (posts.length) {
            ctx.socialTrending = [...(ctx.socialTrending || []), ...posts];
          }
        })
      );
    }
  }

  // Hacker News — tech/science trending stories
  if (needsTech || needsScience || needsSocial) {
    promises.push(
      safeFetch(HN_TOP, 5000).then(async (ids) => {
        if (!Array.isArray(ids) || !ids.length) return;
        // Fetch top 4 story titles in parallel
        const topIds = ids.slice(0, 4);
        const stories = await Promise.allSettled(
          topIds.map((id: number) => safeFetch(HN_ITEM(id), 4000))
        );
        const titles: string[] = [];
        for (const result of stories) {
          if (result.status === 'fulfilled' && result.value?.title) {
            titles.push(result.value.title.slice(0, 100));
          }
        }
        if (titles.length) ctx.techTrending = titles;
      })
    );
  }

  // Weather — adds regional grounding when region is known
  if (region && REGION_COORDS[region] && needsWeather) {
    const { lat, lon, city } = REGION_COORDS[region];
    promises.push(
      safeFetch(OPEN_METEO(lat, lon)).then((data) => {
        if (!data?.current_weather) return;
        const w = data.current_weather;
        const desc = weatherCodeToText(w.weathercode);
        ctx.weather = { temp: w.temperature, description: desc, city };
      })
    );
  }

  await Promise.allSettled(promises);

  const sources = [
    ctx.fxSource ? `fx:${ctx.fxSource}` : null,
    ctx.cryptoSource ? `crypto:${ctx.cryptoSource}` : null,
    ctx.wiki ? 'wiki:yes' : null,
    ctx.ddgFact ? 'ddg:yes' : null,
    ctx.newsHeadlines?.length ? `news:${ctx.newsHeadlines.length}` : null,
    ctx.socialTrending?.length ? `social:${ctx.socialTrending.length}` : null,
    ctx.techTrending?.length ? `tech:${ctx.techTrending.length}` : null,
    ctx.weather ? 'weather:yes' : null,
  ].filter(Boolean);
  console.log('[WebCtx]', sources.length ? sources.join(' | ') : 'no sources matched');
  return ctx;
}

/**
 * Convert the fetched context into a concise text block to inject into the prompt.
 */
export function formatWebContext(ctx: WebContext): string {
  const now = new Date(ctx.fetchedAt);
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
  const parts: string[] = [
    `[Live data as of ${timeStr}. Use these figures naturally — do NOT name sources or say "according to" in your response. Just know the facts and speak from knowledge.]`,
  ];

  if (ctx.fx && Object.keys(ctx.fx).length) {
    const rates = Object.entries(ctx.fx)
      .map(([k, v]) => `${k}=${v.toLocaleString('en', { maximumFractionDigits: 0 })}`)
      .join(', ');
    parts.push(`FX (per 1 USD): ${rates}`);
  }

  if (ctx.crypto && Object.keys(ctx.crypto).length) {
    const prices = Object.entries(ctx.crypto)
      .map(([id, v]) => {
        const chg = v.usd_24h_change != null
          ? ` ${v.usd_24h_change > 0 ? '+' : ''}${v.usd_24h_change.toFixed(1)}%`
          : '';
        return `${id}: $${v.usd.toLocaleString('en')}${chg}`;
      })
      .join(', ');
    parts.push(`Crypto: ${prices}`);
  }

  if (ctx.wiki) {
    parts.push(`Background: ${ctx.wiki}`);
  }

  if (ctx.ddgFact) {
    parts.push(`Facts: ${ctx.ddgFact}`);
  }

  if (ctx.newsHeadlines?.length) {
    parts.push(`Headlines: ${ctx.newsHeadlines.join(' • ')}`);
  }

  if (ctx.socialTrending?.length) {
    const seen = new Set<string>();
    const unique = ctx.socialTrending.filter(t => {
      const key = t.title.slice(0, 40);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const lines = unique.slice(0, 5).map(t => t.title);
    parts.push(`Trending now: ${lines.join(' • ')}`);
  }

  if (ctx.techTrending?.length) {
    parts.push(`Tech pulse: ${ctx.techTrending.slice(0, 4).join(' • ')}`);
  }

  if (ctx.weather) {
    parts.push(`${ctx.weather.city}: ${ctx.weather.temp}°C, ${ctx.weather.description}`);
  }

  return parts.join('\n');
}

function extractWikiSubject(query: string): string | null {
  const cleaned = query
    .replace(/[?!.,;]/g, '')
    .replace(/\b(will|would|could|should|can|what|is|are|does|do|did|how|why|when|who|where|explain|tell me|about|history of|the|a|an|give me|show me|i want to know|please)\b/gi, '')
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 1 && words.length <= 8) return words.slice(0, 5).join(' ');
  return null;
}

function extractDDGQuery(query: string): string | null {
  // For DDG, pass a slightly cleaned version — DDG handles natural language well
  const cleaned = query.replace(/[?!]/g, '').trim();
  if (cleaned.length < 3 || cleaned.length > 200) return null;
  return cleaned;
}

function weatherCodeToText(code: number): string {
  // WMO weather interpretation codes → human text
  const codes: Record<number, string> = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Foggy', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle',
    55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers',
    81: 'Heavy showers', 82: 'Violent showers', 95: 'Thunderstorm',
    96: 'Thunderstorm w/ hail', 99: 'Severe thunderstorm',
  };
  return codes[code] || 'Unknown';
}
