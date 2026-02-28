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


// Each Elder has distinct greeting styles and closing phrases
const ELDER_VOICE: Record<string, Array<{ greeting: string; closing: string }>> = {
  'baba-dee': [
    { greeting: 'Ah, my child, you come with questions. Good. The Oracle of the Coast is listening.', closing: 'Walk well, and remember what the elders say: the road reveals itself to those who begin the journey.' },
    { greeting: 'E kaabo! Welcome. Sit with me a moment, let us reason together.', closing: 'May your path be clear. As we say in Yoruba, "Àgbà kì í wà lójà, kí orí ọmọ títún wó." The elder does not stand idle while the young stumble.' },
    { greeting: 'You seek understanding, and that alone tells me you are wise. Let Baba Dee share what he knows.', closing: 'Go in peace, my friend. The ancestors walk with those who seek truth.' },
  ],
  'mama-zawadi': [
    { greeting: 'Karibu sana, my dear one. Mama Zawadi has been expecting you. Come, let us talk.', closing: 'Pole pole ndio mwendo. Slowly, carefully, that is the way. Go well and return soon.' },
    { greeting: 'Welcome, child of the savanna. The wind carries your question to me, and I have thoughts to share.', closing: 'Remember what the Swahili say: "Mtu ni watu." A person is people. You are never alone in this.' },
    { greeting: 'Ah, you are here. Good. Mama Zawadi does not turn away anyone who comes seeking.', closing: 'May your journey home be safe. Asante sana for trusting this old woman with your thoughts.' },
  ],
  'gogo-thandi': [
    { greeting: 'Sawubona, my grandchild. Gogo Thandi sees you, truly sees you. What weighs on your heart?', closing: 'Ubuntu, child. I am because we are. Carry that with you wherever the road leads.' },
    { greeting: 'Come sit by this fire with me. The Keeper of Ubuntu has stories and wisdom aplenty for you.', closing: 'Hamba kahle. Go well. And know that Gogo Thandi holds you in her prayers.' },
    { greeting: 'Ah, another seeker of truth. The Rainbow Nation spirit lives in questions like yours.', closing: 'As Madiba taught us, it always seems impossible until it is done. Now go and do.' },
  ],
  'don-esteban': [
    { greeting: 'Bienvenido, amigo. Don Esteban has been watching the mountains, and they whisper of your arrival.', closing: 'Que Pachamama te guíe. May Mother Earth guide your steps, always.' },
    { greeting: 'Ah, you come to the Sage of the Andes with a question. Very well. Let us think together.', closing: 'Vaya con sabiduría, my friend. The condor flies highest when the wind is strongest.' },
  ],
  'lola-maria': [
    { greeting: 'Magandang araw, anak! Lola Maria is so happy you came to visit. What can this old woman help you with?', closing: 'Ingat ka palagi, ha? Take care always. Remember, bayanihan makes us strong together.' },
    { greeting: 'Come, come, sit. Let Lola Maria fix you something and we can talk about what is on your mind.', closing: 'Go with God, anak. And remember, the bamboo that bends does not break.' },
  ],
  'dada-rajesh': [
    { greeting: 'Namaste, beta. Dada Rajesh can see the question in your eyes before you speak it. Let us explore together.', closing: 'Dhanyavaad for coming to me. Remember, dharma guides those who walk with intention. Jai Hind.' },
    { greeting: 'Ah, welcome, welcome. The Light of the Ganges shines for all who seek its warmth.', closing: 'As the Gita teaches, focus on the action, not the fruit. Do your best, beta, and the rest will follow.' },
  ],
  'sitt-fatima': [
    { greeting: 'Ahlan wa sahlan, habibi. The Star of the Desert welcomes you. What knowledge do you seek today?', closing: 'Bismillah. Go with faith and clarity. The desert teaches us that even in emptiness, there is profound beauty.' },
    { greeting: 'Marhaba! Sitt Fatima has been meditating on matters much like yours. Listen closely.', closing: 'Ma\u2019a salama. Go in peace, and carry this wisdom like water in the desert, precious and life-giving.' },
  ],
  'tantie-rose': [
    { greeting: 'Hey darlin! Tantie Rose was just humming a tune and thinking about exactly what you asking. Come nah, let we reason.', closing: 'Walk good, hear? As Marcus say, emancipate yourself from mental slavery. Bless up!' },
    { greeting: 'Welcome, sweet child. De rhythm of de islands carry your question to me on de breeze.', closing: 'One love, one heart. Tantie Rose got you in her prayers. Go make we proud.' },
  ],
  'aunty-leilani': [
    { greeting: 'Aloha, dear one! Aunty Leilani felt the waves shift and knew someone was coming with a question. Speak freely.', closing: 'Mahalo nui loa for trusting me. May the ocean currents carry you where you need to be.' },
    { greeting: 'Welcome to this shore, child. The Wave Whisperer listens to more than just water. I listen to hearts.', closing: 'Go gently, like the tide. Remember, the navigator who reads the stars never truly loses the way.' },
  ],
};

