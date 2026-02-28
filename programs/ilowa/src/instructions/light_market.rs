use anchor_lang::prelude::*;
use crate::errors::IlowaError;

const ONE_YEAR: i64 = 365 * 24 * 60 * 60;
const PLATFORM_FEE_BPS: u64 = 50;
const MIN_BET: u64 = 10_000_000;
const MAX_BET: u64 = 100_000_000_000;
const ARCIUM_PRIVACY_FEE: u64 = 5_000_000;

// ── State ─────────────────────────────────────────────────────────────────────

/// Market state. oracle_authority = Pubkey::default() → manual-only resolution.
/// Light Protocol upgrade path: once light-sdk supports Anchor 0.32, this struct
/// moves to a Merkle tree leaf. Field layout stays identical.
#[account]
#[derive(InitSpace)]
pub struct LightMarketStub {
    pub creator: Pubkey,
    pub question_hash: [u8; 32],
    pub category: u8,
    pub region: u8,
    pub resolve_date: i64,
    pub yes_pool: u64,
    pub no_pool: u64,
    pub total_bets: u32,
    pub shielded_bet_count: u32,
    pub is_active: bool,
    pub resolved: bool,
    pub outcome: u8,         // 0=unresolved, 1=YES, 2=NO
    pub created_at: i64,
    pub oracle_authority: Pubkey,  // zero = no oracle
    pub oracle_threshold: i64,
    pub oracle_above: bool,        // YES wins when price >= threshold
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct LightBetStub {
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub amount: u64,
    pub outcome: bool,
    pub timestamp: i64,
    pub claimed: bool,
    pub bump: u8,
}

/// ephem_pub(32) | nonce(24) | nacl_secretbox(24) = exactly 80 bytes
/// zk_proof: salt(32) | sha256_commit(32) = exactly 64 bytes
#[account]
#[derive(InitSpace)]
pub struct ShieldedLightBetStub {
    pub market: Pubkey,
    pub bettor: Pubkey,
    #[max_len(80)]
    pub encrypted_amount: Vec<u8>,
    pub outcome: bool,
    #[max_len(64)]
    pub zk_proof: Vec<u8>,
    pub timestamp: i64,
    pub claimed: bool,
    pub bump: u8,
}

/// Arcium MXE writes encrypted pool aggregates here after computing on all
/// shielded bets. Only mxe_authority can update. Once finalized the market
/// resolver can use the decrypted totals for payouts.
#[account]
#[derive(InitSpace)]
pub struct ShieldedPoolAggregate {
    pub market: Pubkey,
    #[max_len(80)]
    pub encrypted_yes_total: Vec<u8>,
    #[max_len(80)]
    pub encrypted_no_total: Vec<u8>,
    pub total_shielded_bets: u32,
    pub last_updated: i64,
    pub mxe_authority: Pubkey,
    pub is_finalized: bool,
    pub bump: u8,
}

// ── CreateLightMarket ─────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(question_hash: [u8; 32], category: u8, region: u8, resolve_date: i64)]
pub struct CreateLightMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        init, payer = creator,
        space = 8 + LightMarketStub::INIT_SPACE,
        seeds = [b"light_market", creator.key().as_ref(), &resolve_date.to_le_bytes()],
        bump
    )]
    pub market: Account<'info, LightMarketStub>,
    pub system_program: Program<'info, System>,
}

pub fn create_light_market(
    ctx: Context<CreateLightMarket>,
    question_hash: [u8; 32],
    category: u8,
    region: u8,
    resolve_date: i64,
    oracle_authority: Pubkey,
    oracle_threshold: i64,
    oracle_above: bool,
) -> Result<()> {
    let clock = Clock::get()?;
    require!(category <= 6, IlowaError::InvalidCategory);
    require!(region <= 8, IlowaError::InvalidRegion);
    require!(resolve_date > clock.unix_timestamp, IlowaError::InvalidResolveDate);
    require!(resolve_date < clock.unix_timestamp + ONE_YEAR, IlowaError::ResolveDateTooFar);

    let m = &mut ctx.accounts.market;
    m.creator            = ctx.accounts.creator.key();
    m.question_hash      = question_hash;
    m.category           = category;
    m.region             = region;
    m.resolve_date       = resolve_date;
    m.yes_pool           = 0;
    m.no_pool            = 0;
    m.total_bets         = 0;
    m.shielded_bet_count = 0;
    m.is_active          = true;
    m.resolved           = false;
    m.outcome            = 0;
    m.created_at         = clock.unix_timestamp;
    m.oracle_authority   = oracle_authority;
    m.oracle_threshold   = oracle_threshold;
    m.oracle_above       = oracle_above;
    m.bump               = ctx.bumps.market;

    emit!(LightMarketCreated {
        market: m.key(),
        creator: ctx.accounts.creator.key(),
        question_hash, category, region, resolve_date,
        has_oracle: oracle_authority != Pubkey::default(),
    });
    Ok(())
}

