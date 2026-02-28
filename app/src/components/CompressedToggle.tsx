import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Zap, Layers, ChevronRight, ChevronDown, Database } from 'lucide-react-native';
import { ILOWA_COLORS } from '../theme/colors';
import { useRegion } from '../hooks/useRegion';
import { PremiumToggle } from './PremiumToggle';

// Map region config keys to cultural pattern keys
const REGION_KEY_MAP: Record<string, string> = {
  'westAfrica': 'west-africa',
  'west-africa': 'west-africa',
  'eastAfrica': 'east-africa',
  'east-africa': 'east-africa',
  'southernAfrica': 'southern-africa',
  'southern-africa': 'southern-africa',
  'latinAmerica': 'latin-america',
  'latin-america': 'latin-america',
  'southAsia': 'south-asia',
  'south-asia': 'south-asia',
  'southeastAsia': 'southeast-asia',
  'southeast-asia': 'southeast-asia',
  'mena': 'mena',
  'caribbean': 'caribbean',
  'pacific': 'pacific',
};

interface CompressedToggleProps {
  value: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

/**
 * CompressedToggle - Light Protocol ZK Compression Toggle
 * 
 * Uses PremiumToggle with cultural patterns in the track.
 * Green theme for cost savings visual cue.
 */
export function CompressedToggle({ value, onChange, disabled = false }: CompressedToggleProps) {
  const [showInfo, setShowInfo] = useState(false);
  const { config } = useRegion();
  const regionKey = REGION_KEY_MAP[config?.region || 'westAfrica'] || 'west-africa';

  // Animated glow effect
  const glowStyle = useAnimatedStyle(() => ({
    opacity: withTiming(value ? 0.5 : 0, { duration: 400 }),
  }));

  // Border animation when enabled
  const borderStyle = useAnimatedStyle(() => ({
    borderColor: value ? '#10B981' : 'rgba(16, 185, 129, 0.2)',
    borderWidth: value ? 2 : 1,
  }));

  return (
    <Animated.View style={[styles.cardOuter, borderStyle]}>
      {/* Glow effect behind card */}
      <Animated.View style={[styles.cardGlow, glowStyle]} />

      <LinearGradient
        colors={value 
          ? ['rgba(16, 185, 129, 0.12)', 'rgba(15, 23, 42, 0.95)', 'rgba(15, 23, 42, 0.98)']
          : ['rgba(15, 23, 42, 0.95)', 'rgba(15, 23, 42, 0.85)']
        }
        style={styles.card}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.labelRow}>
            <View style={[styles.iconContainer, { backgroundColor: value ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)' }]}>
              {value ? (
                <Zap size={18} color="#10B981" strokeWidth={2.5} />
              ) : (
                <Database size={18} color="#6EE7B7" strokeWidth={2} />
              )}
            </View>
            <View>
              <Text style={[styles.label, value && { color: '#10B981' }]}>Compressed Market</Text>
              <Text style={styles.subtitle}>
                {value ? '⚡ Light Protocol Active' : '📦 Standard Storage'}
              </Text>
            </View>
          </View>

          {/* Premium Toggle with cultural pattern */}
          <PremiumToggle
            value={value}
            onChange={onChange}
            regionKey={regionKey}
            disabled={disabled}
            size="medium"
          />
        </View>

        {/* Description */}
        <Text style={styles.description}>
          {value
            ? 'ZK compression enabled. ~1000x less storage rent, saving SOL on creation.'
            : 'Standard storage with regular Solana rent.'}
        </Text>

        {/* Savings badge */}
        {value && (
          <View style={styles.badge}>
            <View style={styles.savingsRow}>
              <Layers size={14} color="#10B981" strokeWidth={2} />
              <Text style={styles.badgeText}>Savings: ~0.002 SOL per market</Text>
            </View>
            <Text style={[styles.badgeText, { marginTop: 4, color: '#06B6D4' }]}>
              🌳 Light Protocol Merkle Trees
            </Text>
          </View>
        )}

        {/* Info toggle */}
        <Pressable onPress={() => setShowInfo(!showInfo)} style={styles.infoToggle}>
          {showInfo 
            ? <ChevronDown size={14} color={ILOWA_COLORS.cyan} strokeWidth={2.5} />
            : <ChevronRight size={14} color={ILOWA_COLORS.cyan} strokeWidth={2.5} />
          }
          <Text style={styles.infoToggleText}>How does compression work?</Text>
        </Pressable>

        {/* Expanded info */}
        {showInfo && (
          <View style={styles.infoPanel}>
            <Text style={styles.infoText}>
              {'• ZK-compressed Merkle trees\n'}
              {'• Proofs on-chain, data off-chain\n'}
              {'• Same security (trustless)\n'}
              {'• Ideal for small bets\n'}
              {'• Amounts visible (no privacy)\n'}
              {'• Combine with Arcium for private + cheap'}
            </Text>
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    borderRadius: 16,
    overflow: 'visible',
    position: 'relative',
  },
  cardGlow: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 22,
    backgroundColor: '#10B981',
    zIndex: -1,
  },
  card: {
    padding: 16,
    borderRadius: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    zIndex: 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#6EE7B7',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Sora-SemiBold',
  },
  subtitle: {
    color: ILOWA_COLORS.textMuted,
    fontSize: 11,
    fontFamily: 'Inter',
    marginTop: 2,
  },
  description: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Inter',
    zIndex: 2,
  },
  badge: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    zIndex: 2,
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeText: {
    color: '#10B981',
    fontSize: 11,
    fontFamily: 'Inter',
  },
  infoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
    zIndex: 2,
  },
  infoToggleText: {
    color: ILOWA_COLORS.cyan,
    fontSize: 12,
    fontFamily: 'Inter',
  },
  infoPanel: {
    marginTop: 8,
    paddingLeft: 18,
    zIndex: 2,
  },
  infoText: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 17,
    fontFamily: 'Inter',
  },
});
