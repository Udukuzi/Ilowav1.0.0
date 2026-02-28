use anchor_lang::prelude::*;
use crate::errors::IlowaError;

/// Reward per contribution in lamports (0.001 SOL = 1_000_000 lamports)
const REWARD_PER_CONTRIBUTION: u64 = 1_000_000;

/// Maximum session duration (7 days in seconds)
const MAX_SESSION_DURATION: i64 = 7 * 24 * 60 * 60;

/// Minimum contributions before claiming
const MIN_CONTRIBUTIONS_FOR_CLAIM: u64 = 10;

// ════════════════════════════════════════════════════════════════════════════
// ARCIUM MPC SESSION
// ════════════════════════════════════════════════════════════════════════════

/// Initialize an MPC encryption session for a user.
/// This creates a commitment that links the user's wallet to their encrypted AI interactions.
pub fn init_mpc_session(ctx: Context<InitMpcSession>, session_nonce: [u8; 32]) -> Result<()> {
    let session = &mut ctx.accounts.session;
    let clock = Clock::get()?;

    session.owner = ctx.accounts.owner.key();
    session.session_nonce = session_nonce;
    session.created_at = clock.unix_timestamp;
    session.expires_at = clock.unix_timestamp + MAX_SESSION_DURATION;
    session.is_active = true;
    session.interaction_count = 0;
    session.last_interaction_hash = [0u8; 32];
    session.last_interaction_at = 0;
    session.bump = ctx.bumps.session;

    msg!("MPC session initialized for {}", ctx.accounts.owner.key());
    Ok(())
}

/// Close an MPC session (user-initiated or expired)
pub fn close_mpc_session(ctx: Context<CloseMpcSession>) -> Result<()> {
    let session = &ctx.accounts.session;
    let clock = Clock::get()?;

    // Only owner can close, or it must be expired
    require!(
        session.owner == ctx.accounts.owner.key() || clock.unix_timestamp > session.expires_at,
        IlowaError::Unauthorized
    );

    msg!("MPC session closed");
    Ok(())
}

/// Record an encrypted interaction commitment (hash only, not actual data)
pub fn record_interaction(
    ctx: Context<RecordInteraction>,
    interaction_hash: [u8; 32],
) -> Result<()> {
    let session = &mut ctx.accounts.session;
    let clock = Clock::get()?;

    // Verify session is valid
    require!(session.is_active, IlowaError::InvalidMpcSession);
    require!(clock.unix_timestamp < session.expires_at, IlowaError::SessionExpired);

    // Increment interaction count
    session.interaction_count = session.interaction_count.checked_add(1)
        .ok_or(IlowaError::ArithmeticOverflow)?;

    // Store last interaction hash for verification
    session.last_interaction_hash = interaction_hash;
    session.last_interaction_at = clock.unix_timestamp;

    msg!("Interaction #{} recorded", session.interaction_count);
    Ok(())
}

// ════════════════════════════════════════════════════════════════════════════
// FEDERATED LEARNING
// ════════════════════════════════════════════════════════════════════════════

/// Initialize the global FL reward pool (called once by deployer).
pub fn init_fl_reward_pool(ctx: Context<InitFLRewardPool>) -> Result<()> {
    let pool = &mut ctx.accounts.reward_pool;
    pool.total_distributed = 0;
    pool.bump = ctx.bumps.reward_pool;
    msg!("FL reward pool initialized");
    Ok(())
}

/// Initialize federated learning account for a user (opt-in)
pub fn init_federated_learning(ctx: Context<InitFederatedLearning>) -> Result<()> {
    let fl_account = &mut ctx.accounts.fl_account;
    let clock = Clock::get()?;

    fl_account.owner = ctx.accounts.owner.key();
    fl_account.enabled = true;
    fl_account.contribution_count = 0;
    fl_account.total_earned = 0;
    fl_account.pending_rewards = 0;
    fl_account.last_contribution_at = 0;
    fl_account.last_claim_at = 0;
    fl_account.last_contribution_hash = [0u8; 32];
    fl_account.created_at = clock.unix_timestamp;
    fl_account.bump = ctx.bumps.fl_account;

    msg!("Federated learning enabled for {}", ctx.accounts.owner.key());
    Ok(())
}

