import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  Alert,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { RadioTower, Compass, CalendarClock, Headphones, MapPin, Globe, Search, RefreshCw, Music2 } from 'lucide-react-native';
import { AudiusMusicBrowser } from '../../components/AudiusMusicBrowser';
import { FollowButton } from '../../components/FollowButton';
import { ILOWA_COLORS } from '../../theme/colors';
import { PODCAST_LIBRARY, getEpisodesForRegion } from '../../lib/podcasts/content-library';
import { RADIO_STATIONS } from '../../data/radio-stations';
import { RadioPlayer } from '../../components/RadioPlayer';
import { LiveIndicator } from '../../components/LiveIndicator';
import { XMTPChat } from '../../components/XMTPChat';
import { CallInButton } from '../../components/CallInButton';
import { TipDJButton } from '../../components/TipDJButton';
import { getStationStreamInfo, StreamInfo } from '../../lib/radio/stream';
import { usePlayerStore } from '../../lib/player/unified-player';
import { useRegion } from '../../hooks/useRegion';
import { useWallet } from '../../hooks/useWallet';
import { useTipDJ } from '../../hooks/useTipDJ';
import { useRadioBrowser } from '../../hooks/useRadioBrowser';
import { BrowseStation } from '../../types/radio';
import { getRegionCountryNames } from '../../lib/radio/radio-browser';

const { width } = Dimensions.get('window');

