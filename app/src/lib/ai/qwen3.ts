/**
 * Elder AI System
 * 
 * NOTE: Qwen3 server removed per spec. Elder wisdom is now:
 * 1. Local curated responses (wisdom database)
 * 2. Voice transcription via Gladia (online) / Vosk (offline)
 * 
 * No external AI API calls needed for v1.
 */

import { ELDERS } from '../../data/elders';

export interface ElderChatResponse {
  message: string;
  language: string;
  suggestions?: string[];
}

export interface MarketValidation {
  valid: boolean;
  reason?: string;
  category?: string;
  suggestedExpiry?: number;
}

// Elder wisdom database - curated responses by topic
const ELDER_WISDOM: Record<string, string[]> = {
  naira: [
    'The Naira dances with global winds. Watch the oil, watch the CBN, watch the whispers of the market.',
    'Currency is like the tide — it ebbs and flows. The wise trader reads the moon, not the waves.',
    'When the dollar speaks, the Naira listens. But remember, patience rewards the faithful.',
  ],
  market: [
    'Markets are like the village square — truth emerges from many voices speaking.',
    'The ancestors knew: buy when others fear, sell when others dream.',
    'Every market has its rhythm. Find the beat before you dance.',
  ],
  prediction: [
    'To predict is to listen — to the earth, to the people, to the silent signs.',
    'The future is written in patterns. Those who see patterns see tomorrow.',
    'A prediction without wisdom is a guess. Add wisdom, and it becomes insight.',
  ],
  wisdom: [
    'The baobab does not grow tall in a day. Patience in all things.',
    'What the elders see sitting, the young cannot see standing.',
    'The river that forgets its source will dry up.',
    'When the music changes, so must the dance.',
    'No matter how long the night, the day is sure to come.',
  ],
  crypto: [
    'Digital gold requires the same wisdom as physical gold — do not chase, accumulate.',
    'The blockchain never lies, but it does not reveal all truths easily.',
    'In decentralization, we find the old village spirit — power to the many, not the few.',
  ],
  football: [
    'The beautiful game mirrors life — teamwork, strategy, and moments of pure magic.',
    'A match is won in the mind before the feet touch the ball.',
    'The crowd sees the goal, the wise see the pass that made it possible.',
  ],
  default: [
    'Speak, and the ancestors listen. Your question carries weight.',
    'The path you seek is already before you. Look with fresh eyes.',
    'Every question contains its answer, like the seed contains the tree.',
  ],
};

/**
 * Get Elder response based on message content
 */
export async function chatWithElder(
  elderId: string,
  message: string,
  language: string = 'en'
): Promise<ElderChatResponse> {
  const elder = ELDERS.find(e => e.id === elderId);
  const lowerMessage = message.toLowerCase();
  
  // Detect topic from message
  let topic = 'default';
  if (lowerMessage.includes('naira') || lowerMessage.includes('currency') || lowerMessage.includes('dollar')) {
    topic = 'naira';
  } else if (lowerMessage.includes('market') || lowerMessage.includes('trade') || lowerMessage.includes('invest')) {
    topic = 'market';
  } else if (lowerMessage.includes('predict') || lowerMessage.includes('bet') || lowerMessage.includes('think')) {
    topic = 'prediction';
  } else if (lowerMessage.includes('crypto') || lowerMessage.includes('bitcoin') || lowerMessage.includes('solana')) {
    topic = 'crypto';
  } else if (lowerMessage.includes('football') || lowerMessage.includes('match') || lowerMessage.includes('goal')) {
    topic = 'football';
  } else if (lowerMessage.includes('wisdom') || lowerMessage.includes('advice') || lowerMessage.includes('guide')) {
    topic = 'wisdom';
  }
  
  // Get random wisdom for topic
  const wisdomList = ELDER_WISDOM[topic] || ELDER_WISDOM.default;
  const wisdom = wisdomList[Math.floor(Math.random() * wisdomList.length)];
  
  return {
    message: wisdom,
    language,
    suggestions: getSuggestions(topic),
  };
}

function getSuggestions(topic: string): string[] {
  const suggestions: Record<string, string[]> = {
    naira: ['Predict Naira rate', 'Market analysis', 'Currency trends'],
    market: ['Create prediction', 'View trending', 'Market wisdom'],
    prediction: ['Make a bet', 'View markets', 'Today\'s odds'],
    crypto: ['SOL price', 'Crypto wisdom', 'DeFi trends'],
    football: ['Match predictions', 'AFCON updates', 'Player stats'],
    wisdom: ['Daily blessing', 'Elder guidance', 'Proverb of the day'],
    default: ['Ask about markets', 'Get wisdom', 'Make prediction'],
  };
  return suggestions[topic] || suggestions.default;
}

/**
 * Validate a market question (local validation)
 */
