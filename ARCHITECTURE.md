# Ilowa Architecture

> Voice-native, AI-powered Cultural SocialFi Radio for the Global South (2.5B users)

## Quick Reference

| Question | Answer |
|----------|--------|
| **Which AI to use?** | Gladia (online) + Vosk (offline) for voice transcription. Elder wisdom is LOCAL (no API). |
| **Which AI to remove?** | Qwen3 server removed. Wispr Flow not used. |
| **Radio streaming?** | OBS → Livepeer (HLS) → App. Fallback: IPFS audio. |
| **Content storage?** | IPFS (Pinata) for live content, Arweave for permanent archive. |
| **Automation?** | Bot checks DJ status → if offline, plays IPFS queue. |
| **DJ uploads?** | DJ Portal → Upload audio → Pinata IPFS → Arweave archive. |
| **How everything connects?** | Voice → Markets/Radio → Betting → NFTs → Payouts. |
| **Build order?** | 1. Voice ✅ 2. Radio ✅ 3. Markets ✅ 4. Privacy (Arcium) |
| **Monthly costs?** | ~$992/month (see breakdown below) |
| **Success criteria?** | Voice transcription + Radio streaming + Markets betting all working |

---

## 1. AI Stack (NO EXTERNAL AI SERVER)

```
┌─────────────────────────────────────────────────────────────────┐
│                        VOICE INPUT                               │
│                                                                   │
│   User speaks → Recording (expo-av) → Audio file (.wav)          │
│                           │                                       │
│                           ▼                                       │
│   ┌───────────────────────────────────────────────────────┐      │
│   │              HYBRID TRANSCRIPTION                      │      │
│   │                                                        │      │
│   │   Layer 1: Gladia API (online, best quality)          │      │
│   │   Layer 2: Vosk (offline, 100% private)               │      │
│   │                                                        │      │
│   │   Output: { text, language, confidence }              │      │
│   └───────────────────────────────────────────────────────┘      │
│                           │                                       │
│                           ▼                                       │
│   ┌───────────────────────────────────────────────────────┐      │
│   │              ELDER WISDOM (LOCAL)                      │      │
│   │                                                        │      │
│   │   - No external AI API calls                          │      │
│   │   - Curated responses in lib/ai/qwen3.ts              │      │
│   │   - Keyword matching + regional wisdom database       │      │
│   │   - 9 Elders, one per region                          │      │
│   └───────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### Key Files
- `lib/voice/gladia.ts` - Gladia API integration (online)
- `lib/voice/vosk.ts` - Vosk offline transcription (native build only)
- `lib/voice/hybrid.ts` - Orchestrates Gladia → Vosk fallback
- `lib/ai/qwen3.ts` - LOCAL Elder wisdom, NO server needed

### What's Removed
- ❌ Qwen3 server (was planned, not needed)
- ❌ Wispr Flow (replaced by Gladia + Vosk)
- ❌ Any external LLM API calls

---

## 2. Radio Streaming Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     LIVE STREAMING                               │
│                                                                   │
│   DJ Computer                                                     │
│   ┌─────────────┐                                                │
│   │    OBS      │ ──RTMP──▶ Livepeer Ingest                      │
│   │  Studio     │           │                                     │
│   └─────────────┘           │                                     │
│                             ▼                                     │
│                     ┌───────────────┐                            │
│                     │   Livepeer    │                            │
│                     │   Transcode   │                            │
│                     └───────────────┘                            │
│                             │                                     │
│                             ▼                                     │
│                     HLS Stream URL                                │
│                     (m3u8 playlist)                               │
│                             │                                     │
│                             ▼                                     │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    ILOWA APP                             │   │
│   │                                                          │   │
│   │   expo-av player → HLS stream → Live audio              │   │
│   │   Visualizer → Frequency analysis                       │   │
│   │   Chat → XMTP encrypted                                 │   │
│   │   Tip DJ → Solana transaction                          │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     OFFLINE FALLBACK                             │
│                                                                   │
│   If DJ not live:                                                │
│   1. Bot detects offline status (Livepeer API)                   │
│   2. Fetches audio queue from IPFS (Pinata gateway)              │
│   3. Plays pre-recorded shows/music                              │
│   4. Archives to Arweave for permanence                          │
└─────────────────────────────────────────────────────────────────┘
```

