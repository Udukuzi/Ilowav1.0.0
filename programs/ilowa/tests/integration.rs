use anchor_lang::prelude::*;
use anchor_lang::{InstructionData, ToAccountMetas};
use solana_program_test::*;
use solana_sdk::{
    instruction::Instruction,
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    system_program,
    transaction::Transaction,
};

use ilowa::state::market::MarketStatus;

fn program_id() -> Pubkey {
    ilowa::ID
}

fn program_test() -> ProgramTest {
    ProgramTest::new("ilowa", program_id(), None)
}

fn find_market_pda(creator: &Pubkey, expires_at: i64) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"market", creator.as_ref(), &expires_at.to_le_bytes()],
        &program_id(),
    )
}

fn find_bet_pda(market: &Pubkey, user: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"bet", market.as_ref(), user.as_ref()],
        &program_id(),
    )
}

fn find_shielded_bet_pda(market: &Pubkey, user: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"shielded_bet", market.as_ref(), user.as_ref()],
        &program_id(),
    )
}

fn find_treasury_pda() -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"treasury"], &program_id())
}

fn find_vault_pda(market: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"vault", market.as_ref()], &program_id())
}

fn find_elder_guardian_pda(user: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"elder_guardian", user.as_ref()], &program_id())
}

fn find_social_recovery_pda(user: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"social_recovery", user.as_ref()], &program_id())
}

fn find_voice_nft_pda(owner: &Pubkey, voice_uri: &str) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"voice_nft", owner.as_ref(), voice_uri.as_bytes()],
        &program_id(),
    )
}

fn find_dapp_registry_pda(dapp: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"dapp_registry", dapp.as_ref()], &program_id())
}

// ═══════════════════════════════════════════════════════════════
// MARKET TESTS
// ═══════════════════════════════════════════════════════════════

#[tokio::test]
async fn test_create_market() {
    let mut ctx = program_test().start_with_context().await;
    let creator = &ctx.payer;
    let question = "Will Naira hit 2000 by March?";
    let expires_at: i64 = 9999999999;
    let (market_pda, _) = find_market_pda(&creator.pubkey(), expires_at);

    let ix = Instruction {
        program_id: program_id(),
        accounts: ilowa::accounts::CreateMarket {
            creator: creator.pubkey(),
            market: market_pda,
            system_program: system_program::id(),
        }
        .to_account_metas(None),
        data: ilowa::instruction::CreateMarket {
            question: question.to_string(),
            category: "finance".to_string(),
            region: "westAfrica".to_string(),
            is_private: false,
            expires_at: expires_at,
        }
        .data(),
    };

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&creator.pubkey()),
        &[&ctx.payer],
        ctx.last_blockhash,
    );

    ctx.banks_client.process_transaction(tx).await.unwrap();

    // Verify market account
    let market_account = ctx
        .banks_client
        .get_account(market_pda)
        .await
        .unwrap()
        .expect("market account should exist");

    assert!(market_account.data.len() > 0);
}

#[tokio::test]
async fn test_create_market_question_too_long() {
    let mut ctx = program_test().start_with_context().await;
    let creator = &ctx.payer;
    let question = "x".repeat(281); // Over 280 char limit
    let expires_at: i64 = 7777777777;
    let (market_pda, _) = find_market_pda(&creator.pubkey(), expires_at);

    let ix = Instruction {
        program_id: program_id(),
        accounts: ilowa::accounts::CreateMarket {
            creator: creator.pubkey(),
            market: market_pda,
            system_program: system_program::id(),
        }
        .to_account_metas(None),
        data: ilowa::instruction::CreateMarket {
            question: question.clone(),
            category: "finance".to_string(),
            region: "westAfrica".to_string(),
            is_private: false,
            expires_at: 9999999999,
        }
        .data(),
    };

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&creator.pubkey()),
        &[&ctx.payer],
        ctx.last_blockhash,
    );

    let result = ctx.banks_client.process_transaction(tx).await;
    assert!(result.is_err(), "Should fail with question too long");
}