/// Disable federated learning (opt-out)
pub fn disable_federated_learning(ctx: Context<DisableFederatedLearning>) -> Result<()> {
    let fl_account = &mut ctx.accounts.fl_account;
    
    fl_account.enabled = false;
    msg!("Federated learning disabled");
    Ok(())
}

/// Record a contribution to federated learning
pub fn record_contribution(
    ctx: Context<RecordContribution>,
    contribution_hash: [u8; 32],
    contribution_type: u8, // 0=interaction, 1=feedback, 2=correction
) -> Result<()> {
    let fl_account = &mut ctx.accounts.fl_account;
    let clock = Clock::get()?;

    require!(fl_account.enabled, IlowaError::FLNotEnabled);

    // Calculate reward (corrections are worth more)
    let reward = match contribution_type {
        2 => REWARD_PER_CONTRIBUTION * 2, // Correction: 2x reward
        1 => REWARD_PER_CONTRIBUTION + REWARD_PER_CONTRIBUTION / 2, // Feedback: 1.5x
        _ => REWARD_PER_CONTRIBUTION, // Interaction: 1x
    };

    fl_account.contribution_count = fl_account.contribution_count.checked_add(1)
        .ok_or(IlowaError::ArithmeticOverflow)?;
    fl_account.pending_rewards = fl_account.pending_rewards.checked_add(reward)
        .ok_or(IlowaError::ArithmeticOverflow)?;
    fl_account.last_contribution_at = clock.unix_timestamp;
    fl_account.last_contribution_hash = contribution_hash;

    msg!(
        "Contribution #{} recorded, pending rewards: {} lamports",
        fl_account.contribution_count,
        fl_account.pending_rewards
    );
    Ok(())
}

/// Claim federated learning rewards
pub fn claim_fl_rewards(ctx: Context<ClaimFLRewards>) -> Result<()> {
    let fl_account = &mut ctx.accounts.fl_account;
    let clock = Clock::get()?;

    require!(fl_account.enabled, IlowaError::FLNotEnabled);
    require!(fl_account.pending_rewards > 0, IlowaError::NoRewardsToClaim);
    require!(
        fl_account.contribution_count >= MIN_CONTRIBUTIONS_FOR_CLAIM,
        IlowaError::NoRewardsToClaim
    );

    let reward_amount = fl_account.pending_rewards;
    let pool_bump = ctx.accounts.reward_pool.bump;

    require!(
        ctx.accounts.reward_pool.to_account_info().lamports() >= reward_amount,
        IlowaError::RewardPoolExhausted
    );

    // CPI transfer out of the program-owned reward pool PDA
    let pool_seeds: &[&[u8]] = &[b"fl_reward_pool", &[pool_bump]];
    anchor_lang::system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.reward_pool.to_account_info(),
                to: ctx.accounts.owner.to_account_info(),
            },
            &[pool_seeds],
        ),
        reward_amount,
    )?;

    // Update FL account
    let fl_account = &mut ctx.accounts.fl_account;
    fl_account.total_earned = fl_account.total_earned.checked_add(reward_amount)
        .ok_or(IlowaError::ArithmeticOverflow)?;
    fl_account.pending_rewards = 0;
    fl_account.last_claim_at = clock.unix_timestamp;

    ctx.accounts.reward_pool.total_distributed = ctx.accounts.reward_pool.total_distributed
        .checked_add(reward_amount)
        .ok_or(IlowaError::ArithmeticOverflow)?;

    msg!("Claimed {} lamports in FL rewards", reward_amount);
    Ok(())
}