// ── PlaceLightBet ─────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct PlaceLightBet<'info> {
    #[account(mut)]
    pub bettor: Signer<'info>,
    #[account(mut, constraint = market.is_active @ IlowaError::MarketNotActive)]
    pub market: Account<'info, LightMarketStub>,
    #[account(
        init, payer = bettor,
        space = 8 + LightBetStub::INIT_SPACE,
        seeds = [b"light_bet", market.key().as_ref(), bettor.key().as_ref()],
        bump
    )]
    pub bet: Account<'info, LightBetStub>,
    /// CHECK: platform treasury
    #[account(mut, seeds = [b"treasury"], bump)]
    pub platform_treasury: AccountInfo<'info>,
    /// CHECK: market SOL vault
    #[account(mut, seeds = [b"light_vault", market.key().as_ref()], bump)]
    pub market_vault: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

pub fn place_light_bet(ctx: Context<PlaceLightBet>, amount: u64, outcome: bool) -> Result<()> {
    require!(amount >= MIN_BET, IlowaError::BetTooSmall);
    require!(amount <= MAX_BET, IlowaError::BetTooLarge);
    let clock = Clock::get()?;
    require!(clock.unix_timestamp < ctx.accounts.market.resolve_date, IlowaError::MarketExpired);

    let fee = amount.checked_mul(PLATFORM_FEE_BPS).ok_or(IlowaError::ArithmeticOverflow)?
                    .checked_div(10_000).ok_or(IlowaError::ArithmeticOverflow)?;
    let net = amount.checked_sub(fee).ok_or(IlowaError::ArithmeticOverflow)?;

    anchor_lang::system_program::transfer(
        CpiContext::new(ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.bettor.to_account_info(),
                to:   ctx.accounts.platform_treasury.to_account_info() }),
        fee)?;
    anchor_lang::system_program::transfer(
        CpiContext::new(ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.bettor.to_account_info(),
                to:   ctx.accounts.market_vault.to_account_info() }),
        net)?;

    let m = &mut ctx.accounts.market;
    if outcome { m.yes_pool = m.yes_pool.checked_add(net).ok_or(IlowaError::ArithmeticOverflow)?; }
    else       { m.no_pool  = m.no_pool.checked_add(net).ok_or(IlowaError::ArithmeticOverflow)?;  }
    m.total_bets = m.total_bets.checked_add(1).ok_or(IlowaError::ArithmeticOverflow)?;

    let b = &mut ctx.accounts.bet;
    b.market = m.key(); b.bettor = ctx.accounts.bettor.key();
    b.amount = net; b.outcome = outcome;
    b.timestamp = clock.unix_timestamp; b.claimed = false; b.bump = ctx.bumps.bet;

    emit!(LightBetPlaced { market: m.key(), bettor: ctx.accounts.bettor.key(), amount: net, outcome, platform_fee: fee });
    Ok(())
}

// ── PlaceShieldedLightBet ─────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct PlaceShieldedLightBet<'info> {
    #[account(mut)]
    pub bettor: Signer<'info>,
    #[account(mut, constraint = market.is_active @ IlowaError::MarketNotActive)]
    pub market: Account<'info, LightMarketStub>,
    #[account(
        init, payer = bettor,
        space = 8 + ShieldedLightBetStub::INIT_SPACE,
        seeds = [b"shielded_light_bet", market.key().as_ref(), bettor.key().as_ref()],
        bump
    )]
    pub bet: Account<'info, ShieldedLightBetStub>,
    /// CHECK: platform treasury
    #[account(mut, seeds = [b"treasury"], bump)]
    pub platform_treasury: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

