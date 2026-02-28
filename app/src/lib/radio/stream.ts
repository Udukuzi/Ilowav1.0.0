/**
 * Radio Stream Player
 * 
 * Supports:
 * - Livepeer HLS streams (when DJ is live)
 * - IPFS audio files (when DJ is offline)
 * - Seamless switching between live and pre-recorded
 * - Multi-layer fallback system for unreliable streams
 */

import { Audio, AVPlaybackStatus } from 'expo-av';
import { Alert } from 'react-native';
import { RadioStation, BrowseStation } from '../../types/radio';
import { RADIO_STATIONS } from '../../data/radio-stations';
import { getStreamStatus, STATION_STREAMS } from './livepeer';
import { getIPFSUrl } from '../storage/ipfs';
import { searchStations } from './radio-browser';

// Cache for working stream URLs (reduces repeated 404s)
const workingUrlCache: Record<string, { url: string; timestamp: number }> = {};
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

let sound: Audio.Sound | null = null;
let isInitialized = false;
let currentStreamType: 'live' | 'ipfs' | null = null;

export interface StreamInfo {
  isLive: boolean;
  streamUrl: string | null;
  viewerCount: number;
  currentTrack?: string;
}

export async function initRadioPlayer() {
  if (isInitialized) return;
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    staysActiveInBackground: true,
    playsInSilentModeIOS: true,
  });
  isInitialized = true;
}

/**
 * Get current stream info for a station
 * Checks Livepeer first, falls back to IPFS playlist
 */
export async function getStationStreamInfo(stationId: string): Promise<StreamInfo> {
  const livepeerStreamId = STATION_STREAMS[stationId];
  
  if (livepeerStreamId) {
    const status = await getStreamStatus(livepeerStreamId);
    if (status.isLive && status.playbackUrl) {
      return {
        isLive: true,
        streamUrl: status.playbackUrl,
        viewerCount: status.viewerCount,
      };
    }
  }
  
  // Fall back to IPFS playlist (automation bot manages this)
  const station = RADIO_STATIONS.find(s => s.id === stationId);
  return {
    isLive: false,
    streamUrl: station?.streamUrl || null,
    viewerCount: 0,
    currentTrack: 'Afrobeats Mix', // In production, fetch from database
  };
}

/**
 * Play a station - auto-detects live vs IPFS
 */
export async function playStation(station: RadioStation): Promise<Audio.Sound> {
  await stopStation();
  await initRadioPlayer();

  // Get stream info (live or IPFS)
  const streamInfo = await getStationStreamInfo(station.id);
  
  if (!streamInfo.streamUrl) {
    throw new Error('No stream available for this station');
  }

  currentStreamType = streamInfo.isLive ? 'live' : 'ipfs';

  const { sound: newSound } = await Audio.Sound.createAsync(
    { uri: streamInfo.streamUrl },
    { shouldPlay: true, isLooping: !streamInfo.isLive }
  );
  sound = newSound;
  return newSound;
}

/**
 * Play a specific IPFS track
 */
export async function playIPFSTrack(ipfsHash: string): Promise<Audio.Sound> {
  await stopStation();
  await initRadioPlayer();

  const url = getIPFSUrl(ipfsHash);
  currentStreamType = 'ipfs';

  const { sound: newSound } = await Audio.Sound.createAsync(
    { uri: url },
    { shouldPlay: true, isLooping: false }
  );
  sound = newSound;
  return newSound;
}

/**
 * Play an arbitrary stream URL (e.g. from radio-browser.info)
 */
export async function playStreamUrl(url: string): Promise<Audio.Sound> {
  await stopStation();
  await initRadioPlayer();

  currentStreamType = 'live';

  const { sound: newSound } = await Audio.Sound.createAsync(
    { uri: url },
    { shouldPlay: true, isLooping: false }
  );
  sound = newSound;
  return newSound;
}

/**
 * Play a BrowseStation with multi-layer fallback
 * Tries: primary URL → cached URL → API search → IPFS fallback
 * 
 * IMPORTANT: This function stops any existing playback first,
 * tests streams WITHOUT playing, then plays only the working stream.
 */
