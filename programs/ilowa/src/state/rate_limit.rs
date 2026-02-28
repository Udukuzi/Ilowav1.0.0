use anchor_lang::prelude::*;
use crate::errors::IlowaError;

#[account]
#[derive(InitSpace)]
pub struct RateLimitAccount {
    pub user: Pubkey,
    pub last_bet_timestamp: i64,
    pub bets_in_window: u8,
    pub window_start: i64,
    pub banned_until: Option<i64>,
    pub bump: u8,
}

const MAX_BETS_PER_HOUR: u8 = 10;
const MIN_BET_INTERVAL: i64 = 60; // 1 minute
const WINDOW_DURATION: i64 = 3600; // 1 hour
const SUSPICIOUS_THRESHOLD: u8 = 20;
const BAN_DURATION: i64 = 24 * 3600; // 24 hours

impl RateLimitAccount {
    /// Check if user can place a bet (rate limit).
    /// Prevents spam and DoS attacks.
    pub fn can_bet(&self, clock: &Clock) -> Result<()> {
        let now = clock.unix_timestamp;

        // Check if banned
        if let Some(ban_until) = self.banned_until {
            require!(now >= ban_until, IlowaError::UserBanned);
        }

        // If window expired, user can always bet (counter will reset in record_bet)
        let in_current_window = (now - self.window_start) < WINDOW_DURATION;
        if !in_current_window {
            return Ok(());
        }

        // Check rate limit
        require!(
            self.bets_in_window < MAX_BETS_PER_HOUR,
            IlowaError::RateLimitExceeded
        );

        // Check cooldown
        require!(
            now - self.last_bet_timestamp >= MIN_BET_INTERVAL,
            IlowaError::BetTooSoon
        );

        Ok(())
    }

    /// Update rate limit state after successful bet.
    pub fn record_bet(&mut self, clock: &Clock) {
        let now = clock.unix_timestamp;

        // Reset window if expired
        if (now - self.window_start) >= WINDOW_DURATION {
            self.window_start = now;
            self.bets_in_window = 0;
        }

        self.last_bet_timestamp = now;
        self.bets_in_window = self.bets_in_window.saturating_add(1);

        // Auto-ban if suspicious activity
        if self.bets_in_window > SUSPICIOUS_THRESHOLD {
            self.banned_until = Some(now + BAN_DURATION);
        }
    }
}