// ════════════════════════════════════════════════════════════════════════════
// ACCOUNT STRUCTURES
// ════════════════════════════════════════════════════════════════════════════

#[derive(Accounts)]
pub struct InitMpcSession<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + MpcSession::INIT_SPACE,
        seeds = [b"mpc_session", owner.key().as_ref()],
        bump
    )]
    pub session: Account<'info, MpcSession>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseMpcSession<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"mpc_session", owner.key().as_ref()],
        bump = session.bump,
        close = owner
    )]
    pub session: Account<'info, MpcSession>,
}

#[derive(Accounts)]
pub struct RecordInteraction<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"mpc_session", owner.key().as_ref()],
        bump = session.bump,
        has_one = owner @ IlowaError::Unauthorized
    )]
    pub session: Account<'info, MpcSession>,
}

#[derive(Accounts)]
pub struct InitFLRewardPool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + FLRewardPool::INIT_SPACE,
        seeds = [b"fl_reward_pool"],
        bump
    )]
    pub reward_pool: Account<'info, FLRewardPool>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitFederatedLearning<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + FederatedLearningAccount::INIT_SPACE,
        seeds = [b"federated_learning", owner.key().as_ref()],
        bump
    )]
    pub fl_account: Account<'info, FederatedLearningAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DisableFederatedLearning<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"federated_learning", owner.key().as_ref()],
        bump = fl_account.bump,
        has_one = owner @ IlowaError::Unauthorized
    )]
    pub fl_account: Account<'info, FederatedLearningAccount>,
}

#[derive(Accounts)]
pub struct RecordContribution<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"federated_learning", owner.key().as_ref()],
        bump = fl_account.bump,
        has_one = owner @ IlowaError::Unauthorized
    )]
    pub fl_account: Account<'info, FederatedLearningAccount>,
}

#[derive(Accounts)]
pub struct ClaimFLRewards<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"federated_learning", owner.key().as_ref()],
        bump = fl_account.bump,
        has_one = owner @ IlowaError::Unauthorized
    )]
    pub fl_account: Account<'info, FederatedLearningAccount>,

    #[account(
        mut,
        seeds = [b"fl_reward_pool"],
        bump = reward_pool.bump
    )]
    pub reward_pool: Account<'info, FLRewardPool>,

    pub system_program: Program<'info, System>,
}

// ════════════════════════════════════════════════════════════════════════════
// STATE ACCOUNTS
// ════════════════════════════════════════════════════════════════════════════

#[account]
#[derive(InitSpace)]
pub struct FLRewardPool {
    pub total_distributed: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct MpcSession {
    /// Owner of this session
    pub owner: Pubkey,
    /// Session nonce for encryption key derivation
    pub session_nonce: [u8; 32],
    /// When session was created
    pub created_at: i64,
    /// When session expires
    pub expires_at: i64,
    /// Whether session is currently active
    pub is_active: bool,
    /// Number of interactions in this session
    pub interaction_count: u64,
    /// Hash of last interaction (for verification)
    pub last_interaction_hash: [u8; 32],
    /// Timestamp of last interaction
    pub last_interaction_at: i64,
    /// PDA bump
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct FederatedLearningAccount {
    /// Owner of this account
    pub owner: Pubkey,
    /// Whether FL is enabled
    pub enabled: bool,
    /// Total contributions made
    pub contribution_count: u64,
    /// Total rewards earned (in lamports)
    pub total_earned: u64,
    /// Pending rewards to claim (in lamports)
    pub pending_rewards: u64,
    /// Timestamp of last contribution
    pub last_contribution_at: i64,
    /// Timestamp of last claim
    pub last_claim_at: i64,
    /// Hash of last contribution (for verification)
    pub last_contribution_hash: [u8; 32],
    /// When account was created
    pub created_at: i64,
    /// PDA bump
    pub bump: u8,
}
