/**
 * Livepeer Integration for Live Radio Streaming
 * 
 * DJs stream via OBS Studio → Livepeer RTMP → HLS output → App plays
 * Cost: $0.015/min transcoding
 */

const LIVEPEER_API_KEY = process.env.EXPO_PUBLIC_LIVEPEER_API_KEY || '';
const LIVEPEER_API_URL = 'https://livepeer.studio/api';

export interface StreamStatus {
  isLive: boolean;
  playbackUrl: string | null;
  viewerCount: number;
  startedAt: number | null;
}

export interface LivepeerStream {
  id: string;
  name: string;
  streamKey: string;
  playbackId: string;
  isActive: boolean;
  createdAt: number;
}

/**
 * Check if a DJ stream is currently live
 */
export async function getStreamStatus(streamId: string): Promise<StreamStatus> {
  try {
    const response = await fetch(`${LIVEPEER_API_URL}/stream/${streamId}`, {
      headers: {
        Authorization: `Bearer ${LIVEPEER_API_KEY}`,
      },
    });

    if (!response.ok) {
      return { isLive: false, playbackUrl: null, viewerCount: 0, startedAt: null };
    }

    const stream = await response.json();
    
    return {
      isLive: stream.isActive === true,
      playbackUrl: stream.isActive 
        ? `https://livepeercdn.studio/hls/${stream.playbackId}/index.m3u8`
        : null,
      viewerCount: stream.viewerCount || 0,
      startedAt: stream.isActive ? stream.lastSeen : null,
    };
  } catch (error) {
    console.error('Livepeer status check failed:', error);
    return { isLive: false, playbackUrl: null, viewerCount: 0, startedAt: null };
  }
}

/**
 * Get the HLS playback URL for a stream
 */
export function getPlaybackUrl(playbackId: string): string {
  return `https://livepeercdn.studio/hls/${playbackId}/index.m3u8`;
}

/**
 * Get RTMP ingest URL for DJs to stream to
 */
export function getRTMPUrl(): string {
  return 'rtmp://rtmp.livepeer.com/live';
}

/**
 * Create a new stream for a DJ (called from DJ Portal)
 */
export async function createStream(name: string): Promise<LivepeerStream | null> {
  try {
    const response = await fetch(`${LIVEPEER_API_URL}/stream`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LIVEPEER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        profiles: [
          { name: '720p', bitrate: 2000000, fps: 30, width: 1280, height: 720 },
          { name: '480p', bitrate: 1000000, fps: 30, width: 854, height: 480 },
          { name: '360p', bitrate: 500000, fps: 30, width: 640, height: 360 },
        ],
      }),
    });

    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error('Failed to create Livepeer stream:', error);
    return null;
  }
}

/**
 * Station stream mapping (hardcoded for v1)
 */
export const STATION_STREAMS: Record<string, string> = {
  'west-africa': process.env.EXPO_PUBLIC_LIVEPEER_WEST_AFRICA_STREAM_ID || '',
  'east-africa': process.env.EXPO_PUBLIC_LIVEPEER_EAST_AFRICA_STREAM_ID || '',
  'southern-africa': process.env.EXPO_PUBLIC_LIVEPEER_SOUTHERN_AFRICA_STREAM_ID || '',
  'latin-america': process.env.EXPO_PUBLIC_LIVEPEER_LATIN_AMERICA_STREAM_ID || '',
  'south-asia': process.env.EXPO_PUBLIC_LIVEPEER_SOUTH_ASIA_STREAM_ID || '',
  'southeast-asia': process.env.EXPO_PUBLIC_LIVEPEER_SOUTHEAST_ASIA_STREAM_ID || '',
  'mena': process.env.EXPO_PUBLIC_LIVEPEER_MENA_STREAM_ID || '',
  'caribbean': process.env.EXPO_PUBLIC_LIVEPEER_CARIBBEAN_STREAM_ID || '',
  'pacific': process.env.EXPO_PUBLIC_LIVEPEER_PACIFIC_STREAM_ID || '',
};
