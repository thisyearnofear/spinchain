#!/bin/sh
set -e

# Xcode Cloud post-clone script. Mirrors .github/workflows/prepare-ios.yml:
# the shell loads the deployed site (Capacitor remote-server mode) because
# Next.js cannot static-export the API routes, so no web bundle is built.

if [ -z "$CAPACITOR_SERVER_URL" ]; then
    echo "error: set CAPACITOR_SERVER_URL in the Xcode Cloud workflow environment (e.g. https://spinchain.vercel.app)."
    exit 1
fi
case "$CAPACITOR_SERVER_URL" in
    https://*) ;;
    *) echo "error: CAPACITOR_SERVER_URL must be an https:// origin, got: $CAPACITOR_SERVER_URL"; exit 1 ;;
esac

export HOMEBREW_NO_AUTO_UPDATE=1
export LANG=en_US.UTF-8
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

brew install node@22
export PATH="$(brew --prefix node@22)/bin:$PATH"
command -v pod >/dev/null 2>&1 || brew install cocoapods

cd "${CI_PRIMARY_REPOSITORY_PATH:-$(dirname "$0")/../../..}"

corepack enable
pnpm install --frozen-lockfile

# The Capacitor CLI still requires webDir to exist in remote-server mode.
mkdir -p out
printf '<!doctype html><meta charset="utf-8"><title>SpinChain</title>' > out/index.html

# Runs pod install for ios/App.
pnpm exec cap sync ios

echo "Post-clone setup complete!"
