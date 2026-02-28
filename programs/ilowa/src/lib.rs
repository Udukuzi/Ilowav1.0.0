use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("HYDwFwax9U6svCRYWD7Fqq3TXxSSQCQ6CwKrb3ZTkD3z");

#[program]
pub mod ilowa {
    use super::*;

    // ── Markets ──────────────────────────────────────────────

    pub fn create_market(
        ctx: Context<CreateMarket>,
        question: String,
        category: String,
        region: String,
        is_private: bool,
        expires_at: i64,
    ) -> Result<()> {
        instructions::create_market::create_market(ctx, question, category, region, is_private, expires_at)
    }

    pub fn place_bet(
        ctx: Context<PlaceBet>,
        amount: u64,
        outcome: bool,
    ) -> Result<()> {
        instructions::place_bet::place_bet(ctx, amount, outcome)
    }

    pub fn shielded_bet(
        ctx: Context<ShieldedBet>,
        encrypted_amount: Vec<u8>,
        zk_proof: Vec<u8>,
        outcome: bool,
    ) -> Result<()> {
        instructions::shielded_bet::shielded_bet(ctx, encrypted_amount, zk_proof, outcome)
    }

    pub fn create_compressed_market(
        ctx: Context<CreateCompressedMarket>,
        question: String,
        resolve_date: i64,
        category: CompressedMarketCategory,
    ) -> Result<()> {
        instructions::create_compressed_market::create_compressed_market(ctx, question, resolve_date, category)
    }

