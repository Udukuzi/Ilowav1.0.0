use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct DAppRegistry {
    pub dapp_pubkey: Pubkey,
    #[max_len(128)]
    pub domain: String,
    pub verified: bool,
    pub elder_endorsed: bool,
    pub risk_score: u8,
    pub total_users: u64,
    pub scam_reports: u64,
    pub approved_votes: u8,
    pub date_verified: i64,
    pub bump: u8,
}
