/**
 * NFT Gallery Component
 * 
 * Displays user's DRiP NFTs in a grid layout
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Linking,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ImageIcon, ExternalLink, Mic, Radio, Headphones, Award } from 'lucide-react-native';
import { ILOWA_COLORS } from '../theme/colors';
import {
  DripNFT,
  getUserDripNFTs,
  formatNFTType,
  getNFTTypeColor,
} from '../lib/nft/drip';

interface NFTGalleryProps {
  compact?: boolean;
  maxItems?: number;
}

export function NFTGallery({ compact = false, maxItems }: NFTGalleryProps) {
  const [nfts, setNfts] = useState<DripNFT[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNFTs();
  }, []);

  const loadNFTs = async () => {
    try {
      const userNFTs = await getUserDripNFTs();
      setNfts(maxItems ? userNFTs.slice(0, maxItems) : userNFTs);
    } catch (err) {
      console.error('[NFTGallery] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: DripNFT['type']) => {
    const color = getNFTTypeColor(type);
    switch (type) {
      case 'voice_prediction': return <Mic size={16} color={color} />;
      case 'dj_show': return <Radio size={16} color={color} />;
      case 'podcast': return <Headphones size={16} color={color} />;
      case 'collectible': return <Award size={16} color={color} />;
      default: return <ImageIcon size={16} color={color} />;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={ILOWA_COLORS.purple} />
      </View>
    );
  }

  if (nfts.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <ImageIcon size={32} color={ILOWA_COLORS.textMuted} />
        <Text style={styles.emptyText}>No NFTs yet</Text>
        <Text style={styles.emptyHint}>
          Win predictions or attend DJ shows to earn collectibles
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Collectibles</Text>
        <Text style={styles.headerCount}>{nfts.length} NFTs</Text>
      </View>

      <ScrollView
        horizontal={compact}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={compact ? styles.horizontalGrid : styles.verticalGrid}
      >
        {nfts.map((nft) => (
          <Pressable
            key={nft.id}
            style={[styles.nftCardOuter, compact && styles.nftCardCompact]}
            onPress={() => Linking.openURL(nft.dripUrl)}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)', 'rgba(139,92,246,0.05)']}
              style={styles.nftCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
            {nft.imageUrl ? (
              <Image
                source={{ uri: nft.imageUrl }}
                style={[styles.nftImage, compact && styles.nftImageCompact]}
              />
            ) : (
              <View style={[styles.nftImageFallback, compact && styles.nftImageCompact]}>
                {getTypeIcon(nft.type)}
              </View>
            )}

            <View style={styles.nftInfo}>
              <View style={styles.nftTypeRow}>
                {getTypeIcon(nft.type)}
                <Text style={[styles.nftType, { color: getNFTTypeColor(nft.type) }]}>
                  {formatNFTType(nft.type)}
                </Text>
              </View>
              <Text style={styles.nftTitle} numberOfLines={1}>
                {nft.title}
              </Text>
              {!compact && (
                <Text style={styles.nftDescription} numberOfLines={2}>
                  {nft.description}
                </Text>
              )}
            </View>

            <View style={styles.nftAction}>
              <ExternalLink size={14} color={ILOWA_COLORS.textMuted} />
            </View>
            </LinearGradient>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    overflow: 'hidden',
  },
  emptyText: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 14,
    color: ILOWA_COLORS.textPrimary,
  },
  emptyHint: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.textMuted,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 16,
    color: ILOWA_COLORS.textPrimary,
  },
  headerCount: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.textMuted,
  },
  horizontalGrid: {
    gap: 12,
    paddingRight: 16,
  },
  verticalGrid: {
    gap: 10,
  },
  nftCardOuter: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
  },
  nftCard: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
    gap: 12,
  },
  nftCardCompact: {
    width: 200,
    flexDirection: 'column',
    padding: 10,
  },
  nftImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  nftImageCompact: {
    width: '100%',
    height: 100,
    borderRadius: 8,
  },
  nftImageFallback: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nftInfo: {
    flex: 1,
    gap: 4,
  },
  nftTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nftType: {
    fontFamily: 'Inter',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  nftTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 13,
    color: ILOWA_COLORS.textPrimary,
  },
  nftDescription: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: ILOWA_COLORS.textMuted,
    lineHeight: 16,
  },
  nftAction: {
    padding: 4,
  },
});
