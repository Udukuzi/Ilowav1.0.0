/**
 * OrbitFlare Blinks Integration
 * 
 * OrbitFlare enables Solana Actions (Blinks) — shareable, composable
 * transaction links that can be embedded anywhere. Ilowa uses Blinks
 * to create one-click actions for:
 * 
 * - Prediction market bets (share a "bet YES on X" link)
 * - DJ tips (share a "tip DJ Amara" link)
 * - Event tickets (share a "buy ticket" link)
 * - Radio call-in rewards
 * 
 * @see https://orbitflare.com
 */

import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

const BLINK_BASE = process.env.EXPO_PUBLIC_ORBITFLARE_URL || 'https://blinks.ilowa.app';

// ─── Types ──────────────────────────────────────────────────────────

export interface BlinkAction {
  id: string;
  type: 'bet' | 'tip' | 'ticket' | 'follow' | 'custom';
  title: string;
  description: string;
  icon: string; // URL or emoji
  label: string; // button text
  url: string; // the blink URL
  params: Record<string, string>;
  createdAt: string;
}

export interface BlinkMetadata {
  title: string;
  icon: string;
  description: string;
  label: string;
  links?: {
    actions: {
      label: string;
      href: string;
      parameters?: { name: string; label: string }[];
    }[];
  };
}

// ─── Blink Generators ───────────────────────────────────────────────

/**
 * Create a Blink for placing a bet on a prediction market.
 * Anyone who clicks the link can bet directly from their wallet.
 */
export function createBetBlink(params: {
  marketId: string;
  marketQuestion: string;
  side: 'yes' | 'no';
  suggestedAmount?: number;
}): BlinkAction {
  const { marketId, marketQuestion, side, suggestedAmount } = params;
  const urlParams = new URLSearchParams({
    market: marketId,
    side,
    ...(suggestedAmount ? { amount: suggestedAmount.toString() } : {}),
  });

  return {
    id: `bet-${marketId}-${side}-${Date.now()}`,
    type: 'bet',
    title: `Bet ${side.toUpperCase()} on "${marketQuestion}"`,
    description: `One-click prediction bet via Ilowa Markets`,
    icon: side === 'yes' ? '🟢' : '🔴',
    label: `Bet ${side.toUpperCase()}${suggestedAmount ? ` (${suggestedAmount} SOL)` : ''}`,
    url: `${BLINK_BASE}/api/actions/bet?${urlParams}`,
    params: { marketId, side },
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create a Blink for tipping a DJ.
 * Shareable link that lets anyone send SOL to the DJ's wallet.
 */
export function createTipBlink(params: {
  djName: string;
  djWallet: string;
  stationName: string;
  suggestedAmount?: number;
}): BlinkAction {
  const { djName, djWallet, stationName, suggestedAmount } = params;
  const urlParams = new URLSearchParams({
    wallet: djWallet,
    dj: djName,
    station: stationName,
    ...(suggestedAmount ? { amount: suggestedAmount.toString() } : {}),
  });

  return {
    id: `tip-${djWallet.slice(0, 8)}-${Date.now()}`,
    type: 'tip',
    title: `Tip DJ ${djName}`,
    description: `Support ${djName} on ${stationName} — powered by Ilowa Radio`,
    icon: '🎧',
    label: `Tip ${suggestedAmount ? `${suggestedAmount} SOL` : 'DJ'}`,
    url: `${BLINK_BASE}/api/actions/tip?${urlParams}`,
    params: { djWallet, djName, amount: String(suggestedAmount || 0.05) },
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create a Blink for purchasing an event ticket via KYD.
 */
export function createTicketBlink(params: {
  eventId: string;
  eventName: string;
  tierId: string;
  tierName: string;
  price: number;
}): BlinkAction {
  const { eventId, eventName, tierId, tierName, price } = params;
  const urlParams = new URLSearchParams({
    event: eventId,
    tier: tierId,
  });

  return {
    id: `ticket-${eventId}-${tierId}-${Date.now()}`,
    type: 'ticket',
    title: `Get ${tierName} for "${eventName}"`,
    description: `Purchase a ${tierName} ticket — ${price} SOL via Ilowa Events`,
    icon: '🎫',
    label: `Buy Ticket (${price} SOL)`,
    url: `${BLINK_BASE}/api/actions/ticket?${urlParams}`,
    params: { eventId, tierId },
    createdAt: new Date().toISOString(),
  };
}

// ─── Blink Resolution ───────────────────────────────────────────────

/**
 * Fetch metadata for a Blink URL (the actions.json spec).
 * Used when rendering shared Blinks in the chat or feed.
 */
export async function resolveBlinkMetadata(blinkUrl: string): Promise<BlinkMetadata | null> {
  try {
    const res = await fetch(blinkUrl, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Execute a Blink action — returns a transaction to sign.
 * The user's wallet signs and submits.
 */
export async function executeBlinkAction(
  actionUrl: string,
  walletAddress: string
): Promise<{ transaction: string } | null> {
  try {
    const res = await fetch(actionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: walletAddress }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Share Helpers ──────────────────────────────────────────────────

/**
 * Generate an attractive, human-readable share message for a Blink.
 * Works with any share sheet (WhatsApp, Telegram, Twitter, X, etc.)
 * 
 * For tips: builds a solana: pay link that Phantom, Solflare, Backpack
 * and other Solana wallets can open directly. The message is designed
 * to feel personal and encourage support — not just dump raw params.
 */
export function getBlinkShareText(blink: BlinkAction): string {
  if (blink.type === 'tip' && blink.params.djWallet) {
    const name = blink.params.djName || 'this artist';
    const amount = blink.params.amount || '0.05';
    const label = encodeURIComponent(`Tip ${name}`);
    const msg = encodeURIComponent(`Love from a fan — via Ilowa Radio 🎧`);
    const solPayUrl = `solana:${blink.params.djWallet}?amount=${amount}&label=${label}&message=${msg}`;

    return [
      `🎧 Support ${name} on Ilowa Radio`,
      ``,
      `Every tip fuels independent music from the Global South.`,
      `Drop ${amount} SOL to show some love — it only takes a tap.`,
      ``,
      `👇 Tap to tip (opens in any Solana wallet)`,
      solPayUrl,
      ``,
      `Powered by Ilowa · Solana · Audius`,
    ].join('\n');
  }

  if (blink.type === 'bet') {
    return [
      `🔮 ${blink.title}`,
      ``,
      blink.description,
      ``,
      `Think you know the answer? Make your prediction on Ilowa Markets.`,
      ``,
      `Powered by Ilowa on Solana`,
    ].join('\n');
  }

  if (blink.type === 'ticket') {
    return [
      `🎫 ${blink.title}`,
      ``,
      blink.description,
      ``,
      `Grab your ticket before it sells out.`,
      ``,
      `Powered by Ilowa · KYD Events`,
    ].join('\n');
  }

  return `${blink.title}\n\n${blink.description}\n\nPowered by Ilowa on Solana`;
}

/**
 * Check if a URL is a valid Ilowa Blink.
 */
export function isIlowaBlink(url: string): boolean {
  return url.startsWith(BLINK_BASE) || url.includes('ilowa.app/api/actions');
}
