import { RadioStation, DJ } from '../types/radio';

// DJs for each station
const DJS: Record<string, DJ> = {
  'dj-kunle': {
    id: 'dj-kunle',
    name: 'DJ Kunle',
    avatar: '',
    wallet: 'DJKunL3wAF8vRQp5dN4xBj9mZ7YtKJ2sPvfCqHkE1abc',
    totalTips: 0,
    genre: 'Afrobeats',
  },
  'dj-amara': {
    id: 'dj-amara',
    name: 'DJ Amara',
    avatar: '',
    wallet: 'DJAmaR4xBF9vSQq6eM5xCk0nZ8YuLK3tQwgDrIjF2def',
    totalTips: 0,
    genre: 'Bongo Flava',
  },
  'dj-thabo': {
    id: 'dj-thabo',
    name: 'DJ Thabo',
    avatar: '',
    wallet: 'DJThaB5yCG0wTRr7fN6yDl1oA9ZvMM4uRxhEsJkG3ghi',
    totalTips: 0,
    genre: 'Amapiano',
  },
};

// Demo stream URLs — verified working free Icecast/Shoutcast streams
// Each URL was tested with curl to confirm actual audio data delivery.
// Replace with actual Livepeer/IPFS streams in production.
const DEMO_STREAMS: Record<string, string> = {
  // West Africa → 181.fm The Beat (hip-hop, R&B, urban — Afrobeats adjacent)
  'west-africa': 'http://listen.181fm.com/181-beat_128k.mp3',
  // East Africa → SomaFM Illstreet (old-school hip-hop & soul — Bongo Flava adjacent)
  'east-africa': 'http://ice1.somafm.com/illstreet-128-mp3',
  // Southern Africa → SomaFM DEF CON (electronic/house — Amapiano adjacent)
  'southern-africa': 'http://ice1.somafm.com/defcon-128-mp3',
  // Latin America → 181.fm Power (pop/dance — Latin pop adjacent)
  'latin-america': 'http://listen.181fm.com/181-power_128k.mp3',
  // South Asia → SomaFM Suburbs of Goa (Indian electronica & world)
  'south-asia': 'http://ice1.somafm.com/suburbsofgoa-128-mp3',
  // Southeast Asia → 181.fm The Beat (pop/urban)
  'southeast-asia': 'http://listen.181fm.com/181-beat_128k.mp3',
  // MENA → SomaFM Groove Salad (ambient/chill — diverse world sounds)
  'mena': 'http://ice1.somafm.com/groovesalad-128-mp3',
  // Caribbean → UK Roots FM (reggae, dub, dancehall)
  'caribbean': 'http://138.201.198.218:8043/stream',
  // Pacific → SomaFM Groove Salad (ambient/chill — island vibes)
  'pacific': 'http://ice1.somafm.com/groovesalad-128-mp3',
};

