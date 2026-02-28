use anchor_lang::prelude::*;
use crate::state::elder::SocialRecovery;
use crate::errors::IlowaError;

#[derive(Accounts)]
pub struct ApproveSocialRecovery<'info> {
    #[account(mut)]
    pub guardian: Signer<'info>,

    #[account(
        mut,
        seeds = [b"social_recovery", social_recovery.user_wallet.as_ref()],
        bump = social_recovery.bump,
    )]
    pub social_recovery: Account<'info, SocialRecovery>,
}

pub fn approve_social_recovery(
    ctx: Context<ApproveSocialRecovery>,
    new_wallet: Pubkey,
) -> Result<()> {
    let recovery = &mut ctx.accounts.social_recovery;
    let guardian_key = ctx.accounts.guardian.key();

    // Verify signer is a guardian
    require!(
        recovery.guardians.contains(&guardian_key),
        IlowaError::NotAGuardian
    );

    // Verify not already approved
    require!(
        !recovery.approvals.contains(&guardian_key),
        IlowaError::AlreadyApproved
    );

    // Set new wallet target (must match across all approvals)
    if let Some(existing_wallet) = recovery.new_wallet {
        require!(existing_wallet == new_wallet, IlowaError::Unauthorized);
    } else {
        recovery.new_wallet = Some(new_wallet);
    }

    // Record approval
    recovery.approvals.push(guardian_key);
    recovery.recovery_in_progress = true;

    let approval_count = recovery.approvals.len() as u8;

    emit!(SocialRecoveryApproval {
        user: recovery.user_wallet,
        guardian: guardian_key,
        new_wallet,
        approvals: approval_count,
        threshold: recovery.threshold,
    });

    // Check if threshold reached
    if approval_count >= recovery.threshold {
        emit!(SocialRecoveryComplete {
            user: recovery.user_wallet,
            new_wallet,
        });
    }

    Ok(())
}

#[event]
pub struct SocialRecoveryApproval {
    pub user: Pubkey,
    pub guardian: Pubkey,
    pub new_wallet: Pubkey,
    pub approvals: u8,
    pub threshold: u8,
}

#[event]
pub struct SocialRecoveryComplete {
    pub user: Pubkey,
    pub new_wallet: Pubkey,
}
