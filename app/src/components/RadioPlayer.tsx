import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Image, Dimensions, Modal, StatusBar, TouchableOpacity, Platform } from 'react-native';
import Animated, { useAnimatedStyle, withRepeat, withSequence, withTiming, useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Music2, SkipBack, SkipForward, Repeat, Repeat1, Shuffle, Maximize2, Minimize2, RotateCw, X, ChevronDown, Volume2, VolumeX, Heart, Rewind, FastForward } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ILOWA_COLORS } from '../theme/colors';
import { RadioStation } from '../types/radio';
import { usePlayerStore } from '../lib/player/unified-player';
import { PremiumWaveVisualizer } from './PremiumWaveVisualizer';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type PlayerMode = 'normal' | 'expanded' | 'fullscreen' | 'mini';

interface RadioPlayerProps {
  station: RadioStation;
  onTogglePlay: () => void;
}

type RepeatMode = 'off' | 'one' | 'all';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function RadioPlayer({ station, onTogglePlay }: RadioPlayerProps) {
  const player = usePlayerStore();
  const navRouter = useRouter();
  const { source, isPlaying, isLoading, title, artist, artwork, isRepeat, isShuffle, queue } = player;
  
  const [playerMode, setPlayerMode] = useState<PlayerMode>('normal');
  const [rotation, setRotation] = useState(0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [seekBarWidth, setSeekBarWidth] = useState(1);

  // Seek forward/backward 10 seconds
  const handleSeekForward = async () => {
    if (player.sound) {
      const status = await player.sound.getStatusAsync();
      if (status.isLoaded) {
        const newPosition = Math.min(status.positionMillis + 10000, status.durationMillis || status.positionMillis);
        await player.sound.setPositionAsync(newPosition);
      }
    }
  };

  const handleSeekBackward = async () => {
    if (player.sound) {
      const status = await player.sound.getStatusAsync();
      if (status.isLoaded) {
        const newPosition = Math.max(status.positionMillis - 10000, 0);
        await player.sound.setPositionAsync(newPosition);
      }
    }
  };

  const handleToggleLike = () => {
    setIsLiked(!isLiked);
    // TODO: Persist to favorites store for analytics
  };
  
  // Animation values
  const glowOpacity = useSharedValue(0.3);
  const mediaScale = useSharedValue(1);
  const translateY = useSharedValue(0);
  
  const glowStyle = useAnimatedStyle(() => ({
    // static glow on Android to avoid per-frame withRepeat allocation
    opacity: Platform.OS === 'android'
      ? (isPlaying ? 0.45 : 0.2)
      : isPlaying ? withRepeat(
          withSequence(
            withTiming(0.6, { duration: 1200 }),
            withTiming(0.3, { duration: 1200 })
          ), -1, true
        ) : 0.2,
  }));

  const mediaAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: mediaScale.value }],
  }));

  // Gesture handlers for swipe up/down
  const setModeFromGesture = useCallback((mode: PlayerMode) => {
    setPlayerMode(mode);
  }, []);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (playerMode === 'normal' && event.translationY < -50) {
        translateY.value = event.translationY;
      } else if (playerMode === 'expanded' && event.translationY > 50) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (playerMode === 'normal' && event.translationY < -100) {
        runOnJS(setModeFromGesture)('expanded');
      } else if (playerMode === 'expanded' && event.translationY > 100) {
        runOnJS(setModeFromGesture)('normal');
      }
      translateY.value = withSpring(0);
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (playerMode === 'normal') {
        runOnJS(setModeFromGesture)('expanded');
      } else if (playerMode === 'expanded') {
        runOnJS(setModeFromGesture)('fullscreen');
      }
    });

  const composedGestures = Gesture.Race(doubleTapGesture, panGesture);

  // Determine display info based on source
  const displayTitle = title || station.name;
  const displayArtist = artist || (station.currentDJ ? `DJ ${station.currentDJ.name}` : 'Live Radio');
  const hasArtwork = !!artwork;
  const hasVideo = false; // TODO: Check for video URL in track
  const isAudius = source === 'audius';
  const hasQueue = queue.length >= 1; // show controls for any Audius track

  // Source badge
  const sourceBadge = source === 'audius' ? '♫ Audius' 
    : source === 'browse' ? '📻 Browse' 
    : source === 'radio' ? '🔴 Live' 
    : '📻 Radio';

  const sourceColor = source === 'audius' ? ILOWA_COLORS.purple 
    : source === 'browse' ? ILOWA_COLORS.gold 
    : ILOWA_COLORS.cyan;

  const handleRepeatToggle = () => {
    const modes: RepeatMode[] = ['off', 'one', 'all'];
    const currentIndex = modes.indexOf(repeatMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setRepeatMode(nextMode);
    if (nextMode === 'one') {
      player.toggleRepeat(); // Enable repeat
    } else if (nextMode === 'off' && isRepeat) {
      player.toggleRepeat(); // Disable repeat
    }
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleToggleMode = () => {
    if (playerMode === 'normal') setPlayerMode('expanded');
    else if (playerMode === 'expanded') setPlayerMode('fullscreen');
    else if (playerMode === 'fullscreen') setPlayerMode('expanded');
  };

  const handleMinimize = () => {
    if (playerMode === 'fullscreen') setPlayerMode('expanded');
    else if (playerMode === 'expanded') setPlayerMode('normal');
    else setPlayerMode('mini');
  };

  const handleCloseFullscreen = () => {
    setPlayerMode('expanded');
  };

  const handleToggleMute = async () => {
    if (player.sound) {
      await player.sound.setIsMutedAsync(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleControlsVisibility = () => {
    setShowControls(!showControls);
  };

  // Get media viewport dimensions based on mode
  const getMediaHeight = () => {
    switch (playerMode) {
      case 'mini': return 60;
      case 'normal': return 200;
      case 'expanded': return 320;
      case 'fullscreen': return SCREEN_HEIGHT;
      default: return 200;
    }
  };

  const getArtworkSize = () => {
    switch (playerMode) {
      case 'mini': return 48;
      case 'normal': return 140;
      case 'expanded': return 220;
      case 'fullscreen': return Math.min(SCREEN_WIDTH - 60, 360);
      default: return 140;
    }
  };

  // Mini Player Mode
  if (playerMode === 'mini') {
    return (
      <Pressable 
        style={styles.miniPlayer}
        onPress={() => setPlayerMode('normal')}
      >
        <LinearGradient
          colors={['rgba(20,20,30,0.98)', 'rgba(10,10,15,0.98)']}
          style={styles.miniPlayerGradient}
        >
          {hasArtwork ? (
            <Image source={{ uri: artwork! }} style={styles.miniArtwork} />
          ) : (
            <View style={[styles.miniIcon, { backgroundColor: `${sourceColor}20` }]}>
              <Ionicons name="radio" size={20} color={sourceColor} />
            </View>
          )}
          <View style={styles.miniInfo}>
            <Text style={styles.miniTitle} numberOfLines={1}>{displayTitle}</Text>
            <Pressable
              onPress={() => isAudius && player.currentAudiusTrack?.artistId && navRouter.push(`/artist/${player.currentAudiusTrack.artistId}` as any)}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            >
              <Text style={[styles.miniArtist, isAudius && { textDecorationLine: 'underline' }]} numberOfLines={1}>{displayArtist}</Text>
            </Pressable>
          </View>
          <Pressable onPress={onTogglePlay} style={styles.miniPlayBtn}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color={ILOWA_COLORS.textPrimary} />
          </Pressable>
          <Pressable onPress={() => setPlayerMode('normal')} style={styles.miniExpandBtn}>
            <Maximize2 size={18} color={ILOWA_COLORS.textMuted} />
          </Pressable>
        </LinearGradient>
      </Pressable>
    );
  }

  // Fullscreen Modal
  const renderFullscreenModal = () => (
    <Modal
      visible={playerMode === 'fullscreen'}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleCloseFullscreen}
    >
      <StatusBar hidden />
      <View style={styles.fullscreenContainer}>
        <LinearGradient
          colors={['#0a0a0f', '#141428', '#0a0a0f']}
          style={StyleSheet.absoluteFill}
        />
        
        {/* Close button */}
        <Pressable style={styles.fullscreenClose} onPress={handleCloseFullscreen}>
          <ChevronDown size={28} color={ILOWA_COLORS.textPrimary} />
        </Pressable>

        {/* Main media area */}
        <Pressable 
          style={styles.fullscreenMedia}
          onPress={toggleControlsVisibility}
        >
          {hasArtwork ? (
            <View style={[styles.fullscreenArtworkWrapper, { transform: [{ rotate: `${rotation}deg` }] }]}>
              <Image source={{ uri: artwork! }} style={styles.fullscreenArtworkBg} blurRadius={50} />
              <Image 
                source={{ uri: artwork! }} 
                style={[styles.fullscreenArtwork, { width: getArtworkSize(), height: getArtworkSize() }]} 
              />
            </View>
          ) : (
            <PremiumWaveVisualizer
              isPlaying={isPlaying}
              height={300}
              accentColor={sourceColor}
              style={styles.fullscreenVisualizer}
            />
          )}
        </Pressable>

        {/* Track info */}
        <View style={styles.fullscreenInfo}>
          <Text style={styles.fullscreenTitle} numberOfLines={2}>{displayTitle}</Text>
          <Pressable
            onPress={() => isAudius && player.currentAudiusTrack?.artistId && navRouter.push(`/artist/${player.currentAudiusTrack.artistId}` as any)}
          >
            <Text style={[styles.fullscreenArtist, isAudius && { textDecorationLine: 'underline' }]} numberOfLines={1}>{displayArtist}</Text>
          </Pressable>
          <View style={[styles.sourceBadge, { backgroundColor: `${sourceColor}20`, alignSelf: 'center', marginTop: 8 }]}>
            <Text style={[styles.sourceBadgeText, { color: sourceColor }]}>{sourceBadge}</Text>
          </View>
        </View>

        {/* Full controls */}
        {showControls && (
          <View style={styles.fullscreenControls}>
            {/* Secondary controls row */}
            <View style={styles.fullscreenSecondaryControls}>
              <Pressable onPress={handleToggleMute} style={styles.fullscreenSecBtn}>
                {isMuted ? (
                  <VolumeX size={22} color={ILOWA_COLORS.textMuted} />
                ) : (
                  <Volume2 size={22} color={ILOWA_COLORS.textSecondary} />
                )}
              </Pressable>
              <Pressable onPress={handleToggleLike} style={styles.fullscreenSecBtn}>
                <Heart 
                  size={22} 
                  color={isLiked ? '#EC4899' : ILOWA_COLORS.textSecondary} 
                  fill={isLiked ? '#EC4899' : 'transparent'}
                />
              </Pressable>
              {hasArtwork && (
                <Pressable onPress={handleRotate} style={styles.fullscreenSecBtn}>
                  <RotateCw size={22} color={ILOWA_COLORS.textSecondary} />
                </Pressable>
              )}
            </View>

            {/* ±10s seek row — Audius only, clearly labelled */}
            {isAudius && (
              <View style={styles.seekControlsRow}>
                <Pressable onPress={handleSeekBackward} style={styles.seekBtn}>
                  <Rewind size={18} color={ILOWA_COLORS.textSecondary} />
                  <Text style={styles.seekLabel}>-10s</Text>
                </Pressable>
                <Pressable onPress={handleSeekForward} style={styles.seekBtn}>
                  <FastForward size={18} color={ILOWA_COLORS.textSecondary} />
                  <Text style={styles.seekLabel}>+10s</Text>
                </Pressable>
              </View>
            )}

            {/* Main navigation controls — always navigate prev/next */}
            <View style={styles.fullscreenMainControls}>
              <Pressable onPress={() => player.toggleShuffle()} style={styles.fullscreenCtrlBtn}>
                <Shuffle size={24} color={isShuffle ? ILOWA_COLORS.cyan : ILOWA_COLORS.textMuted} />
              </Pressable>

              <Pressable onPress={() => player.previous()} style={styles.fullscreenCtrlBtn}>
                <SkipBack size={32} color={ILOWA_COLORS.textPrimary} fill={ILOWA_COLORS.textPrimary} />
              </Pressable>

              <Pressable onPress={onTogglePlay} disabled={isLoading}>
                <LinearGradient
                  colors={[sourceColor, `${sourceColor}CC`]}
                  style={styles.fullscreenPlayBtn}
                >
                  {isLoading ? (
                    <ActivityIndicator size="large" color={ILOWA_COLORS.deepBlack} />
                  ) : (
                    <Ionicons name={isPlaying ? 'pause' : 'play'} size={40} color={ILOWA_COLORS.deepBlack} />
                  )}
                </LinearGradient>
              </Pressable>

              <Pressable onPress={() => player.next()} style={styles.fullscreenCtrlBtn}>
                <SkipForward size={32} color={ILOWA_COLORS.textPrimary} fill={ILOWA_COLORS.textPrimary} />
              </Pressable>

              <Pressable onPress={handleRepeatToggle} style={styles.fullscreenCtrlBtn}>
                {repeatMode === 'one' ? (
                  <Repeat1 size={24} color={ILOWA_COLORS.cyan} />
                ) : (
                  <Repeat size={24} color={repeatMode === 'all' ? ILOWA_COLORS.cyan : ILOWA_COLORS.textMuted} />
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );

  return (
    <>
    {renderFullscreenModal()}
    <GestureHandlerRootView>
    <GestureDetector gesture={composedGestures}>
    <View style={[styles.card, { borderColor: `${sourceColor}20` }]}>
      {/* Top Info Row */}
      <View style={styles.stationInfo}>
        {/* Artwork / Icon */}
        {hasArtwork ? (
          <Image source={{ uri: artwork! }} style={styles.artworkImage} />
        ) : (
          <View style={[styles.stationIcon, { backgroundColor: `${sourceColor}15` }]}>
            {source === 'audius' ? (
              <Music2 size={28} color={ILOWA_COLORS.purple} />
            ) : (
              <Ionicons name="radio" size={28} color={sourceColor} />
            )}
          </View>
        )}

        <View style={styles.stationText}>
          <Text style={styles.stationName} numberOfLines={1}>{displayTitle}</Text>
          <Pressable
            onPress={() => isAudius && player.currentAudiusTrack?.artistId && navRouter.push(`/artist/${player.currentAudiusTrack.artistId}` as any)}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Text style={[styles.stationRegion, isAudius && { textDecorationLine: 'underline' }]} numberOfLines={1}>{displayArtist}</Text>
          </Pressable>
          <View style={styles.sourceRow}>
            <View style={[styles.sourceBadge, { backgroundColor: `${sourceColor}20` }]}>
              <Text style={[styles.sourceBadgeText, { color: sourceColor }]}>{sourceBadge}</Text>
            </View>
            {source === null && (
              <Text style={styles.listeners}>{station.listenerCount} listeners</Text>
            )}
          </View>
        </View>
      </View>

      {/* Media Display Area - Expandable with gestures */}
      <Animated.View style={mediaAnimatedStyle}>
        <Pressable 
          onPress={handleToggleMode}
          onLongPress={() => setPlayerMode('fullscreen')}
          delayLongPress={500}
          style={[styles.mediaContainer, { height: getMediaHeight() }]}
        >
          {/* Glow Effect */}
          <Animated.View style={[styles.mediaGlow, glowStyle, { backgroundColor: sourceColor }]} />
          
          {/* Glass morphism background */}
          <LinearGradient
            colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)', 'rgba(0,0,0,0.2)']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          
          {hasArtwork ? (
            <View style={[styles.artworkWrapper, { transform: [{ rotate: `${rotation}deg` }] }]}>
              <Image source={{ uri: artwork! }} style={styles.artworkLarge} blurRadius={40} />
              <Image 
                source={{ uri: artwork! }} 
                style={[
                  styles.artworkCenter, 
                  { width: getArtworkSize(), height: getArtworkSize() }
                ]} 
              />
            </View>
          ) : (
            <PremiumWaveVisualizer
              isPlaying={isPlaying}
              height={playerMode === 'expanded' ? 280 : 160}
              accentColor={sourceColor}
              style={styles.visualizer}
            />
          )}
          
          {/* Control overlay buttons */}
          <View style={styles.mediaOverlay}>
            {/* Fullscreen button */}
            <Pressable 
              style={styles.overlayBtn} 
              onPress={() => setPlayerMode('fullscreen')}
            >
              <Maximize2 size={20} color="#fff" />
            </Pressable>
            
            {/* Minimize button */}
            <Pressable 
              style={[styles.overlayBtn, styles.overlayBtnRight]} 
              onPress={handleMinimize}
            >
              {playerMode === 'expanded' ? (
                <ChevronDown size={20} color="#fff" />
              ) : (
                <Minimize2 size={20} color="#fff" />
              )}
            </Pressable>
            
            {/* Rotation button for images */}
            {hasArtwork && playerMode === 'expanded' && (
              <Pressable style={[styles.overlayBtn, styles.overlayBtnLeft]} onPress={handleRotate}>
                <RotateCw size={20} color="#fff" />
              </Pressable>
            )}
          </View>
          
          {/* Mode indicator */}
          <View style={styles.modeIndicator}>
            <Text style={styles.modeIndicatorText}>
              {playerMode === 'normal' ? 'Tap to expand • Hold for fullscreen' : 'Tap to minimize • Hold for fullscreen'}
            </Text>
          </View>
        </Pressable>
      </Animated.View>

      {/* Seek Bar (Audius tracks only) */}
      {isAudius && player.duration > 0 && (
        <View style={styles.seekContainer}>
          <Text style={styles.seekTime}>{formatTime(player.position)}</Text>
          <View
            style={styles.seekTrack}
            onLayout={(e) => setSeekBarWidth(e.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => true}
            onResponderGrant={(e) => {
              const ratio = e.nativeEvent.locationX / seekBarWidth;
              player.seekTo(Math.max(0, Math.min(ratio * player.duration, player.duration)));
            }}
            onResponderMove={(e) => {
              const ratio = e.nativeEvent.locationX / seekBarWidth;
              player.seekTo(Math.max(0, Math.min(ratio * player.duration, player.duration)));
            }}
          >
            <View style={styles.seekTrackBg} />
            <View
              style={[
                styles.seekFill,
                {
                  width: `${player.duration > 0 ? (player.position / player.duration) * 100 : 0}%`,
                  backgroundColor: sourceColor,
                },
              ]}
            />
            <View
              style={[
                styles.seekThumb,
                {
                  left: `${player.duration > 0 ? (player.position / player.duration) * 100 : 0}%`,
                  backgroundColor: sourceColor,
                },
              ]}
            />
          </View>
          <Text style={styles.seekTime}>{formatTime(player.duration)}</Text>
        </View>
      )}

      {/* Full Controls Row */}
      <View style={styles.controls}>
        {/* Shuffle (Audius only) */}
        {isAudius && hasQueue ? (
          <Pressable onPress={() => player.toggleShuffle()} style={styles.controlButton}>
            <Shuffle size={20} color={isShuffle ? ILOWA_COLORS.cyan : ILOWA_COLORS.textMuted} />
          </Pressable>
        ) : (
          <View style={styles.controlButton} />
        )}

        {/* Previous — always navigates regardless of source */}
        <Pressable onPress={() => player.previous()} style={styles.controlButton}>
          <SkipBack size={24} color={ILOWA_COLORS.textSecondary} fill={ILOWA_COLORS.textSecondary} />
        </Pressable>

        {/* Play/Pause - Glow Button */}
        <Pressable onPress={onTogglePlay} disabled={isLoading}>
          <Animated.View style={[styles.playButtonGlow, glowStyle, { backgroundColor: sourceColor }]} />
          <LinearGradient
            colors={[sourceColor, `${sourceColor}CC`]}
            style={styles.playButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={ILOWA_COLORS.deepBlack} />
            ) : (
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={30}
                color={ILOWA_COLORS.deepBlack}
              />
            )}
          </LinearGradient>
        </Pressable>

        {/* Next — always navigates regardless of source */}
        <Pressable onPress={() => player.next()} style={styles.controlButton}>
          <SkipForward size={24} color={ILOWA_COLORS.textSecondary} fill={ILOWA_COLORS.textSecondary} />
        </Pressable>

        {/* Repeat (Audius only) */}
        {isAudius ? (
          <Pressable onPress={handleRepeatToggle} style={styles.controlButton}>
            {repeatMode === 'one' ? (
              <Repeat1 size={20} color={ILOWA_COLORS.cyan} />
            ) : (
              <Repeat size={20} color={repeatMode === 'all' ? ILOWA_COLORS.cyan : ILOWA_COLORS.textMuted} />
            )}
          </Pressable>
        ) : player.currentAudiusTrack ? (
          <Pressable style={styles.controlButton}>
            <Ionicons name="heart-outline" size={20} color={ILOWA_COLORS.purple} />
          </Pressable>
        ) : (
          <View style={styles.controlButton} />
        )}
      </View>

      {/* Now Playing Footer */}
      <View style={styles.nowPlaying}>
        <Text style={[styles.nowPlayingLabel, { color: sourceColor, backgroundColor: `${sourceColor}15` }]}>
          {isPlaying ? 'NOW' : 'READY'}
        </Text>
        <Text style={styles.nowPlayingTitle} numberOfLines={1}>
          {isPlaying 
            ? `${displayTitle} — ${displayArtist}`
            : station.schedule.length > 0 
              ? `${station.schedule[0].title} — ${station.schedule[0].genre}`
              : 'Tap play to start listening'
          }
        </Text>
      </View>
    </View>
    </GestureDetector>
    </GestureHandlerRootView>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  stationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  stationIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artworkImage: {
    width: 56,
    height: 56,
    borderRadius: 16,
  },
  stationText: {
    flex: 1,
  },
  stationName: {
    fontFamily: 'Sora-Bold',
    fontSize: 17,
    color: ILOWA_COLORS.textPrimary,
    marginBottom: 2,
  },
  stationRegion: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: ILOWA_COLORS.textSecondary,
    marginBottom: 4,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sourceBadgeText: {
    fontFamily: 'Sora-Bold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  listeners: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: ILOWA_COLORS.textMuted,
  },
  mediaContainer: {
    minHeight: 200,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    position: 'relative',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  mediaGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    borderRadius: 30,
  },
  artworkWrapper: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artworkLarge: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  artworkCenter: {
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  visualizer: {
    flex: 1,
    width: '100%',
  },
  mediaOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayBtnRight: {
    position: 'absolute',
    right: 0,
  },
  overlayBtnLeft: {
    position: 'absolute',
    left: 40,
  },
  modeIndicator: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  modeIndicatorText: {
    fontFamily: 'Inter',
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonGlow: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 40,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  tipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  tipText: {
    fontFamily: 'Sora-Bold',
    fontSize: 13,
    color: ILOWA_COLORS.gold,
  },
  seekContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  seekTrack: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
    position: 'relative',
  },
  seekTrackBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    position: 'absolute',
    left: 0,
    right: 0,
  },
  seekFill: {
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    left: 0,
  },
  seekThumb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    position: 'absolute',
    marginLeft: -7,
    top: 7,
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 3,
  },
  seekTime: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: ILOWA_COLORS.textMuted,
    width: 36,
    textAlign: 'center',
  },
  nowPlaying: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 12,
  },
  nowPlayingLabel: {
    fontFamily: 'Sora-Bold',
    fontSize: 9,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    letterSpacing: 1,
  },
  nowPlayingTitle: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.textSecondary,
    flex: 1,
  },
  // Mini player styles
  miniPlayer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    zIndex: 1000,
  },
  miniPlayerGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  miniArtwork: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  miniIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniInfo: {
    flex: 1,
  },
  miniTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 14,
    color: ILOWA_COLORS.textPrimary,
  },
  miniArtist: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.textMuted,
  },
  miniPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniExpandBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fullscreen styles
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  fullscreenClose: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  fullscreenMedia: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  fullscreenArtworkWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  fullscreenArtworkBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.4,
  },
  fullscreenArtwork: {
    borderRadius: 24,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 20,
  },
  fullscreenVisualizer: {
    width: SCREEN_WIDTH - 40,
  },
  fullscreenInfo: {
    paddingHorizontal: 30,
    paddingVertical: 20,
    alignItems: 'center',
  },
  fullscreenTitle: {
    fontFamily: 'Sora-Bold',
    fontSize: 24,
    color: ILOWA_COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  fullscreenArtist: {
    fontFamily: 'Inter',
    fontSize: 16,
    color: ILOWA_COLORS.textSecondary,
    textAlign: 'center',
  },
  fullscreenControls: {
    paddingHorizontal: 30,
    paddingBottom: 50,
  },
  fullscreenSecondaryControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 16,
  },
  fullscreenSecBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seekControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    marginBottom: 20,
  },
  seekBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  seekLabel: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.textSecondary,
  },
  fullscreenMainControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  fullscreenCtrlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenPlayBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
});
