use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::errors::IlowaError;

const PLATFORM_FEE_PERCENT: u64 = 15; // 15% platform fee on tips (creators earn 85%)
const MIN_TIP: u64 = 1_000_000;       // 0.001 SOL

#[derive(Accounts)]
pub struct TipDJ<'info> {
    #[account(mut)]
    pub tipper: Signer<'info>,

    /// CHECK: DJ wallet receives the tip
    #[account(mut)]
    pub dj: AccountInfo<'info>,

    /// CHECK: Platform treasury PDA
    #[account(
        mut,
        seeds = [b"treasury"],
        bump
    )]
    pub platform_treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn tip_dj(ctx: Context<TipDJ>, amount: u64) -> Result<()> {
    require!(amount >= MIN_TIP, IlowaError::TipTooSmall);

    // 10% platform fee
    let platform_fee = amount
        .checked_mul(PLATFORM_FEE_PERCENT)
        .ok_or(IlowaError::ArithmeticOverflow)?
        .checked_div(100)
        .ok_or(IlowaError::ArithmeticOverflow)?;

    let dj_amount = amount
        .checked_sub(platform_fee)
        .ok_or(IlowaError::ArithmeticOverflow)?;

    // Transfer platform fee to treasury
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.tipper.to_account_info(),
                to: ctx.accounts.platform_treasury.to_account_info(),
            },
        ),
        platform_fee,
    )?;

    // Transfer 85% to DJ
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.tipper.to_account_info(),
                to: ctx.accounts.dj.to_account_info(),
            },
        ),
        dj_amount,
    )?;

    emit!(DJTipped {
        tipper: ctx.accounts.tipper.key(),
        dj: ctx.accounts.dj.key(),
        amount: dj_amount,
        platform_fee,
    });

    Ok(())
}

#[event]
pub struct DJTipped {
    pub tipper: Pubkey,
    pub dj: Pubkey,
    pub amount: u64,
    pub platform_fee: u64,
}
