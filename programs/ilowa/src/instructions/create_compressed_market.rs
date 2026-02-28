use anchor_lang::prelude::*;
use crate::errors::IlowaError;

const ONE_YEAR: i64 = 365 * 24 * 60 * 60;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum CompressedMarketCategory {
    Currency,
    Weather,
    Politics,
    Crypto,
    Sports,
    Culture,
    Other,
}

/// Compressed market — designed for Light Protocol ZK compression.
/// Uses smaller footprint than regular Market for 1000x cheaper storage.
/// When Light Protocol SDK is integrated, this account will be stored
/// in a merkle tree instead of as a regular Solana account.
#[account]
#[derive(InitSpace)]
pub struct CompressedMarket {
    pub creator: Pubkey,
    #[max_len(280)]
    pub question: String,
    pub category: CompressedMarketCategory,
    pub resolve_date: i64,
    pub yes_bets: u64,
    pub no_bets: u64,
    pub is_active: bool,
    pub resolved: bool,
    pub outcome: Option<bool>,
    pub created_at: i64,
    pub bump: u8,
}

#[derive(Accounts)]
#[instruction(question: String, resolve_date: i64)]
pub struct CreateCompressedMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + CompressedMarket::INIT_SPACE,
        seeds = [
            b"compressed_market",
            creator.key().as_ref(),
            &resolve_date.to_le_bytes(),
        ],
        bump
    )]
    pub market: Account<'info, CompressedMarket>,

    pub system_program: Program<'info, System>,
}

pub fn create_compressed_market(
    ctx: Context<CreateCompressedMarket>,
    question: String,
    resolve_date: i64,
    category: CompressedMarketCategory,
) -> Result<()> {
    // Validate question length
    require!(
        question.len() >= 10 && question.len() <= 280,
        IlowaError::InvalidQuestionLength
    );

    let clock = Clock::get()?;

    // Resolve date must be in future
    require!(
        resolve_date > clock.unix_timestamp,
        IlowaError::InvalidResolveDate
    );

    // Resolve date not too far (max 1 year)
    require!(
        resolve_date < clock.unix_timestamp + ONE_YEAR,
        IlowaError::ResolveDateTooFar
    );

    let market = &mut ctx.accounts.market;
    market.creator = ctx.accounts.creator.key();
    market.question = question;
    market.category = category;
    market.resolve_date = resolve_date;
    market.yes_bets = 0;
    market.no_bets = 0;
    market.is_active = true;
    market.resolved = false;
    market.outcome = None;
    market.created_at = clock.unix_timestamp;
    market.bump = ctx.bumps.market;

    emit!(CompressedMarketCreated {
        market: market.key(),
        creator: ctx.accounts.creator.key(),
        resolve_date,
        category,
    });

    Ok(())
}

#[event]
pub struct CompressedMarketCreated {
    pub market: Pubkey,
    pub creator: Pubkey,
    pub resolve_date: i64,
    pub category: CompressedMarketCategory,
}
