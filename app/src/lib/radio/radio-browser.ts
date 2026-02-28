/**
 * Radio Browser API Client
 *
 * Free, open API — no auth required.
 * Docs: https://de2.api.radio-browser.info/
 * Provides 40,000+ stations searchable by country, tag, language, etc.
 */

import { BrowseStation } from '../../types/radio';

// Hardcoded server list (avoids DNS lookup which can fail in Expo Go)
const API_SERVERS = [
  'https://de2.api.radio-browser.info',
  'https://fi1.api.radio-browser.info',
  'https://de1.api.radio-browser.info',
];

const USER_AGENT = 'Ilowa/1.0';

// ── Region → Country Code Mapping ─────────────────────────────
// Maps each Ilowa region to ISO 3166-1 alpha-2 country codes
// covering the Global South. Ordered by population/radio density.
export const REGION_COUNTRIES: Record<string, string[]> = {
  'west-africa': ['NG', 'GH', 'SN', 'CI', 'ML', 'BF', 'NE', 'GM', 'SL', 'LR', 'TG', 'BJ', 'GW'],
  'east-africa': ['KE', 'TZ', 'UG', 'ET', 'RW', 'BI', 'SO', 'ER', 'DJ', 'SS', 'MG'],
  'southern-africa': ['ZA', 'ZW', 'MZ', 'BW', 'NA', 'ZM', 'MW', 'LS', 'SZ', 'AO'],
  'latin-america': ['BR', 'MX', 'CO', 'AR', 'PE', 'VE', 'CL', 'EC', 'BO', 'PY', 'UY', 'GT', 'HN', 'SV', 'CR', 'PA', 'NI', 'DO'],
  'south-asia': ['IN', 'PK', 'BD', 'LK', 'NP', 'AF'],
  'southeast-asia': ['ID', 'PH', 'VN', 'TH', 'MM', 'MY', 'KH', 'LA', 'SG'],
  'mena': ['EG', 'MA', 'DZ', 'TN', 'IQ', 'SA', 'AE', 'JO', 'LB', 'PS', 'LY', 'SD', 'YE', 'OM', 'KW', 'BH', 'QA'],
  'caribbean': ['JM', 'TT', 'HT', 'CU', 'BB', 'BS', 'GY', 'SR', 'BZ', 'AG', 'DM', 'GD', 'KN', 'LC', 'VC'],
  'pacific': ['FJ', 'PG', 'WS', 'TO', 'VU', 'SB', 'KI', 'FM', 'MH', 'PW', 'NR', 'TV', 'NZ', 'AU'],
};

// Tags to prefer per region (used for sorting relevance)
const REGION_PREFERRED_TAGS: Record<string, string[]> = {
  'west-africa': ['afrobeats', 'afro', 'highlife', 'afropop', 'naija', 'hiplife', 'juju'],
  'east-africa': ['bongo', 'gengetone', 'benga', 'swahili', 'afro', 'gospel'],
  'southern-africa': ['amapiano', 'kwaito', 'gqom', 'house', 'afro house', 'gospel', 'maskandi'],
  'latin-america': ['reggaeton', 'salsa', 'cumbia', 'bachata', 'merengue', 'latin', 'tropical', 'samba', 'bossa nova'],
  'south-asia': ['bollywood', 'hindi', 'filmi', 'bhangra', 'tamil', 'telugu', 'desi'],
  'southeast-asia': ['pop', 'dangdut', 'opm', 'thai', 'vietnamese'],
  'mena': ['arabic', 'rai', 'khaliji', 'dabke', 'oriental', 'quran'],
  'caribbean': ['reggae', 'dancehall', 'soca', 'calypso', 'kompa', 'zouk'],
  'pacific': ['island', 'pacific', 'reggae', 'polynesian'],
};