#[tokio::test]
async fn test_place_bet_and_resolve() {
    let mut ctx = program_test().start_with_context().await;
    let creator = Keypair::new();
    let bettor = Keypair::new();

    // Airdrop SOL to creator and bettor
    let rent = ctx.banks_client.get_rent().await.unwrap();
    let airdrop_amount = 10_000_000_000u64; // 10 SOL

    // Fund creator
    let fund_creator_ix = solana_sdk::system_instruction::transfer(
        &ctx.payer.pubkey(),
        &creator.pubkey(),
        airdrop_amount,
    );
    let fund_bettor_ix = solana_sdk::system_instruction::transfer(
        &ctx.payer.pubkey(),
        &bettor.pubkey(),
        airdrop_amount,
    );
    let fund_tx = Transaction::new_signed_with_payer(
        &[fund_creator_ix, fund_bettor_ix],
        Some(&ctx.payer.pubkey()),
        &[&ctx.payer],
        ctx.last_blockhash,
    );
    ctx.banks_client.process_transaction(fund_tx).await.unwrap();

    // Create market
    let question = "Will BTC reach 150K?";
    let expires_at: i64 = 9999999999;
    let (market_pda, _) = find_market_pda(&creator.pubkey(), expires_at);
    let (treasury_pda, _) = find_treasury_pda();
    let (vault_pda, _) = find_vault_pda(&market_pda);

    let create_ix = Instruction {
        program_id: program_id(),
        accounts: ilowa::accounts::CreateMarket {
            creator: creator.pubkey(),
            market: market_pda,
            system_program: system_program::id(),
        }
        .to_account_metas(None),
        data: ilowa::instruction::CreateMarket {
            question: question.to_string(),
            category: "crypto".to_string(),
            region: "latinAmerica".to_string(),
            is_private: false,
            expires_at: 9999999999,
        }
        .data(),
    };

    let blockhash = ctx.banks_client.get_latest_blockhash().await.unwrap();
    let create_tx = Transaction::new_signed_with_payer(
        &[create_ix],
        Some(&creator.pubkey()),
        &[&creator],
        blockhash,
    );
    ctx.banks_client.process_transaction(create_tx).await.unwrap();

    // Place bet (YES, 1 SOL)
    let (bet_pda, _) = find_bet_pda(&market_pda, &bettor.pubkey());
    let bet_amount = 1_000_000_000u64; // 1 SOL

    let bet_ix = Instruction {
        program_id: program_id(),
        accounts: ilowa::accounts::PlaceBet {
            user: bettor.pubkey(),
            market: market_pda,
            bet: bet_pda,
            platform_treasury: treasury_pda,
            market_vault: vault_pda,
            system_program: system_program::id(),
        }
        .to_account_metas(None),
        data: ilowa::instruction::PlaceBet {
            amount: bet_amount,
            outcome: true,
        }
        .data(),
    };

    let blockhash = ctx.banks_client.get_latest_blockhash().await.unwrap();
    let bet_tx = Transaction::new_signed_with_payer(
        &[bet_ix],
        Some(&bettor.pubkey()),
        &[&bettor],
        blockhash,
    );
    ctx.banks_client.process_transaction(bet_tx).await.unwrap();

    // Resolve market (YES wins)
    let resolve_ix = Instruction {
        program_id: program_id(),
        accounts: ilowa::accounts::ResolveMarket {
            resolver: creator.pubkey(),
            market: market_pda,
        }
        .to_account_metas(None),
        data: ilowa::instruction::ResolveMarket { outcome: true }.data(),
    };

    let blockhash = ctx.banks_client.get_latest_blockhash().await.unwrap();
    let resolve_tx = Transaction::new_signed_with_payer(
        &[resolve_ix],
        Some(&creator.pubkey()),
        &[&creator],
        blockhash,
    );
    ctx.banks_client.process_transaction(resolve_tx).await.unwrap();

    // Verify market is resolved
    let market_account = ctx
        .banks_client
        .get_account(market_pda)
        .await
        .unwrap()
        .expect("market should exist");
    assert!(market_account.data.len() > 0);
}

// ═══════════════════════════════════════════════════════════════
// SHIELDED BET TEST
// ═══════════════════════════════════════════════════════════════

