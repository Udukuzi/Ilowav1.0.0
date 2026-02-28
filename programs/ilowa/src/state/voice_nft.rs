use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct VoiceNFT {
    pub owner: Pubkey,
    pub market: Pubkey,
    #[max_len(200)]
    pub voice_uri: String,
    #[max_len(200)]
    pub metadata_uri: String,
    pub is_winner: bool,
    pub is_meme: bool,
    pub mints: u32,
    pub created_at: i64,
    pub bump: u8,
}