### Key Files
- `lib/radio/livepeer.ts` - Livepeer API for stream status
- `lib/radio/stream.ts` - Audio player, HLS + IPFS fallback
- `lib/radio/call-in.ts` - Voice call-ins uploaded to IPFS
- `components/RadioPlayer.tsx` - UI with visualizer
- `data/radio-stations.ts` - 9 regional stations config

### OBS → Livepeer Setup
1. Create Livepeer stream at https://livepeer.studio
2. Get RTMP ingest URL and stream key
3. Configure OBS: Settings → Stream → Custom → Livepeer URL
4. Add stream ID to `.env`: `EXPO_PUBLIC_LIVEPEER_STREAM_ID_WEST_AFRICA=...`

---

## 3. Content Storage

```
┌─────────────────────────────────────────────────────────────────┐
│                    STORAGE TIERS                                 │
│                                                                   │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│   │   HOT       │    │   WARM      │    │   COLD      │         │
│   │   IPFS      │ ──▶│   IPFS      │ ──▶│  Arweave    │         │
│   │  (Pinata)   │    │  (Pinned)   │    │ (Permanent) │         │
│   └─────────────┘    └─────────────┘    └─────────────┘         │
│   Live uploads       Pinned 30 days     Forever                  │
│   Call-ins          Popular content     Voice NFTs               │
│   DJ recordings     Trending shows      Winning predictions      │
└─────────────────────────────────────────────────────────────────┘
```

### Key Files
- `lib/storage/ipfs.ts` - Pinata IPFS upload/pin
- `lib/storage/arweave.ts` - Permanent archive
- `lib/radio/call-in.ts` - Call-in → IPFS flow

### Cost Breakdown
| Service | Monthly | Notes |
|---------|---------|-------|
| Pinata IPFS | $20 | 50GB, 100K gateway requests |
| Arweave | ~$5 | Per MB, only for permanent content |
| Livepeer | $50-200 | Based on stream hours |

---

## 4. Automation (Bot System)

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTOMATION BOT                                │
│                                                                   │
│   Every 30 seconds:                                              │
│   1. Check Livepeer API for stream status                        │
│   2. If DJ is live → update app state                           │
│   3. If DJ offline → play IPFS queue                            │
│                                                                   │
│   On new call-in:                                                │
│   1. Receive audio from app                                      │
│   2. Upload to IPFS (Pinata)                                     │
│   3. Add to DJ queue                                             │
│   4. If hot (tips/votes) → archive to Arweave                   │
│                                                                   │
│   On market resolution:                                          │
│   1. Verify outcome (oracle or DJ input)                         │
│   2. Execute resolve_market on-chain                            │
│   3. Notify winners                                              │
│   4. Mint Voice NFTs for viral predictions                      │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation
- Bot runs as separate process (Node.js or serverless)
- Polls Livepeer every 30s for stream status
- Uses Supabase for state management
- Triggers Solana transactions for automation

---

