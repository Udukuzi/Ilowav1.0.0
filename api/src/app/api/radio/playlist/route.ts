/**
 * Radio Playlist API
 * 
 * GET /api/radio/playlist?station=west-africa
 * Returns: Array of IPFS tracks for the station
 */

import { NextRequest, NextResponse } from 'next/server';

interface PlaylistTrack {
  id: string;
  title: string;
  artist: string;
  ipfsHash: string;
  ipfsUrl: string;
  duration: number;
  genre: string;
  addedAt: number;
}

// In production, this would be fetched from Supabase
const DEMO_PLAYLISTS: Record<string, PlaylistTrack[]> = {
  'west-africa': [
    {
      id: '1',
      title: 'Lagos Nights',
      artist: 'Afrobeats Collective',
      ipfsHash: 'QmDemo1...',
      ipfsUrl: 'https://gateway.pinata.cloud/ipfs/QmDemo1...',
      duration: 245,
      genre: 'Afrobeats',
      addedAt: Date.now() - 86400000,
    },
    {
      id: '2',
      title: 'Naija Vibes',
      artist: 'DJ Kunle',
      ipfsHash: 'QmDemo2...',
      ipfsUrl: 'https://gateway.pinata.cloud/ipfs/QmDemo2...',
      duration: 312,
      genre: 'Afrobeats',
      addedAt: Date.now() - 172800000,
    },
    {
      id: '3',
      title: 'Crypto Talk Intro',
      artist: 'Ilowa Radio',
      ipfsHash: 'QmDemo3...',
      ipfsUrl: 'https://gateway.pinata.cloud/ipfs/QmDemo3...',
      duration: 45,
      genre: 'Jingle',
      addedAt: Date.now() - 259200000,
    },
  ],
  'east-africa': [
    {
      id: '1',
      title: 'Nairobi Sunrise',
      artist: 'Bongo Beats',
      ipfsHash: 'QmDemo4...',
      ipfsUrl: 'https://gateway.pinata.cloud/ipfs/QmDemo4...',
      duration: 287,
      genre: 'Bongo Flava',
      addedAt: Date.now() - 86400000,
    },
  ],
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const stationId = searchParams.get('station') || 'west-africa';

  // In production, fetch from Supabase:
  // const { data } = await supabase
  //   .from('playlists')
  //   .select('*')
  //   .eq('station_id', stationId)
  //   .order('added_at', { ascending: false });

  const playlist = DEMO_PLAYLISTS[stationId] || [];

  return NextResponse.json({
    stationId,
    tracks: playlist,
    totalTracks: playlist.length,
  });
}