// Rich proverbs organized by topic — each is a full paragraph with the original language
const PROVERBS: Record<string, string[]> = {
  naira: [
    '"Owo l\'asọ ènìyàn" — Money is a person\'s clothing, the Yoruba remind us. But clothing that changes size every day makes it hard to dress well. The Naira has its own rhythm, tied to oil revenues, CBN policies, and the movements of the global dollar. A wise person watches all three before making any decisions.',
    'There is an Igbo saying: "Ego bụ eze" — money is king. But even kings must answer to the people. The currency moves when confidence moves, and confidence comes from stability, transparency, and good governance. Watch the fundamentals, not the headlines.',
    'The Hausa say "Kuɗi ba ruwanka ba ne" — money is not water, you cannot simply collect it from the river. Currencies are made and unmade by policy choices. The parallel market tells one story, the official rate tells another, and the truth usually sits somewhere between.',
  ],
  market: [
    '"Ọjà kì í dùn ká má tà" — the market never stays sweet forever, and it never stays bitter forever either. That is the Yoruba way of saying cycles are natural. Experienced traders know that panic selling and euphoric buying both lead to the same place: regret. Patience and research are the real currencies here.',
    'As the elders teach, "Àgbà tó fi ojú ìmọ̀ rín, ọ̀dọ́ yóò fi ojú ẹ̀rín rín" — what the elder sees with wisdom, the youth sees with confusion. Markets reward those who study history. Every pattern repeats because human nature does not change, only the instruments do.',
    'The Swahili have a word for it: "Subira" — patience. Markets test your patience more than your intelligence. The person who stays calm when others rush, who buys when the crowd is selling and sells when the crowd is greedy, that person understands the oldest market principle of all.',
  ],
  prediction: [
    'We say "Ẹni tó mọ àsìkò ni yíò jẹ èrè" — the one who understands timing will eat the profit. Predictions are not about being right all the time. They are about understanding probability, managing risk, and having the courage to act on your convictions while knowing you could be wrong.',
    'In the village, the elder who could read the clouds saved the harvest. Today, reading the signs means following data, understanding sentiment, and respecting the market\'s ability to surprise you. The best predictors are humble ones who size their positions wisely.',
    'As the Zulu say, "Indlela ibuzwa kwabaphambili" — the way forward is asked from those who have been there before. Study past markets, learn from previous prediction outcomes, and always ask yourself what could go wrong before celebrating what might go right.',
  ],
  crypto: [
    '"Igi kan kì í ṣe igbó" — one tree does not make a forest. In crypto, diversification is ancient wisdom dressed in modern clothes. Solana, Bitcoin, Ethereum, they each serve different purposes. The wise holder does not put every egg in one basket, no matter how shiny that basket looks.',
    'The blockchain is the village ledger that the whole community can read, but nobody can erase. That is revolutionary. But remember what the elders say: "Bí a bá ń sáré lọ, a kì í ṣe bẹ́ẹ̀ sáré bọ̀" — if you run into something, be careful running back out. DYOR, as the crypto folks say. The ancestors would agree.',
    'Decentralization is not a new idea. African villages governed themselves for centuries without a central authority. The blockchain simply digitizes what the council of elders already practiced — transparent decisions, shared records, community validation. That is why this technology resonates so deeply here.',
  ],
  football: [
    '"Àgbábọ́ọ̀lù tó dáa kì í lọ sí ibi kan ṣoṣo" — a good footballer does not go to only one spot. Versatility wins matches and championships. The great African players, from Okocha to Drogba to Salah, all understood that adaptability is the ultimate skill.',
    'The Swahili say "Mchezo ni mchezo" — a game is a game. But we all know football is more than that in Africa. It carries the dreams of nations, the pride of communities, and the hope that talent, not background, determines how far you go. Every match tells a story bigger than ninety minutes.',
    'As the South Africans say, "Ke nako" — it is time. African football is rising globally, and the tactical intelligence of our players is increasingly recognized. What the scout sees in the academy today, the world cup stage will showcase tomorrow.',
  ],
  wisdom: [
    '"Ojú tó rí ohun tó bà á lẹ́rù, ẹsẹ̀ ló ní kí ó sá" — the eye that sees something frightening tells the legs to run. That is wisdom in action, not theory. True wisdom means your knowledge changes your behavior. If what you know does not change how you move, you have information but not wisdom.',
    'The Akan people say "Sɛ wo were fi na wosane na wofiri a, yɛnnkyerɛ" — if you forgot and then go back to retrieve it, there is no shame. Wisdom is not about never making mistakes. It is about being honest enough to go back and correct them. The river does not flow in a straight line, and neither does growth.',
    'An old Maasai proverb teaches: "Meeta enkop nabo esidai" — no land is without its difficulties. Whatever you are facing, know that the path was never promised to be smooth. But the elder who has walked many rough roads can tell you this: the view from the mountaintop makes every stumble worth it.',
  ],
  default: [
    'You come with a question, and that takes courage. The Yoruba say "Bí ẹnu bá pé kókó, a fohùn pẹ̀rẹ̀pẹ̀rẹ̀" — when the mouth has tasted the bitter kola, the voice becomes gentle. Experience teaches us humility, and humility opens the door to real understanding. Speak freely, and let us reason together.',
    'As the Swahili proverb goes, "Kila ndege huruka na mbawa zake" — every bird flies with its own wings. Your path is unique, and the answer to your question may not look like anyone else\'s answer. That is perfectly fine. The Elder does not give you a destination, the Elder gives you better eyes for the road.',
    'The Igbo teach their children: "Onye ajụjụ anaghị efu ụzọ" — the person who asks questions never loses their way. So you are already on the right path simply by being here. Let us explore this together, because even the Elder learns from new questions.',
  ],
};