// ── Global Genre Categories ─────────────────────────────────────
// Available to all users regardless of region
export const GLOBAL_GENRES: { id: string; name: string; icon: string; tags: string[] }[] = [
  { id: 'lofi', name: 'Lofi', icon: '🎧', tags: ['lofi', 'lo-fi', 'chillhop', 'study'] },
  { id: 'lofi-jazz', name: 'Lofi Jazz', icon: '🎷', tags: ['lofi jazz', 'jazz hop', 'nu jazz', 'smooth jazz'] },
  { id: 'hiphop', name: 'Hip-Hop', icon: '🎤', tags: ['hip hop', 'hiphop', 'rap', 'urban'] },
  { id: 'rnb', name: 'R&B / Soul', icon: '💜', tags: ['rnb', 'r&b', 'soul', 'neo soul'] },
  { id: 'jazz', name: 'Jazz', icon: '🎺', tags: ['jazz', 'bebop', 'swing', 'blues'] },
  { id: 'electronic', name: 'Electronic', icon: '🎛️', tags: ['electronic', 'edm', 'house', 'techno', 'trance'] },
  { id: 'ambient', name: 'Ambient / Chill', icon: '🌙', tags: ['ambient', 'chill', 'chillout', 'downtempo', 'relaxation'] },
  { id: 'classical', name: 'Classical', icon: '🎻', tags: ['classical', 'orchestra', 'symphony', 'piano'] },
  { id: 'rock', name: 'Rock', icon: '🎸', tags: ['rock', 'indie', 'alternative', 'punk'] },
  { id: 'pop', name: 'Pop', icon: '🎵', tags: ['pop', 'top 40', 'hits', 'chart'] },
];

