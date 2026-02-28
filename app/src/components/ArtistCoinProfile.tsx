/**
 * Audius Artist Coin Profile
 * 
 * Shows an artist's $AUDIO balance, top supporters, and tip history.
 * Rendered when tapping an artist in the Audius music browser.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable, ActivityIndicator } from 'react-native';
import { Heart, Users, Music2, ExternalLink, Award } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ILOWA_COLORS } from '../theme/colors';
import {
  AudiusUser,
  AudiusSupporter,
  getArtistCoinProfile,
  formatAudioAmount,
} from '../lib/music/audius';
import { followAudiusArtist } from '../lib/social/tapestry';

interface ArtistCoinProfileProps {
  artistId: string;
  walletAddress?: string; // current user's wallet for follow
  onClose?: () => void;
}

export function ArtistCoinProfile({ artistId, walletAddress, onClose }: ArtistCoinProfileProps) {
  const [artist, setArtist] = useState<AudiusUser | null>(null);
  const [supporters, setSupporters] = useState<AudiusSupporter[]>([]);
  const [totalTips, setTotalTips] = useState('0');
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [artistId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const profile = await getArtistCoinProfile(artistId);
      if (profile) {
        setArtist(profile.user);
        setSupporters(profile.supporters);
        setTotalTips(profile.totalTipsReceived);
      }
    } catch (err) {
      console.warn('[ArtistCoin] Load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!walletAddress || !artist) return;
    setFollowing(true);
    try {
      await followAudiusArtist(walletAddress, artistId, artist.name);
    } catch {}
    // keep button in "following" state regardless
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={ILOWA_COLORS.purple} />
      </View>
    );
  }

  if (!artist) return null;

  return (
    <View style={styles.container}>
      {/* Artist Header */}
      <View style={styles.header}>
        {artist.profilePicture ? (
          <Image source={{ uri: artist.profilePicture }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Music2 size={28} color={ILOWA_COLORS.purple} />
          </View>
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.artistName}>{artist.name}</Text>
          <Text style={styles.artistHandle}>@{artist.handle}</Text>
          <View style={styles.statsRow}>
            <Text style={styles.statText}>{artist.followerCount.toLocaleString()} followers</Text>
            <Text style={styles.statDot}>·</Text>
            <Text style={styles.statText}>{artist.trackCount} tracks</Text>
          </View>
        </View>
      </View>

      {/* $AUDIO Balance */}
      <LinearGradient
        colors={['rgba(139,92,246,0.12)', 'rgba(139,92,246,0.04)']}
        style={styles.balanceCard}
      >
        <Text style={styles.balanceLabel}>$AUDIO Balance</Text>
        <Text style={styles.balanceValue}>
          {artist.totalAudioBalance ? formatAudioAmount(String(artist.totalAudioBalance)) : '—'}
        </Text>
        <Text style={styles.tipsReceived}>
          Total tips received: {formatAudioAmount(totalTips)}
        </Text>
      </LinearGradient>

      {/* Follow Button */}
      {walletAddress && (
        <Pressable
          style={[styles.followBtn, following && styles.followBtnActive]}
          onPress={handleFollow}
          disabled={following}
        >
          <Heart size={16} color={following ? ILOWA_COLORS.deepBlack : ILOWA_COLORS.purple} fill={following ? ILOWA_COLORS.deepBlack : 'none'} />
          <Text style={[styles.followText, following && styles.followTextActive]}>
            {following ? 'Following' : 'Follow Artist'}
          </Text>
        </Pressable>
      )}

      {/* Top Supporters */}
      {supporters.length > 0 && (
        <View style={styles.supportersSection}>
          <View style={styles.sectionHeader}>
            <Award size={16} color={ILOWA_COLORS.gold} />
            <Text style={styles.sectionTitle}>Top Supporters</Text>
          </View>
          {supporters.slice(0, 5).map((s, i) => (
            <View key={i} style={styles.supporterRow}>
              <Text style={styles.supporterRank}>#{s.rank || i + 1}</Text>
              {s.sender.profilePicture ? (
                <Image source={{ uri: s.sender.profilePicture }} style={styles.supporterAvatar} />
              ) : (
                <View style={[styles.supporterAvatar, styles.avatarFallback]}>
                  <Users size={12} color={ILOWA_COLORS.textMuted} />
                </View>
              )}
              <Text style={styles.supporterName} numberOfLines={1}>{s.sender.name}</Text>
              <Text style={styles.supporterAmount}>{formatAudioAmount(s.amount)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Wallet Info */}
      {artist.splWallet && (
        <View style={styles.walletRow}>
          <ExternalLink size={12} color={ILOWA_COLORS.textMuted} />
          <Text style={styles.walletText}>
            SPL: {artist.splWallet.slice(0, 6)}...{artist.splWallet.slice(-4)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 18,
    padding: 20,
    gap: 16,
  },
  loadingWrap: {
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 18,
    padding: 40,
    alignItems: 'center',
  },
  header: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: {
    backgroundColor: 'rgba(139,92,246,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerInfo: { flex: 1, gap: 2 },
  artistName: { fontFamily: 'Sora-Bold', fontSize: 18, color: ILOWA_COLORS.textPrimary },
  artistHandle: { fontFamily: 'Inter', fontSize: 13, color: ILOWA_COLORS.textMuted },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statText: { fontFamily: 'Inter', fontSize: 12, color: ILOWA_COLORS.textSecondary },
  statDot: { color: ILOWA_COLORS.textMuted, fontSize: 10 },
  balanceCard: {
    borderRadius: 14, padding: 16, gap: 4,
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.1)',
  },
  balanceLabel: { fontFamily: 'Sora', fontSize: 11, color: ILOWA_COLORS.textMuted, letterSpacing: 0.5 },
  balanceValue: { fontFamily: 'Sora-Bold', fontSize: 22, color: ILOWA_COLORS.purple },
  tipsReceived: { fontFamily: 'Inter', fontSize: 12, color: ILOWA_COLORS.textSecondary },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: ILOWA_COLORS.purple,
  },
  followBtnActive: {
    backgroundColor: ILOWA_COLORS.purple, borderColor: ILOWA_COLORS.purple,
  },
  followText: { fontFamily: 'Sora-Bold', fontSize: 13, color: ILOWA_COLORS.purple },
  followTextActive: { color: ILOWA_COLORS.deepBlack },
  supportersSection: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: ILOWA_COLORS.textPrimary },
  supporterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 10,
  },
  supporterRank: { fontFamily: 'Sora-Bold', fontSize: 11, color: ILOWA_COLORS.gold, width: 24 },
  supporterAvatar: { width: 28, height: 28, borderRadius: 14 },
  supporterName: { fontFamily: 'Inter-Medium', fontSize: 13, color: ILOWA_COLORS.textSecondary, flex: 1 },
  supporterAmount: { fontFamily: 'Sora', fontSize: 12, color: ILOWA_COLORS.purple },
  walletRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingTop: 4,
  },
  walletText: { fontFamily: 'Inter', fontSize: 11, color: ILOWA_COLORS.textMuted },
});
