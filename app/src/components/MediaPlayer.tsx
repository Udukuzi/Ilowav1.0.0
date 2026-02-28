/**
 * MediaPlayer Component
 * 
 * Enhanced media player with:
 * - Album art display (from IPFS metadata)
 * - Video playback for podcasts
 * - Audio visualizer when no artwork
 * - Track info from metadata
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { AudioVisualizer, CircularVisualizer, MiniVisualizer } from './AudioVisualizer';
import { getIPFSUrl } from '../lib/storage/ipfs';
import { BrowseStation } from '../types/radio';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ILOWA_COLORS = {
  gold: '#FFD700',
  purple: '#8B5CF6',
  cyan: '#00D9FF',
  magenta: '#FF006E',
  dark: '#0A0A0F',
  cardDark: '#12121A',
  textPrimary: '#F8F8FF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
};

export interface TrackMetadata {
  title: string;
  artist: string;
  artwork?: string; // IPFS hash or URL
  video?: string; // IPFS hash or URL (for video podcasts)
  description?: string;
  duration?: number;
  genre?: string;
}

interface MediaPlayerProps {
  isPlaying: boolean;
  isLoading?: boolean;
  station?: BrowseStation | null;
  metadata?: TrackMetadata | null;
  onTogglePlay: () => void;
  onStop?: () => void;
  compact?: boolean;
}

export function MediaPlayer({
  isPlaying,
  isLoading = false,
  station,
  metadata,
  onTogglePlay,
  onStop,
  compact = false,
}: MediaPlayerProps) {
  const [artworkLoaded, setArtworkLoaded] = useState(false);
  const [artworkError, setArtworkError] = useState(false);

  // Get artwork URL (supports IPFS hash or direct URL)
  const getArtworkUrl = (): string | null => {
    if (metadata?.artwork) {
      // Check if it's an IPFS hash or full URL
      if (metadata.artwork.startsWith('Qm') || metadata.artwork.startsWith('bafy')) {
        return getIPFSUrl(metadata.artwork);
      }
      return metadata.artwork;
    }
    if (station?.favicon) {
      return station.favicon;
    }
    return null;
  };

  const artworkUrl = getArtworkUrl();
  const hasArtwork = artworkUrl && !artworkError;

  // Track info
  const title = metadata?.title || station?.name || 'Unknown Station';
  const artist = metadata?.artist || station?.country || 'Live Radio';
  const description = metadata?.description || station?.tags?.split(',').slice(0, 3).join(', ');

  if (compact) {
    return (
      <CompactMediaPlayer
        isPlaying={isPlaying}
        isLoading={isLoading}
        title={title}
        artist={artist}
        artworkUrl={artworkUrl}
        onTogglePlay={onTogglePlay}
        onStop={onStop}
      />
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      {/* Media Display Area */}
      <View style={styles.mediaContainer}>
        {hasArtwork ? (
          // Show artwork with circular visualizer overlay
          <View style={styles.artworkContainer}>
            <Image
              source={{ uri: artworkUrl! }}
              style={styles.artwork}
              onLoad={() => setArtworkLoaded(true)}
              onError={() => setArtworkError(true)}
            />
            {artworkLoaded && isPlaying && (
              <View style={styles.artworkOverlay}>
                <CircularVisualizer isPlaying={isPlaying} size={200} />
              </View>
            )}
            {!artworkLoaded && (
              <View style={styles.artworkPlaceholder}>
                <ActivityIndicator size="large" color={ILOWA_COLORS.cyan} />
              </View>
            )}
          </View>
        ) : (
          // No artwork - show full visualizer
          <View style={styles.visualizerContainer}>
            <AudioVisualizer
              isPlaying={isPlaying}
              barCount={48}
              height={200}
              colorScheme="gradient"
            />
            <View style={styles.visualizerIcon}>
              <Ionicons name="radio" size={48} color={ILOWA_COLORS.cyan} />
            </View>
          </View>
        )}
      </View>

      {/* Track Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {artist}
        </Text>
        {description && (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        <Pressable style={styles.controlButton} onPress={onTogglePlay} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator size="large" color={ILOWA_COLORS.cyan} />
          ) : (
            <Ionicons
              name={isPlaying ? 'pause-circle' : 'play-circle'}
              size={64}
              color={ILOWA_COLORS.cyan}
            />
          )}
        </Pressable>
        {onStop && (
          <Pressable style={styles.stopButton} onPress={onStop}>
            <Ionicons name="stop-circle" size={40} color={ILOWA_COLORS.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Mini visualizer always at bottom */}
      <View style={styles.miniVisualizerContainer}>
        <MiniVisualizer isPlaying={isPlaying} barCount={64} height={30} />
      </View>
    </Animated.View>
  );
}

