#!/bin/sh

# Xcode Cloud post-clone script
# This runs after Xcode Cloud clones the repository

# Install Node.js if not available
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# Install pnpm if not available
if ! command -v pnpm &> /dev/null; then
    echo "Installing pnpm..."
    npm install -g pnpm
fi

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Build Next.js app
echo "Building Next.js app..."
pnpm build

# Sync Capacitor
echo "Syncing Capacitor..."
pnpm exec cap sync ios

# Install CocoaPods dependencies
echo "Installing CocoaPods dependencies..."
cd ios/App
pod install

echo "Post-clone setup complete!"
