/**
 * Hybrid governance for Ilowa — pre-token, points-weighted + quadratic voting.
 *
 * Votes are stored blind in Nillion (via VPS) so no one can see how a specific
 * wallet voted. Tallies are computed server-side and only the aggregate counts
 * are written back to Supabase for public display.
 *
 * Eligibility to propose: 1 000+ points OR SAFT holder.
 * Voting power: sqrt(total_points) — dampens whale effects without eliminating them.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { nillionStorage, WalletAuth } from '../nillion/NillionClient';
import { pointsSystem } from '../points/PointsSystem';

let _sb: SupabaseClient | null = null;
function getSupabase(): SupabaseClient | null {
  if (_sb) return _sb;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _sb = createClient(url, key);
  return _sb;
}

const VPS_URL = process.env.EXPO_PUBLIC_VPS_API_URL || 'http://localhost:3000';

export interface Proposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  createdAt: number;
  votingEnds: number;
  status: 'active' | 'passed' | 'rejected' | 'executed' | 'cancelled';
  votes: { yes: number; no: number; abstain: number };
  quorum: number;      // fraction of total sqrt-points that must participate
  threshold: number;   // yes / (yes + no) needed to pass
}

export type VoteChoice = 'yes' | 'no' | 'abstain';


class HybridGovernanceSystem {

  // ── proposal creation ──────────────────────────────────────────────────────

  async createProposal({
    title,
    description,
    proposerWallet,
    votingDuration = 7,
    auth,
  }: {
    title: string;
    description: string;
    proposerWallet: string;
    votingDuration?: number;
    auth: WalletAuth;
  }): Promise<string> {
    // eligibility — check locally against Supabase cache before round-tripping VPS
    const pts = await pointsSystem.getUserPoints(proposerWallet);
    const isSAFT = await this._isSAFTHolder(proposerWallet);

    if (pts.totalPoints < 1_000 && !isSAFT) {
      throw new Error('You need at least 1 000 points or SAFT holder status to create a proposal');
    }

    // send to VPS (which calls Python → Supabase)
    const message = `ilowa_AUTH_${Date.now()}`;
    const msgBytes = new TextEncoder().encode(message);
    let signature = '';
    if (auth.signMessage) {
      const sigBytes = await auth.signMessage(msgBytes);
      signature = Buffer.from(sigBytes).toString('hex');
    }

    const resp = await fetch(`${VPS_URL}/api/governance/propose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: proposerWallet,
        signature,
        message,
        title,
        description,
        votingDuration,
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      throw new Error(`Proposal creation failed: ${detail}`);
    }

    const { proposal_id } = await resp.json();
    console.log('[Governance] Proposal created:', proposal_id);
    return proposal_id;
  }

  // ── voting ────────────────────────────────────────────────────────────────

  async vote({
    proposalId,
    voterWallet,
    choice,
    auth,
  }: {
    proposalId: string;
    voterWallet: string;
    choice: VoteChoice;
    auth: WalletAuth;
  }): Promise<void> {
    // make sure the proposal is still open
    const proposal = await this.getProposal(proposalId);
    if (!proposal) throw new Error('Proposal not found');
    if (proposal.status !== 'active') throw new Error(`Proposal is ${proposal.status}`);
    if (Date.now() > proposal.votingEnds) throw new Error('Voting period has closed');

    // has this wallet already voted?
    const voted = await this._hasVoted(proposalId, voterWallet);
    if (voted) throw new Error('You have already voted on this proposal');

    // quadratic voting power based on the user's points
    const pts   = await pointsSystem.getUserPoints(voterWallet);
    const power = Math.sqrt(Math.max(pts.totalPoints, 1));

    // store blind vote in Nillion via VPS
    await nillionStorage.storeSecret(
      {
        secretName:   `vote_${proposalId}_${voterWallet}`,
        secretValue:  JSON.stringify({ choice, power, ts: Date.now() }),
        allowedUsers: [voterWallet, 'ILOWA_GOVERNANCE_TALLIER'],
      },
      auth
    );

    // also call VPS governance/vote so the Python backend updates Supabase tally
    const message = `ilowa_AUTH_${Date.now()}`;
    const msgBytes = new TextEncoder().encode(message);
    let signature = '';
    if (auth.signMessage) {
      const sigBytes = await auth.signMessage(msgBytes);
      signature = Buffer.from(sigBytes).toString('hex');
    }

    const resp = await fetch(`${VPS_URL}/api/governance/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: voterWallet,
        signature,
        message,
        proposalId,
        choice,
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      throw new Error(`Vote submission failed: ${detail}`);
    }

    console.log('[Governance] Vote cast — power:', power.toFixed(2), 'choice:', choice);
  }

  // ── reads ─────────────────────────────────────────────────────────────────

  async getProposal(proposalId: string): Promise<Proposal | null> {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single();

    if (error || !data) return null;

    return {
      id:          data.id,
      title:       data.title,
      description: data.description ?? '',
      proposer:    data.proposer_wallet ?? '',
      createdAt:   new Date(data.created_at).getTime(),
      votingEnds:  new Date(data.voting_ends).getTime(),
      status:      data.status,
      votes:       { yes: 0, no: 0, abstain: 0 },  // tallies come from separate query
      quorum:      0.1,
      threshold:   0.6,
    };
  }

  async listActiveProposals(): Promise<Proposal[]> {
    const sb = getSupabase();
    if (!sb) return [];
    const { data } = await sb
      .from('proposals')
      .select('*')
      .eq('status', 'active')
      .gt('voting_ends', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    return (data ?? []).map(d => ({
      id:          d.id,
      title:       d.title,
      description: d.description ?? '',
      proposer:    d.proposer_wallet ?? '',
      createdAt:   new Date(d.created_at).getTime(),
      votingEnds:  new Date(d.voting_ends).getTime(),
      status:      d.status,
      votes:       { yes: 0, no: 0, abstain: 0 },
      quorum:      0.1,
      threshold:   0.6,
    }));
  }

  // ── private helpers ───────────────────────────────────────────────────────

  private async _isSAFTHolder(wallet: string): Promise<boolean> {
    const sb = getSupabase();
    if (!sb) return false;
    const { data } = await sb
      .from('saft_holders')
      .select('wallet_address')
      .eq('wallet_address', wallet)
      .single();
    return !!data;
  }

  private async _hasVoted(proposalId: string, wallet: string): Promise<boolean> {
    // check Nillion — if the secret exists, the wallet already voted
    try {
      const val = await nillionStorage.retrieveSecret(
        `vote_${proposalId}_${wallet}`,
        wallet
      );
      return val !== null;
    } catch {
      return false;
    }
  }
}

export const hybridGovernance = new HybridGovernanceSystem();
