/**
 * Radio Automation Bot
 * 
 * GET /api/cron/radio-automation
 * 
 * Runs every 5 minutes via Vercel Cron
 * - Checks if DJ is live for each station
 * - If offline, selects next track from IPFS playlist
 * - Updates database with current stream URL
 */

import { NextRequest, NextResponse } from 'next/server';

const LIVEPEER_API_KEY = process.env.LIVEPEER_API_KEY || '';

// Station configurations
const STATIONS = [
  { id: 'west-africa', streamId: process.env.LIVEPEER_WEST_AFRICA_STREAM_ID },
  { id: 'east-africa', streamId: process.env.LIVEPEER_EAST_AFRICA_STREAM_ID },
  { id: 'southern-africa', streamId: process.env.LIVEPEER_SOUTHERN_AFRICA_STREAM_ID },
  { id: 'latin-america', streamId: process.env.LIVEPEER_LATIN_AMERICA_STREAM_ID },
  { id: 'south-asia', streamId: process.env.LIVEPEER_SOUTH_ASIA_STREAM_ID },
  { id: 'southeast-asia', streamId: process.env.LIVEPEER_SOUTHEAST_ASIA_STREAM_ID },
  { id: 'mena', streamId: process.env.LIVEPEER_MENA_STREAM_ID },
  { id: 'caribbean', streamId: process.env.LIVEPEER_CARIBBEAN_STREAM_ID },
  { id: 'pacific', streamId: process.env.LIVEPEER_PACIFIC_STREAM_ID },
];

interface StationStatus {
  stationId: string;
  isLive: boolean;
  action: 'none' | 'switched_to_live' | 'switched_to_playlist' | 'continuing_playlist';
  currentTrack?: string;
}

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this header)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: StationStatus[] = [];

  for (const station of STATIONS) {
    if (!station.streamId) {
      results.push({
        stationId: station.id,
        isLive: false,
        action: 'none',
      });
      continue;
    }

    try {
      // Check Livepeer stream status
      const response = await fetch(
        `https://livepeer.studio/api/stream/${station.streamId}`,
        {
          headers: { Authorization: `Bearer ${LIVEPEER_API_KEY}` },
        }
      );

      if (!response.ok) {
        results.push({
          stationId: station.id,
          isLive: false,
          action: 'continuing_playlist',
        });
        continue;
      }

      const stream = await response.json();

      if (stream.isActive) {
        // DJ is live
        results.push({
          stationId: station.id,
          isLive: true,
          action: 'switched_to_live',
        });

        // In production: Update Supabase
        // await supabase.from('stations').update({
        //   is_live: true,
        //   current_stream_url: `https://livepeercdn.studio/hls/${stream.playbackId}/index.m3u8`,
        //   updated_at: new Date().toISOString(),
        // }).eq('id', station.id);
      } else {
        // DJ is offline - use playlist
        // In production: Get next track from playlist
        // const { data: nextTrack } = await supabase
        //   .from('playlists')
        //   .select('*')
        //   .eq('station_id', station.id)
        //   .order('last_played', { ascending: true })
        //   .limit(1)
        //   .single();

        results.push({
          stationId: station.id,
          isLive: false,
          action: 'continuing_playlist',
          currentTrack: 'Afrobeats Mix', // Placeholder
        });

        // In production: Update last_played and current track
        // await supabase.from('stations').update({
        //   is_live: false,
        //   current_track_id: nextTrack.id,
        //   current_stream_url: nextTrack.ipfs_url,
        //   updated_at: new Date().toISOString(),
        // }).eq('id', station.id);
      }
    } catch (error) {
      console.error(`Error checking station ${station.id}:`, error);
      results.push({
        stationId: station.id,
        isLive: false,
        action: 'none',
      });
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    stations: results,
  });
}
