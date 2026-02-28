# Ilowa Build Setup

Complete guide to building Ilowa for Android and iOS.

---

## Quick Start (EAS Cloud Builds)

EAS builds in the cloud - no local Android SDK or Xcode required.

### 1. Login to EAS

```bash
cd app

# Login (creates free Expo account if needed)
npx eas-cli login
```

### 2. Configure Project

```bash
# Initialize EAS project (one-time)
npx eas-cli build:configure
```

This will prompt you to create or link an Expo project and add a `projectId` to your `app.json`.

### 3. Build Development Client

**Android APK (for testing):**
```bash
npx eas-cli build --profile development --platform android
```

**iOS Simulator (for Mac testing):**
```bash
npx eas-cli build --profile development --platform ios
```

**iOS Device (requires Apple Developer $99/year):**
```bash
npx eas-cli build --profile development-device --platform ios
```

### 4. Install and Run

After build completes, EAS provides a download link or QR code.

**Android:** Download APK → Install → Open
**iOS Simulator:** Download → Drag to simulator
**iOS Device:** Install via TestFlight or ad-hoc

Then start the dev server:
```bash
npx expo start --dev-client
```

---

## Local Builds (Optional)

For faster iteration, you can build locally.

### Android SDK Setup

**Ubuntu/Debian:**
```bash
# Install Java 17
sudo apt install openjdk-17-jdk

# Install Android command-line tools
mkdir -p ~/Android/Sdk/cmdline-tools
cd ~/Android/Sdk/cmdline-tools
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip commandlinetools-linux-*.zip
mv cmdline-tools latest

# Set environment variables (add to ~/.bashrc)
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Install SDK components
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

# Accept licenses
sdkmanager --licenses
```

**macOS:**
```bash
# Install via Homebrew
brew install --cask android-commandlinetools

# Set environment (add to ~/.zshrc)
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Install SDK components
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
sdkmanager --licenses
```

**Local Android Build:**
```bash
cd app

# Generate native project
npx expo prebuild --platform android

# Build APK
cd android && ./gradlew assembleDebug

# APK location: android/app/build/outputs/apk/debug/app-debug.apk
```

### iOS Local Build (Mac only)

```bash
# Install Xcode from App Store
# Open Xcode and install command-line tools

cd app

# Generate native project
npx expo prebuild --platform ios

# Open in Xcode
open ios/Ilowa.xcworkspace

# Build in Xcode (⌘+R) or:
cd ios && xcodebuild -workspace Ilowa.xcworkspace -scheme Ilowa -configuration Debug -sdk iphonesimulator
```

---

## Environment Variables

Create `app/.env`:

```bash
cp .env.example .env
# Then fill in your API keys — see app/.env.example for the full list
```

---

## Build Profiles

| Profile | Platform | Output | Use Case |
|---------|----------|--------|----------|
| `development` | Android | APK | Testing on device |
| `development` | iOS | Simulator build | Testing on Mac |
| `development-device` | iOS | Device build | Testing on iPhone |
| `preview` | Both | Internal distribution | Beta testing |
| `production` | Both | Store-ready | App Store/Play Store |

---

## Troubleshooting

### "SDK location not found"
```bash
# Create local.properties in android folder
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
```

### "Could not find tools.jar"
```bash
# Ensure JAVA_HOME is set
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
```

### iOS "No team selected"
1. Open `ios/Ilowa.xcworkspace` in Xcode
2. Select project → Signing & Capabilities
3. Select your development team

### "expo-dev-client not found"
```bash
npx expo install expo-dev-client
npx expo prebuild --clean
```

### Metro bundler issues
```bash
# Clear cache
npx expo start --clear
```

---

## Deployment

### Google Play Store

1. Build production AAB:
   ```bash
   npx eas-cli build --profile production --platform android
   ```

2. Download `.aab` file from EAS

3. Upload to Google Play Console → Internal testing

### Apple App Store

1. Build production IPA:
   ```bash
   npx eas-cli build --profile production --platform ios
   ```

2. Submit via EAS:
   ```bash
   npx eas-cli submit --platform ios
   ```

3. Or upload manually via Transporter app

---

## Native Module Support

The development client includes native modules for:

- **Solana Mobile Wallet Adapter** - Connect to Phantom, Solflare
- **expo-av** - Audio recording and playback
- **expo-local-authentication** - Biometric auth
- **expo-secure-store** - Encrypted storage

These don't work in Expo Go - you need the dev client build.