export async function validateMarket(question: string): Promise<MarketValidation> {
  const trimmed = question.trim();
  
  // Basic validation rules
  if (trimmed.length < 10) {
    return { valid: false, reason: 'Question too short — add more detail' };
  }
  
  if (trimmed.length > 280) {
    return { valid: false, reason: 'Question too long — keep it concise' };
  }
  
  if (!trimmed.includes('?') && !trimmed.toLowerCase().startsWith('will')) {
    return { valid: false, reason: 'Phrase as a yes/no question (e.g., "Will X happen?")' };
  }
  
  // Detect category across all 13 on-chain categories
  const lowerQ = trimmed.toLowerCase();
  let category = 'other';

  if (
    lowerQ.includes('naira') || lowerQ.includes('cedi') || lowerQ.includes('rand') || lowerQ.includes('shilling') ||
    lowerQ.includes('dollar') || lowerQ.includes('euro') || lowerQ.includes('pound') || lowerQ.includes('franc') ||
    lowerQ.includes('currency') || lowerQ.includes('exchange rate') || lowerQ.includes('forex') ||
    lowerQ.includes('devaluat') || lowerQ.includes('cbn') || lowerQ.includes('central bank')
  ) {
    category = 'currency';
  } else if (
    lowerQ.includes('bitcoin') || lowerQ.includes('btc') || lowerQ.includes('ethereum') || lowerQ.includes('eth') ||
    lowerQ.includes('solana') || lowerQ.includes(' sol ') || lowerQ.includes('crypto') || lowerQ.includes('defi') ||
    lowerQ.includes('nft') || lowerQ.includes('token') || lowerQ.includes('blockchain') || lowerQ.includes('web3') ||
    lowerQ.includes('usdc') || lowerQ.includes('usdt') || lowerQ.includes('altcoin') || lowerQ.includes('memecoin')
  ) {
    category = 'crypto';
  } else if (
    lowerQ.includes('election') || lowerQ.includes('president') || lowerQ.includes('governor') ||
    lowerQ.includes('senator') || lowerQ.includes('parliament') || lowerQ.includes('vote') ||
    lowerQ.includes('ballot') || lowerQ.includes('political party') || lowerQ.includes('inec') ||
    lowerQ.includes('campaign') || lowerQ.includes('polling') || lowerQ.includes('candidat')
  ) {
    category = 'elections';
  } else if (
    lowerQ.includes('football') || lowerQ.includes('soccer') || lowerQ.includes('afcon') ||
    lowerQ.includes('premier league') || lowerQ.includes('champions league') || lowerQ.includes('world cup') ||
    lowerQ.includes('goal') || lowerQ.includes('stadium') || lowerQ.includes('bafana') ||
    lowerQ.includes('super eagles') || lowerQ.includes('black stars') || lowerQ.includes('harambee')
  ) {
    category = 'football';
  } else if (
    lowerQ.includes(' match') || lowerQ.includes('nba') || lowerQ.includes('nfl') || lowerQ.includes('championship') ||
    lowerQ.includes('olympics') || lowerQ.includes('athlete') || lowerQ.includes('tournament') ||
    lowerQ.includes('cricket') || lowerQ.includes('rugby') || lowerQ.includes('tennis') ||
    lowerQ.includes('sport') || lowerQ.includes('player') || lowerQ.includes('team win')
  ) {
    category = 'sports';
  } else if (
    lowerQ.includes('davido') || lowerQ.includes('burna') || lowerQ.includes('wizkid') || lowerQ.includes('tiwa') ||
    lowerQ.includes('afrobeats') || lowerQ.includes('afrobeat') || lowerQ.includes('amapiano') ||
    lowerQ.includes('highlife') || lowerQ.includes('makosa') || lowerQ.includes('concert') ||
    lowerQ.includes('grammy') || lowerQ.includes('music award') || lowerQ.includes('album') ||
    lowerQ.includes('hit song') || lowerQ.includes('chart')
  ) {
    category = 'afrobeats';
  } else if (
    lowerQ.includes('nollywood') || lowerQ.includes('genevieve') || lowerQ.includes('omotola') ||
    lowerQ.includes('nigerian film') || lowerQ.includes('africa magic') || lowerQ.includes('amvca') ||
    lowerQ.includes('movie') || lowerQ.includes('series') || lowerQ.includes('box office') ||
    lowerQ.includes('film award')
  ) {
    category = 'nollywood';
  } else if (
    lowerQ.includes('music') || lowerQ.includes('song') || lowerQ.includes('artist') || lowerQ.includes('band') ||
    lowerQ.includes('singer') || lowerQ.includes('rapper') || lowerQ.includes('playlist') ||
    lowerQ.includes('streaming') || lowerQ.includes('spotify') || lowerQ.includes('apple music')
  ) {
    category = 'music';
  } else if (
    lowerQ.includes('stock') || lowerQ.includes('share price') || lowerQ.includes('nse') || lowerQ.includes('jse') ||
    lowerQ.includes('investment') || lowerQ.includes('gdp') || lowerQ.includes('inflation') ||
    lowerQ.includes('interest rate') || lowerQ.includes('oil price') || lowerQ.includes('recession') ||
    lowerQ.includes('economy') || lowerQ.includes('market cap') || lowerQ.includes('ipo')
  ) {
    category = 'finance';
  } else if (
    lowerQ.includes('politics') || lowerQ.includes('government') || lowerQ.includes('minister') ||
    lowerQ.includes('policy') || lowerQ.includes('law') || lowerQ.includes('senate') ||
    lowerQ.includes('bill pass') || lowerQ.includes('constitution') || lowerQ.includes('coup') ||
    lowerQ.includes('parliament')
  ) {
    category = 'politics';
  } else if (
    lowerQ.includes('iphone') || lowerQ.includes('android') || lowerQ.includes('samsung') ||
    lowerQ.includes('startup') || lowerQ.includes('artificial intelligence') || lowerQ.includes(' ai ') ||
    lowerQ.includes('tech') || lowerQ.includes('app launch') || lowerQ.includes('5g') ||
    lowerQ.includes('internet') || lowerQ.includes('software') || lowerQ.includes('google') ||
    lowerQ.includes('apple') || lowerQ.includes('microsoft') || lowerQ.includes('meta')
  ) {
    category = 'tech';
  } else if (
    lowerQ.includes('rain') || lowerQ.includes('weather') || lowerQ.includes('flood') ||
    lowerQ.includes('drought') || lowerQ.includes('temperature') || lowerQ.includes('harmattan') ||
    lowerQ.includes('monsoon') || lowerQ.includes('hurricane') || lowerQ.includes('climate')
  ) {
    category = 'weather';
  } else if (
    lowerQ.includes('festival') || lowerQ.includes('tradition') || lowerQ.includes('culture') ||
    lowerQ.includes('heritage') || lowerQ.includes('carnival') || lowerQ.includes('award show') ||
    lowerQ.includes('arts') || lowerQ.includes('fashion') || lowerQ.includes('beauty')
  ) {
    category = 'culture';
  }
  
  // Suggest expiry based on keywords
  let suggestedExpiry = 7 * 24 * 60 * 60 * 1000; // Default: 1 week
  if (lowerQ.includes('today') || lowerQ.includes('tonight')) {
    suggestedExpiry = 24 * 60 * 60 * 1000; // 1 day
  } else if (lowerQ.includes('tomorrow')) {
    suggestedExpiry = 2 * 24 * 60 * 60 * 1000; // 2 days
  } else if (lowerQ.includes('this week')) {
    suggestedExpiry = 7 * 24 * 60 * 60 * 1000; // 1 week
  } else if (lowerQ.includes('this month') || lowerQ.includes('by march')) {
    suggestedExpiry = 30 * 24 * 60 * 60 * 1000; // 1 month
  }
  
  return {
    valid: true,
    category,
    suggestedExpiry,
  };
}

