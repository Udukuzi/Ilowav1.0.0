/**
 * Audius Music Streaming API Service
 * 
 * Free, decentralized music streaming for Ilowa radio
 * API docs: https://audiusproject.github.io/api-docs/
 */

const AUDIUS_API_HOST = 'https://discoveryprovider.audius.co';
const APP_NAME = 'ilowa';

export interface AudiusTrack {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  streamUrl: string;
  artwork: string | null;
  duration: number;
  playCount?: number;
  genre?: string;
  mood?: string;
  tags?: string;
}

export interface AudiusUser {
  id: string;
  name: string;
  handle: string;
  profilePicture: string | null;
  followerCount: number;
  trackCount: number;
  splWallet?: string;
  ercWallet?: string;
  supporterCount?: number;
  supportingCount?: number;
  totalAudioBalance?: number;
}

export interface AudiusTip {
  amount: string;
  sender: AudiusUser;
  receiver: AudiusUser;
  createdAt: string;
}

export interface AudiusSupporter {
  rank: number;
  amount: string;
  sender: AudiusUser;
}

/**
 * Get trending tracks by genre
 */
export async function getAudiusTrendingTracks(
  genre: string = 'All',
  limit: number = 50
): Promise<AudiusTrack[]> {
  try {
    const params = new URLSearchParams({
      genre: genre === 'All' ? '' : genre,
      limit: limit.toString(),
      app_name: APP_NAME,
    });
    
    const response = await fetch(
      `${AUDIUS_API_HOST}/v1/tracks/trending?${params}`
    );
    
    if (!response.ok) {
      throw new Error(`Audius API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    return (data.data || []).map((track: any) => ({
      id: track.id,
      title: track.title,
      artist: track.user?.name || 'Unknown Artist',
      artistId: track.user?.id,
      streamUrl: `${AUDIUS_API_HOST}/v1/tracks/${track.id}/stream?app_name=${APP_NAME}`,
      artwork: track.artwork?.['480x480'] || track.user?.profile_picture?.['480x480'] || null,
      duration: track.duration || 0,
      playCount: track.play_count || 0,
      genre: track.genre || '',
      mood: track.mood || '',
      tags: track.tags || '',
    }));
  } catch (error) {
    console.error('[Audius] Failed to fetch trending tracks:', error);
    return [];
  }
}

/**
 * Region to Audius genre mapping
 */
const REGION_GENRE_MAP: Record<string, string> = {
  'west-africa': 'Electronic', // Closest to Afrobeats
  'east-africa': 'Electronic',
  'southern-africa': 'Electronic',
  'latin-america': 'Latin',
  'south-asia': 'Hip-Hop/Rap',
  'southeast-asia': 'Electronic',
  'mena': 'World',
  'caribbean': 'Reggae',
  'pacific': 'Pop',
};

/**
 * Get tracks by Ilowa region
 */
export async function getRegionalTracks(region: string): Promise<AudiusTrack[]> {
  const genre = REGION_GENRE_MAP[region] || 'All';
  return getAudiusTrendingTracks(genre);
}

/**
 * Search tracks by query
 */
export async function searchAudiusTracks(query: string, limit: number = 20): Promise<AudiusTrack[]> {
  try {
    const params = new URLSearchParams({
      query: query,
      limit: limit.toString(),
      app_name: APP_NAME,
    });
    
    const response = await fetch(
      `${AUDIUS_API_HOST}/v1/tracks/search?${params}`
    );
    
    if (!response.ok) {
      throw new Error(`Audius search error: ${response.status}`);
    }
    
    const data = await response.json();
    
    return (data.data || []).map((track: any) => ({
      id: track.id,
      title: track.title,
      artist: track.user?.name || 'Unknown Artist',
      artistId: track.user?.id,
      streamUrl: `${AUDIUS_API_HOST}/v1/tracks/${track.id}/stream?app_name=${APP_NAME}`,
      artwork: track.artwork?.['480x480'] || null,
      duration: track.duration || 0,
      playCount: track.play_count || 0,
      genre: track.genre || '',
    }));
  } catch (error) {
    console.error('[Audius] Search failed:', error);
    return [];
  }
}

/**
 * Get a single track by ID
 */
export async function getAudiusTrack(trackId: string): Promise<AudiusTrack | null> {
  try {
    const response = await fetch(
      `${AUDIUS_API_HOST}/v1/tracks/${trackId}?app_name=${APP_NAME}`
    );
    
    if (!response.ok) {
      throw new Error(`Audius track error: ${response.status}`);
    }
    
    const data = await response.json();
    const track = data.data;
    
    if (!track) return null;
    
    return {
      id: track.id,
      title: track.title,
      artist: track.user?.name || 'Unknown Artist',
      artistId: track.user?.id,
      streamUrl: `${AUDIUS_API_HOST}/v1/tracks/${track.id}/stream?app_name=${APP_NAME}`,
      artwork: track.artwork?.['480x480'] || null,
      duration: track.duration || 0,
      playCount: track.play_count || 0,
      genre: track.genre || '',
      mood: track.mood || '',
    };
  } catch (error) {
    console.error('[Audius] Get track failed:', error);
    return null;
  }
}

/**
 * Get user/artist by ID
 */
export async function getAudiusUser(userId: string): Promise<AudiusUser | null> {
  try {
    const response = await fetch(
      `${AUDIUS_API_HOST}/v1/users/${userId}?app_name=${APP_NAME}`
    );
    
    if (!response.ok) {
      throw new Error(`Audius user error: ${response.status}`);
    }
    
    const data = await response.json();
    const user = data.data;
    
    if (!user) return null;
    
    return mapUserData(user);
  } catch (error) {
    console.error('[Audius] Get user failed:', error);
    return null;
  }
}

/**
 * Get tracks by a specific artist
 */
export async function getArtistTracks(userId: string, limit: number = 20): Promise<AudiusTrack[]> {
  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      app_name: APP_NAME,
    });
    
    const response = await fetch(
      `${AUDIUS_API_HOST}/v1/users/${userId}/tracks?${params}`
    );
    
    if (!response.ok) {
      throw new Error(`Audius artist tracks error: ${response.status}`);
    }
    
    const data = await response.json();
    
    return (data.data || []).map((track: any) => ({
      id: track.id,
      title: track.title,
      artist: track.user?.name || 'Unknown Artist',
      artistId: track.user?.id,
      streamUrl: `${AUDIUS_API_HOST}/v1/tracks/${track.id}/stream?app_name=${APP_NAME}`,
      artwork: track.artwork?.['480x480'] || null,
      duration: track.duration || 0,
      playCount: track.play_count || 0,
      genre: track.genre || '',
    }));
  } catch (error) {
    console.error('[Audius] Get artist tracks failed:', error);
    return [];
  }
}

// ── Artist Coins / $AUDIO Tipping ──────────────────────────────────

/**
 * Get an artist's top supporters (people who tipped them $AUDIO).
 * Sorted by total amount tipped — shows who's backing the artist.
 */
export async function getArtistSupporters(
  userId: string, limit: number = 10
): Promise<AudiusSupporter[]> {
  try {
    const params = new URLSearchParams({
      limit: limit.toString(), app_name: APP_NAME,
    });
    const res = await fetch(
      `${AUDIUS_API_HOST}/v1/users/${userId}/supporters?${params}`
    );
    if (!res.ok) throw new Error(`supporters ${res.status}`);
    const data = await res.json();
    return (data.data || []).map((s: any) => ({
      rank: s.rank || 0,
      amount: s.amount || '0',
      sender: mapUserData(s.sender),
    }));
  } catch (err) {
    console.error('[Audius] Supporters fetch failed:', err);
    return [];
  }
}

/**
 * Get artists a user is supporting with $AUDIO tips.
 * Shows the user's patronage footprint.
 */
export async function getUserSupportings(
  userId: string, limit: number = 10
): Promise<{ amount: string; receiver: AudiusUser }[]> {
  try {
    const params = new URLSearchParams({
      limit: limit.toString(), app_name: APP_NAME,
    });
    const res = await fetch(
      `${AUDIUS_API_HOST}/v1/users/${userId}/supportings?${params}`
    );
    if (!res.ok) throw new Error(`supportings ${res.status}`);
    const data = await res.json();
    return (data.data || []).map((s: any) => ({
      amount: s.amount || '0',
      receiver: mapUserData(s.receiver),
    }));
  } catch (err) {
    console.error('[Audius] Supportings fetch failed:', err);
    return [];
  }
}

/**
 * Fetch the most recent $AUDIO tips on the network.
 * Useful for a live feed showing artist coin activity.
 */
export async function getRecentTips(limit: number = 10): Promise<AudiusTip[]> {
  try {
    const params = new URLSearchParams({
      limit: limit.toString(), app_name: APP_NAME,
    });
    const res = await fetch(`${AUDIUS_API_HOST}/v1/tips?${params}`);
    if (!res.ok) throw new Error(`tips ${res.status}`);
    const data = await res.json();
    return (data.data || []).map((t: any) => ({
      amount: t.amount || '0',
      sender: mapUserData(t.sender),
      receiver: mapUserData(t.receiver),
      createdAt: t.created_at || '',
    }));
  } catch (err) {
    console.error('[Audius] Tips fetch failed:', err);
    return [];
  }
}

/**
 * Build a full artist coin profile — balance, supporters, wallet.
 * Combines user data with supporter rankings for a complete picture.
 */
export async function getArtistCoinProfile(userId: string): Promise<{
  user: AudiusUser;
  supporters: AudiusSupporter[];
  totalTipsReceived: string;
} | null> {
  const user = await getAudiusUser(userId);
  if (!user) return null;
  const supporters = await getArtistSupporters(userId, 20);
  // Sum up supporter amounts for a running total
  let totalWei = BigInt(0);
  for (const s of supporters) {
    try { totalWei += BigInt(s.amount); } catch { /* skip bad amounts */ }
  }
  return {
    user,
    supporters,
    totalTipsReceived: totalWei.toString(),
  };
}

// maps raw Audius API user blob to our typed interface
function mapUserData(raw: any): AudiusUser {
  return {
    id: raw.id,
    name: raw.name || 'Unknown',
    handle: raw.handle || '',
    profilePicture: raw.profile_picture?.['480x480'] || null,
    followerCount: raw.follower_count || 0,
    trackCount: raw.track_count || 0,
    splWallet: raw.spl_wallet || undefined,
    ercWallet: raw.erc_wallet || undefined,
    supporterCount: raw.supporter_count || 0,
    supportingCount: raw.supporting_count || 0,
    totalAudioBalance: raw.total_audio_balance || 0,
  };
}

/**
 * Format $AUDIO amount from raw string (wei-like) to human readable.
 * Audius stores tips in a large integer format.
 */
export function formatAudioAmount(rawAmount: string): string {
  try {
    const big = BigInt(rawAmount);
    const whole = big / BigInt(10 ** 18);
    const frac = (big % BigInt(10 ** 18)) / BigInt(10 ** 16);
    if (whole >= 1000000n) return `${(Number(whole) / 1e6).toFixed(1)}M $AUDIO`;
    if (whole >= 1000n) return `${(Number(whole) / 1e3).toFixed(1)}K $AUDIO`;
    if (whole > 0n) return `${whole}.${frac.toString().padStart(2, '0')} $AUDIO`;
    return `<0.01 $AUDIO`;
  } catch {
    return rawAmount + ' $AUDIO';
  }
}

/**
 * Available Audius genres for browsing
 */
export const AUDIUS_GENRES = [
  'All',
  'Electronic',
  'Hip-Hop/Rap',
  'Pop',
  'R&B/Soul',
  'Rock',
  'Latin',
  'Reggae',
  'World',
  'Dance',
  'House',
  'Techno',
  'Dubstep',
  'Drum & Bass',
  'Trap',
  'Alternative',
  'Ambient',
  'Classical',
  'Country',
  'Jazz',
  'Metal',
  'Punk',
  'Folk',
  'Soundtrack',
  'Spoken Word',
];

/**
 * Format duration from seconds to mm:ss
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format play count for display
 */
export function formatPlayCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}