// ── Curated Regional Fallback Stations ─────────────────────────────────────
// Popular stations that may be missing from radio-browser.info
export const CURATED_STATIONS: Record<string, BrowseStation[]> = {
  'west-africa': [
    {
      stationuuid: 'curated-wazobia-fm',
      name: 'Wazobia FM 95.1 Lagos',
      url_resolved: 'https://stream.zeno.fm/4d61wprrp7zuv',
      favicon: 'https://wazobiafm.com/wp-content/uploads/2020/08/wazobia-fm-logo.png',
      tags: 'pidgin,naija,afrobeats,news,entertainment',
      country: 'Nigeria',
      countrycode: 'NG',
      language: 'pidgin',
      votes: 100,
      codec: 'MP3',
      bitrate: 128,
      clickcount: 50000,
      lastcheckok: 1,
    },
    {
      stationuuid: 'curated-cool-fm-lagos',
      name: 'Cool FM 96.9 Lagos',
      url_resolved: 'https://stream.zeno.fm/7x5f8sc3ap8uv',
      favicon: 'https://coolfm.ng/wp-content/uploads/2021/03/cool-fm-logo.png',
      tags: 'afrobeats,pop,hiphop,rnb',
      country: 'Nigeria',
      countrycode: 'NG',
      language: 'english',
      votes: 95,
      codec: 'MP3',
      bitrate: 128,
      clickcount: 45000,
      lastcheckok: 1,
    },
    {
      stationuuid: 'curated-naija-fm',
      name: 'Naija FM 102.7',
      url_resolved: 'https://stream.zeno.fm/rmc7a5f5pc0uv',
      favicon: '',
      tags: 'naija,afrobeats,highlife,pidgin',
      country: 'Nigeria',
      countrycode: 'NG',
      language: 'pidgin',
      votes: 80,
      codec: 'MP3',
      bitrate: 128,
      clickcount: 30000,
      lastcheckok: 1,
    },
    {
      stationuuid: 'curated-bbc-hausa',
      name: 'BBC Hausa',
      url_resolved: 'https://stream.live.vc.bbcmedia.co.uk/bbc_hausa_radio',
      favicon: 'https://www.bbc.com/favicon.ico',
      tags: 'news,hausa,bbc,talk',
      country: 'Nigeria',
      countrycode: 'NG',
      language: 'hausa',
      votes: 90,
      codec: 'MP3',
      bitrate: 96,
      clickcount: 40000,
      lastcheckok: 1,
    },
    {
      stationuuid: 'curated-citi-fm-ghana',
      name: 'Citi FM 97.3 Accra',
      url_resolved: 'https://stream.zeno.fm/atvb12h1d1zuv',
      favicon: '',
      tags: 'news,talk,ghana,highlife',
      country: 'Ghana',
      countrycode: 'GH',
      language: 'english',
      votes: 75,
      codec: 'MP3',
      bitrate: 128,
      clickcount: 25000,
      lastcheckok: 1,
    },
  ],
  'east-africa': [
    {
      stationuuid: 'curated-kiss-fm-kenya',
      name: 'Kiss FM Kenya',
      url_resolved: 'https://stream.zeno.fm/6xpnfw2dp98uv',
      favicon: '',
      tags: 'pop,afro,bongo,gengetone',
      country: 'Kenya',
      countrycode: 'KE',
      language: 'english,swahili',
      votes: 85,
      codec: 'MP3',
      bitrate: 128,
      clickcount: 35000,
      lastcheckok: 1,
    },
    {
      stationuuid: 'curated-classic-fm-kenya',
      name: 'Classic 105 Kenya',
      url_resolved: 'https://stream.zeno.fm/mbnfex5dp98uv',
      favicon: '',
      tags: 'oldies,rnb,soul,classic',
      country: 'Kenya',
      countrycode: 'KE',
      language: 'english',
      votes: 80,
      codec: 'MP3',
      bitrate: 128,
      clickcount: 30000,
      lastcheckok: 1,
    },
    {
      stationuuid: 'curated-bbc-swahili',
      name: 'BBC Swahili',
      url_resolved: 'https://stream.live.vc.bbcmedia.co.uk/bbc_swahili_radio',
      favicon: 'https://www.bbc.com/favicon.ico',
      tags: 'news,swahili,bbc,talk',
      country: 'Tanzania',
      countrycode: 'TZ',
      language: 'swahili',
      votes: 90,
      codec: 'MP3',
      bitrate: 96,
      clickcount: 38000,
      lastcheckok: 1,
    },
  ],
  'southern-africa': [
    {
      stationuuid: 'curated-metro-fm-sa',
      name: 'Metro FM South Africa',
      url_resolved: 'https://stream.zeno.fm/0fgcfae9yn8uv',
      favicon: '',
      tags: 'amapiano,kwaito,afro house,rnb',
      country: 'South Africa',
      countrycode: 'ZA',
      language: 'english,zulu',
      votes: 95,
      codec: 'MP3',
      bitrate: 128,
      clickcount: 50000,
      lastcheckok: 1,
    },
    {
      stationuuid: 'curated-ukhozi-fm',
      name: 'Ukhozi FM',
      url_resolved: 'https://stream.zeno.fm/yp8g8xhxf18uv',
      favicon: '',
      tags: 'zulu,gospel,maskandi,amapiano',
      country: 'South Africa',
      countrycode: 'ZA',
      language: 'zulu',
      votes: 90,
      codec: 'MP3',
      bitrate: 128,
      clickcount: 45000,
      lastcheckok: 1,
    },
  ],
  'latin-america': [
    {
      stationuuid: 'curated-globo-fm-brazil',
      name: 'Rádio Globo Brasil',
      url_resolved: 'https://stream.zeno.fm/z7rka3hu6p8uv',
      favicon: '',
      tags: 'brazilian,samba,mpb,pop',
      country: 'Brazil',
      countrycode: 'BR',
      language: 'portuguese',
      votes: 90,
      codec: 'MP3',
      bitrate: 128,
      clickcount: 45000,
      lastcheckok: 1,
    },
    {
      stationuuid: 'curated-los40-mexico',
      name: 'Los 40 México',
      url_resolved: 'https://stream.zeno.fm/0rp42wshfp8uv',
      favicon: '',
      tags: 'pop,latin,reggaeton,hits',
      country: 'Mexico',
      countrycode: 'MX',
      language: 'spanish',
      votes: 85,
      codec: 'MP3',
      bitrate: 128,
      clickcount: 40000,
      lastcheckok: 1,
    },
  ],
  'south-asia': [
    {
      stationuuid: 'curated-radio-mirchi',
      name: 'Radio Mirchi 98.3 FM',
      url_resolved: 'https://stream.zeno.fm/frkdzepxpf8uv',
      favicon: '',
      tags: 'bollywood,hindi,filmi,pop',
      country: 'India',
      countrycode: 'IN',
      language: 'hindi',
      votes: 95,
      codec: 'MP3',
      bitrate: 128,
      clickcount: 60000,
      lastcheckok: 1,
    },
    {
      stationuuid: 'curated-bbc-hindi',
      name: 'BBC Hindi',
      url_resolved: 'https://stream.live.vc.bbcmedia.co.uk/bbc_hindi_radio',
      favicon: 'https://www.bbc.com/favicon.ico',
      tags: 'news,hindi,bbc,talk',
      country: 'India',
      countrycode: 'IN',
      language: 'hindi',
      votes: 90,
      codec: 'MP3',
      bitrate: 96,
      clickcount: 50000,
      lastcheckok: 1,
    },
  ],
  'southeast-asia': [
    {
      stationuuid: 'curated-prambors-fm',
      name: 'Prambors FM Jakarta',
      url_resolved: 'https://stream.zeno.fm/4xu1d1q6498uv',
      favicon: '',
      tags: 'pop,indonesian,dangdut,hits',
      country: 'Indonesia',
      countrycode: 'ID',
      language: 'indonesian',
      votes: 85,
      codec: 'MP3',
      bitrate: 128,
      clickcount: 35000,
      lastcheckok: 1,
    },
  ],
  'mena': [
    {
      stationuuid: 'curated-nile-fm',
      name: 'Nile FM Egypt',
      url_resolved: 'https://stream.zeno.fm/z6h1ezhgup8uv',
      favicon: '',
      tags: 'arabic,pop,egyptian,hits',
      country: 'Egypt',
      countrycode: 'EG',
      language: 'arabic',
      votes: 85,
      codec: 'MP3',
      bitrate: 128,
      clickcount: 35000,
      lastcheckok: 1,
    },
    {
      stationuuid: 'curated-bbc-arabic',
      name: 'BBC Arabic',
      url_resolved: 'https://stream.live.vc.bbcmedia.co.uk/bbc_arabic_radio',
      favicon: 'https://www.bbc.com/favicon.ico',
      tags: 'news,arabic,bbc,talk',
      country: 'Egypt',
      countrycode: 'EG',
      language: 'arabic',
      votes: 92,
      codec: 'MP3',
      bitrate: 96,
      clickcount: 55000,
      lastcheckok: 1,
    },
  ],
  'caribbean': [
    {
      stationuuid: 'curated-irie-fm-jamaica',
      name: 'Irie FM Jamaica',
      url_resolved: 'https://stream.zeno.fm/5amc6k8vv98uv',
      favicon: '',
      tags: 'reggae,dancehall,ska,caribbean',
      country: 'Jamaica',
      countrycode: 'JM',
      language: 'english',
      votes: 90,
      codec: 'MP3',
      bitrate: 128,
      clickcount: 40000,
      lastcheckok: 1,
    },
    {
      stationuuid: 'curated-zip-fm-jamaica',
      name: 'ZIP 103 FM Jamaica',
      url_resolved: 'https://stream.zeno.fm/rqp7d8ra6g8uv',
      favicon: '',
      tags: 'dancehall,reggae,soca,hiphop',
      country: 'Jamaica',
      countrycode: 'JM',
      language: 'english',
      votes: 85,
      codec: 'MP3',
      bitrate: 128,
      clickcount: 35000,
      lastcheckok: 1,
    },
  ],
  'pacific': [
    {
      stationuuid: 'curated-fiji-one',
      name: 'Fiji One Radio',
      url_resolved: 'https://stream.zeno.fm/1a6x0ef47g8uv',
      favicon: '',
      tags: 'pacific,island,reggae,pop',
      country: 'Fiji',
      countrycode: 'FJ',
      language: 'english,fijian',
      votes: 70,
      codec: 'MP3',
      bitrate: 128,
      clickcount: 15000,
      lastcheckok: 1,
    },
  ],
};

