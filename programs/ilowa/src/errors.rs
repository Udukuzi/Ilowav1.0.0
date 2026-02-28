use anchor_lang::prelude::*;

#[error_code]
pub enum IlowaError {
    // Market errors
    #[msg("Market question is too long (max 280 characters)")]
    QuestionTooLong,
    #[msg("Market has already been resolved")]
    MarketAlreadyResolved,
    #[msg("Market has expired")]
    MarketExpired,
    #[msg("Market has not expired yet")]
    MarketNotExpired,
    #[msg("Market is not active")]
    MarketNotActive,
    #[msg("Invalid expiry timestamp")]
    InvalidExpiry,

    // Bet errors
    #[msg("Bet amount is too small (minimum 0.01 SOL)")]
    BetTooSmall,
    #[msg("Bet amount is too large (maximum 100 SOL)")]
    BetTooLarge,
    #[msg("Insufficient funds for bet")]
    InsufficientFunds,

    // Guardian errors
    #[msg("Recovery already in progress")]
    RecoveryAlreadyInProgress,
    #[msg("Recovery not in progress")]
    RecoveryNotInProgress,
    #[msg("Timelock has not elapsed")]
    TimelockNotElapsed,
    #[msg("Recovery was canceled")]
    RecoveryCanceled,

    // Social Recovery errors
    #[msg("Invalid guardian count (must be exactly 5)")]
    InvalidGuardianCount,
    #[msg("Signer is not a guardian")]
    NotAGuardian,
    #[msg("Guardian has already approved")]
    AlreadyApproved,
    #[msg("Recovery threshold not met")]
    ThresholdNotMet,
    #[msg("New wallet not set")]
    NewWalletNotSet,

    // DApp Registry errors
    #[msg("DApp already registered")]
    DAppAlreadyRegistered,
    #[msg("Insufficient elder votes")]
    InsufficientElderVotes,

    // Tipping errors
    #[msg("Tip amount is too small")]
    TipTooSmall,

    // NFT errors
    #[msg("Voice URI is required")]
    VoiceUriRequired,

    // Privacy errors
    #[msg("Invalid encrypted data format")]
    InvalidEncryptedData,
    #[msg("Invalid ZK proof")]
    InvalidZkProof,

    // Rate limiting errors
    #[msg("Rate limit exceeded (max 10 bets/hour)")]
    RateLimitExceeded,
    #[msg("Please wait 1 minute between bets")]
    BetTooSoon,
    #[msg("User is temporarily banned")]
    UserBanned,

    // Compressed market errors
    #[msg("Question must be 10-280 characters")]
    InvalidQuestionLength,
    #[msg("Resolve date must be in the future")]
    InvalidResolveDate,
    #[msg("Resolve date cannot be more than 1 year in future")]
    ResolveDateTooFar,
    #[msg("Invalid category (must be 0-6)")]
    InvalidCategory,
    #[msg("Invalid region (must be 0-8)")]
    InvalidRegion,

    // Claim errors
    #[msg("Market has not been resolved yet")]
    MarketNotResolved,
    #[msg("Winnings already claimed")]
    AlreadyClaimed,
    #[msg("Your bet did not win")]
    BetLost,
    #[msg("No winning bets in this market")]
    NoWinningBets,

    // Arcium MPC errors
    #[msg("Invalid MPC session")]
    InvalidMpcSession,
    #[msg("Session has expired")]
    SessionExpired,
    #[msg("Invalid encryption commitment")]
    InvalidCommitment,
    #[msg("MPC session already exists")]
    SessionAlreadyExists,

    // Federated Learning errors
    #[msg("Federated learning not enabled for user")]
    FLNotEnabled,
    #[msg("No rewards to claim")]
    NoRewardsToClaim,
    #[msg("Contribution already recorded")]
    ContributionAlreadyRecorded,
    #[msg("Invalid contribution proof")]
    InvalidContributionProof,
    #[msg("Reward pool exhausted")]
    RewardPoolExhausted,

    // Oracle resolution errors
    #[msg("No oracle configured for this market")]
    OracleNotSet,
    #[msg("Price condition not satisfied for this outcome")]
    OraclePriceMismatch,
    #[msg("Stale oracle price — publish time too old")]
    OraclePriceStale,

    // Shielded pool errors
    #[msg("Pool already finalized by MXE")]
    ShieldedPoolFinalized,
    #[msg("Caller is not the MXE authority for this pool")]
    NotMxeAuthority,

    // Oracle account errors
    #[msg("Provided account is not a valid Pyth price feed")]
    InvalidOracleAccount,
    #[msg("Pyth price exponent out of expected range")]
    InvalidOracleExponent,

    // General errors
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
}
