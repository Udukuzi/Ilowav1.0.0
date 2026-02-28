import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Pressable, TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Plus, Lock, Zap } from 'lucide-react-native';
import { ILOWA_COLORS } from '@/theme/colors';
import { ProposalCard } from '@/components/governance/ProposalCard';
import { hybridGovernance, Proposal, VoteChoice } from '@/lib/governance/HybridGovernance';
import { useWallet } from '@/hooks/useWallet';

// ── Create Proposal Modal ─────────────────────────────────────────────────────

function CreateProposalModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (title: string, description: string, days: number) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [desc,  setDesc]  = useState('');
  const [days,  setDays]  = useState('7');
  const [busy,  setBusy]  = useState(false);

  const submit = async () => {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Give the proposal a title before submitting.');
      return;
    }
    const d = parseInt(days, 10);
    if (isNaN(d) || d < 1 || d > 30) {
      Alert.alert('Invalid duration', 'Voting duration must be 1–30 days.');
      return;
    }
    setBusy(true);
    try {
      await onCreate(title.trim(), desc.trim(), d);
      setTitle(''); setDesc(''); setDays('7');
      onClose();
    } catch (err: any) {
      Alert.alert('Failed', err.message ?? 'Could not create proposal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={modal.backdrop}>
        <View style={modal.sheet}>
          <View style={modal.handle} />

          <Text style={modal.heading}>New Proposal</Text>
          <Text style={modal.sub}>Requires 1 000+ points or SAFT holder status</Text>

          <Text style={modal.label}>Title *</Text>
          <TextInput
            style={modal.input}
            placeholder="e.g. Reduce platform fee to 0.3%"
            placeholderTextColor={ILOWA_COLORS.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          <Text style={modal.label}>Description</Text>
          <TextInput
            style={[modal.input, modal.multiline]}
            placeholder="Explain the reasoning and expected impact…"
            placeholderTextColor={ILOWA_COLORS.textMuted}
            value={desc}
            onChangeText={setDesc}
            multiline
            numberOfLines={4}
            maxLength={500}
          />

          <Text style={modal.label}>Voting Duration (days)</Text>
          <TextInput
            style={modal.input}
            placeholder="7"
            placeholderTextColor={ILOWA_COLORS.textMuted}
            value={days}
            onChangeText={setDays}
            keyboardType="number-pad"
            maxLength={2}
          />

          <View style={modal.secNote}>
            <Lock size={13} color={ILOWA_COLORS.gold} />
            <Text style={modal.secNoteText}>
              Vote tallies stored blind in Nillion — encrypted, quantum-resistant
            </Text>
          </View>

          <View style={modal.btnRow}>
            <Pressable style={modal.cancelBtn} onPress={onClose} disabled={busy}>
              <Text style={modal.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={modal.submitBtn} onPress={submit} disabled={busy}>
              {busy
                ? <ActivityIndicator size="small" color="#0D1117" />
                : <Text style={modal.submitText}>Submit</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function GovernanceScreen() {
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const wallet  = useWallet();

  const [proposals,  setProposals]  = useState<Proposal[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [voted,      setVoted]      = useState<Record<string, VoteChoice>>({});
  const [voting,     setVoting]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await hybridGovernance.listActiveProposals();
      setProposals(list);
    } catch (err) {
      console.error('[Governance] load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (title: string, description: string, days: number) => {
    if (!wallet.connected || !wallet.publicKey) {
      throw new Error('Connect your wallet first');
    }
    if (!wallet.signMessage) {
      throw new Error('Wallet does not support message signing');
    }
    await hybridGovernance.createProposal({
      title,
      description,
      proposerWallet: wallet.publicKey.toBase58(),
      votingDuration: days,
      auth: { wallet: wallet.publicKey.toBase58(), signMessage: wallet.signMessage },
    });
    await load();
  };

  const handleVote = async (proposalId: string, choice: VoteChoice) => {
    if (!wallet.connected || !wallet.publicKey) {
      Alert.alert('Not connected', 'Connect your wallet to vote');
      return;
    }
    if (!wallet.signMessage) {
      Alert.alert('Unsupported', 'Your wallet does not support message signing');
      return;
    }
    setVoting(proposalId);
    try {
      await hybridGovernance.vote({
        proposalId,
        voterWallet: wallet.publicKey.toBase58(),
        choice,
        auth: { wallet: wallet.publicKey.toBase58(), signMessage: wallet.signMessage },
      });
      setVoted(prev => ({ ...prev, [proposalId]: choice }));
      Alert.alert('Vote recorded', `Your ${choice} vote is stored privately in Nillion.`);
      await load();
    } catch (err: any) {
      Alert.alert('Vote failed', err.message ?? 'Something went wrong');
    } finally {
      setVoting(null);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* header */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={ILOWA_COLORS.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Governance</Text>
        {wallet.connected && (
          <Pressable style={styles.createBtn} onPress={() => setShowCreate(true)}>
            <Plus size={18} color="#0D1117" />
          </Pressable>
        )}
      </Animated.View>

      {/* privacy banner */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.banner}>
        <Lock size={13} color={ILOWA_COLORS.gold} />
        <Text style={styles.bannerText}>
          Votes are blind — stored encrypted in Nillion. Quadratic voting prevents whale capture.
        </Text>
      </Animated.View>

      {/* how it works pills */}
      <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.pills}>
        <Pill label="Points-weighted" color="#10B981" />
        <Pill label="Quadratic √pts" color="#8B5CF6" />
        <Pill label="60% threshold" color={ILOWA_COLORS.gold} />
        <Pill label="Blind Nillion" color="#00D9FF" />
      </Animated.View>

      {/* proposal list */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {loading ? (
          <ActivityIndicator color={ILOWA_COLORS.gold} style={{ marginTop: 40 }} />
        ) : proposals.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.empty}>
            <Zap size={40} color={ILOWA_COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No active proposals</Text>
            <Text style={styles.emptyText}>
              Earn 1 000+ points or hold SAFT to create the first one.
            </Text>
          </Animated.View>
        ) : (
          proposals.map((p, idx) => (
            <Animated.View key={p.id} entering={FadeInDown.delay(idx * 60).duration(400)}>
              <ProposalCard
                proposal={p}
                onVote={handleVote}
                hasVoted={!!voted[p.id]}
                userVote={voted[p.id] ?? null}
                disabled={voting === p.id}
              />
            </Animated.View>
          ))
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      <CreateProposalModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />
    </View>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[pill.wrap, { borderColor: color, backgroundColor: `${color}14` }]}>
      <Text style={[pill.text, { color }]}>{label}</Text>
    </View>
  );
}

const pill = StyleSheet.create({
  wrap: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  text: { fontSize: 11, fontFamily: 'Sora' },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ILOWA_COLORS.deepBlack,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ILOWA_COLORS.cardDark,
  },
  title: {
    flex: 1,
    fontFamily: 'Sora-Bold',
    fontSize: 22,
    color: ILOWA_COLORS.textPrimary,
  },
  createBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: 'rgba(255,215,0,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.15)',
    borderRadius: 10,
    padding: 12,
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    color: ILOWA_COLORS.textSecondary,
    fontFamily: 'Inter',
    lineHeight: 18,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  list: {
    paddingHorizontal: 20,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 18,
    color: ILOWA_COLORS.textSecondary,
  },
  emptyText: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: ILOWA_COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
});

const modal = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F1117',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 6,
  },
  heading: {
    fontFamily: 'Sora-Bold',
    fontSize: 20,
    color: ILOWA_COLORS.textPrimary,
  },
  sub: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.textMuted,
    marginTop: -8,
  },
  label: {
    fontFamily: 'Sora',
    fontSize: 12,
    color: ILOWA_COLORS.textSecondary,
    marginBottom: -8,
  },
  input: {
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: ILOWA_COLORS.textPrimary,
    fontFamily: 'Inter',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  multiline: {
    height: 96,
    textAlignVertical: 'top',
  },
  secNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,215,0,0.06)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.12)',
  },
  secNoteText: {
    flex: 1,
    fontSize: 12,
    color: ILOWA_COLORS.textSecondary,
    fontFamily: 'Inter',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: 'Sora',
    fontSize: 14,
    color: ILOWA_COLORS.textSecondary,
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
  },
  submitText: {
    fontFamily: 'Sora-Bold',
    fontSize: 14,
    color: '#0D1117',
  },
});