## 5. DJ Portal Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      DJ PORTAL                                   │
│                                                                   │
│   1. DJ logs in with Solana wallet                               │
│   2. Dashboard shows:                                            │
│      - Total tips received                                       │
│      - Listener count                                            │
│      - Upcoming schedule                                         │
│      - Call-in queue                                             │
│                                                                   │
│   3. Upload flow:                                                │
│      DJ selects audio file                                       │
│            │                                                     │
│            ▼                                                     │
│      Upload to Pinata IPFS                                       │
│            │                                                     │
│            ▼                                                     │
│      Get CID, add to playlist                                    │
│            │                                                     │
│            ▼                                                     │
│      (Optional) Archive to Arweave                               │
│                                                                   │
│   4. Go Live:                                                    │
│      - Get OBS stream key                                        │
│      - Start streaming                                           │
│      - App auto-detects via Livepeer                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. System Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                 VOICE → EVERYTHING                               │
│                                                                   │
│   User speaks prediction                                         │
│            │                                                     │
│            ▼                                                     │
│   Gladia/Vosk transcribes                                        │
│            │                                                     │
│            ▼                                                     │
│   Elder validates (local)                                        │
│            │                                                     │
│   ┌───────┴───────┐                                             │
│   │               │                                              │
│   ▼               ▼                                              │
│ MARKET         RADIO                                             │
│ Create on-chain  Call-in to live show                           │
│   │               │                                              │
│   ▼               ▼                                              │
│ BETTING        ENGAGEMENT                                        │
│ Others bet      Listeners react                                  │
│ YES/NO          Tips, votes                                      │
│   │               │                                              │
│   ▼               ▼                                              │
│ RESOLUTION     VIRAL                                             │
│ Oracle/DJ       Content trends                                   │
│ resolves          │                                              │
│   │               │                                              │
│   └───────┬───────┘                                             │
│           │                                                      │
│           ▼                                                      │
│       VOICE NFT                                                  │
│   Mint memorable moments                                         │
│   - Winning prediction                                           │
│   - Viral call-in                                               │
│   - Meme-worthy content                                         │
│           │                                                      │
│           ▼                                                      │
│       PAYOUT                                                     │
│   Winners claim SOL                                              │
│   DJs receive tips                                               │
│   NFT royalties                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Build Order & Status

| Phase | Component | Status | Priority |
|-------|-----------|--------|----------|
| 1 | Voice Transcription (Gladia) | ✅ Done | P0 |
| 1 | Voice Transcription (Vosk offline) | 🔧 Needs native build | P1 |
| 2 | Radio Player (HLS) | ✅ Done | P0 |
| 2 | Radio Livepeer Integration | ✅ Done | P0 |
| 2 | Radio IPFS Fallback | ✅ Done | P1 |
| 3 | Prediction Markets (on-chain) | ✅ Done | P0 |
| 3 | Betting (place_bet) | ✅ Done | P0 |
| 3 | Claim Winnings | ✅ Done | P0 |
| 4 | DJ Tipping (on-chain) | ✅ Done | P1 |
| 4 | Voice NFTs | ✅ Contract done | P2 |
| 5 | Privacy (Arcium shielded bets) | 📋 Stubbed | P2 |
| 5 | Compressed Markets (Light Protocol) | 📋 Stubbed | P3 |
| 6 | Social Recovery | ✅ Contract done | P2 |
| 6 | Elder Guardian | ✅ Contract done | P2 |

---

## 8. Cost Expectations

### Monthly Operating Costs (~$992)

| Service | Cost | Notes |
|---------|------|-------|
| **Gladia** | $0-99 | Free tier: 10 hrs/mo, Pro: $99/mo |
| **Livepeer** | $50-200 | ~$0.005/min transcoding |
| **Pinata IPFS** | $20 | Starter plan |
| **Arweave** | $5-20 | Per MB archived |
| **Solana RPC** | $0-100 | Free devnet, paid mainnet |
| **Supabase** | $25 | Pro plan |
| **Domain/SSL** | $15 | Annual |
| **Vercel/Hosting** | $20 | Pro plan |
| **Push Notifications** | $0-25 | Expo Push free tier |
| **Error Tracking** | $26 | Sentry team |
| **Total** | **~$261-630** | Conservative estimate |

### One-Time Costs

| Item | Cost |
|------|------|
| Apple Developer | $99/year |
| Google Play | $25 one-time |
| Solana deployment | ~$5 (devnet free) |

---

## 9. Success Criteria

### MVP Launch Checklist

