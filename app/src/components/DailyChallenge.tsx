import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ILOWA_COLORS } from '../theme/colors';
import { Elder } from '../types/elder';
import { VoiceInputButton } from './VoiceInputButton';
import { useVoiceInput } from '../hooks/useVoiceInput';

// Region-specific daily challenge questions — auto-rotates by day-of-year
const CHALLENGE_POOL: Record<string, string[]> = {
  westAfrica: [
    'What will the Naira/USD rate close at today?',
    'Will cocoa futures rise or fall this week?',
    'Which West African tech startup will announce funding next?',
    'Will the price of garri drop or rise at Bodija Market this week?',
    'How many goals will be scored in this weekend\'s NPFL matches?',
    'Will Bitcoin cross $100k by end of this month?',
    'Which Afrobeats song will top the charts this Friday?',
  ],
  eastAfrica: [
    'What will the KES/USD rate close at today?',
    'Will M-Pesa transaction volume hit a new high this month?',
    'Which East African startup will raise the most funding this quarter?',
    'Will tea export prices rise or fall this week?',
    'How will the Nairobi Securities Exchange close today — up or down?',
    'Will SOL outperform ETH this week?',
    'Which Safari Rally stage will produce the fastest time?',
  ],
  southernAfrica: [
    'What will the Rand/USD rate close at today?',
    'Will Eskom announce load shedding stage changes this week?',
    'Which PSL team will lead the table after this weekend?',
    'Will platinum prices rise or fall this week?',
    'How will the JSE All Share Index close today?',
    'Will Bitcoin dominance increase or decrease this week?',
    'Which amapiano track will dominate streaming this week?',
  ],
  latinAmerica: [
    'What will the Real/USD rate close at today?',
    'Will soybean futures rise or fall this week?',
    'Which Latin American fintech will announce a new product?',
    'How will the Bovespa close today — green or red?',
    'Will coffee prices break their monthly high?',
    'Which reggaeton release will top Spotify Latin this week?',
    'Will SOL flip a top-10 token by market cap this month?',
  ],
  southAsia: [
    'What will the Rupee/USD rate close at today?',
    'Will the Sensex close above or below its opening?',
    'Which IPL team will win the most matches this week?',
    'Will gold prices in Mumbai rise or fall today?',
    'Which Bollywood release will lead the box office this Friday?',
    'Will India\'s crypto trading volume hit a new weekly high?',
    'How will Nifty50 perform compared to last week?',
  ],
  southeastAsia: [
    'What will the Peso/USD rate close at today?',
    'Will rice export prices rise or fall this month?',
    'Which Southeast Asian ride-hailing company will expand next?',
    'How will the PSEi close today — up or down?',
    'Will remittance flows to the Philippines increase this quarter?',
    'Which K-drama OST will top regional charts this week?',
    'Will BTC/PHP break a new local high this week?',
  ],
  mena: [
    'What will the oil price close at today?',
    'Will the Saudi Tadawul index close green or red?',
    'Which MENA tech company will announce expansion next?',
    'Will gold prices in the Dubai Gold Souk rise or fall?',
    'How will the Egyptian pound perform against the dollar this week?',
    'Will Bitcoin hash rate reach a new all-time high this month?',
    'Which Arabian Gulf football league match will surprise this weekend?',
  ],
  caribbean: [
    'What will the JMD/USD rate close at today?',
    'Will tourism arrivals beat last month\'s numbers?',
    'Which Caribbean artist will drop the hottest track this week?',
    'Will rum export revenue increase this quarter?',
    'How will reggae festival ticket sales compare to last year?',
    'Will Solana TVL increase or decrease this week?',
    'Which island will announce a new crypto-friendly policy?',
  ],
  pacific: [
    'What will the NZD/USD rate close at today?',
    'Will the ASX 200 close above or below yesterday?',
    'Which Pacific Island nation will announce a climate initiative?',
    'Will lamb export prices rise or fall this month?',
    'How will the All Blacks perform in their next match?',
    'Will Bitcoin mining difficulty increase at the next adjustment?',
    'Which Polynesian cultural event will trend on social media?',
  ],
};