// Simple in-memory cache: region -> { stations, fetchedAt }
const cache: Record<string, { stations: BrowseStation[]; fetchedAt: number }> = {};
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

let currentServerIndex = 0;

function getBaseUrl(): string {
  return API_SERVERS[currentServerIndex % API_SERVERS.length];
}

function rotateServer(): void {
  currentServerIndex = (currentServerIndex + 1) % API_SERVERS.length;
}

/**
 * Fetch stations from radio-browser.info for a single country code.
 */
async function fetchByCountryCode(
  countryCode: string,
  limit: number = 30,
  offset: number = 0,
): Promise<BrowseStation[]> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/json/stations/bycountrycodeexact/${countryCode}?hidebroken=true&order=clickcount&reverse=true&limit=${limit}&offset=${offset}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
    },
  });

  if (!res.ok) {
    throw new Error(`radio-browser API error: ${res.status}`);
  }

  return res.json();
}

/**
 * Fetch stations for an Ilowa region.
 * Merges curated stations (always at top) with API results,
 * prioritizing stations with region-relevant tags and high click counts.
 */
export async function fetchRegionStations(
  region: string,
  limit: number = 50,
): Promise<BrowseStation[]> {
  // Check cache
  const cached = cache[region];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.stations.slice(0, limit);
  }

  // Start with curated stations for this region (always at top)
  const curated = CURATED_STATIONS[region] || [];
  const curatedUrls = new Set(curated.map(s => s.url_resolved));

  const countryCodes = REGION_COUNTRIES[region];
  if (!countryCodes || countryCodes.length === 0) {
    console.warn('[RadioBrowser] No country codes for region:', region);
    // Return curated only if no country codes
    cache[region] = { stations: curated, fetchedAt: Date.now() };
    return curated.slice(0, limit);
  }

  try {
    // Fetch from top 3 countries in parallel (most populated/radio-rich)
    const topCountries = countryCodes.slice(0, 3);
    const perCountryLimit = Math.ceil((limit - curated.length) / topCountries.length);

    const results = await Promise.allSettled(
      topCountries.map(cc => fetchByCountryCode(cc, perCountryLimit + 10))
    );

    let allStations: BrowseStation[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allStations = allStations.concat(result.value);
      }
    }

    // Filter: must have a resolved URL, pass last check, and not duplicate curated
    allStations = allStations.filter(
      s => s.url_resolved && s.url_resolved.length > 0 && s.lastcheckok === 1 && !curatedUrls.has(s.url_resolved)
    );

    // De-duplicate by stream URL
    const seen = new Set<string>();
    allStations = allStations.filter(s => {
      if (seen.has(s.url_resolved)) return false;
      seen.add(s.url_resolved);
      return true;
    });

    // Score stations: prefer regional tags + high clicks
    const preferredTags = REGION_PREFERRED_TAGS[region] || [];
    const scored = allStations.map(s => {
      const stationTags = (s.tags || '').toLowerCase();
      let tagScore = 0;
      for (const tag of preferredTags) {
        if (stationTags.includes(tag)) tagScore += 10;
      }
      return { station: s, score: tagScore + Math.log2(Math.max(s.clickcount, 1)) };
    });

    scored.sort((a, b) => b.score - a.score);
    const apiStations = scored.map(s => s.station).slice(0, limit - curated.length);

    // Merge: curated first, then API results
    const merged = [...curated, ...apiStations];

    // Cache
    cache[region] = { stations: merged, fetchedAt: Date.now() };

    console.log(`[RadioBrowser] Fetched ${merged.length} stations for ${region} (${curated.length} curated + ${apiStations.length} API)`);
    return merged.slice(0, limit);
  } catch (error) {
    console.error('[RadioBrowser] Fetch failed, rotating server:', error);
    rotateServer();

    // Return curated + cached data if available
    if (cached) return cached.stations.slice(0, limit);
    return curated.slice(0, limit);
  }
}