- [ ] **Voice**: User can speak, get transcription, create market
- [ ] **Radio**: 9 stations, play live or IPFS fallback
- [ ] **Markets**: Create, bet, resolve, claim winnings
- [ ] **Wallet**: Connect Solana wallet, see balance
- [ ] **Tips**: Tip DJs during live shows
- [ ] **Chat**: XMTP encrypted radio chat

### Technical Validation

- [ ] Voice accuracy > 85% for African accents
- [ ] Stream latency < 10 seconds
- [ ] Transaction confirmation < 5 seconds
- [ ] App cold start < 3 seconds
- [ ] Offline mode works (Vosk + IPFS cache)

---

## 10. Environment Variables

```bash
# Voice (Gladia)
EXPO_PUBLIC_GLADIA_API_KEY=your_key

# Solana
EXPO_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com

# Livepeer (Radio)
EXPO_PUBLIC_LIVEPEER_API_KEY=your_key
EXPO_PUBLIC_LIVEPEER_STREAM_ID_WEST_AFRICA=stream_id

# IPFS (Pinata)
EXPO_PUBLIC_PINATA_API_KEY=your_key
EXPO_PUBLIC_PINATA_SECRET_KEY=your_secret

# Arweave
EXPO_PUBLIC_ARWEAVE_WALLET_PATH=./arweave-wallet.json
```

---

## 11. Deployed Contracts

**Program ID:** `HYDwFwax9U6svCRYWD7Fqq3TXxSSQCQ6CwKrb3ZTkD3z`

### Instructions (17 total)
- `create_market` - Create prediction market
- `place_bet` - Place bet on market
- `shielded_bet` - Private bet (Arcium)
- `create_compressed_market` - Light Protocol market
- `place_compressed_bet` - Bet on compressed market
- `resolve_market` - Resolve with outcome
- `claim_winnings` - Claim payout
- `tip_dj` - Tip DJ during show
- `mint_voice_nft` - Mint voice moment
- `init_elder_guardian` - Setup recovery
- `set_guardian_key` - Set guardian
- `initiate_recovery` - Start recovery
- `cancel_recovery` - Cancel recovery
- `execute_recovery` - Complete recovery
- `init_social_recovery` - Multi-sig recovery
- `approve_social_recovery` - Approve recovery
- `register_dapp` - Register dApp
- `verify_dapp` / `report_dapp` - Moderation

---

## 12. AI Routing — Aya vs GLM-5

```
User message
    │
    ▼
detectReasoningQuery(msg)
    │
    ├── strong trigger (calculate, analyze, trading signal, memecoin, RSI…) → GLM-5
    ├── 2+ soft keywords (trade, profit, blockchain, staking…)             → GLM-5
    └── else                                                                → Cohere Aya
```

- **GLM-5**: Deep reasoning, STEM, trading analysis, chart patterns, computations
- **Aya (Command A)**: Cultural context, multilingual, general conversation
- **Local fallback**: Elder wisdom database when both APIs are down
- Badge in AI tab shows which model answered: "GLM-5 Deep" / "Aya AI" / "Elder Wisdom"

Key files: `lib/ai/privacy-ai.ts`, `lib/ai/glm5.ts`, `lib/ai/cohere-aya.ts`

---

## 13. KYD Ticketing (TICKS Protocol)

On-chain event ticketing on Solana via KYD Labs.

- **Event detail screen**: `app/event/[id].tsx` — tier selection, real SOL transfer, QR receipt
- **Home integration**: Compact event cards navigate to detail screen on tap
- **OrbitFlare sharing**: Each ticket tier has a "Share Blink" button
- **Backend**: `lib/ticketing/kyd.ts` — KYDClient with purchase, transfer, verify

---

## 14. Torque Loyalty Campaigns

On-chain loyalty programs via Torque SDK.

- **Home integration**: Campaign cards are tappable → Alert with description + "Join Campaign"
- **Enrollment**: `enrollInCampaign(wallet, campaignId)` posts to Torque API
- **Reward types**: SOL, NFT, or points — displayed with appropriate icons