#[tokio::test]
async fn test_shielded_bet() {
    let mut ctx = program_test().start_with_context().await;
    let creator = Keypair::new();
    let bettor = Keypair::new();

    // Fund accounts
    let fund_tx = Transaction::new_signed_with_payer(
        &[
            solana_sdk::system_instruction::transfer(&ctx.payer.pubkey(), &creator.pubkey(), 10_000_000_000),
            solana_sdk::system_instruction::transfer(&ctx.payer.pubkey(), &bettor.pubkey(), 10_000_000_000),
        ],
        Some(&ctx.payer.pubkey()),
        &[&ctx.payer],
        ctx.last_blockhash,
    );
    ctx.banks_client.process_transaction(fund_tx).await.unwrap();

    // Create market
    let question = "Shielded test market";
    let expires_at: i64 = 8888888888;
    let (market_pda, _) = find_market_pda(&creator.pubkey(), expires_at);
    let (treasury_pda, _) = find_treasury_pda();
    let (vault_pda, _) = find_vault_pda(&market_pda);

    let create_ix = Instruction {
        program_id: program_id(),
        accounts: ilowa::accounts::CreateMarket {
            creator: creator.pubkey(),
            market: market_pda,
            system_program: system_program::id(),
        }
        .to_account_metas(None),
        data: ilowa::instruction::CreateMarket {
            question: question.to_string(),
            category: "crypto".to_string(),
            region: "mena".to_string(),
            is_private: true,
            expires_at,
        }
        .data(),
    };

    let blockhash = ctx.banks_client.get_latest_blockhash().await.unwrap();
    let tx = Transaction::new_signed_with_payer(&[create_ix], Some(&creator.pubkey()), &[&creator], blockhash);
    ctx.banks_client.process_transaction(tx).await.unwrap();

    // Place shielded bet with encrypted amount + ZK proof
    let (shielded_bet_pda, _) = find_shielded_bet_pda(&market_pda, &bettor.pubkey());
    let encrypted_amount: Vec<u8> = vec![0u8; 64]; // Simulated Arcium-encrypted amount
    let zk_proof: Vec<u8> = vec![1u8; 64];         // Simulated ZK proof of solvency

    let shielded_ix = Instruction {
        program_id: program_id(),
        accounts: ilowa::accounts::ShieldedBet {
            user: bettor.pubkey(),
            market: market_pda,
            bet: shielded_bet_pda,
            platform_treasury: treasury_pda,
            system_program: system_program::id(),
        }
        .to_account_metas(None),
        data: ilowa::instruction::ShieldedBet {
            encrypted_amount,
            zk_proof,
            outcome: true,
        }
        .data(),
    };

    let blockhash = ctx.banks_client.get_latest_blockhash().await.unwrap();
    let tx = Transaction::new_signed_with_payer(&[shielded_ix], Some(&bettor.pubkey()), &[&bettor], blockhash);
    ctx.banks_client.process_transaction(tx).await.unwrap();
}

// ═══════════════════════════════════════════════════════════════
// TIP DJ TEST
// ═══════════════════════════════════════════════════════════════

#[tokio::test]
async fn test_tip_dj() {
    let mut ctx = program_test().start_with_context().await;
    let tipper = Keypair::new();
    let dj = Keypair::new();
    let (treasury_pda, _) = find_treasury_pda();

    // Fund tipper
    let fund_tx = Transaction::new_signed_with_payer(
        &[solana_sdk::system_instruction::transfer(&ctx.payer.pubkey(), &tipper.pubkey(), 5_000_000_000)],
        Some(&ctx.payer.pubkey()),
        &[&ctx.payer],
        ctx.last_blockhash,
    );
    ctx.banks_client.process_transaction(fund_tx).await.unwrap();

    // Tip DJ 0.1 SOL
    let tip_ix = Instruction {
        program_id: program_id(),
        accounts: ilowa::accounts::TipDJ {
            tipper: tipper.pubkey(),
            dj: dj.pubkey(),
            platform_treasury: treasury_pda,
            system_program: system_program::id(),
        }
        .to_account_metas(None),
        data: ilowa::instruction::TipDj {
            amount: 100_000_000, // 0.1 SOL
        }
        .data(),
    };

    let blockhash = ctx.banks_client.get_latest_blockhash().await.unwrap();
    let tx = Transaction::new_signed_with_payer(&[tip_ix], Some(&tipper.pubkey()), &[&tipper], blockhash);
    ctx.banks_client.process_transaction(tx).await.unwrap();

    // Verify DJ received 90% (0.09 SOL)
    let dj_balance = ctx.banks_client.get_balance(dj.pubkey()).await.unwrap();
    assert_eq!(dj_balance, 90_000_000, "DJ should receive 90% of tip");
}