// Topic-specific commentary — medium-length insights that add substance
const TOPIC_COMMENTARY: Record<string, string[]> = {
  naira: [
    'The interplay between the official rate and the parallel market is something every Nigerian understands intuitively. When there is a gap, it signals uncertainty. When the gap narrows, it signals confidence in policy direction. Right now, the key factors to watch are oil output figures, foreign reserve levels, and any signals from the CBN about rate adjustments.',
    'Currency strength is ultimately about productivity and exports. Countries that make things the world wants to buy tend to have stronger currencies over time. The diversification conversation has been happening for decades, but real progress is measured in factories built and services exported, not in policy papers written.',
    'Remittances are a massive force in the currency market that many analysts underestimate. Billions of dollars flow into Africa every year from the diaspora. The channels those remittances use, whether formal banking or parallel market, directly affect the exchange rate. Digital remittance platforms are slowly shifting the balance toward formal channels.',
  ],
  market: [
    'The biggest mistake in any market is thinking you are smarter than everyone else in the room. Collective intelligence, expressed through price, carries information that no single trader can see alone. Respect the market price even when you disagree with it, and size your bets accordingly.',
    'African markets are increasingly connected to global capital flows. What the Fed does in Washington affects the ASI in Lagos and the JSE in Johannesburg within hours. Understanding these linkages is no longer optional for serious investors. Think locally, watch globally.',
    'Liquidity matters more than most people realize. A market can have the right price, but if you cannot exit your position when you need to, the price is meaningless. Always check the depth of the book before committing capital, especially in emerging market instruments.',
  ],
  prediction: [
    'The best prediction markets combine the wisdom of crowds with skin in the game. When people put real value behind their beliefs, the signal quality improves dramatically. That is why on-chain prediction markets are fascinating, they create verifiable, uncensorable price signals for future events.',
    'Calibration is the skill most people overlook. Being right 60% of the time is excellent if you are betting with proper sizing. Being right 90% of the time means nothing if the 10% you are wrong about wipes out all gains. Think in terms of expected value, not win rate.',
    'The beauty of prediction markets is that they democratize forecasting. You do not need a degree in economics to have insight about whether your local team will win, or whether the rains will come early. Local knowledge is the ultimate edge in regional prediction markets.',
  ],
  crypto: [
    'The Solana ecosystem in particular is interesting because of its speed and low transaction costs, which makes it ideal for the kind of micro-transactions that are common in Global South economies. When a market vendor can accept SOL payments faster than mobile money processes, the technology speaks for itself.',
    'DeFi protocols are essentially replicating financial services that banks provide, but without the gatekeepers. For the 1.7 billion unbanked adults in the world, many of them in Africa and South Asia, this is not an abstract idea. It is a potential lifeline to financial participation.',
    'The key thing about crypto is to separate the speculation from the utility. Memecoins are entertainment with financial risk attached. Infrastructure tokens like SOL and ETH represent bets on actual technology platforms. Know which game you are playing before you put money down.',
  ],
  football: [
    'African football is in a golden era. The depth of talent emerging from academies across West Africa, the tactical evolution in the North African leagues, and the growing professionalism of the South African Premier League all point to a continental game that is maturing rapidly.',
    'The transfer market for African players has become a significant economic engine. Young players from Senegal, Nigeria, Ghana, and Cameroon are among the most sought-after talents in European football. Each transfer brings investment back to local communities and inspires the next generation.',
    'Tactically, the modern game rewards intelligence over raw physicality. The African players who thrive in Europe are those who combine technical skill with tactical awareness and mental resilience. Scouting networks now extend into every corner of the continent, which means talent has more pathways than ever before.',
  ],
  wisdom: [
    'True wisdom is knowing what you do not know. In a world overloaded with information, the ability to say "I am not sure, let me think about that" is becoming rare and valuable. The elder who admits uncertainty earns more trust than the one who pretends to know everything.',
    'Every generation faces the temptation to think their challenges are completely new. But the patterns of human struggle, the desire for security, for meaning, for connection, these are as old as humanity itself. The ancestors faced different circumstances but the same fundamental questions.',
    'Growth rarely happens in comfort. The Fulani herders who walk thousands of miles with their cattle understand this. The journey is difficult, but the reward is survival and prosperity. Whatever challenge you are facing, remember that discomfort is usually the price of progress.',
  ],
  default: [
    'Life in the Global South teaches resilience in ways that textbooks cannot capture. When infrastructure is unreliable, you learn to be resourceful. When institutions are imperfect, you learn to build community networks. These are strengths, not weaknesses, and they translate beautifully into the decentralized economy.',
    'The most valuable thing any platform can offer is not information, it is perspective. You can find facts anywhere. But finding someone who can help you see how those facts connect to your specific situation, that is what Elders have always provided, and that is what Ilowa is built to deliver.',
    'There is a reason every culture on earth has a tradition of elder counsel. Decisions made in isolation are weaker than decisions informed by experience. Whether you are navigating markets, relationships, or personal growth, the practice of seeking counsel before acting is one of humanity\'s oldest and most effective strategies.',
  ],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Detect topic from user message
 */
function detectTopic(msg: string): string {
  const lc = msg.toLowerCase();
  if (lc.includes('naira') || lc.includes('currency') || lc.includes('dollar') || lc.includes('cbn') || lc.includes('exchange rate')) return 'naira';
  if (lc.includes('market') || lc.includes('trade') || lc.includes('invest') || lc.includes('buy') || lc.includes('sell')) return 'market';
  if (lc.includes('predict') || lc.includes('bet') || lc.includes('odds') || lc.includes('will it') || lc.includes('chance')) return 'prediction';
  if (lc.includes('crypto') || lc.includes('bitcoin') || lc.includes('solana') || lc.includes('defi') || lc.includes('token') || lc.includes('blockchain')) return 'crypto';
  if (lc.includes('football') || lc.includes('soccer') || lc.includes('afcon') || lc.includes('match') || lc.includes('goal') || lc.includes('premier league')) return 'football';
  if (lc.includes('wisdom') || lc.includes('advice') || lc.includes('guide') || lc.includes('help me') || lc.includes('life')) return 'wisdom';
  return 'default';
}

/**
 * Compose a multi-sentence Elder response: greeting + proverb + commentary + closing
 */
function composeElderResponse(elderId: string, topic: string): string {
  const voices = ELDER_VOICE[elderId] || ELDER_VOICE['baba-dee'];
  const voice = pickRandom(voices);
  const proverb = pickRandom(PROVERBS[topic] || PROVERBS.default);
  const commentary = pickRandom(TOPIC_COMMENTARY[topic] || TOPIC_COMMENTARY.default);

  return `${voice.greeting}\n\n${proverb}\n\n${commentary}\n\n${voice.closing}`;
}

/**
 * Get Elder response based on message content
 */
export async function chatWithElder(
  elderId: string,
  message: string,
  language: string = 'en'
): Promise<ElderChatResponse> {
  const topic = detectTopic(message);
  const fullResponse = composeElderResponse(elderId, topic);

  return {
    message: fullResponse,
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