Key file: `lib/loyalty/torque.ts`

---

## 15. OrbitFlare Blinks (Shareable Solana Actions)

Blinks = shareable URLs that encode Solana transactions.

- **MarketCard**: "Share" button creates a bet Blink for the market
- **Event tiers**: "Blink" button creates a ticket purchase link
- **Artist profiles**: "Tip Artist via Blink" creates a $AUDIO tip link
- Blink types: `createBetBlink`, `createTipBlink`, `createTicketBlink`

Key file: `lib/actions/orbitflare.ts`

---

## 16. Audius Artist Profiles

Full artist coin profiles accessible from the music browser.

- **Artist screen**: `app/artist/[id].tsx` — avatar, stats, supporters, tracks, tip button
- **Navigation**: Artist name in AudiusMusicBrowser is tappable (underlined)
- **Supporters**: Top $AUDIO tippers shown with rank, avatar, amount
- **Tipping**: Via OrbitFlare Blink share (no direct on-chain tip from mobile yet)

Key files: `lib/music/audius.ts`, `components/AudiusMusicBrowser.tsx`

---

## 17. Points & Early Adopter System

Fibonacci-inspired tier progression (15 tiers: Seed → Ancestor).

- **Tiers**: Threshold-based, each with multiplier (1.0x → 2.5x)
- **Milestones**: One-time bonuses at 50, 100, 250 ("Rising Voice"), 500… 100K pts
- **Early adopter badges**:
  - Users 1–33: **Genesis Elder** — 🏛️ +1.0x bonus (effectively 2x), governance perks
  - Users 34–99: **Pioneer Voice** — 🌅 +0.5x bonus (effectively 1.5x), early access
- **Storage**: Nillion (blind vault) → Supabase cache → AsyncStorage offline fallback

Key files: `lib/points/PointsSystem.ts`, `components/Points/PointsDisplay.tsx`

---

## 18. Screen Map

```
app/
├── index.tsx                    Router guard (onboarding vs tabs)
├── _layout.tsx                  Root layout + providers
├── (onboarding)/
│   ├── wallet.tsx               Wallet connect gate
│   ├── region.tsx               Region picker (9 regions)
│   ├── language.tsx             Language selector
│   ├── reveal.tsx               Animated Elder reveal
│   └── guardians.tsx            Elder Guardian setup
├── (tabs)/
│   ├── home.tsx                 Feed: predictions, events, campaigns, podcasts
│   ├── radio.tsx                Live, Browse, Schedule, Podcasts, Audius
│   ├── markets.tsx              Prediction markets + creation
│   ├── ai.tsx                   Elder AI chat (Aya / GLM-5 / local)
│   └── profile.tsx              Wallet, points, settings, governance
├── market/[id].tsx              Market detail + betting
├── event/[id].tsx               KYD event detail + ticket purchase
├── artist/[id].tsx              Audius artist profile + supporters
├── podcast/[id].tsx             Podcast player with Elder TTS
├── governance.tsx               Proposal voting
├── radio/call-in.tsx            Voice call-in recording
└── settings/
    ├── region.tsx               Switch region/language
    ├── voice.tsx                Gladia/Vosk voice config
    ├── ai-privacy.tsx           AI & privacy controls
    ├── about.tsx                BantuBloomNetwork 2026 ©
    ├── security.tsx             Security settings
    ├── elder-guardian.tsx        Guardian key management
    └── social-recovery.tsx      Social recovery setup
```

---

## Quick Commands

```bash
# Start dev server (LAN — Metro on port 80)
cd app && npx expo start --port 80 --lan

# TypeScript check (should be 0 errors)
cd app && npx tsc --noEmit

# Build Android APK (EAS Cloud)
cd app && npx eas-cli build --profile development --platform android

# Deploy Solana program
cd programs/ilowa && anchor build && anchor deploy

# Start backend services
docker-compose up -d
```
