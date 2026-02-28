use anchor_lang::prelude::*;
use crate::state::elder::ElderGuardian;

#[derive(Accounts)]
pub struct InitElderGuardian<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init,
        payer = user,
        space = 8 + ElderGuardian::INIT_SPACE,
        seeds = [b"elder_guardian", user.key().as_ref()],
        bump
    )]
    pub guardian: Account<'info, ElderGuardian>,

    pub system_program: Program<'info, System>,
}

pub fn init_elder_guardian(ctx: Context<InitElderGuardian>) -> Result<()> {
    let guardian = &mut ctx.accounts.guardian;

    guardian.user_wallet = ctx.accounts.user.key();
    guardian.guardian_key = Pubkey::default(); // Set by client after biometric encryption
    guardian.timelock = 7 * 24 * 60 * 60; // 7 days in seconds
    guardian.recovery_initiated = false;
    guardian.recovery_timestamp = 0;
    guardian.canceled = false;
    guardian.bump = ctx.bumps.guardian;

    emit!(ElderGuardianCreated {
        user: ctx.accounts.user.key(),
        guardian: guardian.key(),
        timelock: guardian.timelock,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct SetGuardianKey<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"elder_guardian", user.key().as_ref()],
        bump = guardian.bump,
        constraint = guardian.user_wallet == user.key(),
    )]
    pub guardian: Account<'info, ElderGuardian>,
}

pub fn set_guardian_key(ctx: Context<SetGuardianKey>, guardian_key: Pubkey) -> Result<()> {
    ctx.accounts.guardian.guardian_key = guardian_key;
    Ok(())
}

#[event]
pub struct ElderGuardianCreated {
    pub user: Pubkey,
    pub guardian: Pubkey,
    pub timelock: i64,
}
