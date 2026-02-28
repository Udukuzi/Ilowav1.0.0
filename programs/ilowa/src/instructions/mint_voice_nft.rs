use anchor_lang::prelude::*;
use crate::state::voice_nft::VoiceNFT;
use crate::errors::IlowaError;

#[derive(Accounts)]
#[instruction(voice_uri: String)]
pub struct MintVoiceNFT<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + VoiceNFT::INIT_SPACE,
        seeds = [b"voice_nft", owner.key().as_ref(), voice_uri.as_bytes()],
        bump
    )]
    pub voice_nft: Account<'info, VoiceNFT>,

    pub system_program: Program<'info, System>,
}

pub fn mint_voice_nft(
    ctx: Context<MintVoiceNFT>,
    voice_uri: String,
    metadata_uri: String,
    market: Pubkey,
    is_winner: bool,
    is_meme: bool,
) -> Result<()> {
    require!(!voice_uri.is_empty(), IlowaError::VoiceUriRequired);

    let clock = Clock::get()?;
    let nft = &mut ctx.accounts.voice_nft;

    nft.owner = ctx.accounts.owner.key();
    nft.market = market;
    nft.voice_uri = voice_uri;
    nft.metadata_uri = metadata_uri;
    nft.is_winner = is_winner;
    nft.is_meme = is_meme;
    nft.mints = 1;
    nft.created_at = clock.unix_timestamp;
    nft.bump = ctx.bumps.voice_nft;

    emit!(VoiceNFTMinted {
        nft: nft.key(),
        owner: ctx.accounts.owner.key(),
        market,
        is_winner,
        is_meme,
    });

    Ok(())
}

#[event]
pub struct VoiceNFTMinted {
    pub nft: Pubkey,
    pub owner: Pubkey,
    pub market: Pubkey,
    pub is_winner: bool,
    pub is_meme: bool,
}