const ELDER_PROMPTS: Record<string, string> = {
  westAfrica: 'Speak your truth, and the market will judge.',
  eastAfrica: 'Pole pole — wisdom speaks before haste.',
  southernAfrica: 'Ubuntu teaches us: your prediction lifts the village.',
  latinAmerica: 'Pachamama rewards the brave and the patient.',
  southAsia: 'Like the Ganges, let your wisdom flow freely.',
  southeastAsia: 'Bayanihan — together we predict the future.',
  mena: 'The stars guided caravans; let insight guide your call.',
  caribbean: 'Feel the riddim of the market, darling.',
  pacific: 'The ocean current reveals what the shore cannot see.',
};

function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function hoursUntilMidnightUTC(): string {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const diff = midnight.getTime() - now.getTime();
  const h = Math.floor(diff / (1000 * 60 * 60));
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${h}h ${m}m`;
}

interface DailyChallengeProps {
  elder: Elder;
}

export function DailyChallenge({ elder }: DailyChallengeProps) {
  const elderColors = ILOWA_COLORS.elders[elder.region];
  const voiceInput = useVoiceInput();
  const [countdown, setCountdown] = useState(hoursUntilMidnightUTC());

  // tick the countdown every 60s
  useEffect(() => {
    const iv = setInterval(() => setCountdown(hoursUntilMidnightUTC()), 60_000);
    return () => clearInterval(iv);
  }, []);

  // pick today's question deterministically
  const pool = CHALLENGE_POOL[elder.region] ?? CHALLENGE_POOL.westAfrica;
  const todayQ = pool[dayOfYear() % pool.length];
  const prompt = ELDER_PROMPTS[elder.region] ?? ELDER_PROMPTS.westAfrica;

  return (
    <View style={[styles.cardOuter, { borderColor: `${elderColors.primary}40` }]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)', 'rgba(0,0,0,0.1)']}
        style={styles.card}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={[styles.accentGlow, { backgroundColor: elderColors.primary }]} />
        
        <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: `${elderColors.primary}20` }]}>
          <Ionicons name="flame" size={14} color={elderColors.primary} />
          <Text style={[styles.badgeText, { color: elderColors.primary }]}>
            Daily Challenge
          </Text>
        </View>
        <Text style={styles.prize}>0.1 SOL Prize</Text>
      </View>

      <Text style={styles.question}>
        {todayQ}
      </Text>

      <Text style={styles.elderPrompt}>
        {elder.name} asks: "{prompt}"
      </Text>

      <View style={styles.actionRow}>
        <VoiceInputButton
          onRecordComplete={async (uri) => {
            const text = await voiceInput.transcribe(uri);
            if (text) {
              Alert.alert(
                'Submit Prediction?',
                `"${text}"`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Submit', onPress: () => { /* submit challenge prediction */ } },
                ]
              );
            } else {
              Alert.alert('Error', 'Could not transcribe. Try again.');
            }
            voiceInput.reset();
          }}
        />
        <View style={styles.stats}>
          <Text style={styles.statText}>Ends in {countdown}</Text>
          <Text style={[styles.statText, { color: elderColors.primary, fontSize: 11 }]}>
            Prize grows with community funding
          </Text>
        </View>
      </View>

      <View style={styles.leaderRow}>
        <Ionicons name="trophy" size={14} color={ILOWA_COLORS.gold} />
        <Text style={styles.leaderText}>
          Winners split the daily pot — accuracy is everything
        </Text>
      </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    borderRadius: 18,
    marginBottom: 20,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  card: {
    padding: 18,
    borderRadius: 16,
    position: 'relative',
  },
  accentGlow: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontFamily: 'Sora-Bold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  prize: {
    fontFamily: 'Sora-Bold',
    fontSize: 13,
    color: ILOWA_COLORS.gold,
  },
  question: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 17,
    color: ILOWA_COLORS.textPrimary,
    lineHeight: 24,
    marginBottom: 8,
  },
  elderPrompt: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontStyle: 'italic',
    color: ILOWA_COLORS.textSecondary,
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 14,
  },
  stats: {
    flex: 1,
    gap: 4,
  },
  statText: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.textMuted,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 12,
  },
  leaderText: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.textSecondary,
  },
});