/**
 * Compact media player for now-playing cards
 */
function CompactMediaPlayer({
  isPlaying,
  isLoading,
  title,
  artist,
  artworkUrl,
  onTogglePlay,
  onStop,
}: {
  isPlaying: boolean;
  isLoading?: boolean;
  title: string;
  artist: string;
  artworkUrl: string | null;
  onTogglePlay: () => void;
  onStop?: () => void;
}) {
  return (
    <View style={styles.compactContainer}>
      {/* Artwork or Icon */}
      {artworkUrl ? (
        <Image source={{ uri: artworkUrl }} style={styles.compactArtwork} />
      ) : (
        <View style={[styles.compactArtwork, styles.compactArtworkFallback]}>
          <Ionicons name="radio" size={20} color={ILOWA_COLORS.cyan} />
        </View>
      )}

      {/* Info */}
      <View style={styles.compactInfo}>
        <Text style={styles.compactTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.compactArtist} numberOfLines={1}>
          {artist}
        </Text>
      </View>

      {/* Mini visualizer */}
      <View style={styles.compactVisualizer}>
        <MiniVisualizer isPlaying={isPlaying} barCount={5} height={24} />
      </View>

      {/* Controls */}
      <Pressable onPress={onTogglePlay} disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator size="small" color={ILOWA_COLORS.cyan} />
        ) : (
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={24}
            color={ILOWA_COLORS.cyan}
          />
        )}
      </Pressable>

      {onStop && (
        <Pressable onPress={onStop} style={styles.compactStopBtn}>
          <Ionicons name="stop" size={20} color={ILOWA_COLORS.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

/**
 * Fetch metadata from IPFS for a track
 */
export async function fetchTrackMetadata(ipfsHash: string): Promise<TrackMetadata | null> {
  try {
    const metadataUrl = `${getIPFSUrl(ipfsHash)}/metadata.json`;
    const response = await fetch(metadataUrl);
    
    if (!response.ok) {
      // Try direct hash as metadata
      const directUrl = getIPFSUrl(`${ipfsHash}/metadata.json`);
      const directResponse = await fetch(directUrl);
      if (!directResponse.ok) return null;
      return await directResponse.json();
    }
    
    return await response.json();
  } catch (error) {
    console.warn('[MediaPlayer] Failed to fetch metadata:', error);
    return null;
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 16,
    overflow: 'hidden',
  },
  mediaContainer: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ILOWA_COLORS.dark,
  },
  artworkContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  artwork: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  artworkOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  artworkPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ILOWA_COLORS.dark,
  },
  visualizerContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  visualizerIcon: {
    position: 'absolute',
    opacity: 0.3,
  },
  infoContainer: {
    padding: 16,
    gap: 4,
  },
  title: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 20,
    color: ILOWA_COLORS.textPrimary,
  },
  artist: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: ILOWA_COLORS.purple,
  },
  description: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: ILOWA_COLORS.textSecondary,
    marginTop: 4,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 16,
  },
  controlButton: {
    padding: 8,
  },
  stopButton: {
    padding: 8,
  },
  miniVisualizerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  compactArtwork: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  compactArtworkFallback: {
    backgroundColor: ILOWA_COLORS.dark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactInfo: {
    flex: 1,
    gap: 2,
  },
  compactTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 14,
    color: ILOWA_COLORS.textPrimary,
  },
  compactArtist: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.textSecondary,
  },
  compactVisualizer: {
    width: 40,
  },
  compactStopBtn: {
    marginLeft: 4,
  },
});

export default MediaPlayer;