export async function playBrowseStationWithFallback(
  station: BrowseStation,
  region?: string
): Promise<{ sound: Audio.Sound; usedFallback: boolean }> {
  console.log('[Radio] Attempting to play:', station.name);
  
  // CRITICAL: Stop any existing playback FIRST
  await stopStation();
  
  let validSound: Audio.Sound | null = null;
  let usedFallback = false;
  
  // Check cache for known working URL
  const cached = workingUrlCache[station.stationuuid];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('[Radio] Using cached URL for', station.name);
    try {
      validSound = await tryStreamUrl(cached.url, station.name);
      if (validSound) {
        usedFallback = false;
      }
    } catch {
      // Cache invalid, continue with fallback
      delete workingUrlCache[station.stationuuid];
    }
  }
  
  // Layer 1: Try primary URL
  if (!validSound) {
    console.log('[Radio] Trying primary URL...');
    try {
      validSound = await tryStreamUrl(station.url_resolved, station.name);
      if (validSound) {
        console.log('[Radio] ✅ Primary URL worked');
        cacheWorkingUrl(station.stationuuid, station.url_resolved);
        usedFallback = false;
      }
    } catch (err) {
      console.warn('[Radio] Primary URL failed:', err);
    }
  }
  
  // Layer 2: Search radio-browser.info API for alternative stream
  if (!validSound) {
    console.log('[Radio] Primary failed, searching radio-browser.info...');
    try {
      const alternatives = await searchStations(station.name, 5);
      for (const alt of alternatives) {
        if (alt.stationuuid !== station.stationuuid && alt.url_resolved) {
          try {
            validSound = await tryStreamUrl(alt.url_resolved, alt.name);
            if (validSound) {
              console.log('[Radio] ✅ Found working alternative:', alt.name);
              cacheWorkingUrl(station.stationuuid, alt.url_resolved);
              usedFallback = true;
              break;
            }
          } catch {
            continue;
          }
        }
      }
    } catch (err) {
      console.warn('[Radio] API search failed:', err);
    }
  }
  
  // Layer 3: Play IPFS fallback content for the region
  if (!validSound && region) {
    console.log('[Radio] All streams failed, trying IPFS fallback...');
    try {
      validSound = await playRegionIPFSFallback(region);
      if (validSound) {
        console.log('[Radio] ✅ Playing IPFS fallback content');
        Alert.alert(
          'Station Offline',
          `${station.name} is currently unavailable. Playing pre-recorded content.`,
          [{ text: 'OK' }]
        );
        // IPFS fallback already plays, so return directly
        return { sound: validSound, usedFallback: true };
      }
    } catch (err) {
      console.warn('[Radio] IPFS fallback failed:', err);
    }
  }
  
  // If we found a valid stream, NOW start playing it
  if (validSound) {
    await validSound.playAsync();
    sound = validSound;
    currentStreamType = 'live';
    return { sound: validSound, usedFallback };
  }
  
  // ALL LAYERS FAILED
  console.error('[Radio] ❌ All playback methods failed for', station.name);
  Alert.alert(
    'Playback Error',
    `Could not play ${station.name}. This station may be offline or geo-restricted. Try another station.`,
    [{ text: 'OK' }]
  );
  
  throw new Error(`All playback methods failed for ${station.name}`);
}

/**
 * Try to load and verify a stream URL (does NOT auto-play)
 * Returns the sound object if stream is valid, null otherwise
 */
async function tryStreamUrl(url: string, stationName: string, timeout = 8000): Promise<Audio.Sound | null> {
  await initRadioPlayer();
  
  return new Promise(async (resolve) => {
    let timeoutId: NodeJS.Timeout | null = null;
    let resolved = false;
    let testSound: Audio.Sound | null = null;
    
    const cleanup = async () => {
      if (timeoutId) clearTimeout(timeoutId);
      // Clean up test sound if it failed
      if (testSound && resolved) {
        try {
          await testSound.stopAsync();
          await testSound.unloadAsync();
        } catch {}
      }
    };
    
    try {
      // Create sound but DON'T play yet - just test if it loads
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: false }, // Don't auto-play!
        (status: AVPlaybackStatus) => {
          if (resolved) return;
          
          if (!status.isLoaded && 'error' in status && status.error) {
            // Stream error
            console.warn(`[Radio] Stream error for ${stationName}:`, status.error);
            resolved = true;
            cleanup();
            resolve(null);
          }
        }
      );
      
      testSound = newSound;
      
      // Check if sound loaded successfully
      const status = await newSound.getStatusAsync();
      if (status.isLoaded) {
        // Stream loaded successfully - return it (caller will play)
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        resolve(newSound);
        return;
      }
      
      // Set timeout for slow streams
      timeoutId = setTimeout(async () => {
        if (!resolved) {
          resolved = true;
          console.warn(`[Radio] Stream timeout for ${stationName}`);
          await cleanup();
          resolve(null);
        }
      }, timeout);
      
    } catch (err) {
      resolved = true;
      console.error(`[Radio] Failed to create sound for ${url}:`, err);
      await cleanup();
      resolve(null);
    }
  });
}

/**
 * Play IPFS fallback content for a region
 */
async function playRegionIPFSFallback(region: string): Promise<Audio.Sound | null> {
  // Map regions to IPFS playlist hashes (in production, fetch from database)
  const REGION_IPFS_PLAYLISTS: Record<string, string[]> = {
    'west-africa': [
      'QmExample1', // Afrobeats mix
      'QmExample2', // Highlife collection
    ],
    'east-africa': [
      'QmExample3', // Bongo Flava mix
    ],
    'southern-africa': [
      'QmExample4', // Amapiano mix
    ],
    // Add more regions...
  };
  
  const playlist = REGION_IPFS_PLAYLISTS[region];
  if (!playlist || playlist.length === 0) {
    return null;
  }
  
  // Pick random track from playlist
  const randomHash = playlist[Math.floor(Math.random() * playlist.length)];
  
  try {
    const url = getIPFSUrl(randomHash);
    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: true, isLooping: true }
    );
    sound = newSound;
    currentStreamType = 'ipfs';
    return newSound;
  } catch {
    return null;
  }
}

/**
 * Cache a working URL for future use
 */
function cacheWorkingUrl(stationId: string, url: string) {
  workingUrlCache[stationId] = {
    url,
    timestamp: Date.now(),
  };
}

/**
 * Clear URL cache (call when user reports stream issues)
 */
export function clearStreamCache(stationId?: string) {
  if (stationId) {
    delete workingUrlCache[stationId];
  } else {
    Object.keys(workingUrlCache).forEach(key => delete workingUrlCache[key]);
  }
}

export async function pauseStation() {
  if (sound) {
    await sound.pauseAsync();
  }
}

export async function resumeStation() {
  if (sound) {
    await sound.playAsync();
  }
}

export async function stopStation() {
  if (sound) {
    await sound.stopAsync();
    await sound.unloadAsync();
    sound = null;
    currentStreamType = null;
  }
}

export function getCurrentSound(): Audio.Sound | null {
  return sound;
}

export function getCurrentStreamType(): 'live' | 'ipfs' | null {
  return currentStreamType;
}

export function getStationByRegion(region: string): RadioStation | undefined {
  return RADIO_STATIONS.find((s) => s.region === region);
}