/**
 * Search stations globally by name or tag.
 */
export async function searchStations(
  query: string,
  limit: number = 30,
): Promise<BrowseStation[]> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/json/stations/search?name=${encodeURIComponent(query)}&hidebroken=true&order=clickcount&reverse=true&limit=${limit}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    const stations: BrowseStation[] = await res.json();

    return stations.filter(s => s.url_resolved && s.lastcheckok === 1);
  } catch (error) {
    console.error('[RadioBrowser] Search failed:', error);
    rotateServer();
    return [];
  }
}

/**
 * Fetch stations by genre tag (for global genres).
 * Searches by tag and returns top stations sorted by click count.
 */
export async function fetchByGenre(
  genreId: string,
  limit: number = 30,
): Promise<BrowseStation[]> {
  const cacheKey = `genre:${genreId}`;
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.stations.slice(0, limit);
  }

  // Find the genre definition
  const genre = GLOBAL_GENRES.find(g => g.id === genreId);
  if (!genre) {
    console.warn('[RadioBrowser] Unknown genre:', genreId);
    return [];
  }

  try {
    // Search by the first tag (most specific)
    const baseUrl = getBaseUrl();
    const primaryTag = genre.tags[0];
    const url = `${baseUrl}/json/stations/bytag/${encodeURIComponent(primaryTag)}?hidebroken=true&order=clickcount&reverse=true&limit=${limit + 20}`;

    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!res.ok) throw new Error(`Genre fetch failed: ${res.status}`);
    let stations: BrowseStation[] = await res.json();

    // Filter valid stations
    stations = stations.filter(s => s.url_resolved && s.lastcheckok === 1);

    // De-duplicate
    const seen = new Set<string>();
    stations = stations.filter(s => {
      if (seen.has(s.url_resolved)) return false;
      seen.add(s.url_resolved);
      return true;
    });

    // Score by how many genre tags match
    const scored = stations.map(s => {
      const stationTags = (s.tags || '').toLowerCase();
      let tagScore = 0;
      for (const tag of genre.tags) {
        if (stationTags.includes(tag.toLowerCase())) tagScore += 5;
      }
      return { station: s, score: tagScore + Math.log2(Math.max(s.clickcount, 1)) };
    });

    scored.sort((a, b) => b.score - a.score);
    const sorted = scored.map(s => s.station).slice(0, limit);

    // Cache
    cache[cacheKey] = { stations: sorted, fetchedAt: Date.now() };

    console.log(`[RadioBrowser] Fetched ${sorted.length} stations for genre "${genre.name}"`);
    return sorted;
  } catch (error) {
    console.error('[RadioBrowser] Genre fetch failed:', error);
    rotateServer();
    if (cached) return cached.stations.slice(0, limit);
    return [];
  }
}