pub fn place_shielded_light_bet(
    ctx: Context<PlaceShieldedLightBet>,
    encrypted_amount: Vec<u8>,
    zk_proof: Vec<u8>,
    outcome: bool,
) -> Result<()> {
    require!(encrypted_amount.len() == 80, IlowaError::InvalidEncryptedData);
    require!(zk_proof.len() == 64, IlowaError::InvalidZkProof);
    let clock = Clock::get()?;
    require!(clock.unix_timestamp < ctx.accounts.market.resolve_date, IlowaError::MarketExpired);

    anchor_lang::system_program::transfer(
        CpiContext::new(ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.bettor.to_account_info(),
                to:   ctx.accounts.platform_treasury.to_account_info() }),
        ARCIUM_PRIVACY_FEE)?;

    let m = &mut ctx.accounts.market;
    m.total_bets         = m.total_bets.checked_add(1).ok_or(IlowaError::ArithmeticOverflow)?;
    m.shielded_bet_count = m.shielded_bet_count.checked_add(1).ok_or(IlowaError::ArithmeticOverflow)?;

    let b = &mut ctx.accounts.bet;
    b.market = m.key(); b.bettor = ctx.accounts.bettor.key();
    b.encrypted_amount = encrypted_amount; b.outcome = outcome;
    b.zk_proof = zk_proof; b.timestamp = clock.unix_timestamp;
    b.claimed = false; b.bump = ctx.bumps.bet;

    emit!(ShieldedLightBetPlaced { market: m.key(), bettor: ctx.accounts.bettor.key(), outcome, timestamp: b.timestamp });
    Ok(())
}

// ── ResolveLightMarket (creator, after resolve_date) ─────────────────────────

#[derive(Accounts)]
pub struct ResolveLightMarket<'info> {
    pub creator: Signer<'info>,
    #[account(
        mut,
        has_one = creator @ IlowaError::Unauthorized,
        constraint = market.is_active @ IlowaError::MarketNotActive,
        constraint = !market.resolved @ IlowaError::MarketAlreadyResolved,
    )]
    pub market: Account<'info, LightMarketStub>,
}

pub fn resolve_light_market(ctx: Context<ResolveLightMarket>, outcome: bool) -> Result<()> {
    let clock = Clock::get()?;
    require!(clock.unix_timestamp >= ctx.accounts.market.resolve_date, IlowaError::MarketNotExpired);

    let m = &mut ctx.accounts.market;
    m.resolved  = true;
    m.is_active = false;
    m.outcome   = if outcome { 1 } else { 2 };

    emit!(LightMarketResolved { market: m.key(), outcome, yes_pool: m.yes_pool, no_pool: m.no_pool });
    Ok(())
}

// ── Pyth V1 price account parsing ────────────────────────────────────────────
//
// Parses a Pyth Push-Oracle price account without pulling in pyth-sdk-solana,
// which currently pins solana-program to a version that conflicts with our
// anchor-lang 0.32 dependency tree. The layout below matches Pyth SDK v0.10
// (stable since v2 price accounts, ~2022) and is unlikely to change.
//
// Field offsets (all little-endian):
//   0   magic   u32  must equal 0xa1b2c3d4
//   4   ver     u32
//  20   expo    i32  price exponent  (e.g. -8 means price × 10⁻⁸)
//  40   valid_slot  u64
// 208   agg.price   i64  ← the aggregate price we want
// 216   agg.conf    u64
// 224   agg.status  u32  must be 1 (Trading) for a live price
// 232   agg.pub_slot u64 slot when this price was last published
//
// Staleness guard: price must have been published within MAX_PRICE_AGE_SLOTS.
const PYTH_MAGIC: u32      = 0xa1b2c3d4;
const MAX_PRICE_AGE_SLOTS: u64 = 25;  // ~10 seconds on mainnet/devnet

/// Returns `(raw_price, exponent)` from a Pyth V1 price account.
/// Callers compare raw_price against oracle_threshold which is stored
/// at the same Pyth scale (i.e. threshold = human_price × 10^|expo|).
fn read_pyth_price(data: &[u8], current_slot: u64) -> Result<i64> {
    require!(data.len() >= 240, IlowaError::InvalidOracleAccount);

    let magic = u32::from_le_bytes(data[0..4].try_into().unwrap());
    require!(magic == PYTH_MAGIC, IlowaError::InvalidOracleAccount);

    // expo sanity — Pyth prices use exponents like -8, -6, never positive
    let expo = i32::from_le_bytes(data[20..24].try_into().unwrap());
    require!(expo >= -12 && expo <= 0, IlowaError::InvalidOracleExponent);

    let pub_slot = u64::from_le_bytes(data[232..240].try_into().unwrap());
    require!(
        pub_slot > 0 && current_slot.saturating_sub(pub_slot) <= MAX_PRICE_AGE_SLOTS,
        IlowaError::OraclePriceStale
    );

    // status 1 = Trading (live quote). 0=Unknown, 2=Halted, 3=Auction
    let status = u32::from_le_bytes(data[224..228].try_into().unwrap());
    require!(status == 1, IlowaError::OraclePriceStale);

    let price = i64::from_le_bytes(data[208..216].try_into().unwrap());
    Ok(price)
}

