use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ElderGuardian {
    pub user_wallet: Pubkey,
    pub guardian_key: Pubkey,
    pub timelock: i64,
    pub recovery_initiated: bool,
    pub recovery_timestamp: i64,
    pub canceled: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SocialRecovery {
    pub user_wallet: Pubkey,
    #[max_len(5)]
    pub guardians: Vec<Pubkey>,
    pub threshold: u8,
    pub recovery_in_progress: bool,
    #[max_len(5)]
    pub approvals: Vec<Pubkey>,
    pub new_wallet: Option<Pubkey>,
    pub bump: u8,
}
