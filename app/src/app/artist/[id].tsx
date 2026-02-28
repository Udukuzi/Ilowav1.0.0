// Audius Artist Profile — shows artist info, supporters, $AUDIO tips,
// top tracks, and a tip button via OrbitFlare Blink sharing.

import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Image, ActivityIndicator, Share,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowLeft, Users, Music2, Heart, Play, Pause, ExternalLink } from 'lucide-react-native';
import { ILOWA_COLORS } from '../../theme/colors';
import {
  AudiusUser, AudiusTrack, AudiusSupporter,
  getArtistCoinProfile, getArtistTracks,
  formatAudioAmount, formatPlayCount, formatDuration,
} from '../../lib/music/audius';
import { createTipBlink, getBlinkShareText } from '../../lib/actions/orbitflare';
import { usePlayerStore } from '../../lib/player/unified-player';

export default function ArtistProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const player = usePlayerStore();

  const [artist, setArtist] = useState<AudiusUser | null>(null);
  const [supporters, setSupporters] = useState<AudiusSupporter[]>([]);
  const [totalTips, setTotalTips] = useState('0');
  const [tracks, setTracks] = useState<AudiusTrack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [profile, artistTracks] = await Promise.all([
          getArtistCoinProfile(id),
          getArtistTracks(id, 15),
        ]);
        if (profile) {
          setArtist(profile.user);
          setSupporters(profile.supporters);
          setTotalTips(profile.totalTipsReceived);
        }
        setTracks(artistTracks);
      } catch (err) {
        console.error('[ArtistProfile] load failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handlePlay = async (track: AudiusTrack) => {
    if (player.currentAudiusTrack?.id === track.id && player.isPlaying) {
      await player.stop();
      return;
    }
    await player.playAudius(track, tracks);
  };

  const shareTipBlink = async () => {
    if (!artist) return;
    const blink = createTipBlink({
      djName: artist.name,
      djWallet: artist.splWallet || artist.ercWallet || artist.handle,
      stationName: 'Audius',
      suggestedAmount: 0.05,
    });
    try { await Share.share({ message: getBlinkShareText(blink) }); } catch {}
  };

  if (loading) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={ILOWA_COLORS.purple} style={{ marginTop: 80 }} />
      </View>
    );
  }

  if (!artist) {
    return (
      <View style={[s.root, { paddingTop: insets.top, padding: 20 }]}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/radio')} style={s.back}>
          <ArrowLeft size={24} color={ILOWA_COLORS.textPrimary} />
        </Pressable>
        <Text style={s.emptyText}>Artist not found</Text>
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Nav */}
        <View style={s.nav}>
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/radio')} style={s.back}>
            <ArrowLeft size={24} color={ILOWA_COLORS.textPrimary} />
          </Pressable>
          <Text style={s.navTitle}>Artist</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Hero */}
        <Animated.View entering={FadeInDown.delay(100)} style={s.hero}>
          {artist.profilePicture ? (
            <Image source={{ uri: artist.profilePicture }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.avatarFallback]}>
              <Music2 size={36} color={ILOWA_COLORS.purple} />
            </View>
          )}
          <Text style={s.artistName}>{artist.name}</Text>
          <Text style={s.handle}>@{artist.handle}</Text>

          <View style={s.statsRow}>
            <Stat label="Followers" value={formatPlayCount(artist.followerCount)} />
            <Stat label="Tracks" value={String(artist.trackCount)} />
            <Stat label="Supporters" value={String(artist.supporterCount || 0)} />
          </View>

          {/* $AUDIO balance */}
          {(artist.totalAudioBalance || 0) > 0 && (
            <View style={s.audioRow}>
              <Text style={s.audioLabel}>$AUDIO Balance</Text>
              <Text style={s.audioValue}>{formatAudioAmount(String(artist.totalAudioBalance || 0))}</Text>
            </View>
          )}

          {/* Tip via Blink */}
          <Pressable style={s.tipBtn} onPress={shareTipBlink}>
            <Heart size={16} color={ILOWA_COLORS.deepBlack} />
            <Text style={s.tipBtnText}>Tip Artist via Blink</Text>
          </Pressable>
        </Animated.View>

        {/* Supporters */}
        {supporters.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200)} style={s.section}>
            <Text style={s.secTitle}>Top Supporters</Text>
            <Text style={s.secSub}>Total tipped: {formatAudioAmount(totalTips)}</Text>
            {supporters.slice(0, 8).map((sup, i) => (
              <View key={`${sup.sender.id}-${i}`} style={s.supporterRow}>
                <Text style={s.supporterRank}>#{sup.rank || i + 1}</Text>
                {sup.sender.profilePicture ? (
                  <Image source={{ uri: sup.sender.profilePicture }} style={s.supporterAvatar} />
                ) : (
                  <View style={[s.supporterAvatar, { backgroundColor: 'rgba(139,92,246,0.15)', alignItems: 'center', justifyContent: 'center' }]}>
                    <Users size={12} color={ILOWA_COLORS.purple} />
                  </View>
                )}
                <Text style={s.supporterName} numberOfLines={1}>{sup.sender.name}</Text>
                <Text style={s.supporterAmount}>{formatAudioAmount(sup.amount)}</Text>
              </View>
            ))}
          </Animated.View>
        )}

        {/* Tracks */}
        {tracks.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300)} style={s.section}>
            <Text style={s.secTitle}>Tracks</Text>
            {tracks.map((track, idx) => {
              const active = player.currentAudiusTrack?.id === track.id && player.isPlaying;
              return (
                <Pressable key={track.id} style={s.trackRow} onPress={() => handlePlay(track)}>
                  <Text style={s.trackIdx}>{idx + 1}</Text>
                  {track.artwork ? (
                    <Image source={{ uri: track.artwork }} style={s.trackArt} />
                  ) : (
                    <View style={[s.trackArt, { backgroundColor: 'rgba(139,92,246,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
                      <Music2 size={14} color={ILOWA_COLORS.purple} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[s.trackTitle, active && { color: ILOWA_COLORS.purple }]} numberOfLines={1}>{track.title}</Text>
                    <Text style={s.trackMeta}>{formatPlayCount(track.playCount || 0)} plays · {formatDuration(track.duration)}</Text>
                  </View>
                  <View style={[s.playBtn, active && { backgroundColor: ILOWA_COLORS.purple }]}>
                    {active ? (
                      <Pause size={14} color={ILOWA_COLORS.deepBlack} />
                    ) : (
                      <Play size={14} color={ILOWA_COLORS.deepBlack} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text style={{ fontSize: 18, fontWeight: '700', color: '#FFF' }}>{value}</Text>
      <Text style={{ fontSize: 11, color: ILOWA_COLORS.textMuted }}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: ILOWA_COLORS.deepBlack },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 8 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontFamily: 'Sora-Bold', fontSize: 18, color: ILOWA_COLORS.textPrimary },
  emptyText: { fontFamily: 'Inter', fontSize: 14, color: ILOWA_COLORS.textMuted, textAlign: 'center', marginTop: 40 },

  hero: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 },
  avatar: { width: 88, height: 88, borderRadius: 44, marginBottom: 12, backgroundColor: ILOWA_COLORS.cardDark },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  artistName: { fontFamily: 'Sora-Bold', fontSize: 24, color: ILOWA_COLORS.textPrimary },
  handle: { fontFamily: 'Inter', fontSize: 13, color: ILOWA_COLORS.textMuted, marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 32, marginBottom: 14 },
  audioRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(139,92,246,0.1)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 14,
  },
  audioLabel: { fontFamily: 'Inter', fontSize: 12, color: ILOWA_COLORS.textMuted },
  audioValue: { fontFamily: 'Sora-Bold', fontSize: 14, color: ILOWA_COLORS.purple },
  tipBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: ILOWA_COLORS.purple, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24,
  },
  tipBtnText: { fontFamily: 'Sora-Bold', fontSize: 14, color: ILOWA_COLORS.deepBlack },

  section: { paddingHorizontal: 20, marginTop: 8, marginBottom: 16 },
  secTitle: { fontFamily: 'Sora-SemiBold', fontSize: 16, color: ILOWA_COLORS.textPrimary, marginBottom: 4 },
  secSub: { fontFamily: 'Inter', fontSize: 12, color: ILOWA_COLORS.textMuted, marginBottom: 12 },

  supporterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  supporterRank: { fontFamily: 'Sora-Bold', fontSize: 12, color: ILOWA_COLORS.gold, width: 28 },
  supporterAvatar: { width: 28, height: 28, borderRadius: 14 },
  supporterName: { fontFamily: 'Inter', fontSize: 13, color: ILOWA_COLORS.textPrimary, flex: 1 },
  supporterAmount: { fontFamily: 'Sora-SemiBold', fontSize: 12, color: ILOWA_COLORS.purple },

  trackRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  trackIdx: { fontFamily: 'Inter', fontSize: 12, color: ILOWA_COLORS.textMuted, width: 20, textAlign: 'center' },
  trackArt: { width: 40, height: 40, borderRadius: 6, backgroundColor: ILOWA_COLORS.cardDark },
  trackTitle: { fontFamily: 'Inter', fontSize: 13, color: ILOWA_COLORS.textPrimary },
  trackMeta: { fontFamily: 'Inter', fontSize: 11, color: ILOWA_COLORS.textMuted, marginTop: 2 },
  playBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
});
