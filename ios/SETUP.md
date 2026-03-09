# iOS Build Setup for TestFlight

This project uses **Xcode Cloud** (included with Apple Developer Program) for building iOS apps without needing Xcode installed locally.

## Prerequisites

1. Apple Developer Program membership ($99/year)
2. GitHub repository

## Setup Steps

### 1. Configure App Store Connect API Key

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Go to Users and Access > Keys
3. Create a new API Key with "App Manager" access
4. Note the **Issuer ID** and **Key ID**
5. Download the private key (.p8 file)

### 2. Add Secrets to GitHub

Add these repository secrets (Settings > Secrets and variables > Actions):

| Secret | Value |
|--------|-------|
| `APP_STORE_CONNECT_ISSUER_ID` | From step 1 (e.g., `abc123-defg-...)` |
| `APP_STORE_CONNECT_API_KEY_ID` | From step 1 (e.g., `D4HK45J2K2`) |
| `APP_STORE_CONNECT_API_KEY_PRIVATE_KEY` | The full content of the .p8 file |
| `IOS_TEAM_ID` | Your Apple Team ID (found in Apple Developer account) |

### 3. Trigger a Build

Run the workflow:
```bash
# Option 1: Push to main branch (auto-builds)
git push origin main

# Option 2: Manual trigger
gh workflow run ios-xcodecloud.yml
```

### 4. View Build Progress

1. Go to App Store Connect > Builds
2. Or check GitHub Actions tab

### 5. Submit to TestFlight

Once the build is complete:
1. Go to App Store Connect > TestFlight
2. Find your build under "Builds"
3. Submit for review

## Manual Build (Alternative)

If you have access to a Mac:

```bash
# Install dependencies
pnpm install

# Build web app
pnpm build

# Sync Capacitor
pnpm cap sync ios

# Open in Xcode
open ios/App.xcworkspace
```

Then in Xcode:
1. Select your team in Signing & Capabilities
2. Product > Archive
3. Distribute to TestFlight

## Troubleshooting

### Build Fails with "No Scheme"
Make sure the workspace contains a shared scheme. In Xcode:
1. File > Workspace Settings
2. Click "Shared Settings"
3. Check "Schemes are shared"

### Pod Install Fails
Make sure CocoaPods is installed:
```bash
sudo gem install cocoapods
```
