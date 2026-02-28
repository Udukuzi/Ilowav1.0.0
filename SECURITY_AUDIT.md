# Ilowa Security Audit — Feb 27, 2026

## Summary

Full review of XSS, CORS, API key exposure, input validation, rate limiting, and privacy controls.

**Overall: PASS** — no critical vulnerabilities found. Minor hardening applied during audit.

---

## Findings & Fixes

### 1. CORS Configuration
- **Before:** Node.js server used `cors()` (allow all), Python backend `allow_origins=["*"]`
- **Fix:** Both now read `ALLOWED_ORIGINS` env var. Falls back to permissive only when unset (dev mode).
- **Files:** `server/index.ts`, `backend/main.py`

### 2. Rate Limiting
- **Before:** No rate limiting on Node.js API
- **Fix:** Added in-memory rate limiter — 120 req/min general, auto-prunes stale entries
- **File:** `server/index.ts`

### 3. API Key Management
- **Status: PASS** — All API keys loaded from `EXPO_PUBLIC_*` env vars with empty fallbacks
- **No hardcoded secrets** found in source code
- **SecureStore** used in 14 files (90 references) for wallet data, tokens, region config
- **.gitignore** updated to cover `server/.env`, `app/.env`, `app/.env.local`

### 4. XSS / Injection
- **Status: PASS** — No `dangerouslySetInnerHTML`, `eval()`, `innerHTML`, or `window.open` found
- React Native doesn't have a DOM — XSS surface is minimal by architecture

### 5. Input Validation
- **Node.js:** Wallet signature verification via `nacl.sign.detached.verify` before any write operation
- **Node.js:** Auth message expires after 60 seconds (replay protection)
- **Python:** Wallet address validated (length >= 32 chars) via `get_wallet()` dependency
- **JSON body limit:** Set to 1MB on Node.js (`express.json({ limit: '1mb' })`)
- **File uploads:** Stored in `/tmp/ilowa-uploads/` with multer, cleaned after processing

### 6. Privacy Architecture
- **Nillion:** Private bet amounts, points breakdowns stored in blind vault
- **Arcium MXE:** Stubbed for Expo Go, ready for production MPC encryption
- **Light Protocol:** Compressed/shielded transactions for private market operations
- **On-device AI:** Elder wisdom via local Qwen3, voice via Gladia/Vosk — no server round-trip for sensitive queries
- **Federated Learning:** Model updates only, raw data never leaves device

### 7. Solana Security
- **Program ID:** `HYDwFwax9U6svCRYWD7Fqq3TXxSSQCQ6CwKrb3ZTkD3z`
- **PDA derivation:** Uses `PublicKey.findProgramAddressSync` (fixed from buggy custom implementation)
- **Transaction approval:** AI-powered transaction analysis before signing (`transaction-approval.ts`)
- **Elder Guardian:** On-chain recovery mechanism with time-delay and social recovery

### 8. Network Security
- **Metro:** Runs on port 80, LAN only — no public exposure
- **VPS script:** Includes UFW firewall, fail2ban, certbot TLS setup
- **Docker:** Services isolated, health checks configured

---

### 9. Deep Audit — Feb 27, 2026

- **TypeScript:** 0 errors across 139 source files (`npx tsc --noEmit` clean)
- **Hardcoded secrets:** None found — all keys via `EXPO_PUBLIC_*` env vars
- **Bearer tokens:** No raw tokens in source
- **`.gitignore`:** Hardened — now covers `node_modules/`, `.expo/`, build artifacts, `target/`, APK/AAB/IPA
- **Dead code:** `lib/solana/program.ts` (replaced by market-reader/writer), `AudioVisualizer3D.tsx` (unused) — harmless, left in place
- **XMTP type fix:** `privateKeyOverride` cast to `any` (valid runtime SDK option, missing from type defs)

---

## Recommendations for Production

1. **Set `ALLOWED_ORIGINS`** to actual domain(s) before mainnet deploy
2. **Move to Redis rate limiter** if scaling beyond single VPS
3. **Add Sentry or similar** for runtime error monitoring
4. **Enable CSP headers** on the Node.js server for any web views
5. **Rotate API keys** quarterly, monitor usage dashboards
6. **Supabase RLS** — ensure row-level security policies are enabled on all tables
7. **Remove dead code** (`program.ts`, `AudioVisualizer3D.tsx`) before production builds
8. **Pin dependency versions** in `package.json` to avoid supply chain drift