export const RADIO_STATIONS: RadioStation[] = [
  {
    id: 'west-africa',
    name: 'Ilowa West Africa',
    region: 'west-africa',
    streamUrl: process.env.EXPO_PUBLIC_RADIO_WEST_AFRICA_URL || DEMO_STREAMS['west-africa'],
    isLive: false,
    currentDJ: DJS['dj-kunle'],
    listenerCount: 127,
    schedule: [
      {
        id: 'wa-morning',
        djId: 'dj-kunle',
        djName: 'DJ Kunle',
        startTime: '08:00',
        endTime: '12:00',
        title: 'Morning Oracle',
        genre: 'Afrobeats + Predictions',
        isLive: false,
      },
      {
        id: 'wa-afternoon',
        djId: 'dj-kunle',
        djName: 'DJ Kunle',
        startTime: '12:00',
        endTime: '16:00',
        title: 'Afternoon Vibes',
        genre: 'Afrobeats + Highlife',
        isLive: false,
      },
      {
        id: 'wa-evening',
        djId: 'dj-kunle',
        djName: 'DJ Kunle',
        startTime: '16:00',
        endTime: '20:00',
        title: 'Evening Wisdom',
        genre: 'Juju + Elder Stories',
        isLive: false,
      },
      {
        id: 'wa-night',
        djId: 'ai-dj',
        djName: 'AI Elder Mix',
        startTime: '20:00',
        endTime: '08:00',
        title: 'Night Wisdom Loop',
        genre: 'Lo-fi Afrobeats',
        isLive: false,
      },
    ],
  },
  {
    id: 'east-africa',
    name: 'Ilowa East Africa',
    region: 'east-africa',
    streamUrl: process.env.EXPO_PUBLIC_RADIO_EAST_AFRICA_URL || DEMO_STREAMS['east-africa'],
    isLive: false,
    currentDJ: DJS['dj-amara'],
    listenerCount: 89,
    schedule: [
      {
        id: 'ea-morning',
        djId: 'dj-amara',
        djName: 'DJ Amara',
        startTime: '08:00',
        endTime: '14:00',
        title: 'Swahili Sunrise',
        genre: 'Bongo Flava + Gengetone',
        isLive: false,
      },
      {
        id: 'ea-afternoon',
        djId: 'dj-amara',
        djName: 'DJ Amara',
        startTime: '14:00',
        endTime: '20:00',
        title: 'Safari Sounds',
        genre: 'East African Mix',
        isLive: false,
      },
    ],
  },
  {
    id: 'southern-africa',
    name: 'Ilowa Southern Africa',
    region: 'southern-africa',
    streamUrl: process.env.EXPO_PUBLIC_RADIO_SOUTHERN_AFRICA_URL || DEMO_STREAMS['southern-africa'],
    isLive: false,
    currentDJ: DJS['dj-thabo'],
    listenerCount: 156,
    schedule: [
      {
        id: 'sa-morning',
        djId: 'dj-thabo',
        djName: 'DJ Thabo',
        startTime: '08:00',
        endTime: '14:00',
        title: 'Ubuntu Morning',
        genre: 'Amapiano + Kwaito',
        isLive: false,
      },
      {
        id: 'sa-afternoon',
        djId: 'dj-thabo',
        djName: 'DJ Thabo',
        startTime: '14:00',
        endTime: '20:00',
        title: 'Township Vibes',
        genre: 'South African House',
        isLive: false,
      },
    ],
  },
  {
    id: 'latin-america',
    name: 'Ilowa Latin America',
    region: 'latin-america',
    streamUrl: process.env.EXPO_PUBLIC_RADIO_LATIN_AMERICA_URL || DEMO_STREAMS['latin-america'],
    isLive: false,
    listenerCount: 73,
    schedule: [],
  },
  {
    id: 'south-asia',
    name: 'Ilowa South Asia',
    region: 'south-asia',
    streamUrl: process.env.EXPO_PUBLIC_RADIO_SOUTH_ASIA_URL || DEMO_STREAMS['south-asia'],
    isLive: false,
    listenerCount: 201,
    schedule: [],
  },
  {
    id: 'southeast-asia',
    name: 'Ilowa Southeast Asia',
    region: 'southeast-asia',
    streamUrl: process.env.EXPO_PUBLIC_RADIO_SOUTHEAST_ASIA_URL || DEMO_STREAMS['southeast-asia'],
    isLive: false,
    listenerCount: 45,
    schedule: [],
  },
  {
    id: 'mena',
    name: 'Ilowa MENA',
    region: 'mena',
    streamUrl: process.env.EXPO_PUBLIC_RADIO_MENA_URL || DEMO_STREAMS['mena'],
    isLive: false,
    listenerCount: 112,
    schedule: [],
  },
  {
    id: 'caribbean',
    name: 'Ilowa Caribbean',
    region: 'caribbean',
    streamUrl: process.env.EXPO_PUBLIC_RADIO_CARIBBEAN_URL || DEMO_STREAMS['caribbean'],
    isLive: false,
    listenerCount: 67,
    schedule: [],
  },
  {
    id: 'pacific',
    name: 'Ilowa Pacific',
    region: 'pacific',
    streamUrl: process.env.EXPO_PUBLIC_RADIO_PACIFIC_URL || DEMO_STREAMS['pacific'],
    isLive: false,
    listenerCount: 34,
    schedule: [],
  },
];

// XMTP chat room addresses for each station
export const RADIO_CHAT_ADDRESSES: Record<string, string> = {
  'west-africa': '', // Configure at deployment
  'east-africa': '',
  'southern-africa': '',
  'latin-america': '',
  'south-asia': '',
  'southeast-asia': '',
  'mena': '',
  'caribbean': '',
  'pacific': '',
};
