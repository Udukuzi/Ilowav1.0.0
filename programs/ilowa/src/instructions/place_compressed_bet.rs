use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::instructions::create_compressed_market::CompressedMarket;
use crate::errors::IlowaError;

const PLATFORM_FEE_BPS: u64 = 50; // 0.5% fee
const MIN_BET: u64 = 10_000_000;  // 0.01 SOL
const MAX_BET: u64 = 100_000_000_000; // 100 SOL

#[derive(Accounts)]
pub struct PlaceCompressedBet<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        constraint = market.is_active @ IlowaError::MarketNotActive,
    )]
    pub market: Account<'info, CompressedMarket>,

    #[account(
        init,
        payer = user,
        space = 8 + CompressedBet::INIT_SPACE,
        seeds = [b"compressed_bet", market.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub bet: Account<'info, CompressedBet>,

    /// CHECK: Platform treasury PDA
    #[account(
        mut,
        seeds = [b"treasury"],
        bump
    )]
    pub platform_treasury: AccountInfo<'info>,

    /// CHECK: Market vault PDA
    #[account(
        mut,
        seeds = [b"compressed_vault", market.key().as_ref()],
        bump
    )]
    pub market_vault: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn place_compressed_bet(
    ctx: Context<PlaceCompressedBet>,
    amount: u64,
    outcome: bool,
) -> Result<()> {
    require!(amount >= MIN_BET, IlowaError::BetTooSmall);
    require!(amount <= MAX_BET, IlowaError::BetTooLarge);

    let clock = Clock::get()?;
    let market = &ctx.accounts.market;

    // Check market hasn't expired
    require!(clock.unix_timestamp < market.resolve_date, IlowaError::MarketExpired);

    // Calculate platform fee (0.5%)
    let platform_fee = amount
        .checked_mul(PLATFORM_FEE_BPS)
        .ok_or(IlowaError::ArithmeticOverflow)?
        .checked_div(10_000)
        .ok_or(IlowaError::ArithmeticOverflow)?;

    let bet_amount = amount
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

    // Transfer bet amount to market vault
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.market_vault.to_account_info(),
            },
        ),
        bet_amount,
    )?;

    // Update market pools
    let market = &mut ctx.accounts.market;
    if outcome {
        market.yes_bets = market.yes_bets
            .checked_add(bet_amount)
            .ok_or(IlowaError::ArithmeticOverflow)?;
    } else {
        market.no_bets = market.no_bets
            .checked_add(bet_amount)
            .ok_or(IlowaError::ArithmeticOverflow)?;
    }

    // Store bet
    let bet = &mut ctx.accounts.bet;
    bet.market = market.key();
    bet.user = ctx.accounts.user.key();
    bet.outcome = outcome;
    bet.amount = bet_amount;
    bet.timestamp = clock.unix_timestamp;
    bet.claimed = false;
    bet.bump = ctx.bumps.bet;

    emit!(CompressedBetPlaced {
        market: market.key(),
        user: ctx.accounts.user.key(),
        amount: bet_amount,
        outcome,
        platform_fee,
    });

    Ok(())
}

#[account]
#[derive(InitSpace)]
pub struct CompressedBet {
    pub market: Pubkey,
    pub user: Pubkey,
    pub outcome: bool,
    pub amount: u64,
    pub timestamp: i64,
    pub claimed: bool,
    pub bump: u8,
}

#[event]
pub struct CompressedBetPlaced {
    pub market: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
    pub outcome: bool,
    pub platform_fee: u64,
}
