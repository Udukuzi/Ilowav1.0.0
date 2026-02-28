/**
 * Points rules for Ilowa.
 *
 * Keep this in one place so adjusting rewards doesn't require hunting
 * through multiple files. The backend mirrors these values in _POINTS_TABLE
 * (backend/main.py) — if you change something here, update there too.
 */

import { pointsSystem } from './PointsSystem';

export const POINTS_RULES = {
  // early adoption — generous to reward risk-takers
  EARLY_USER_SIGNUP:         100,
  FIRST_WEEK_USER:           500,
  BETA_TESTER:              1000,
  DAILY_LOGIN:                 3,
  WEEKLY_ACTIVE:              50,

  // prediction markets
  CREATE_MARKET:              10,
  PLACE_BET:                   5,
  ACCURATE_PREDICTION:        50,
  STREAK_BONUS_3:             25,   // 3 correct in a row
  STREAK_BONUS_5:            100,   // 5 in a row

  // radio & music
  RADIO_LISTEN_HOUR:           3,   // per hour of radio streamed
  AUDIUS_TRACK_PLAY:           1,   // played a full Audius track
  RADIO_CALL_IN:               5,   // submitted a voice call-in

  // social
  FOLLOW_CREATOR:              2,
  TIP_CREATOR:                15,
  JOIN_CHAT_ROOM:              5,
  SHARE_BLINK:                 3,   // shared an OrbitFlare Blink

  // content creation
  UPLOAD_AUDIO:               20,
  PODCAST_EPISODE:            50,
  VERIFIED_CREATOR:          200,
  MINT_NFT:                   20,

  // referrals
  REFER_USER:                100,
  REFERRAL_BECOMES_ACTIVE:    50,

  // events (KYD)
  TICKET_PURCHASED:           10,
  EVENT_ATTENDED:             25,

  // federated learning
  FL_CONTRIBUTION:             5,   // submitted a learning contribution

  // governance
  VOTE_ON_PROPOSAL:           10,
  CREATE_PROPOSAL:            25,
  PROPOSAL_PASSES:           100,
} as const;


/**
 * Called wherever a user action happens (market creation, bet placement, etc.).
 * Fires-and-forgets to the VPS — doesn't block the UI flow.
 *
 * Requires auth because the VPS needs a signed message to accept the write.
 * Pass `null` for auth in server-side contexts where the VPS calls Python directly.
 */
export async function autoAwardPoints(
  userWallet: string,
  action: string,
  metadata?: Record<string, unknown>,
  auth?: { signMessage: (msg: Uint8Array) => Promise<Uint8Array> } | null
): Promise<void> {
  let pts = 0;
  let activity = '';

  switch (action) {
    case 'market_created':
      pts = POINTS_RULES.CREATE_MARKET;
      activity = 'predictions';
      break;

    case 'bet_placed':
      pts = POINTS_RULES.PLACE_BET;
      activity = 'predictions';
      break;

    case 'prediction_won': {
      pts = POINTS_RULES.ACCURATE_PREDICTION;
      activity = 'accuratePredictions';
      const streak = Number(metadata?.winStreak ?? 0);
      if (streak >= 5) pts += POINTS_RULES.STREAK_BONUS_5;
      else if (streak >= 3) pts += POINTS_RULES.STREAK_BONUS_3;
      break;
    }

    case 'creator_followed':
      pts = POINTS_RULES.FOLLOW_CREATOR;
      activity = 'socialEngagement';
      break;

    case 'creator_tipped':
      pts = POINTS_RULES.TIP_CREATOR;
      activity = 'socialEngagement';
      break;

    case 'user_referred':
      pts = POINTS_RULES.REFER_USER;
      activity = 'referrals';
      break;

    case 'nft_minted':
      pts = POINTS_RULES.MINT_NFT;
      activity = 'contentCreation';
      break;

    case 'voted_on_proposal':
      pts = POINTS_RULES.VOTE_ON_PROPOSAL;
      activity = 'socialEngagement';
      break;

    case 'proposal_created':
      pts = POINTS_RULES.CREATE_PROPOSAL;
      activity = 'socialEngagement';
      break;

    case 'daily_login':
      pts = POINTS_RULES.DAILY_LOGIN;
      activity = 'socialEngagement';
      break;

    case 'radio_call_in':
      pts = POINTS_RULES.RADIO_CALL_IN;
      activity = 'contentCreation';
      break;

    case 'radio_listen_hour':
      pts = POINTS_RULES.RADIO_LISTEN_HOUR;
      activity = 'contentCreation';
      break;

    case 'audius_track_play':
      pts = POINTS_RULES.AUDIUS_TRACK_PLAY;
      activity = 'contentCreation';
      break;

    case 'ticket_purchased':
      pts = POINTS_RULES.TICKET_PURCHASED;
      activity = 'socialEngagement';
      break;

    case 'event_attended':
      pts = POINTS_RULES.EVENT_ATTENDED;
      activity = 'socialEngagement';
      break;

    case 'fl_contribution':
      pts = POINTS_RULES.FL_CONTRIBUTION;
      activity = 'contentCreation';
      break;

    case 'blink_shared':
      pts = POINTS_RULES.SHARE_BLINK;
      activity = 'socialEngagement';
      break;

    default:
      console.warn('[Points] No rule for action:', action);
      return;
  }

  if (pts <= 0) return;

  // Apply tier multiplier — higher tiers earn more per action
  const currentPoints = await pointsSystem.getUserPoints(userWallet).catch(() => null);
  if (currentPoints) {
    const mult = pointsSystem.getMultiplier(currentPoints.tier);
    pts = Math.round(pts * mult);
  }

  try {
    await pointsSystem.awardPoints({
      userWallet,
      activity: activity as any,
      amount: pts,
      // signMessage is optional — when absent (e.g. right after a tx closes
      // the MWA session) we still fire the award using wallet address only.
      auth: auth ? { wallet: userWallet, signMessage: auth.signMessage } : { wallet: userWallet },
    });
  } catch (err) {
    console.error('[Points] autoAwardPoints failed silently:', err);
  }
}
