use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::market::*;
use crate::errors::IlowaError;

const MIN_BET: u64 = 10_000_000;        // 0.01 SOL
const MAX_BET: u64 = 100_000_000_000;   // 100 SOL
const PLATFORM_FEE_BPS: u64 = 50;       // 0.5% = 50 basis points

#[derive(Accounts)]
pub struct PlaceBet<'info> {
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
        space = 8 + Bet::INIT_SPACE,
        seeds = [b"bet", market.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub bet: Account<'info, Bet>,

    /// CHECK: Platform treasury PDA
    #[account(
        mut,
        seeds = [b"treasury"],
        bump
    )]
    pub platform_treasury: AccountInfo<'info>,

    /// CHECK: Market vault PDA that holds bet funds
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump
    )]
    pub market_vault: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn place_bet(
    ctx: Context<PlaceBet>,
    amount: u64,
    outcome: bool,
) -> Result<()> {
    require!(amount >= MIN_BET, IlowaError::BetTooSmall);
    require!(amount <= MAX_BET, IlowaError::BetTooLarge);

    let clock = Clock::get()?;
    let market = &ctx.accounts.market;
    require!(clock.unix_timestamp < market.expires_at, IlowaError::MarketExpired);

    // Calculate platform fee (0.5%)
    let platform_fee = amount
        .checked_mul(PLATFORM_FEE_BPS)
        .ok_or(IlowaError::ArithmeticOverflow)?
        .checked_div(10_000)
        .ok_or(IlowaError::ArithmeticOverflow)?;

    let net_amount = amount
        .checked_sub(platform_fee)
        .ok_or(IlowaError::ArithmeticOverflow)?;

    // Transfer platform fee to treasury
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.platform_treasury.to_account_info(),
            },
        ),
        platform_fee,
    )?;

    // Transfer net amount to market vault
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.market_vault.to_account_info(),
            },
        ),
        net_amount,
    )?;

    // Update market pools
    let market = &mut ctx.accounts.market;
    if outcome {
        market.yes_pool = market.yes_pool
            .checked_add(net_amount)
            .ok_or(IlowaError::ArithmeticOverflow)?;
    } else {
        market.no_pool = market.no_pool
            .checked_add(net_amount)
            .ok_or(IlowaError::ArithmeticOverflow)?;
    }
    market.total_bets = market.total_bets
        .checked_add(1)
        .ok_or(IlowaError::ArithmeticOverflow)?;

    // Record bet
    let bet = &mut ctx.accounts.bet;
    bet.market = market.key();
    bet.user = ctx.accounts.user.key();
    bet.outcome = outcome;
    bet.amount = net_amount;
    bet.is_shielded = false;
    bet.timestamp = clock.unix_timestamp;
    bet.claimed = false;
    bet.bump = ctx.bumps.bet;

    emit!(BetPlaced {
        market: market.key(),
        user: ctx.accounts.user.key(),
        outcome,
        amount: net_amount,
        platform_fee,
    });

    Ok(())
}

#[event]
pub struct BetPlaced {
    pub market: Pubkey,
    pub user: Pubkey,
    pub outcome: bool,
    pub amount: u64,
    pub platform_fee: u64,
}
