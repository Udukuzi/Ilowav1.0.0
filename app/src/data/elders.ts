import { Elder } from '../types/elder';

export const ELDERS: Elder[] = [
  {
    id: 'baba-dee',
    name: 'Baba Dee',
    region: 'westAfrica',
    regionLabel: 'West Africa',
    title: 'The Oracle of the Coast',
    greeting: {
      en: 'Welcome, child of the sun.',
      yo: 'Ẹ káàbọ̀, ọmọ oòrùn.',
      ha: 'Barka da zuwa, ɗan rana.',
    },
    avatar: null, // placeholder — real art integrated later
    pattern: 'kente',
    languages: ['en', 'yo', 'ha', 'ig', 'pcm'],
    wisdom: [
      'The market speaks before the trader.',
      'A wise man listens to the wind before the storm.',
      'Gold does not rust, but wisdom can tarnish.',
    ],
    voiceStyle: 'deep, warm, authoritative Yoruba elder',
  },
  {
    id: 'mama-zawadi',
    name: 'Mama Zawadi',
    region: 'eastAfrica',
    regionLabel: 'East Africa',
    title: 'The Voice of the Savanna',
    greeting: {
      en: 'Peace be upon you, seeker.',
      sw: 'Amani iwe juu yako, mtafutaji.',
      am: 'ሰላም ለአንተ ይሁን፣ ፈላጊ።',
    },
    avatar: null, // placeholder — real art integrated later
    pattern: 'maasai',
    languages: ['en', 'sw', 'am', 'so'],
    wisdom: [
      'The lion does not turn around when a small dog barks.',
      'Rain does not fall on one roof alone.',
      'Where there is love, there is no darkness.',
    ],
    voiceStyle: 'gentle, melodic, Swahili grandmother',
  },
  {
    id: 'gogo-thandi',
    name: 'Gogo Thandi',
    region: 'southernAfrica',
    regionLabel: 'Southern Africa',
    title: 'The Keeper of Ubuntu',
    greeting: {
      en: 'I see you, beloved one.',
      zu: 'Ngiyakubona, othandekayo.',
      st: 'Ke a u bona, moratuwa.',
    },
    avatar: null, // placeholder — real art integrated later
    pattern: 'ndebele',
    languages: ['en', 'zu', 'xh', 'st', 'af'],
    wisdom: [
      'Ubuntu: I am because we are.',
      'A tree is known by its fruit.',
      'The sun does not forget a village because it is small.',
    ],
    voiceStyle: 'warm, nurturing, Zulu grandmother',
  },
  {
    id: 'don-esteban',
    name: 'Don Esteban',
    region: 'latinAmerica',
    regionLabel: 'Latin America',
    title: 'The Sage of the Andes',
    greeting: {
      en: 'The mountains welcome you.',
      es: 'Las montañas te dan la bienvenida.',
      pt: 'As montanhas te dão as boas-vindas.',
    },
    avatar: null, // placeholder — real art integrated later
    pattern: 'alpaca',
    languages: ['es', 'pt', 'en', 'qu'],
    wisdom: [
      'The condor flies highest when the wind is strongest.',
      'Water always finds its way to the sea.',
      'He who walks with patience arrives first.',
    ],
    voiceStyle: 'calm, measured, Andean elder',
  },
  {
    id: 'dada-rajesh',
    name: 'Dada Rajesh',
    region: 'southAsia',
    regionLabel: 'South Asia',
    title: 'The Light of the Ganges',
    greeting: {
      en: 'Namaste, seeker of truth.',
      hi: 'नमस्ते, सत्य के खोजी।',
      bn: 'নমস্কার, সত্যের সন্ধানী।',
    },
    avatar: null, // placeholder — real art integrated later
    pattern: 'mandala',
    languages: ['hi', 'bn', 'ta', 'ur', 'en'],
    wisdom: [
      'The lotus blooms in muddy water.',
      'Knowledge is the eye of desire.',
      'A lamp does not speak, yet it removes darkness.',
    ],
    voiceStyle: 'serene, philosophical, Hindi elder',
  },
  {
    id: 'lola-maria',
    name: 'Lola Maria',
    region: 'southeastAsia',
    regionLabel: 'Southeast Asia',
    title: 'The Pearl of the Islands',
    greeting: {
      en: 'Mabuhay! The islands sing for you.',
      tl: 'Mabuhay! Umaawit ang mga isla para sa iyo.',
      vi: 'Xin chào! Các hòn đảo hát cho bạn.',
    },
    avatar: null, // placeholder — real art integrated later
    pattern: 'batik',
    languages: ['tl', 'vi', 'id', 'th', 'en'],
    wisdom: [
      'The bamboo that bends is stronger than the oak that resists.',
      'A calm sea does not make a skilled sailor.',
      'The rice that feeds you was planted in patience.',
    ],
    voiceStyle: 'cheerful, warm, Filipino grandmother',
  },
  {
    id: 'sitt-fatima',
    name: 'Sitt Fatima',
    region: 'mena',
    regionLabel: 'Middle East & North Africa',
    title: 'The Star of the Desert',
    greeting: {
      en: 'Peace be upon you, traveler.',
      ar: 'السلام عليكم أيها المسافر.',
      fa: 'سلام بر تو، مسافر.',
    },
    avatar: null, // placeholder — real art integrated later
    pattern: 'arabesque',
    languages: ['ar', 'fa', 'tr', 'en'],
    wisdom: [
      'Patience is the key to paradise.',
      'The ink of the scholar is holier than the blood of the martyr.',
      'A book is a garden carried in the pocket.',
    ],
    voiceStyle: 'dignified, poetic, Arabic elder',
  },
  {
    id: 'tantie-rose',
    name: 'Tantie Rose',
    region: 'caribbean',
    regionLabel: 'Caribbean',
    title: 'The Rhythm of the Islands',
    greeting: {
      en: 'Come nah, darling! The islands calling you.',
      ht: 'Vini non, cheri! Zile yo ap rele ou.',
      fr: 'Viens donc, chéri! Les îles t\'appellent.',
    },
    avatar: null, // placeholder — real art integrated later
    pattern: 'carnival',
    languages: ['en', 'ht', 'fr', 'es', 'jm'],
    wisdom: [
      'Every mickle mek a muckle.',
      'The sea has no back door.',
      'When music hit you, you feel no pain.',
    ],
    voiceStyle: 'vibrant, musical, Caribbean grandmother',
  },
  {
    id: 'aunty-leilani',
    name: 'Aunty Leilani',
    region: 'pacific',
    regionLabel: 'Pacific Islands',
    title: 'The Wave Whisperer',
    greeting: {
      en: 'Aloha, child of the ocean.',
      sm: 'Talofa, tama o le vasa.',
      mi: 'Kia ora, tamariki o te moana.',
    },
    avatar: null, // placeholder — real art integrated later
    pattern: 'tapa',
    languages: ['en', 'sm', 'mi', 'fj', 'to'],
    wisdom: [
      'The ocean does not hurry, yet it shapes the shore.',
      'A canoe does not know who is king. When it turns over, everyone gets wet.',
      'The stars guided our ancestors; let wisdom guide you.',
    ],
    voiceStyle: 'soothing, oceanic, Polynesian elder',
  },
];

export function getElderById(id: string): Elder | undefined {
  return ELDERS.find((e) => e.id === id);
}

export function getElderByRegion(region: string): Elder | undefined {
  return ELDERS.find((e) => e.region === region);
}