export default function RadioScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { config } = useRegion();
  const wallet = useWallet();
  const { tipDJ, loading: tipping } = useTipDJ(wallet);
  const player = usePlayerStore();
  const { isPlaying, isLoading } = player;
  const [activeTab, setActiveTab] = useState<'live' | 'schedule' | 'podcasts' | 'browse'>('live');
  const [streamInfo, setStreamInfo] = useState<StreamInfo>({
    isLive: false,
    streamUrl: null,
    viewerCount: 0,
  });
  const [showChat, setShowChat] = useState(false);
  const [browseSearchText, setBrowseSearchText] = useState('');
  const [browseSource, setBrowseSource] = useState<'radio' | 'audius'>('radio');
  
  // Get station for current region (map ElderRegionKey to station region)
  const regionMap: Record<string, string> = {
    westAfrica: 'west-africa',
    eastAfrica: 'east-africa',
    southernAfrica: 'southern-africa',
    latinAmerica: 'latin-america',
    southAsia: 'south-asia',
    southeastAsia: 'southeast-asia',
    mena: 'mena',
    caribbean: 'caribbean',
    pacific: 'pacific',
  };
  const stationRegion = config?.region ? regionMap[config.region] : 'west-africa';
  const station = RADIO_STATIONS.find(s => s.region === stationRegion) || RADIO_STATIONS[0];

  // Check stream status periodically
  useEffect(() => {
    const checkStream = async () => {
      const info = await getStationStreamInfo(station.id);
      setStreamInfo(info);
    };
    
    checkStream();
    const interval = setInterval(checkStream, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [station.id]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      player.stop();
    };
  }, []);

  // Toggle play/pause — works for ALL sources via unified player
  const togglePlay = useCallback(async () => {
    if (isLoading) return;

    try {
      if (isPlaying) {
        await player.pause();
      } else if (player.sound) {
        // Resume existing audio
        await player.resume();
      } else {
        // Start radio stream
        await player.playRadio(station, station.streamUrl);
      }
    } catch (error) {
      console.error('[Radio] Playback error:', error);
      Alert.alert('Playback Error', 'Could not play stream. Please try again.');
    }
  }, [isPlaying, isLoading, station, player]);

  // Radio Browser hook for Browse tab
  const radioBrowser = useRadioBrowser(stationRegion);
  const regionCountries = getRegionCountryNames(stationRegion);

  // Play a station from radio-browser.info via unified player
  const playBrowseStation = useCallback(async (browseStation: BrowseStation) => {
    if (isLoading) return;
    try {
      // Seed the full station list so next/prev navigation works
      const stations = radioBrowser.stations;
      if (stations.length > 0) {
        const idx = stations.findIndex(s => s.stationuuid === browseStation.stationuuid);
        player.setBrowseQueue(stations, idx >= 0 ? idx : 0);
      }
      await player.playBrowse(browseStation);
      radioBrowser.onStationClick(browseStation);
    } catch (error) {
      console.error('[Radio] Browse playback error:', error);
    }
  }, [isLoading, radioBrowser, player]);

  // Stop audio when switching browse source
  const handleSourceChange = useCallback(async (source: 'radio' | 'audius') => {
    if (source !== browseSource) {
      await player.stop();
      setBrowseSource(source);
    }
  }, [browseSource, player]);

  // Handle browse search
  const handleBrowseSearch = useCallback(() => {
    radioBrowser.search(browseSearchText);
  }, [browseSearchText, radioBrowser]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.header}>
          <Text style={styles.headerTitle}>Radio</Text>
          <LiveIndicator 
            isLive={streamInfo.isLive} 
            djName={streamInfo.isLive ? station.currentDJ?.name : undefined}
            viewerCount={streamInfo.viewerCount}
            size="medium"
          />
        </Animated.View>

        {/* Unified Media Player */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <RadioPlayer
            station={station}
            onTogglePlay={togglePlay}
          />
        </Animated.View>

        {/* Tab Switcher */}
        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.tabRow}>
          {[
            { key: 'live', label: 'Live', Icon: RadioTower },
            { key: 'browse', label: 'Browse', Icon: Compass },
            { key: 'schedule', label: 'Schedule', Icon: CalendarClock },
            { key: 'podcasts', label: 'Podcasts', Icon: Headphones },
          ].map(({ key, label, Icon }) => (
            <Pressable
              key={key}
              onPress={() => setActiveTab(key as typeof activeTab)}
              style={[
                styles.tabButton,
                activeTab === key && styles.tabButtonActive,
              ]}
            >
              <Icon
                size={18}
                color={activeTab === key ? ILOWA_COLORS.cyan : ILOWA_COLORS.textMuted}
                strokeWidth={2.5}
              />
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === key && styles.tabButtonTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </Animated.View>

        {/* Call-In and Actions */}
        {activeTab === 'live' && (
          <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.actionRow}>
            <CallInButton
              stationId={station.id}
              isLive={streamInfo.isLive}
              onCallInSubmitted={(text) => console.log('Call-in:', text)}
            />
            <TipDJButton
              djName={station.currentDJ?.name || 'DJ'}
              djWallet={station.currentDJ?.wallet}
              isLive={streamInfo.isLive}
              walletConnected={wallet.connected}
              onTip={async (amount) => {
                if (!wallet.connected) {
                  Alert.alert('Connect Wallet', 'Please connect your wallet to tip the DJ.');
                  return;
                }
                if (!station.currentDJ?.wallet) {
                  Alert.alert('Error', 'DJ wallet not configured.');
                  return;
                }
                const result = await tipDJ(station.currentDJ.wallet, amount);
                if (result.success) {
                  Alert.alert('🎉 Tip Sent!', `You tipped ${amount} SOL to ${station.currentDJ?.name || 'the DJ'}!`);
                } else {
                  Alert.alert('Tip Failed', result.error || 'Could not send tip.');
                }
              }}
            />
            {station.currentDJ?.wallet && (
              <FollowButton
                targetWallet={station.currentDJ.wallet}
                currentWallet={wallet.publicKey?.toBase58() || null}
                compact
              />
            )}
            <Pressable
              style={[styles.actionButton, showChat && styles.actionButtonActive]}
              onPress={() => setShowChat(!showChat)}
            >
              <Ionicons 
                name="chatbubbles" 
                size={24} 
                color={showChat ? ILOWA_COLORS.deepBlack : ILOWA_COLORS.cyan} 
              />
              <Text style={[styles.actionButtonText, showChat && styles.actionButtonTextActive]}>
                Chat
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Schedule */}
        {activeTab === 'schedule' && (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.scheduleList}>
            {station.schedule.map((slot, i) => (
              <View key={slot.id} style={styles.scheduleItem}>
                <View style={styles.scheduleTime}>
                  <Text style={styles.scheduleTimeText}>{slot.startTime}</Text>
                  <Text style={styles.scheduleDash}>—</Text>
                  <Text style={styles.scheduleTimeText}>{slot.endTime}</Text>
                </View>
                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleTitle}>{slot.title}</Text>
                  <Text style={styles.scheduleDJ}>{slot.djName}</Text>
                  <Text style={styles.scheduleGenre}>{slot.genre}</Text>
                </View>
                {slot.isLive && (
                  <View style={styles.scheduleLive}>
                    <Text style={styles.scheduleLiveText}>LIVE</Text>
                  </View>
                )}
              </View>
            ))}
          </Animated.View>
        )}

        {/* Podcasts — real episodes from content library */}
        {activeTab === 'podcasts' && (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.podcastList}>
            {getEpisodesForRegion(stationRegion).map((ep, i) => (
              <Pressable
                key={ep.id}
                style={styles.podcastItem}
                onPress={() => router.push(`/podcast/${ep.id}` as any)}
              >
                <View style={styles.podcastIcon}>
                  <Ionicons name="headset" size={24} color={ILOWA_COLORS.cyan} />
                </View>
                <View style={styles.podcastInfo}>
                  <Text style={styles.podcastTitle}>{ep.title}</Text>
                  <Text style={styles.podcastMeta}>
                    {ep.category} • {Math.ceil(ep.durationEstimate / 60)} min • {ep.difficulty}
                  </Text>
                </View>
                <Ionicons name="play-circle" size={32} color={ILOWA_COLORS.cyan} />
              </Pressable>
            ))}
          </Animated.View>
        )}

        {/* Browse Stations (radio-browser.info) */}
        {activeTab === 'browse' && (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.browseContainer}>
            {/* Source Toggle: Live Radio vs Audius Music */}
            <View style={styles.sourceToggle}>
              <Pressable
                style={[styles.sourceToggleBtn, browseSource === 'radio' && styles.sourceToggleBtnActive]}
                onPress={() => handleSourceChange('radio')}
              >
                <RadioTower size={16} color={browseSource === 'radio' ? ILOWA_COLORS.deepBlack : ILOWA_COLORS.textMuted} strokeWidth={2.5} />
                <Text style={[styles.sourceToggleText, browseSource === 'radio' && styles.sourceToggleTextActive]}>
                  Live Radio
                </Text>
              </Pressable>
              <Pressable
                style={[styles.sourceToggleBtn, browseSource === 'audius' && styles.sourceToggleBtnActive]}
                onPress={() => handleSourceChange('audius')}
              >
                <Music2 size={16} color={browseSource === 'audius' ? ILOWA_COLORS.deepBlack : ILOWA_COLORS.textMuted} strokeWidth={2.5} />
                <Text style={[styles.sourceToggleText, browseSource === 'audius' && styles.sourceToggleTextActive]}>
                  Audius Music
                </Text>
              </Pressable>
            </View>

            {/* Audius Music Browser */}
            {browseSource === 'audius' ? (
              <AudiusMusicBrowser
                region={stationRegion}
                onTrackPlay={() => {}}
              />
            ) : (
              <>
            {/* Regional / Global Sub-tabs */}
            <View style={styles.browseModeTabs}>
              <Pressable
                style={[styles.browseModeTab, radioBrowser.mode === 'regional' && styles.browseModeTabActive]}
                onPress={() => radioBrowser.setMode('regional')}
              >
                <MapPin size={16} color={radioBrowser.mode === 'regional' ? ILOWA_COLORS.cyan : ILOWA_COLORS.textMuted} strokeWidth={2.5} />
                <Text style={[styles.browseModeTabText, radioBrowser.mode === 'regional' && styles.browseModeTabTextActive]}>
                  My Region
                </Text>
              </Pressable>
              <Pressable
                style={[styles.browseModeTab, radioBrowser.mode === 'global' && styles.browseModeTabActive]}
                onPress={() => radioBrowser.setMode('global')}
              >
                <Globe size={16} color={radioBrowser.mode === 'global' ? ILOWA_COLORS.cyan : ILOWA_COLORS.textMuted} strokeWidth={2.5} />
                <Text style={[styles.browseModeTabText, radioBrowser.mode === 'global' && styles.browseModeTabTextActive]}>
                  Global Genres
                </Text>
              </Pressable>
            </View>

            {/* Genre Pills (Global mode only) */}
            {radioBrowser.mode === 'global' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreScroll} contentContainerStyle={styles.genreScrollContent}>
                {radioBrowser.genres.map((genre) => (
                  <Pressable
                    key={genre.id}
                    style={[styles.genrePill, radioBrowser.selectedGenre === genre.id && styles.genrePillActive]}
                    onPress={() => radioBrowser.selectGenre(genre.id)}
                  >
                    <Text style={styles.genrePillIcon}>{genre.icon}</Text>
                    <Text style={[styles.genrePillText, radioBrowser.selectedGenre === genre.id && styles.genrePillTextActive]}>
                      {genre.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* Search Bar */}
            <View style={styles.browseSearchRow}>
              <View style={styles.browseSearchInputWrap}>
                <Search size={18} color={ILOWA_COLORS.textMuted} strokeWidth={2.5} />
                <TextInput
                  style={styles.browseSearchInput}
                  placeholder="Search stations..."
                  placeholderTextColor={ILOWA_COLORS.textMuted}
                  value={browseSearchText}
                  onChangeText={setBrowseSearchText}
                  onSubmitEditing={handleBrowseSearch}
                  returnKeyType="search"
                />
                {browseSearchText.length > 0 && (
                  <Pressable onPress={() => { setBrowseSearchText(''); radioBrowser.search(''); }}>
                    <Ionicons name="close-circle" size={18} color={ILOWA_COLORS.textMuted} />
                  </Pressable>
                )}
              </View>
              <Pressable style={styles.browseRefreshBtn} onPress={radioBrowser.refresh}>
                <RefreshCw size={20} color={ILOWA_COLORS.cyan} strokeWidth={2.5} />
              </Pressable>
            </View>

            {/* Context Hint */}
            <Text style={styles.browseRegionHint}>
              {radioBrowser.searchQuery
                ? `Search: "${radioBrowser.searchQuery}"`
                : radioBrowser.mode === 'regional'
                  ? `Stations from ${regionCountries.slice(0, 3).join(', ')}${regionCountries.length > 3 ? ' +more' : ''}`
                  : radioBrowser.selectedGenre
                    ? `${radioBrowser.genres.find(g => g.id === radioBrowser.selectedGenre)?.name || 'Genre'} stations worldwide`
                    : 'Select a genre'
              }
            </Text>

            {/* Now Playing Mini Card */}
            {player.currentBrowseStation && player.source === 'browse' && isPlaying && (
              <View style={styles.browseNowPlaying}>
                {player.currentBrowseStation.favicon ? (
                  <Image source={{ uri: player.currentBrowseStation.favicon }} style={styles.browseNowPlayingIcon} />
                ) : (
                  <View style={[styles.browseNowPlayingIcon, styles.browseNowPlayingIconFallback]}>
                    <Ionicons name="radio" size={16} color={ILOWA_COLORS.cyan} />
                  </View>
                )}
                <View style={styles.browseNowPlayingInfo}>
                  <Text style={styles.browseNowPlayingName} numberOfLines={1}>
                    {player.currentBrowseStation.name}
                  </Text>
                  <Text style={styles.browseNowPlayingMeta} numberOfLines={1}>
                    {player.currentBrowseStation.country} • {player.currentBrowseStation.tags.split(',').slice(0, 2).join(', ')}
                  </Text>
                </View>
                <Pressable onPress={() => player.stop()}>
                  <Ionicons name="stop-circle" size={28} color={ILOWA_COLORS.doubt} />
                </Pressable>
              </View>
            )}

            {/* Loading */}
            {radioBrowser.loading && (
              <View style={styles.browseLoading}>
                <ActivityIndicator size="small" color={ILOWA_COLORS.cyan} />
                <Text style={styles.browseLoadingText}>Loading stations...</Text>
              </View>
            )}

            {/* Error */}
            {radioBrowser.error && (
              <View style={styles.browseError}>
                <Ionicons name="warning" size={18} color={ILOWA_COLORS.gold} />
                <Text style={styles.browseErrorText}>{radioBrowser.error}</Text>
              </View>
            )}

            {/* Station List */}
            {radioBrowser.stations.map((s) => {
              const isCurrentlyPlaying = player.currentBrowseStation?.stationuuid === s.stationuuid && player.source === 'browse' && isPlaying;
              return (
                <Pressable
                  key={s.stationuuid}
                  style={[styles.browseItem, isCurrentlyPlaying && styles.browseItemActive]}
                  onPress={() => playBrowseStation(s)}
                >
                  {s.favicon ? (
                    <Image source={{ uri: s.favicon }} style={styles.browseFavicon} />
                  ) : (
                    <View style={[styles.browseFavicon, styles.browseFaviconFallback]}>
                      <Ionicons name="radio" size={20} color={ILOWA_COLORS.textMuted} />
                    </View>
                  )}
                  <View style={styles.browseItemInfo}>
                    <Text style={styles.browseItemName} numberOfLines={1}>{s.name}</Text>
                    <Text style={styles.browseItemMeta} numberOfLines={1}>
                      {s.country} • {s.tags.split(',').slice(0, 2).join(', ') || s.codec}
                    </Text>
                    <Text style={styles.browseItemStats}>
                      {s.bitrate > 0 ? `${s.bitrate}kbps` : ''}{s.bitrate > 0 && s.clickcount > 0 ? ' • ' : ''}{s.clickcount > 0 ? `${s.clickcount} plays` : ''}
                    </Text>
                  </View>
                  {isCurrentlyPlaying ? (
                    <Ionicons name="volume-high" size={22} color={ILOWA_COLORS.cyan} />
                  ) : isLoading && player.currentBrowseStation?.stationuuid === s.stationuuid ? (
                    <ActivityIndicator size="small" color={ILOWA_COLORS.cyan} />
                  ) : (
                    <Ionicons name="play-circle" size={28} color={ILOWA_COLORS.cyan} />
                  )}
                </Pressable>
              );
            })}

            {/* Empty state */}
            {!radioBrowser.loading && radioBrowser.stations.length === 0 && (
              <View style={styles.browseEmpty}>
                <Ionicons name="radio-outline" size={48} color={ILOWA_COLORS.textMuted} />
                <Text style={styles.browseEmptyText}>No stations found</Text>
                <Text style={styles.browseEmptyHint}>Try a different search or refresh</Text>
              </View>
            )}
              </>
            )}
          </Animated.View>
        )}

        {/* XMTP Chat */}
        {activeTab === 'live' && showChat && (
          <Animated.View entering={FadeInDown.delay(500).duration(500)} style={styles.chatContainer}>
            <XMTPChat
              stationId={station.id}
              isVisible={showChat}
              userAddress={wallet.publicKey?.toBase58()}
            />
          </Animated.View>
        )}

        {/* Stream Info */}
        {activeTab === 'live' && !showChat && (
          <Animated.View entering={FadeInDown.delay(500).duration(500)} style={styles.streamInfo}>
            <View style={styles.streamInfoRow}>
              <Ionicons name="musical-notes" size={18} color={ILOWA_COLORS.cyan} />
              <Text style={styles.streamInfoText}>
                {streamInfo.isLive 
                  ? `Live from ${station.name}` 
                  : streamInfo.currentTrack || 'Playing: Afrobeats Mix'
                }
              </Text>
            </View>
            <Text style={styles.streamInfoHint}>
              {streamInfo.isLive 
                ? 'Tap Chat to join the conversation'
                : 'DJ will be live soon • Enjoying curated playlist'
              }
            </Text>
          </Animated.View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ILOWA_COLORS.deepBlack,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  headerTitle: {
    fontFamily: 'Sora-Bold',
    fontSize: 28,
    color: ILOWA_COLORS.textPrimary,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ILOWA_COLORS.doubt,
  },
  liveText: {
    fontFamily: 'Sora-Bold',
    fontSize: 11,
    color: ILOWA_COLORS.doubt,
    letterSpacing: 1,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 16,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'column',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: ILOWA_COLORS.cardDark,
    alignItems: 'center',
    gap: 4,
  },
  tabButtonActive: {
    backgroundColor: ILOWA_COLORS.cyan,
  },
  tabButtonText: {
    fontFamily: 'Sora',
    fontSize: 13,
    color: ILOWA_COLORS.textMuted,
  },
  tabButtonTextActive: {
    color: ILOWA_COLORS.deepBlack,
    fontFamily: 'Sora-Bold',
  },
  callInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ILOWA_COLORS.gold,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 20,
  },
  callInText: {
    fontFamily: 'Sora-Bold',
    fontSize: 14,
    color: ILOWA_COLORS.deepBlack,
  },
  scheduleList: {
    gap: 12,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  scheduleTime: {
    alignItems: 'center',
    width: 50,
  },
  scheduleTimeText: {
    fontFamily: 'Sora',
    fontSize: 12,
    color: ILOWA_COLORS.textSecondary,
  },
  scheduleDash: {
    fontFamily: 'Inter',
    fontSize: 10,
    color: ILOWA_COLORS.textMuted,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 14,
    color: ILOWA_COLORS.textPrimary,
    marginBottom: 2,
  },
  scheduleDJ: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.textSecondary,
  },
  scheduleGenre: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: ILOWA_COLORS.textMuted,
    marginTop: 2,
  },
  scheduleLive: {
    backgroundColor: ILOWA_COLORS.doubt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  scheduleLiveText: {
    fontFamily: 'Sora-Bold',
    fontSize: 10,
    color: '#fff',
    letterSpacing: 1,
  },
  podcastList: {
    gap: 12,
  },
  podcastItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  podcastIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  podcastInfo: {
    flex: 1,
  },
  podcastTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 14,
    color: ILOWA_COLORS.textPrimary,
    marginBottom: 2,
  },
  podcastMeta: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.textMuted,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 20,
    paddingVertical: 8,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: ILOWA_COLORS.cardDark,
  },
  actionButtonActive: {
    backgroundColor: ILOWA_COLORS.cyan,
  },
  actionButtonText: {
    fontFamily: 'Sora',
    fontSize: 12,
    color: ILOWA_COLORS.cyan,
  },
  actionButtonTextActive: {
    color: ILOWA_COLORS.deepBlack,
  },
  chatContainer: {
    height: 300,
    marginBottom: 16,
  },
  streamInfo: {
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  streamInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  streamInfoText: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 14,
    color: ILOWA_COLORS.textPrimary,
  },
  streamInfoHint: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.textMuted,
  },
  chatPreview: {
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  chatTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 14,
    color: ILOWA_COLORS.textPrimary,
    flex: 1,
  },
  chatCount: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.textMuted,
  },
  chatMessages: {
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatEmpty: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: ILOWA_COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  browseContainer: {
    gap: 10,
  },
  sourceToggle: {
    flexDirection: 'row',
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  sourceToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  sourceToggleBtnActive: {
    backgroundColor: ILOWA_COLORS.cyan,
  },
  sourceToggleText: {
    fontFamily: 'Sora',
    fontSize: 13,
    color: ILOWA_COLORS.textMuted,
  },
  sourceToggleTextActive: {
    color: ILOWA_COLORS.deepBlack,
    fontFamily: 'Sora-SemiBold',
  },
  browseModeTabs: {
    flexDirection: 'row',
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  browseModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  browseModeTabActive: {
    backgroundColor: 'rgba(0, 217, 255, 0.15)',
  },
  browseModeTabText: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: ILOWA_COLORS.textMuted,
  },
  browseModeTabTextActive: {
    fontFamily: 'Sora-SemiBold',
    color: ILOWA_COLORS.cyan,
  },
  genreScroll: {
    marginHorizontal: -20,
    marginTop: 4,
  },
  genreScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  genrePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ILOWA_COLORS.cardDark,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  genrePillActive: {
    backgroundColor: 'rgba(0, 217, 255, 0.12)',
    borderColor: ILOWA_COLORS.cyan,
  },
  genrePillIcon: {
    fontSize: 14,
  },
  genrePillText: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: ILOWA_COLORS.textSecondary,
  },
  genrePillTextActive: {
    fontFamily: 'Sora-SemiBold',
    color: ILOWA_COLORS.cyan,
  },
  browseSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  browseSearchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  browseSearchInput: {
    flex: 1,
    fontFamily: 'Inter',
    fontSize: 14,
    color: ILOWA_COLORS.textPrimary,
    paddingVertical: 0,
  },
  browseRefreshBtn: {
    padding: 10,
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 12,
  },
  browseRegionHint: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.textMuted,
    marginBottom: 4,
  },
  browseNowPlaying: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 217, 255, 0.08)',
    borderRadius: 12,
    padding: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 255, 0.2)',
  },
  browseNowPlayingIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  browseNowPlayingIconFallback: {
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  browseNowPlayingInfo: {
    flex: 1,
  },
  browseNowPlayingName: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 13,
    color: ILOWA_COLORS.cyan,
  },
  browseNowPlayingMeta: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: ILOWA_COLORS.textMuted,
  },
  browseNowPlayingVisualizer: {
    width: 40,
    marginRight: 8,
  },
  browseLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  browseLoadingText: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: ILOWA_COLORS.textMuted,
  },
  browseError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 179, 0, 0.1)',
    borderRadius: 10,
    padding: 10,
  },
  browseErrorText: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.gold,
    flex: 1,
  },
  browseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  browseItemActive: {
    borderWidth: 1,
    borderColor: ILOWA_COLORS.cyan,
    backgroundColor: 'rgba(0, 217, 255, 0.05)',
  },
  browseFavicon: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  browseFaviconFallback: {
    backgroundColor: ILOWA_COLORS.cardDark,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  browseItemInfo: {
    flex: 1,
  },
  browseItemName: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 14,
    color: ILOWA_COLORS.textPrimary,
    marginBottom: 2,
  },
  browseItemMeta: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.textSecondary,
  },
  browseItemStats: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: ILOWA_COLORS.textMuted,
    marginTop: 2,
  },
  browseEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  browseEmptyText: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 16,
    color: ILOWA_COLORS.textSecondary,
  },
  browseEmptyHint: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: ILOWA_COLORS.textMuted,
  },
});