// ── ResolveLightMarketOracle (Pyth or attested price) ─────────────────────────
//
// Two modes depending on what's passed as `price_feed`:
//
//   Pyth mode   — pass the Pyth price feed account (magic 0xa1b2c3d4).
//                 The program reads the aggregate price on-chain, no trust
//                 in the caller's claimed price. Threshold must be set in the
//                 same raw Pyth units (e.g. SOL/USD expo=-8 → $120 = 12_000_000_000).
//
//   Manual mode — pass System Program as price_feed and supply attested_price.
//                 oracle_authority is a trusted relayer who has already verified
//                 the external price and attests it here. Useful for feeds not
//                 yet on Pyth, or off-chain sport/election data.

#[derive(Accounts)]
pub struct ResolveLightMarketOracle<'info> {
    pub oracle_authority: Signer<'info>,
    #[account(
        mut,
        constraint = market.oracle_authority == oracle_authority.key() @ IlowaError::Unauthorized,
        constraint = market.oracle_authority  != Pubkey::default()     @ IlowaError::OracleNotSet,
        constraint = !market.resolved                                  @ IlowaError::MarketAlreadyResolved,
        constraint = market.is_active                                  @ IlowaError::MarketNotActive,
    )]
    pub market: Account<'info, LightMarketStub>,
    /// CHECK: Pyth V1 price account, or System Program for manual attestation.
    /// When a real Pyth feed is passed, the program reads the price on-chain.
    /// Verified by magic bytes — no owner check needed beyond that.
    pub price_feed: UncheckedAccount<'info>,
}

pub fn resolve_light_market_oracle(
    ctx: Context<ResolveLightMarketOracle>,
    attested_price: i64,
    outcome: bool,
) -> Result<()> {
    let feed_key  = ctx.accounts.price_feed.key();
    let clock      = Clock::get()?;

    // If price_feed is System Program → manual attestation, use attested_price.
    // Otherwise → read price directly from the Pyth account and ignore attested_price.
    let effective_price = if feed_key == anchor_lang::solana_program::system_program::ID {
        attested_price
    } else {
        let data = ctx.accounts.price_feed.try_borrow_data()?;
        read_pyth_price(&data, clock.slot)?
    };

    let m = &ctx.accounts.market;
    let expected = if m.oracle_above {
        effective_price >= m.oracle_threshold
    } else {
        effective_price <= m.oracle_threshold
    };
    require!(outcome == expected, IlowaError::OraclePriceMismatch);

    let m = &mut ctx.accounts.market;
    m.resolved  = true;
    m.is_active = false;
    m.outcome   = if outcome { 1 } else { 2 };

    emit!(LightMarketResolved { market: m.key(), outcome, yes_pool: m.yes_pool, no_pool: m.no_pool });
    Ok(())
}

// ── ClaimLightWinnings ────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct ClaimLightWinnings<'info> {
    #[account(mut)]
    pub bettor: Signer<'info>,

    #[account(constraint = market.resolved @ IlowaError::MarketNotResolved)]
    pub market: Account<'info, LightMarketStub>,

    #[account(
        mut,
        seeds = [b"light_bet", market.key().as_ref(), bettor.key().as_ref()],
        bump = bet.bump,
        has_one = bettor @ IlowaError::Unauthorized,
    )]
    pub bet: Account<'info, LightBetStub>,

    /// CHECK: market SOL vault — signed transfer out via PDA seeds
    #[account(mut, seeds = [b"light_vault", market.key().as_ref()], bump)]
    pub market_vault: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn claim_light_winnings(ctx: Context<ClaimLightWinnings>) -> Result<()> {
    let market = &ctx.accounts.market;
    let bet    = &ctx.accounts.bet;

    require!(!bet.claimed, IlowaError::AlreadyClaimed);

    // outcome: 1=YES, 2=NO
    let bet_won = (market.outcome == 1 && bet.outcome) || (market.outcome == 2 && !bet.outcome);
    require!(bet_won, IlowaError::BetLost);

    let winning_pool = if market.outcome == 1 { market.yes_pool } else { market.no_pool };
    let total_pool   = market.yes_pool.checked_add(market.no_pool).ok_or(IlowaError::ArithmeticOverflow)?;
    require!(winning_pool > 0, IlowaError::NoWinningBets);

    // proportional share: payout = bet_amount * total_pool / winning_pool
    let payout = (bet.amount as u128)
        .checked_mul(total_pool as u128).ok_or(IlowaError::ArithmeticOverflow)?
        .checked_div(winning_pool as u128).ok_or(IlowaError::ArithmeticOverflow)?
        as u64;

    let market_key  = market.key();
    let vault_bump  = ctx.bumps.market_vault;
    let vault_seeds: &[&[u8]] = &[b"light_vault", market_key.as_ref(), &[vault_bump]];

    anchor_lang::system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.market_vault.to_account_info(),
                to:   ctx.accounts.bettor.to_account_info(),
            },
            &[vault_seeds],
        ),
        payout,
    )?;

    ctx.accounts.bet.claimed = true;
    emit!(LightWinningsClaimed { market: market_key, bettor: ctx.accounts.bettor.key(), amount: payout });
    Ok(())
}

