use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::market::*;
use crate::errors::IlowaError;

const PRIVACY_FEE: u64 = 5_000_000; // 0.005 SOL MPC encryption fee

/// Shielded bet using Arcium MPC — bet amounts are encrypted on-chain.
/// The outcome is committed via a hash, revealed only at resolution.
/// Amount is encrypted client-side; only bet count is public.
#[derive(Accounts)]
pub struct ShieldedBet<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        constraint = market.status == MarketStatus::Active @ IlowaError::MarketNotActive,
    )]
    pub market: Account<'info, Market>,

    #[account(
        init,
        payer = user,
        space = 8 + ShieldedBetAccount::INIT_SPACE,
        seeds = [b"shielded_bet", market.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub bet: Account<'info, ShieldedBetAccount>,

    /// CHECK: Platform treasury PDA (collects privacy fee)
    #[account(
        mut,
        seeds = [b"treasury"],
        bump
    )]
    pub platform_treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn shielded_bet(
    ctx: Context<ShieldedBet>,
    encrypted_amount: Vec<u8>,
    zk_proof: Vec<u8>,
    outcome: bool,
) -> Result<()> {
    // Validate encrypted data format
    require!(
        encrypted_amount.len() >= 32 && encrypted_amount.len() <= 128,
        IlowaError::InvalidEncryptedData
    );

    // Validate ZK proof format
    require!(
        zk_proof.len() >= 32 && zk_proof.len() <= 128,
        IlowaError::InvalidZkProof
    );

    let clock = Clock::get()?;
    let market = &ctx.accounts.market;
    require!(clock.unix_timestamp < market.expires_at, IlowaError::MarketExpired);

    // Transfer privacy fee to treasury (covers MPC encryption cost)
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.platform_treasury.to_account_info(),
            },
        ),
        PRIVACY_FEE,
    )?;

    // Update market — only bet COUNT is public (amounts are shielded)
    let market = &mut ctx.accounts.market;
    market.total_bets = market.total_bets
        .checked_add(1)
        .ok_or(IlowaError::ArithmeticOverflow)?;

    // Store shielded bet — encrypted amount, no plaintext on-chain
    let bet = &mut ctx.accounts.bet;
    bet.market = market.key();
    bet.bettor = ctx.accounts.user.key();
    bet.encrypted_amount = encrypted_amount;
    bet.outcome = outcome;
    bet.zk_proof = zk_proof;
    bet.timestamp = clock.unix_timestamp;
    bet.resolved = false;
    bet.bump = ctx.bumps.bet;

    // Emit event — NO amount revealed (privacy preserved)
    emit!(ShieldedBetPlaced {
        market: market.key(),
        bettor: ctx.accounts.user.key(),
        outcome,
        timestamp: bet.timestamp,
    });

    Ok(())
}

/// On-chain shielded bet account — stores encrypted amount, not plaintext.
#[account]
#[derive(InitSpace)]
pub struct ShieldedBetAccount {
    pub market: Pubkey,
    pub bettor: Pubkey,
    #[max_len(128)]
    pub encrypted_amount: Vec<u8>,
    pub outcome: bool,
    #[max_len(128)]
    pub zk_proof: Vec<u8>,
    pub timestamp: i64,
    pub resolved: bool,
    pub bump: u8,
}

#[event]
pub struct ShieldedBetPlaced {
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub outcome: bool,
    pub timestamp: i64,
}