/**
 * Generate daily trends (local curated list)
 */
export async function generateDailyTrends(region: string): Promise<string[]> {
  const trendsByRegion: Record<string, string[]> = {
    'west-africa': [
      'Will Naira reach ₦2000 by end of March?',
      'Will Nigeria qualify for World Cup 2026?',
      'Will fuel price drop below ₦600 this month?',
      'Will Davido release new album before April?',
    ],
    'east-africa': [
      'Will M-Pesa transaction fees decrease?',
      'Will Kenya Shilling strengthen against USD?',
      'Will Harambee Stars win their next match?',
      'Will Nairobi rainfall exceed last year?',
    ],
    'southern-africa': [
      'Will load shedding end by June?',
      'Will Rand recover to R16 per USD?',
      'Will Bafana Bafana win AFCON 2025?',
      'Will gold price exceed $2100?',
    ],
    'latin-america': [
      'Will Bitcoin reach $100K by April?',
      'Will Real strengthen against Dollar?',
      'Will Argentina win Copa América?',
      'Will Amazon deforestation decrease?',
    ],
    'south-asia': [
      'Will Rupee stabilize below 85 per USD?',
      'Will IPL final break viewership records?',
      'Will monsoon arrive early this year?',
      'Will Sensex cross 80,000?',
    ],
    default: [
      'Will oil price rise above $90?',
      'Will global inflation drop below 3%?',
      'Will next UN climate summit succeed?',
      'Will remittance fees decrease globally?',
    ],
  };
  
  return trendsByRegion[region] || trendsByRegion.default;
}