    pub fn resolve_market(
        ctx: Context<ResolveMarket>,
        outcome: bool,
    ) -> Result<()> {
        instructions::resolve_market::resolve_market(ctx, outcome)
    }

    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        instructions::claim_winnings::claim_winnings(ctx)
    }

    pub fn place_compressed_bet(
        ctx: Context<PlaceCompressedBet>,
        amount: u64,
        outcome: bool,
    ) -> Result<()> {
        instructions::place_compressed_bet::place_compressed_bet(ctx, amount, outcome)
    }

    // ── Radio & Tipping ─────────────────────────────────────

    pub fn tip_dj(ctx: Context<TipDJ>, amount: u64) -> Result<()> {
        instructions::tip_dj::tip_dj(ctx, amount)
    }

    // ── Voice NFTs ──────────────────────────────────────────

    pub fn mint_voice_nft(
        ctx: Context<MintVoiceNFT>,
        voice_uri: String,
        metadata_uri: String,
        market: Pubkey,
        is_winner: bool,
        is_meme: bool,
    ) -> Result<()> {
        instructions::mint_voice_nft::mint_voice_nft(ctx, voice_uri, metadata_uri, market, is_winner, is_meme)
    }

    // ── Elder Guardian (Security) ───────────────────────────

    pub fn init_elder_guardian(ctx: Context<InitElderGuardian>) -> Result<()> {
        instructions::elder_guardian_init::init_elder_guardian(ctx)
    }

    pub fn set_guardian_key(ctx: Context<SetGuardianKey>, guardian_key: Pubkey) -> Result<()> {
        instructions::elder_guardian_init::set_guardian_key(ctx, guardian_key)
    }

    pub fn initiate_recovery(ctx: Context<InitiateRecovery>) -> Result<()> {
        instructions::elder_guardian_recover::initiate_recovery(ctx)
    }

    pub fn cancel_recovery(ctx: Context<CancelRecovery>) -> Result<()> {
        instructions::elder_guardian_recover::cancel_recovery(ctx)
    }

    pub fn execute_recovery(ctx: Context<ExecuteRecovery>) -> Result<()> {
        instructions::elder_guardian_recover::execute_recovery(ctx)
    }

    // ── Social Recovery ─────────────────────────────────────

    pub fn init_social_recovery(
        ctx: Context<InitSocialRecovery>,
        guardians: Vec<Pubkey>,
    ) -> Result<()> {
        instructions::social_recovery_init::init_social_recovery(ctx, guardians)
    }

    pub fn approve_social_recovery(
        ctx: Context<ApproveSocialRecovery>,
        new_wallet: Pubkey,
    ) -> Result<()> {
        instructions::social_recovery_approve::approve_social_recovery(ctx, new_wallet)
    }

    // ── DApp Registry ───────────────────────────────────────

    pub fn register_dapp(ctx: Context<RegisterDApp>, domain: String) -> Result<()> {
        instructions::dapp_registry_add::register_dapp(ctx, domain)
    }

    pub fn verify_dapp(ctx: Context<VerifyDApp>) -> Result<()> {
        instructions::dapp_registry_add::verify_dapp(ctx)
    }

    pub fn report_dapp(ctx: Context<ReportDApp>) -> Result<()> {
        instructions::dapp_registry_add::report_dapp(ctx)
    }

    // ── Light Protocol (ZK Compression - Stubbed) ─────────────

    pub fn create_light_market(
        ctx: Context<CreateLightMarket>,
        question_hash: [u8; 32],
        category: u8,
        region: u8,
        resolve_date: i64,
        oracle_authority: Pubkey,
        oracle_threshold: i64,
        oracle_above: bool,
    ) -> Result<()> {
        instructions::light_market::create_light_market(
            ctx, question_hash, category, region, resolve_date,
            oracle_authority, oracle_threshold, oracle_above,
        )
    }

    /// Place a bet on a "light" market using stubbed implementation.
    pub fn place_light_bet(
        ctx: Context<PlaceLightBet>,
        amount: u64,
        outcome: bool,
    ) -> Result<()> {
        instructions::light_market::place_light_bet(ctx, amount, outcome)
    }

    // NOTE: This instruction is named PlaceShieldedLightBet but utilizes Arcium for encryption.
    // "Light" refers to the Light Protocol compressed market type, not the encryption layer.
    // Arcium MPC powers the bet-amount encryption; only ciphertext is stored on-chain.
    pub fn place_shielded_light_bet(
        ctx: Context<PlaceShieldedLightBet>,
        encrypted_amount: Vec<u8>,
        zk_proof: Vec<u8>,
        outcome: bool,
    ) -> Result<()> {
        instructions::light_market::place_shielded_light_bet(ctx, encrypted_amount, zk_proof, outcome)
    }

    pub fn resolve_light_market(ctx: Context<ResolveLightMarket>, outcome: bool) -> Result<()> {
        instructions::light_market::resolve_light_market(ctx, outcome)
    }

    pub fn resolve_light_market_oracle(
        ctx: Context<ResolveLightMarketOracle>,
        attested_price: i64,
        outcome: bool,
    ) -> Result<()> {
        instructions::light_market::resolve_light_market_oracle(ctx, attested_price, outcome)
    }

    pub fn claim_light_winnings(ctx: Context<ClaimLightWinnings>) -> Result<()> {
        instructions::light_market::claim_light_winnings(ctx)
    }

    pub fn init_shielded_pool(ctx: Context<InitShieldedPool>, mxe_authority: Pubkey) -> Result<()> {
        instructions::light_market::init_shielded_pool(ctx, mxe_authority)
    }

    pub fn submit_shielded_aggregate(
        ctx: Context<SubmitShieldedAggregate>,
        encrypted_yes_total: Vec<u8>,
        encrypted_no_total: Vec<u8>,
        total_shielded_bets: u32,
        finalize: bool,
    ) -> Result<()> {
        instructions::light_market::submit_shielded_aggregate(
            ctx, encrypted_yes_total, encrypted_no_total, total_shielded_bets, finalize,
        )
    }

    // ── Arcium MPC (Privacy) ─────────────────────────────────

    /// Initialize an MPC encryption session for privacy-preserving AI
    pub fn init_mpc_session(
        ctx: Context<InitMpcSession>,
        session_nonce: [u8; 32],
    ) -> Result<()> {
        instructions::arcium_mpc::init_mpc_session(ctx, session_nonce)
    }

    /// Close an MPC session
    pub fn close_mpc_session(ctx: Context<CloseMpcSession>) -> Result<()> {
        instructions::arcium_mpc::close_mpc_session(ctx)
    }

    /// Record an encrypted interaction commitment
    pub fn record_interaction(
        ctx: Context<RecordInteraction>,
        interaction_hash: [u8; 32],
    ) -> Result<()> {
        instructions::arcium_mpc::record_interaction(ctx, interaction_hash)
    }

    // ── Federated Learning ───────────────────────────────────

    /// Initialize the global FL reward pool (one-time deployer call)
    pub fn init_fl_reward_pool(ctx: Context<InitFLRewardPool>) -> Result<()> {
        instructions::arcium_mpc::init_fl_reward_pool(ctx)
    }

    /// Enable federated learning for a user (opt-in to earn rewards)
    pub fn init_federated_learning(ctx: Context<InitFederatedLearning>) -> Result<()> {
        instructions::arcium_mpc::init_federated_learning(ctx)
    }

    /// Disable federated learning (opt-out)
    pub fn disable_federated_learning(ctx: Context<DisableFederatedLearning>) -> Result<()> {
        instructions::arcium_mpc::disable_federated_learning(ctx)
    }

    /// Record a contribution to federated learning
    pub fn record_contribution(
        ctx: Context<RecordContribution>,
        contribution_hash: [u8; 32],
        contribution_type: u8,
    ) -> Result<()> {
        instructions::arcium_mpc::record_contribution(ctx, contribution_hash, contribution_type)
    }

    /// Claim federated learning rewards
    pub fn claim_fl_rewards(ctx: Context<ClaimFLRewards>) -> Result<()> {
        instructions::arcium_mpc::claim_fl_rewards(ctx)
    }
}
