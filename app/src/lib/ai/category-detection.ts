/**
 * AI-powered category detection for prediction markets
 * Analyzes question text to auto-suggest the most appropriate category
 */

export type MarketCategoryId = 
  | 'all' 
  | 'finance' 
  | 'sports' 
  | 'politics' 
  | 'crypto' 
  | 'weather'
  | 'music'
  | 'afrobeats'
  | 'tech'
  | 'culture'
  | 'nollywood'
  | 'football'
  | 'elections'
  | 'currency';

interface CategoryMatch {
  category: MarketCategoryId;
  confidence: number;
  matchedKeywords: string[];
}

const CATEGORY_KEYWORDS: Record<MarketCategoryId, string[]> = {
  finance: [
    'naira', 'dollar', 'stock', 'price', 'exchange', 'rate', 'usd', 
    'trading', 'market cap', 'inflation', 'central bank', 'fed', 'bank',
    'gdp', 'economy', 'investment', 'bonds', 'interest rate', 'forex'
  ],
  crypto: [
    'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'crypto',
    'defi', 'nft', 'blockchain', 'token', 'dao', 'wallet', 'airdrop',
    'smart contract', 'gas fee', 'staking', 'mint', 'web3'
  ],
  sports: [
    'match', 'game', 'championship', 'league', 'team', 'player', 'score',
    'tournament', 'fifa', 'nba', 'premier league', 'super bowl', 'world cup',
    'olympics', 'cricket', 'tennis', 'boxing', 'ufc', 'f1', 'racing'
  ],
  football: [
    'afcon', 'epl', 'la liga', 'serie a', 'bundesliga', 'ucl', 'champions league',
    'europa league', 'manchester', 'arsenal', 'chelsea', 'liverpool', 'real madrid',
    'barcelona', 'psg', 'bayern', 'juventus', 'goal', 'penalty', 'red card'
  ],
  politics: [
    'election', 'president', 'governor', 'senator', 'policy', 'government',
    'vote', 'party', 'minister', 'cabinet', 'bill', 'law', 'congress',
    'parliament', 'democracy', 'campaign', 'ballot', 'impeach'
  ],
  elections: [
    'presidential election', 'gubernatorial', 'primary', 'runoff', 'polls',
    'swing state', 'electoral', 'candidate', 'nomination', 'debate'
  ],
  weather: [
    'rain', 'weather', 'temperature', 'storm', 'flood', 'drought', 'sunny',
    'cloudy', 'wind', 'hurricane', 'typhoon', 'monsoon', 'snow', 'heat wave',
    'climate', 'forecast'
  ],
  music: [
    'album', 'song', 'artist', 'concert', 'tour', 'grammy', 'billboard',
    'spotify', 'streaming', 'release', 'single', 'music video', 'record'
  ],
  afrobeats: [
    'burna boy', 'wizkid', 'davido', 'rema', 'asake', 'tems', 'ayra starr',
    'amapiano', 'afrobeats', 'afropop', 'naija', 'headies', 'soundcity',
    'ckay', 'fireboy', 'omah lay'
  ],
  nollywood: [
    'nollywood', 'nigerian movie', 'amvca', 'genevieve', 'funke akindele',
    'ramsey nouah', 'omotola', 'netflix nigeria', 'showmax', 'iroko'
  ],
  tech: [
    'app', 'software', 'startup', 'ai', 'artificial intelligence', 'chatgpt',
    'openai', 'google', 'apple', 'microsoft', 'meta', 'twitter', 'x',
    'launch', 'feature', 'update', 'iphone', 'android', 'mobile'
  ],
  culture: [
    'fashion', 'trend', 'viral', 'meme', 'social media', 'influencer',
    'celebrity', 'wedding', 'festival', 'holiday', 'tradition'
  ],
  currency: [
    'naira to dollar', 'exchange rate', 'cbn', 'forex', 'black market',
    'parallel market', 'devaluation', 'appreciation', 'currency'
  ],
  all: [] // Default fallback
};

/**
 * Detect the most appropriate category for a market question
 */
export function detectMarketCategory(question: string): MarketCategoryId {
  const result = detectMarketCategoryWithConfidence(question);
  return result.category;
}

/**
 * Detect category with confidence score and matched keywords
 */
export function detectMarketCategoryWithConfidence(question: string): CategoryMatch {
  const q = question.toLowerCase();
  
  let bestMatch: CategoryMatch = {
    category: 'all',
    confidence: 0,
    matchedKeywords: [],
  };

  // Check each category
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (category === 'all') continue;
    
    const matchedKeywords = keywords.filter(kw => q.includes(kw));
    const confidence = matchedKeywords.length / Math.max(keywords.length * 0.3, 1);
    
    if (matchedKeywords.length > 0 && confidence > bestMatch.confidence) {
      bestMatch = {
        category: category as MarketCategoryId,
        confidence: Math.min(confidence, 1),
        matchedKeywords,
      };
    }
  }

  // Boost confidence for specific patterns
  if (bestMatch.matchedKeywords.length >= 2) {
    bestMatch.confidence = Math.min(bestMatch.confidence * 1.5, 1);
  }

  return bestMatch;
}

/**
 * Get all categories with their match scores for a question
 */
export function getAllCategoryScores(question: string): CategoryMatch[] {
  const q = question.toLowerCase();
  const scores: CategoryMatch[] = [];

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (category === 'all') continue;
    
    const matchedKeywords = keywords.filter(kw => q.includes(kw));
    if (matchedKeywords.length > 0) {
      scores.push({
        category: category as MarketCategoryId,
        confidence: matchedKeywords.length / Math.max(keywords.length * 0.3, 1),
        matchedKeywords,
      });
    }
  }

  return scores.sort((a, b) => b.confidence - a.confidence);
}
