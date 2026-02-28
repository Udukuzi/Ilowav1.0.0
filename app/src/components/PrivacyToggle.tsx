import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ChevronRight, ChevronDown, Shield, Eye } from 'lucide-react-native';
import { ILOWA_COLORS } from '../theme/colors';
import { useRegion } from '../hooks/useRegion';
import { getCulturalPattern } from '../theme/cultural-patterns';
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

interface PrivacyToggleProps {
  value: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

export function PrivacyToggle({ value, onChange, disabled = false }: PrivacyToggleProps) {
  const [showInfo, setShowInfo] = useState(false);
  const { config } = useRegion();
  const regionKey = REGION_KEY_MAP[config?.region || 'westAfrica'] || 'west-africa';
  const pattern = getCulturalPattern(regionKey);

  // Animated glow effect
  const glowStyle = useAnimatedStyle(() => ({
    opacity: withTiming(value ? 0.6 : 0, { duration: 400 }),
  }));

  // Animated border
  const borderStyle = useAnimatedStyle(() => ({
    borderColor: value ? pattern.primaryColor : 'rgba(139, 92, 246, 0.2)',
    borderWidth: value ? 2 : 1,
  }));

  return (
    <Animated.View style={[styles.cardOuter, borderStyle]}>
      {/* Glow effect behind card */}
      <Animated.View style={[styles.cardGlow, { backgroundColor: pattern.primaryColor }, glowStyle]} />
      
      <LinearGradient
        colors={value 
          ? [`${pattern.primaryColor}15`, 'rgba(15, 23, 42, 0.95)', 'rgba(15, 23, 42, 0.98)']
          : ['rgba(15, 23, 42, 0.95)', 'rgba(15, 23, 42, 0.85)']
        }
        style={styles.card}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.labelRow}>
            <View style={[styles.iconContainer, { backgroundColor: value ? `${pattern.primaryColor}25` : 'rgba(139, 92, 246, 0.15)' }]}>
              {value ? (
                <Shield size={18} color={pattern.primaryColor} strokeWidth={2.5} />
              ) : (
                <Eye size={18} color={ILOWA_COLORS.purple} strokeWidth={2} />
              )}
            </View>
            <View>
              <Text style={[styles.label, value && { color: pattern.primaryColor }]}>Private Bet</Text>
              <Text style={styles.patternName}>
                {value ? `🔐 Arcium MPC • ${pattern.name}` : '👁️ Public Mode'}
              </Text>
            </View>
          </View>
          
          {/* Premium Toggle with cultural pattern in track */}
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
            ? 'Your bet amount is encrypted. No one can see how much you bet — not even validators.'
            : 'Public bet. Your bet amount will be visible on-chain.'}
        </Text>

        {/* Security badge */}
        {value && (
          <View style={[styles.badge, { borderColor: `${pattern.primaryColor}30` }]}>
            <Text style={[styles.badgeText, { color: pattern.primaryColor }]}>
              ⚡ Privacy fee: +0.005 SOL
            </Text>
            <Text style={[styles.badgeText, { marginTop: 4, color: pattern.secondaryColor }]}>
              🛡️ 100+ Arcium nodes protecting your data
            </Text>
          </View>
        )}

        {/* Info toggle */}
        <Pressable onPress={() => setShowInfo(!showInfo)} style={styles.infoToggle}>
          {showInfo ? (
            <ChevronDown size={14} color={ILOWA_COLORS.cyan} strokeWidth={2.5} />
          ) : (
            <ChevronRight size={14} color={ILOWA_COLORS.cyan} strokeWidth={2.5} />
          )}
          <Text style={styles.infoToggleText}>How does privacy work?</Text>
        </Pressable>

        {/* Expanded info */}
        {showInfo && (
          <View style={styles.infoPanel}>
            <Text style={styles.infoText}>
              {'• Bet amount encrypted via Arcium MPC\n'}
              {'• 100+ nodes share encryption duties\n'}
              {'• Only you can decrypt the amount\n'}
              {'• Prevents front-running attacks\n'}
              {'• Validators cannot see bet amounts'}
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
    color: ILOWA_COLORS.purple,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Sora-SemiBold',
  },
  patternName: {
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
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderWidth: 1,
    zIndex: 2,
  },
  badgeText: {
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
