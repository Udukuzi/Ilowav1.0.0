use anchor_lang::prelude::*;
use crate::state::dapp_registry::DAppRegistry;
use crate::errors::IlowaError;

const ELDER_VOTE_THRESHOLD: u8 = 5;

#[derive(Accounts)]
#[instruction(domain: String)]
pub struct RegisterDApp<'info> {
    #[account(mut)]
    pub registrar: Signer<'info>,

    /// CHECK: The dApp's program or wallet pubkey
    pub dapp: AccountInfo<'info>,

    #[account(
        init,
        payer = registrar,
        space = 8 + DAppRegistry::INIT_SPACE,
        seeds = [b"dapp_registry", dapp.key().as_ref()],
        bump
    )]
    pub registry: Account<'info, DAppRegistry>,

    pub system_program: Program<'info, System>,
}

pub fn register_dapp(
    ctx: Context<RegisterDApp>,
    domain: String,
) -> Result<()> {
    let clock = Clock::get()?;
    let registry = &mut ctx.accounts.registry;

    registry.dapp_pubkey = ctx.accounts.dapp.key();
    registry.domain = domain;
    registry.verified = false;
    registry.elder_endorsed = false;
    registry.risk_score = 50; // Neutral default
    registry.total_users = 0;
    registry.scam_reports = 0;
    registry.approved_votes = 0;
    registry.date_verified = 0;
    registry.bump = ctx.bumps.registry;

    emit!(DAppRegistered {
        dapp: ctx.accounts.dapp.key(),
        domain: registry.domain.clone(),
        registered_at: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct VerifyDApp<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(
        mut,
        seeds = [b"dapp_registry", registry.dapp_pubkey.as_ref()],
        bump = registry.bump,
    )]
    pub registry: Account<'info, DAppRegistry>,
}

pub fn verify_dapp(ctx: Context<VerifyDApp>) -> Result<()> {
    let clock = Clock::get()?;
    let registry = &mut ctx.accounts.registry;

    registry.approved_votes = registry.approved_votes
        .checked_add(1)
        .ok_or(IlowaError::ArithmeticOverflow)?;

    if registry.approved_votes >= ELDER_VOTE_THRESHOLD {
        registry.verified = true;
        registry.elder_endorsed = true;
        registry.risk_score = 10; // Low risk after elder endorsement
        registry.date_verified = clock.unix_timestamp;

        emit!(DAppVerified {
            dapp: registry.dapp_pubkey,
            votes: registry.approved_votes,
        });
    }

    Ok(())
}

#[derive(Accounts)]
pub struct ReportDApp<'info> {
    #[account(mut)]
    pub reporter: Signer<'info>,

    #[account(
        mut,
        seeds = [b"dapp_registry", registry.dapp_pubkey.as_ref()],
        bump = registry.bump,
    )]
    pub registry: Account<'info, DAppRegistry>,
}

pub fn report_dapp(ctx: Context<ReportDApp>) -> Result<()> {
    let registry = &mut ctx.accounts.registry;

    registry.scam_reports = registry.scam_reports
        .checked_add(1)
        .ok_or(IlowaError::ArithmeticOverflow)?;

    // Auto-increase risk score
    if registry.risk_score < 100 {
        registry.risk_score = registry.risk_score.saturating_add(5);
    }

    emit!(DAppReported {
        dapp: registry.dapp_pubkey,
        reporter: ctx.accounts.reporter.key(),
        total_reports: registry.scam_reports,
    });

    Ok(())
}

#[event]
pub struct DAppRegistered {
    pub dapp: Pubkey,
    pub domain: String,
    pub registered_at: i64,
}

#[event]
pub struct DAppVerified {
    pub dapp: Pubkey,
    pub votes: u8,
}

#[event]
pub struct DAppReported {
    pub dapp: Pubkey,
    pub reporter: Pubkey,
    pub total_reports: u64,
}
