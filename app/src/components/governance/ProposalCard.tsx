import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Clock, CheckCircle, XCircle, Users } from 'lucide-react-native';
import { ILOWA_COLORS } from '@/theme/colors';
import type { Proposal, VoteChoice } from '@/lib/governance/HybridGovernance';

interface ProposalCardProps {
  proposal: Proposal;
  onVote?: (proposalId: string, choice: VoteChoice) => void;
  hasVoted?: boolean;
  userVote?: VoteChoice | null;
  disabled?: boolean;
}

function timeLeft(endsAt: number): string {
  const diff = endsAt - Date.now();
  if (diff <= 0) return 'Ended';
  const days  = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

const STATUS_COLORS: Record<Proposal['status'], string> = {
  active:   '#10B981',
  passed:   '#FFD700',
  rejected: '#EF4444',
  executed: '#8B5CF6',
  cancelled: ILOWA_COLORS.textMuted,
};

export function ProposalCard({ proposal, onVote, hasVoted, userVote, disabled }: ProposalCardProps) {
  const statusColor = STATUS_COLORS[proposal.status] ?? ILOWA_COLORS.textMuted;
  const totalVotes  = proposal.votes.yes + proposal.votes.no + proposal.votes.abstain;
  const yesRatio    = totalVotes > 0 ? proposal.votes.yes / totalVotes : 0;
  const canVote     = proposal.status === 'active' && Date.now() < proposal.votingEnds && !hasVoted && !disabled;

  return (
    <View style={styles.card}>
      {/* header row */}
      <View style={styles.row}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.status, { color: statusColor }]}>
          {proposal.status.toUpperCase()}
        </Text>
        <View style={styles.spacer} />
        <Clock size={12} color={ILOWA_COLORS.textMuted} />
        <Text style={styles.time}>{timeLeft(proposal.votingEnds)}</Text>
      </View>

      {/* title */}
      <Text style={styles.title}>{proposal.title}</Text>

      {/* description preview */}
      {!!proposal.description && (
        <Text style={styles.desc} numberOfLines={2}>{proposal.description}</Text>
      )}

      {/* proposer */}
      <View style={styles.row}>
        <Users size={12} color={ILOWA_COLORS.textMuted} />
        <Text style={styles.proposer}>
          {proposal.proposer.slice(0, 6)}…{proposal.proposer.slice(-4)}
        </Text>
      </View>

      {/* tally bar */}
      {totalVotes > 0 && (
        <View style={styles.tallySection}>
          <View style={styles.tallyTrack}>
            <View style={[styles.tallyYes, { flex: yesRatio }]} />
            <View style={[styles.tallyNo, { flex: 1 - yesRatio }]} />
          </View>
          <View style={styles.tallyLabels}>
            <Text style={styles.tallyYesText}>{(yesRatio * 100).toFixed(0)}% Yes</Text>
            <Text style={styles.tallyCount}>{totalVotes.toFixed(0)} votes cast</Text>
          </View>
        </View>
      )}

      {/* voted badge */}
      {hasVoted && userVote && (
        <View style={[styles.votedBadge, { borderColor: userVote === 'yes' ? '#10B981' : '#EF4444' }]}>
          {userVote === 'yes'
            ? <CheckCircle size={13} color="#10B981" />
            : <XCircle size={13} color="#EF4444" />}
          <Text style={[styles.votedText, { color: userVote === 'yes' ? '#10B981' : '#EF4444' }]}>
            You voted {userVote}
          </Text>
        </View>
      )}

      {/* vote buttons */}
      {canVote && onVote && (
        <View style={styles.voteRow}>
          <Pressable
            style={[styles.voteBtn, styles.yesBtn]}
            onPress={() => onVote(proposal.id, 'yes')}
          >
            <CheckCircle size={15} color="#0D1117" />
            <Text style={styles.yesBtnText}>Yes</Text>
          </Pressable>

          <Pressable
            style={[styles.voteBtn, styles.abstainBtn]}
            onPress={() => onVote(proposal.id, 'abstain')}
          >
            <Text style={styles.abstainBtnText}>Abstain</Text>
          </Pressable>

          <Pressable
            style={[styles.voteBtn, styles.noBtn]}
            onPress={() => onVote(proposal.id, 'no')}
          >
            <XCircle size={15} color="#0D1117" />
            <Text style={styles.noBtnText}>No</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  spacer: { flex: 1 },
  statusDot: {
    width: 6, height: 6, borderRadius: 3,
  },
  status: {
    fontSize: 10,
    fontFamily: 'Sora',
    letterSpacing: 1,
  },
  time: {
    fontSize: 11,
    color: ILOWA_COLORS.textMuted,
    fontFamily: 'Inter',
  },
  title: {
    fontSize: 15,
    fontFamily: 'Sora-SemiBold',
    color: ILOWA_COLORS.textPrimary,
    lineHeight: 22,
  },
  desc: {
    fontSize: 13,
    fontFamily: 'Inter',
    color: ILOWA_COLORS.textSecondary,
    lineHeight: 18,
  },
  proposer: {
    fontSize: 11,
    color: ILOWA_COLORS.textMuted,
    fontFamily: 'Inter',
  },
  tallySection: { gap: 6 },
  tallyTrack: {
    flexDirection: 'row',
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tallyYes: { backgroundColor: '#10B981' },
  tallyNo:  { backgroundColor: '#EF4444' },
  tallyLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tallyYesText: {
    fontSize: 11,
    color: '#10B981',
    fontFamily: 'Inter-Medium',
  },
  tallyCount: {
    fontSize: 11,
    color: ILOWA_COLORS.textMuted,
    fontFamily: 'Inter',
  },
  votedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  votedText: {
    fontSize: 12,
    fontFamily: 'Sora',
    textTransform: 'capitalize',
  },
  voteRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  voteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
  },
  yesBtn:     { backgroundColor: '#10B981' },
  noBtn:      { backgroundColor: '#EF4444' },
  abstainBtn: { backgroundColor: 'rgba(255,255,255,0.1)', flex: 0.8 },
  yesBtnText: {
    fontSize: 13,
    fontFamily: 'Sora-Bold',
    color: '#0D1117',
  },
  noBtnText: {
    fontSize: 13,
    fontFamily: 'Sora-Bold',
    color: '#0D1117',
  },
  abstainBtnText: {
    fontSize: 12,
    fontFamily: 'Sora',
    color: ILOWA_COLORS.textSecondary,
  },
});
