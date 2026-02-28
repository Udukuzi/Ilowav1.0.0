/**
 * Audius Music Browser Component
 * 
 * Browse and play music from Audius in the Radio tab
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Play, Pause, Search, Music2, Heart } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { ILOWA_COLORS } from '../theme/colors';
import {
  AudiusTrack,
  getRegionalTracks,
  searchAudiusTracks,
  getAudiusTrendingTracks,
  formatDuration,
  formatPlayCount,
  AUDIUS_GENRES,
} from '../lib/music/audius';
import { usePlayerStore } from '../lib/player/unified-player';

interface AudiusMusicBrowserProps {
  region: string;
  onTrackPlay?: (track: AudiusTrack) => void;
}

export function AudiusMusicBrowser({ region, onTrackPlay }: AudiusMusicBrowserProps) {
  const [tracks, setTracks] = useState<AudiusTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const player = usePlayerStore();
  const isPlayingRef = useRef(false);
  const navRouter = useRouter();

  const loadTracks = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      let result: AudiusTrack[];
      
      if (searchQuery.trim()) {
        result = await searchAudiusTracks(searchQuery);
      } else if (selectedGenre !== 'All') {
        result = await getAudiusTrendingTracks(selectedGenre);
      } else {
        result = await getRegionalTracks(region);
      }
      
      setTracks(result);
    } catch (err) {
      setError('Failed to load tracks');
      console.error('[AudiusBrowser] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [region, searchQuery, selectedGenre]);

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  const handlePlay = async (track: AudiusTrack) => {
    // Prevent double-tap race conditions
    if (isPlayingRef.current || player.isLoading) return;
    isPlayingRef.current = true;
    
    try {
      // If tapping same track that's playing, stop it
      if (player.currentAudiusTrack?.id === track.id && player.isPlaying) {
        await player.stop();
        isPlayingRef.current = false;
        return;
      }
      
      // Play via unified player — pass full track list so next/prev works
      const startIdx = tracks.findIndex(t => t.id === track.id);
      await player.playAudius(track, tracks.length > 0 ? tracks : undefined);
      if (tracks.length > 0 && startIdx >= 0) {
        player.setQueue(tracks, startIdx);
      }
      onTrackPlay?.(track);
    } catch (err) {
      console.error('[AudiusBrowser] Play error:', err);
    } finally {
      isPlayingRef.current = false;
    }
  };

  const handleSearch = () => {
    loadTracks();
  };

  const renderTrack = ({ item, index }: { item: AudiusTrack; index: number }) => {
    const isActive = player.currentAudiusTrack?.id === item.id && player.source === 'audius';
    
    return (
      <View style={[styles.trackCard, isActive && styles.trackCardActive]}>
        <Pressable
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}
          onPress={() => {
            if (item.artistId) {
              navRouter.push(`/artist/${item.artistId}` as any);
            } else {
              handlePlay(item);
            }
          }}
        >
          {item.artwork ? (
            <Image source={{ uri: item.artwork }} style={styles.artwork} />
          ) : (
            <View style={[styles.artwork, styles.artworkFallback]}>
              <Music2 size={24} color={ILOWA_COLORS.purple} />
            </View>
          )}
          
          <View style={styles.trackInfo}>
            <Text style={styles.trackTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.trackArtist, item.artistId && { textDecorationLine: 'underline' }]} numberOfLines={1}>
              {item.artist}
            </Text>
            <View style={styles.trackMeta}>
              <Text style={styles.trackStats}>
                {formatPlayCount(item.playCount || 0)} plays
              </Text>
              {item.duration > 0 && (
                <Text style={styles.trackDuration}>
                  {formatDuration(item.duration)}
                </Text>
              )}
            </View>
          </View>
        </Pressable>
        
        <Pressable
          style={[styles.playButton, isActive && player.isPlaying && styles.playButtonActive]}
          onPress={() => handlePlay(item)}
        >
          {isActive && player.isPlaying ? (
            <Pause size={20} color={ILOWA_COLORS.deepBlack} fill={ILOWA_COLORS.deepBlack} />
          ) : (
            <Play size={20} color={ILOWA_COLORS.deepBlack} fill={ILOWA_COLORS.deepBlack} />
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Search size={18} color={ILOWA_COLORS.textMuted} strokeWidth={2.5} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Audius music..."
            placeholderTextColor={ILOWA_COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Genre Pills - Using ScrollView to avoid VirtualizedList nesting */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.genreRow}
      >
        {AUDIUS_GENRES.slice(0, 10).map((genre) => (
          <Pressable
            key={genre}
            style={[
              styles.genrePill,
              selectedGenre === genre && styles.genrePillActive,
            ]}
            onPress={() => {
              setSelectedGenre(genre);
              setSearchQuery('');
            }}
          >
            <Text
              style={[
                styles.genrePillText,
                selectedGenre === genre && styles.genrePillTextActive,
              ]}
            >
              {genre}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {searchQuery
            ? `Search: "${searchQuery}"`
            : selectedGenre !== 'All'
              ? `${selectedGenre} Music`
              : 'Trending on Audius'}
        </Text>
        <Text style={styles.trackCount}>
          {tracks.length} tracks
        </Text>
      </View>

      {/* Track List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ILOWA_COLORS.purple} />
          <Text style={styles.loadingText}>Loading Audius tracks...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadTracks}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : tracks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Music2 size={48} color={ILOWA_COLORS.textMuted} />
          <Text style={styles.emptyText}>No tracks found</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.trackList}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
        >
          {tracks.map((item, index) => (
            <View key={item.id}>
              {renderTrack({ item, index })}
              {index < tracks.length - 1 && <View style={{ height: 10 }} />}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchRow: {
    marginBottom: 12,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter',
    fontSize: 14,
    color: ILOWA_COLORS.textPrimary,
    paddingVertical: 12,
  },
  genreRow: {
    gap: 8,
    paddingBottom: 12,
  },
  genrePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: ILOWA_COLORS.cardDark,
  },
  genrePillActive: {
    backgroundColor: ILOWA_COLORS.purple,
  },
  genrePillText: {
    fontFamily: 'Sora',
    fontSize: 12,
    color: ILOWA_COLORS.textSecondary,
  },
  genrePillTextActive: {
    color: 'white',
    fontFamily: 'Sora-SemiBold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 14,
    color: ILOWA_COLORS.textPrimary,
  },
  trackCount: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.textMuted,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: ILOWA_COLORS.textMuted,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  errorText: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: ILOWA_COLORS.doubt,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: ILOWA_COLORS.purple,
    borderRadius: 12,
  },
  retryButtonText: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 13,
    color: 'white',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: ILOWA_COLORS.textMuted,
  },
  trackList: {
    paddingBottom: 20,
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  trackCardActive: {
    borderWidth: 1,
    borderColor: ILOWA_COLORS.purple,
    backgroundColor: 'rgba(139, 92, 246, 0.05)',
  },
  artwork: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  artworkFallback: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 14,
    color: ILOWA_COLORS.textPrimary,
    marginBottom: 2,
  },
  trackArtist: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: ILOWA_COLORS.textSecondary,
    marginBottom: 4,
  },
  trackMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  trackStats: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: ILOWA_COLORS.textMuted,
  },
  trackDuration: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: ILOWA_COLORS.textMuted,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ILOWA_COLORS.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonActive: {
    backgroundColor: ILOWA_COLORS.purple,
  },
});