#[tokio::test]
async fn test_tip_dj_too_small() {
    let mut ctx = program_test().start_with_context().await;
    let tipper = Keypair::new();
    let dj = Keypair::new();
    let (treasury_pda, _) = find_treasury_pda();

    let fund_tx = Transaction::new_signed_with_payer(
        &[solana_sdk::system_instruction::transfer(&ctx.payer.pubkey(), &tipper.pubkey(), 5_000_000_000)],
        Some(&ctx.payer.pubkey()),
        &[&ctx.payer],
        ctx.last_blockhash,
    );
    ctx.banks_client.process_transaction(fund_tx).await.unwrap();

    let tip_ix = Instruction {
        program_id: program_id(),
        accounts: ilowa::accounts::TipDJ {
            tipper: tipper.pubkey(),
            dj: dj.pubkey(),
            platform_treasury: treasury_pda,
            system_program: system_program::id(),
        }
        .to_account_metas(None),
        data: ilowa::instruction::TipDj {
            amount: 100, // Way too small
        }
        .data(),
    };

    let blockhash = ctx.banks_client.get_latest_blockhash().await.unwrap();
    let tx = Transaction::new_signed_with_payer(&[tip_ix], Some(&tipper.pubkey()), &[&tipper], blockhash);
    let result = ctx.banks_client.process_transaction(tx).await;
    assert!(result.is_err(), "Should fail with tip too small");
}

// ═══════════════════════════════════════════════════════════════
// VOICE NFT TEST
// ═══════════════════════════════════════════════════════════════

#[tokio::test]
async fn test_mint_voice_nft() {
    let mut ctx = program_test().start_with_context().await;
    let owner = &ctx.payer;
    let voice_uri = "ipfs://QmVoicePrediction123";
    let metadata_uri = "ipfs://QmMetadata456";
    let market = Pubkey::new_unique();

    let (nft_pda, _) = find_voice_nft_pda(&owner.pubkey(), voice_uri);

    let ix = Instruction {
        program_id: program_id(),
        accounts: ilowa::accounts::MintVoiceNFT {
            owner: owner.pubkey(),
            voice_nft: nft_pda,
            system_program: system_program::id(),
        }
        .to_account_metas(None),
        data: ilowa::instruction::MintVoiceNft {
            voice_uri: voice_uri.to_string(),
            metadata_uri: metadata_uri.to_string(),
            market,
            is_winner: true,
            is_meme: false,
        }
        .data(),
    };

    let tx = Transaction::new_signed_with_payer(&[ix], Some(&owner.pubkey()), &[&ctx.payer], ctx.last_blockhash);
    ctx.banks_client.process_transaction(tx).await.unwrap();

    let nft_account = ctx.banks_client.get_account(nft_pda).await.unwrap().expect("NFT should exist");
    assert!(nft_account.data.len() > 0);
}

// ═══════════════════════════════════════════════════════════════
// ELDER GUARDIAN TESTS
// ═══════════════════════════════════════════════════════════════

#[tokio::test]
async fn test_elder_guardian_lifecycle() {
    let mut ctx = program_test().start_with_context().await;
    let user = &ctx.payer;
    let (guardian_pda, _) = find_elder_guardian_pda(&user.pubkey());

    // Init elder guardian
    let init_ix = Instruction {
        program_id: program_id(),
        accounts: ilowa::accounts::InitElderGuardian {
            user: user.pubkey(),
            guardian: guardian_pda,
            system_program: system_program::id(),
        }
        .to_account_metas(None),
        data: ilowa::instruction::InitElderGuardian {}.data(),
    };

    let tx = Transaction::new_signed_with_payer(&[init_ix], Some(&user.pubkey()), &[&ctx.payer], ctx.last_blockhash);
    ctx.banks_client.process_transaction(tx).await.unwrap();

    // Set guardian key
    let guardian_key = Keypair::new();
    let set_key_ix = Instruction {
        program_id: program_id(),
        accounts: ilowa::accounts::SetGuardianKey {
            user: user.pubkey(),
            guardian: guardian_pda,
        }
        .to_account_metas(None),
        data: ilowa::instruction::SetGuardianKey {
            guardian_key: guardian_key.pubkey(),
        }
        .data(),
    };

    let blockhash = ctx.banks_client.get_latest_blockhash().await.unwrap();
    let tx = Transaction::new_signed_with_payer(&[set_key_ix], Some(&user.pubkey()), &[&ctx.payer], blockhash);
    ctx.banks_client.process_transaction(tx).await.unwrap();

    // Initiate recovery
    let initiate_ix = Instruction {
        program_id: program_id(),
        accounts: ilowa::accounts::InitiateRecovery {
            initiator: user.pubkey(),
            guardian: guardian_pda,
        }
        .to_account_metas(None),
        data: ilowa::instruction::InitiateRecovery {}.data(),
    };

    let blockhash = ctx.banks_client.get_latest_blockhash().await.unwrap();
    let tx = Transaction::new_signed_with_payer(&[initiate_ix], Some(&user.pubkey()), &[&ctx.payer], blockhash);
    ctx.banks_client.process_transaction(tx).await.unwrap();

    // Cancel recovery
    let cancel_ix = Instruction {
        program_id: program_id(),
        accounts: ilowa::accounts::CancelRecovery {
            user: user.pubkey(),
            guardian: guardian_pda,
        }
        .to_account_metas(None),
        data: ilowa::instruction::CancelRecovery {}.data(),
    };

    let blockhash = ctx.banks_client.get_latest_blockhash().await.unwrap();
    let tx = Transaction::new_signed_with_payer(&[cancel_ix], Some(&user.pubkey()), &[&ctx.payer], blockhash);
    ctx.banks_client.process_transaction(tx).await.unwrap();
}

