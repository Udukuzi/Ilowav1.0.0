# Ilowa Radio Setup Guide

## Overview

Ilowa Radio uses a decentralized Web3 stack:
- **Livepeer** - Live streaming (when DJ is on air)
- **IPFS/Pinata** - Music storage (playlist rotation)
- **Arweave** - Permanent storage (podcasts, Voice NFTs)

## Architecture

```
DJ's Computer (OBS Studio)
    ↓ RTMP
Livepeer Network (70K+ nodes)
    ↓ HLS
App (react-native-track-player)
```

When DJ is offline:
```
IPFS Playlist (Pinata)
    ↓ HTTP
App (seamless playback)
```

---

## Step 1: Livepeer Setup

### Create Account
1. Go to https://livepeer.studio/
2. Sign up with email
3. Navigate to **API Keys** → Create new key
4. Copy key to `.env`:
   ```
   LIVEPEER_API_KEY=your-key-here
   ```

### Create Streams
1. Go to **Streams** → Create Stream
2. Name: `ilowa-west-africa`
3. Copy the **Stream ID** and **Stream Key**
4. Add to `.env`:
   ```
   LIVEPEER_WEST_AFRICA_STREAM_ID=abc123...
   ```

### Cost
- $0.015 per minute of transcoding
- 12 hours/day = $10.80/day = ~$324/month per station

---

## Step 2: DJ Setup (OBS Studio)

### Install OBS
1. Download from https://obsproject.com
2. Install on Mac/Windows/Linux

### Configure Audio
1. Open OBS
2. **Sources** → **+** → **Audio Input Capture**
3. Select microphone/headset
4. Test: speak and watch levels

### Configure Stream
1. **Settings** → **Stream**
2. Service: **Custom**
3. Server: `rtmp://rtmp.livepeer.com/live`
4. Stream Key: (from Livepeer dashboard)

### Go Live
1. Click **Start Streaming**
2. App automatically detects and switches to live
3. Click **Stop Streaming** when done

### Add Background Music
1. **Sources** → **+** → **Media Source**
2. Select local MP3 file
3. Set volume to 30% (background)
4. Enable **Loop**

---

## Step 3: IPFS/Pinata Setup

### Create Account
1. Go to https://www.pinata.cloud/
2. Sign up (free tier: 1GB)
3. Navigate to **API Keys** → Create new key
4. Copy to `.env`:
   ```
   PINATA_API_KEY=your-key
   PINATA_SECRET_KEY=your-secret
   ```

### Upload Music
```bash
curl -X POST https://api.pinata.cloud/pinning/pinFileToIPFS \
  -H "pinata_api_key: YOUR_KEY" \
  -H "pinata_secret_api_key: YOUR_SECRET" \
  -F file=@song.mp3
```

Response:
```json
{ "IpfsHash": "QmXyz..." }
```

Playback URL: `https://gateway.pinata.cloud/ipfs/QmXyz...`

### Cost
- Free tier: 1GB
- Paid: $0.15/GB/month

---

## Step 4: Arweave Setup (Permanent Storage)

### Create Wallet
1. Go to https://arweave.app
2. Create new wallet
3. Fund with AR tokens (buy on exchanges)

### Export Wallet
1. Settings → Export Wallet
2. Download JWK file
3. Add to `.env` as single line:
   ```
   ARWEAVE_WALLET_JWK={"kty":"RSA",...}
   ```

### Cost
- $8 per GB (one-time, permanent)
- Use for: podcasts, Voice NFTs, archives

---

## Step 5: Automation Bot

The automation bot runs every 5 minutes on Vercel:

```typescript
// vercel.json
{
  "crons": [{
    "path": "/api/cron/radio-automation",
    "schedule": "*/5 * * * *"
  }]
}
```

### What it does:
1. Check if DJ is live (Livepeer API)
2. If live → do nothing (DJ controls stream)
3. If offline → play next IPFS track
4. Update database with current stream URL

---

## Step 6: Deploy API to Vercel

```bash
cd api
npm install
vercel deploy
```

Add environment variables in Vercel dashboard.

---

## Testing Checklist

- [ ] Livepeer stream created
- [ ] DJ can stream via OBS
- [ ] App detects live/offline status
- [ ] IPFS tracks play when DJ offline
- [ ] Call-in audio uploads to IPFS
- [ ] Automation bot rotates playlist

---

## Troubleshooting

### Stream not showing as live
- Check Livepeer dashboard for stream status
- Verify stream ID in environment variables
- Check OBS is connected (green icon)

### Audio not playing
- Verify stream URL is valid
- Check CORS headers on Pinata gateway
- Test URL in browser first

### Call-in upload fails
- Check Pinata API keys
- Verify file size < 100MB
- Check network connectivity
