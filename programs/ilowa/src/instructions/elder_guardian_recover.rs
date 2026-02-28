use anchor_lang::prelude::*;
use crate::state::elder::ElderGuardian;
use crate::errors::IlowaError;

#[derive(Accounts)]
pub struct InitiateRecovery<'info> {
    #[account(mut)]
    pub initiator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"elder_guardian", guardian.user_wallet.as_ref()],
        bump = guardian.bump,
        constraint = !guardian.recovery_initiated @ IlowaError::RecoveryAlreadyInProgress,
    )]
    pub guardian: Account<'info, ElderGuardian>,
}

pub fn initiate_recovery(ctx: Context<InitiateRecovery>) -> Result<()> {
    let clock = Clock::get()?;
    let guardian = &mut ctx.accounts.guardian;

    guardian.recovery_initiated = true;
    guardian.recovery_timestamp = clock.unix_timestamp;
    guardian.canceled = false;

    emit!(RecoveryInitiated {
        user: guardian.user_wallet,
        initiated_at: clock.unix_timestamp,
        unlocks_at: clock.unix_timestamp + guardian.timelock,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct CancelRecovery<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"elder_guardian", user.key().as_ref()],
        bump = guardian.bump,
        constraint = guardian.user_wallet == user.key() @ IlowaError::Unauthorized,
        constraint = guardian.recovery_initiated @ IlowaError::RecoveryNotInProgress,
    )]
    pub guardian: Account<'info, ElderGuardian>,
}

pub fn cancel_recovery(ctx: Context<CancelRecovery>) -> Result<()> {
    let guardian = &mut ctx.accounts.guardian;

    guardian.recovery_initiated = false;
    guardian.recovery_timestamp = 0;
    guardian.canceled = true;

    emit!(RecoveryCanceled {
        user: guardian.user_wallet,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct ExecuteRecovery<'info> {
    #[account(mut)]
    pub initiator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"elder_guardian", guardian.user_wallet.as_ref()],
        bump = guardian.bump,
        constraint = guardian.recovery_initiated @ IlowaError::RecoveryNotInProgress,
        constraint = !guardian.canceled @ IlowaError::RecoveryCanceled,
    )]
    pub guardian: Account<'info, ElderGuardian>,
}

pub fn execute_recovery(ctx: Context<ExecuteRecovery>) -> Result<()> {
    let clock = Clock::get()?;
    let guardian = &mut ctx.accounts.guardian;

    let elapsed = clock.unix_timestamp - guardian.recovery_timestamp;
    require!(elapsed >= guardian.timelock, IlowaError::TimelockNotElapsed);

    // Recovery successful — guardian key can now be rotated by the initiator
    guardian.recovery_initiated = false;
    guardian.recovery_timestamp = 0;

    emit!(RecoveryExecuted {
        user: guardian.user_wallet,
        executed_at: clock.unix_timestamp,
    });

    Ok(())
}

#[event]
pub struct RecoveryInitiated {
    pub user: Pubkey,
    pub initiated_at: i64,
    pub unlocks_at: i64,
}

#[event]
pub struct RecoveryCanceled {
    pub user: Pubkey,
}

#[event]
pub struct RecoveryExecuted {
    pub user: Pubkey,
    pub executed_at: i64,
}