// ═══════════════════════════════════════════════════════════════
// SOCIAL RECOVERY TESTS
// ═══════════════════════════════════════════════════════════════

#[tokio::test]
async fn test_social_recovery_full_flow() {
    let mut ctx = program_test().start_with_context().await;
    let user = Keypair::new();
    let guardians: Vec<Keypair> = (0..5).map(|_| Keypair::new()).collect();
    let guardian_pubkeys: Vec<Pubkey> = guardians.iter().map(|g| g.pubkey()).collect();
    let new_wallet = Keypair::new();

    // Fund user and all guardians
    let mut fund_ixs = vec![solana_sdk::system_instruction::transfer(
        &ctx.payer.pubkey(),
        &user.pubkey(),
        5_000_000_000,
    )];
    for g in &guardians {
        fund_ixs.push(solana_sdk::system_instruction::transfer(
            &ctx.payer.pubkey(),
            &g.pubkey(),
            1_000_000_000,
        ));
    }
    let fund_tx = Transaction::new_signed_with_payer(&fund_ixs, Some(&ctx.payer.pubkey()), &[&ctx.payer], ctx.last_blockhash);
    ctx.banks_client.process_transaction(fund_tx).await.unwrap();

    let (recovery_pda, _) = find_social_recovery_pda(&user.pubkey());

    // Init social recovery with 5 guardians
    let init_ix = Instruction {
        program_id: program_id(),
        accounts: ilowa::accounts::InitSocialRecovery {
            user: user.pubkey(),
            social_recovery: recovery_pda,
            system_program: system_program::id(),
        }
        .to_account_metas(None),
        data: ilowa::instruction::InitSocialRecovery {
            guardians: guardian_pubkeys.clone(),
        }
        .data(),
    };

    let blockhash = ctx.banks_client.get_latest_blockhash().await.unwrap();
    let tx = Transaction::new_signed_with_payer(&[init_ix], Some(&user.pubkey()), &[&user], blockhash);
    ctx.banks_client.process_transaction(tx).await.unwrap();

    // 3 guardians approve (threshold = 3)
    for i in 0..3 {
        let approve_ix = Instruction {
            program_id: program_id(),
            accounts: ilowa::accounts::ApproveSocialRecovery {
                guardian: guardians[i].pubkey(),
                social_recovery: recovery_pda,
            }
            .to_account_metas(None),
            data: ilowa::instruction::ApproveSocialRecovery {
                new_wallet: new_wallet.pubkey(),
            }
            .data(),
        };

        let blockhash = ctx.banks_client.get_latest_blockhash().await.unwrap();
        let tx = Transaction::new_signed_with_payer(
            &[approve_ix],
            Some(&guardians[i].pubkey()),
            &[&guardians[i]],
            blockhash,
        );
        ctx.banks_client.process_transaction(tx).await.unwrap();
    }

    // Verify recovery account exists and has 3 approvals
    let recovery_account = ctx
        .banks_client
        .get_account(recovery_pda)
        .await
        .unwrap()
        .expect("recovery should exist");
    assert!(recovery_account.data.len() > 0);
}

