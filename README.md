# Ilowa

**The Voice of the Global South** — Voice-native, AI-powered Cultural SocialFi Radio on Solana.

Ilowa connects 2.5 billion people across 9 Global South regions to earn, learn, and connect — in their own languages, on their own terms.

## What It Does

- **Decentralized Radio** — Live streaming (Livepeer HLS), 30,000+ stations via radio-browser.info, Audius music integration, IPFS offline playback, Arweave permanent archive
- **Prediction Markets** — On-chain Solana markets with Light Protocol compressed accounts, Arcium MPC shielded bets, Pyth oracle resolution
- **AI Elders** — 9 culturally-grounded AI personas powered by Cohere Aya (101 languages), GLM-5 reasoning, and Lelapa AI for African languages
- **Privacy** — Arcium MPC encryption, federated learning (on-device only), Elder Guardian timelock recovery, social recovery, biometric auth
- **Podcasts** — AI Elder narrated educational content with TTS audio generation
- **Events & Tickets** — KYD Labs TICKS protocol for programmable ticket NFTs
- **Loyalty** — Torque campaigns, OrbitFlare Blinks for shareable Solana Actions
- **Social** — Tapestry on-chain social graph, XMTP E2EE messaging

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native (Expo) with Expo Router |
| Smart Contracts | Solana Anchor (Rust) |
| AI | Cohere Aya · GLM-5 · Lelapa AI |
| Voice | Gladia (online) · Vosk (offline) |
| Radio | Livepeer · IPFS/Pinata · Arweave |
| Music | Audius API |
| Messaging | XMTP (E2EE) |
| Privacy | Arcium MPC · Light Protocol |
| Social | Tapestry Protocol |
| Ticketing | KYD Labs TICKS |
| Oracle | Pyth · Switchboard V3 |
| Database | Supabase PostgreSQL |

## Architecture

```
┌─────────────────────────────────────────────────┐
│                React Native App                 │
│  ┌──────┐ ┌──────┐ ┌───────┐ ┌────┐ ┌───────┐  │
│  │ Home │ │Radio │ │Markets│ │ AI │ │Profile│  │
│  └──┬───┘ └──┬───┘ └───┬───┘ └─┬──┘ └───┬───┘  │
│     └────────┴─────────┴───────┴────────┘       │
│           Unified Service Layer                 │
│    Solana · XMTP · AI · Radio · Privacy         │
└─────────────────┬───────────────────────────────┘
                  │
   ┌──────────────┼──────────────┐
   │              │              │
┌──┴──┐   ┌──────┴──────┐  ┌────┴────┐
│Solana│   │ AI Services │  │ Storage │
│Anchor│   │ Cohere Aya  │  │ IPFS    │
│Light │   │ GLM-5       │  │ Arweave │
│Arcium│   │ Lelapa      │  │Supabase │
└──────┘   └─────────────┘  └─────────┘
```

## Regions & Elders

| Region | Elder | Cultural Focus |
|--------|-------|---------------|
| West Africa | Baba Dee | Yoruba, Hausa, Igbo wisdom |
| East Africa | Mama Zawadi | Swahili, M-Pesa, tech hubs |
| Southern Africa | Gogo Thandi | Ubuntu, Rainbow Nation |
| South Asia | Dada Rajesh | Hindi, dharma, Indian markets |
| Southeast Asia | Lola Maria | Filipino bayanihan, remittances |
| MENA | Sitt Fatima | Arabic, Islamic finance |
| Latin America | Don Esteban | Andean wisdom, Pachamama |
| Caribbean | Tantie Rose | Patois, reggae, diaspora |
| Pacific | Aunty Leilani | Ocean navigation, sustainability |

## Solana Program

**Program ID:** `HYDwFwax9U6svCRYWD7Fqq3TXxSSQCQ6CwKrb3ZTkD3z`

Instructions: `create_market`, `place_bet`, `shielded_bet`, `resolve_market`, `claim_winnings`, `create_light_market`, `place_light_bet`, `place_shielded_light_bet`, `resolve_light_market`, `resolve_light_market_oracle`, `claim_light_winnings`, `tip_dj`, `mint_voice_nft`, `init_elder_guardian`, `set_guardian_key`, `initiate_recovery`, `cancel_recovery`, `execute_recovery`, `init_social_recovery`, `approve_social_recovery`, `init_federated_learning`, `record_contribution`, `claim_fl_rewards`

## Running

### Mobile App

```bash
cd app
cp .env.example .env   # fill in API keys
npm install
npx expo start --lan
```

### Build APK

```bash
cd app
npx eas-cli build -p android --profile preview
```

### Backend (Docker)

```bash
cp backend/.env.example backend/.env
docker compose up -d
```

## License

MIT — see [LICENSE](LICENSE)

## Download

APK available at [ilowa.app](https://ilowa.netlify.app) — Android 8.0+.

Connect a Solana wallet (Phantom recommended), select your region, and explore.

---

*Built by BantuBloomNetwork*
