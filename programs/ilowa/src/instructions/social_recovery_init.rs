use anchor_lang::prelude::*;
use crate::state::elder::SocialRecovery;
use crate::errors::IlowaError;

#[derive(Accounts)]
pub struct InitSocialRecovery<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init,
        payer = user,
        space = 8 + SocialRecovery::INIT_SPACE,
        seeds = [b"social_recovery", user.key().as_ref()],
        bump
    )]
    pub social_recovery: Account<'info, SocialRecovery>,

    pub system_program: Program<'info, System>,
}

pub fn init_social_recovery(
    ctx: Context<InitSocialRecovery>,
    guardians: Vec<Pubkey>,
) -> Result<()> {
    require!(guardians.len() == 5, IlowaError::InvalidGuardianCount);

    let recovery = &mut ctx.accounts.social_recovery;
    recovery.user_wallet = ctx.accounts.user.key();
    recovery.guardians = guardians;
    recovery.threshold = 3; // 3-of-5
    recovery.recovery_in_progress = false;
    recovery.approvals = vec![];
    recovery.new_wallet = None;
    recovery.bump = ctx.bumps.social_recovery;

    emit!(SocialRecoveryCreated {
        user: ctx.accounts.user.key(),
        guardian_count: 5,
        threshold: 3,
    });

    Ok(())
}

#[event]
pub struct SocialRecoveryCreated {
    pub user: Pubkey,
    pub guardian_count: u8,
    pub threshold: u8,
}