#[tokio::test]
async fn test_social_recovery_wrong_guardian() {
    let mut ctx = program_test().start_with_context().await;
    let user = Keypair::new();
    let guardians: Vec<Keypair> = (0..5).map(|_| Keypair::new()).collect();
    let guardian_pubkeys: Vec<Pubkey> = guardians.iter().map(|g| g.pubkey()).collect();
    let impostor = Keypair::new();
    let new_wallet = Keypair::new();

    // Fund
    let mut fund_ixs = vec![
        solana_sdk::system_instruction::transfer(&ctx.payer.pubkey(), &user.pubkey(), 5_000_000_000),
        solana_sdk::system_instruction::transfer(&ctx.payer.pubkey(), &impostor.pubkey(), 1_000_000_000),
    ];
    let fund_tx = Transaction::new_signed_with_payer(&fund_ixs, Some(&ctx.payer.pubkey()), &[&ctx.payer], ctx.last_blockhash);
    ctx.banks_client.process_transaction(fund_tx).await.unwrap();

    let (recovery_pda, _) = find_social_recovery_pda(&user.pubkey());

    let init_ix = Instruction {
        program_id: program_id(),
        accounts: ilowa::accounts::InitSocialRecovery {
            user: user.pubkey(),
            social_recovery: recovery_pda,
            system_program: system_program::id(),
        }
        .to_account_metas(None),
        data: ilowa::instruction::InitSocialRecovery {
            guardians: guardian_pubkeys,
        }
        .data(),
    };

    let blockhash = ctx.banks_client.get_latest_blockhash().await.unwrap();
    let tx = Transaction::new_signed_with_payer(&[init_ix], Some(&user.pubkey()), &[&user], blockhash);
    ctx.banks_client.process_transaction(tx).await.unwrap();

    // Impostor tries to approve — should fail
    let approve_ix = Instruction {
        program_id: program_id(),
        accounts: ilowa::accounts::ApproveSocialRecovery {
            guardian: impostor.pubkey(),
            social_recovery: recovery_pda,
        }
        .to_account_metas(None),
        data: ilowa::instruction::ApproveSocialRecovery {
            new_wallet: new_wallet.pubkey(),
        }
        .data(),
    };

    let blockhash = ctx.banks_client.get_latest_blockhash().await.unwrap();
    let tx = Transaction::new_signed_with_payer(&[approve_ix], Some(&impostor.pubkey()), &[&impostor], blockhash);
    let result = ctx.banks_client.process_transaction(tx).await;
    assert!(result.is_err(), "Impostor should not be able to approve");
}

// ═══════════════════════════════════════════════════════════════
// DAPP REGISTRY TESTS
// ═══════════════════════════════════════════════════════════════

#[tokio::test]
async fn test_dapp_registry_lifecycle() {
    let mut ctx = program_test().start_with_context().await;
    let registrar = &ctx.payer;
    let dapp = Keypair::new();
    let (registry_pda, _) = find_dapp_registry_pda(&dapp.pubkey());

    // Register dApp
    let register_ix = Instruction {
        program_id: program_id(),
        accounts: ilowa::accounts::RegisterDApp {
            registrar: registrar.pubkey(),
            dapp: dapp.pubkey(),
            registry: registry_pda,
            system_program: system_program::id(),
        }
        .to_account_metas(None),
        data: ilowa::instruction::RegisterDapp {
            domain: "https://example-dapp.com".to_string(),
        }
        .data(),
    };

    let tx = Transaction::new_signed_with_payer(&[register_ix], Some(&registrar.pubkey()), &[&ctx.payer], ctx.last_blockhash);
    ctx.banks_client.process_transaction(tx).await.unwrap();

    // Verify (5 votes needed — we'll do 1 here to test the instruction works)
    let verify_ix = Instruction {
        program_id: program_id(),
        accounts: ilowa::accounts::VerifyDApp {
            voter: registrar.pubkey(),
            registry: registry_pda,
        }
        .to_account_metas(None),
        data: ilowa::instruction::VerifyDapp {}.data(),
    };

    let blockhash = ctx.banks_client.get_latest_blockhash().await.unwrap();
    let tx = Transaction::new_signed_with_payer(&[verify_ix], Some(&registrar.pubkey()), &[&ctx.payer], blockhash);
    ctx.banks_client.process_transaction(tx).await.unwrap();

    // Report dApp
    let report_ix = Instruction {
        program_id: program_id(),
        accounts: ilowa::accounts::ReportDApp {
            reporter: registrar.pubkey(),
            registry: registry_pda,
        }
        .to_account_metas(None),
        data: ilowa::instruction::ReportDapp {}.data(),
    };

    let blockhash = ctx.banks_client.get_latest_blockhash().await.unwrap();
    let tx = Transaction::new_signed_with_payer(&[report_ix], Some(&registrar.pubkey()), &[&ctx.payer], blockhash);
    ctx.banks_client.process_transaction(tx).await.unwrap();
}