/**
 * Report a station click (helps the radio-browser community).
 */
export async function reportClick(stationuuid: string): Promise<void> {
  try {
    const baseUrl = getBaseUrl();
    await fetch(`${baseUrl}/json/url/${stationuuid}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
  } catch {
    // Non-critical, ignore errors
  }
}

/**
 * Get country names for a region (for display).
 */
export function getRegionCountryNames(region: string): string[] {
  const COUNTRY_NAMES: Record<string, string> = {
    NG: 'Nigeria', GH: 'Ghana', SN: 'Senegal', CI: "Côte d'Ivoire", ML: 'Mali',
    KE: 'Kenya', TZ: 'Tanzania', UG: 'Uganda', ET: 'Ethiopia', RW: 'Rwanda',
    ZA: 'South Africa', ZW: 'Zimbabwe', MZ: 'Mozambique', BW: 'Botswana',
    BR: 'Brazil', MX: 'Mexico', CO: 'Colombia', AR: 'Argentina', PE: 'Peru',
    IN: 'India', PK: 'Pakistan', BD: 'Bangladesh', LK: 'Sri Lanka', NP: 'Nepal',
    ID: 'Indonesia', PH: 'Philippines', VN: 'Vietnam', TH: 'Thailand', MY: 'Malaysia',
    EG: 'Egypt', MA: 'Morocco', DZ: 'Algeria', TN: 'Tunisia', IQ: 'Iraq', SA: 'Saudi Arabia',
    JM: 'Jamaica', TT: 'Trinidad & Tobago', HT: 'Haiti', CU: 'Cuba',
    FJ: 'Fiji', PG: 'Papua New Guinea', NZ: 'New Zealand', AU: 'Australia',
  };

  const codes = REGION_COUNTRIES[region] || [];
  return codes.map(cc => COUNTRY_NAMES[cc] || cc).slice(0, 5);
}

/**
 * Clear cached stations for a region (or all).
 */
export function clearCache(region?: string): void {
  if (region) {
    delete cache[region];
  } else {
    Object.keys(cache).forEach(k => delete cache[k]);
  }
}
