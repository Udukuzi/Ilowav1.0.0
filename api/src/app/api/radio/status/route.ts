/**
 * Radio Status API
 * 
 * GET /api/radio/status?station=west-africa
 * Returns: { isLive, streamUrl, viewerCount, currentTrack }
 */

import { NextRequest, NextResponse } from 'next/server';

const LIVEPEER_API_KEY = process.env.LIVEPEER_API_KEY || '';
const LIVEPEER_API_URL = 'https://livepeer.studio/api';

// Station → Livepeer stream ID mapping
const STATION_STREAMS: Record<string, string> = {
  'west-africa': process.env.LIVEPEER_WEST_AFRICA_STREAM_ID || '',
  'east-africa': process.env.LIVEPEER_EAST_AFRICA_STREAM_ID || '',
  'southern-africa': process.env.LIVEPEER_SOUTHERN_AFRICA_STREAM_ID || '',
  'latin-america': process.env.LIVEPEER_LATIN_AMERICA_STREAM_ID || '',
  'south-asia': process.env.LIVEPEER_SOUTH_ASIA_STREAM_ID || '',
  'southeast-asia': process.env.LIVEPEER_SOUTHEAST_ASIA_STREAM_ID || '',
  'mena': process.env.LIVEPEER_MENA_STREAM_ID || '',
  'caribbean': process.env.LIVEPEER_CARIBBEAN_STREAM_ID || '',
  'pacific': process.env.LIVEPEER_PACIFIC_STREAM_ID || '',
};

// Fallback IPFS URLs for each station (when DJ is offline)
const STATION_FALLBACK_URLS: Record<string, string> = {
  'west-africa': process.env.IPFS_WEST_AFRICA_PLAYLIST || '',
  'east-africa': process.env.IPFS_EAST_AFRICA_PLAYLIST || '',
  'southern-africa': process.env.IPFS_SOUTHERN_AFRICA_PLAYLIST || '',
  'latin-america': process.env.IPFS_LATIN_AMERICA_PLAYLIST || '',
  'south-asia': process.env.IPFS_SOUTH_ASIA_PLAYLIST || '',
  'southeast-asia': process.env.IPFS_SOUTHEAST_ASIA_PLAYLIST || '',
  'mena': process.env.IPFS_MENA_PLAYLIST || '',
  'caribbean': process.env.IPFS_CARIBBEAN_PLAYLIST || '',
  'pacific': process.env.IPFS_PACIFIC_PLAYLIST || '',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const stationId = searchParams.get('station') || 'west-africa';

  const streamId = STATION_STREAMS[stationId];

  // Check if DJ is live via Livepeer
  if (streamId && LIVEPEER_API_KEY) {
    try {
      const response = await fetch(`${LIVEPEER_API_URL}/stream/${streamId}`, {
        headers: {
          Authorization: `Bearer ${LIVEPEER_API_KEY}`,
        },
        next: { revalidate: 10 }, // Cache for 10 seconds
      });

      if (response.ok) {
        const stream = await response.json();
        
        if (stream.isActive) {
          return NextResponse.json({
            isLive: true,
            streamUrl: `https://livepeercdn.studio/hls/${stream.playbackId}/index.m3u8`,
            viewerCount: stream.viewerCount || 0,
            currentTrack: null,
            djName: stream.name || 'DJ',
          });
        }
      }
    } catch (error) {
      console.error('Livepeer API error:', error);
    }
  }

  // DJ is offline - return IPFS fallback
  const fallbackUrl = STATION_FALLBACK_URLS[stationId];
  
  return NextResponse.json({
    isLive: false,
    streamUrl: fallbackUrl || null,
    viewerCount: 0,
    currentTrack: 'Afrobeats Mix', // In production, fetch from database
    djName: null,
  });
}