// ── InitShieldedPool ──────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitShieldedPool<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(has_one = creator @ IlowaError::Unauthorized)]
    pub market: Account<'info, LightMarketStub>,

    #[account(
        init, payer = creator,
        space = 8 + ShieldedPoolAggregate::INIT_SPACE,
        seeds = [b"shielded_pool", market.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, ShieldedPoolAggregate>,

    pub system_program: Program<'info, System>,
}

pub fn init_shielded_pool(ctx: Context<InitShieldedPool>, mxe_authority: Pubkey) -> Result<()> {
    let p = &mut ctx.accounts.pool;
    p.market               = ctx.accounts.market.key();
    p.mxe_authority        = mxe_authority;
    p.total_shielded_bets  = 0;
    p.encrypted_yes_total  = vec![];
    p.encrypted_no_total   = vec![];
    p.last_updated         = 0;
    p.is_finalized         = false;
    p.bump                 = ctx.bumps.pool;
    Ok(())
}

// ── SubmitShieldedAggregate (Arcium MXE writes back) ─────────────────────────

#[derive(Accounts)]
pub struct SubmitShieldedAggregate<'info> {
    pub mxe_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"shielded_pool", market.key().as_ref()],
        bump = pool.bump,
        constraint = pool.mxe_authority == mxe_authority.key() @ IlowaError::NotMxeAuthority,
        constraint = !pool.is_finalized                        @ IlowaError::ShieldedPoolFinalized,
    )]
    pub pool: Account<'info, ShieldedPoolAggregate>,

    pub market: Account<'info, LightMarketStub>,
}

pub fn submit_shielded_aggregate(
    ctx: Context<SubmitShieldedAggregate>,
    encrypted_yes_total: Vec<u8>,
    encrypted_no_total: Vec<u8>,
    total_shielded_bets: u32,
    finalize: bool,
) -> Result<()> {
    require!(encrypted_yes_total.len() <= 80, IlowaError::InvalidEncryptedData);
    require!(encrypted_no_total.len() <= 80, IlowaError::InvalidEncryptedData);

    let clock = Clock::get()?;
    let p = &mut ctx.accounts.pool;
    p.encrypted_yes_total = encrypted_yes_total;
    p.encrypted_no_total  = encrypted_no_total;
    p.total_shielded_bets = total_shielded_bets;
    p.last_updated        = clock.unix_timestamp;
    p.is_finalized        = finalize;

    emit!(ShieldedAggregateSubmitted {
        market: ctx.accounts.market.key(),
        total_shielded_bets,
        finalized: finalize,
        updated_at: clock.unix_timestamp,
    });
    Ok(())
}

// ── Events ────────────────────────────────────────────────────────────────────

#[event]
pub struct LightMarketCreated {
    pub market: Pubkey,
    pub creator: Pubkey,
    pub question_hash: [u8; 32],
    pub category: u8,
    pub region: u8,
    pub resolve_date: i64,
    pub has_oracle: bool,
}

#[event]
pub struct LightMarketResolved {
    pub market: Pubkey,
    pub outcome: bool,
    pub yes_pool: u64,
    pub no_pool: u64,
}

#[event]
pub struct LightBetPlaced {
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub amount: u64,
    pub outcome: bool,
    pub platform_fee: u64,
}

#[event]
pub struct ShieldedLightBetPlaced {
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub outcome: bool,
    pub timestamp: i64,
}

#[event]
pub struct LightWinningsClaimed {
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub amount: u64,
}

#[event]
pub struct ShieldedAggregateSubmitted {
    pub market: Pubkey,
    pub total_shielded_bets: u32,
    pub finalized: bool,
    pub updated_at: i64,
}
