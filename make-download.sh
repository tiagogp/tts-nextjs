#!/usr/bin/env bash
# Builds the macOS app and wraps it in a drag-to-Applications disk image.
# Output: dist/PhraseLoop-mac-<arch>.dmg
#
# The app is ad-hoc signed (no Apple Developer ID / notarization). On first
# launch macOS Gatekeeper would otherwise block the embedded Next runtime and
# signed native addons because of the download quarantine,
# making the window load forever. The app now clears its own quarantine at boot
# (see electron/main.js), so no install script — and no Terminal window — is
# needed: the user just drags the app to Applications and opens it once.
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# Mirror the arch-derived output dir used by electron/build-app.sh.
ARCH_DIR="mac-arm64"
[ "$(uname -m)" = "x86_64" ] && ARCH_DIR="mac"
APP="dist/$ARCH_DIR/PhraseLoop.app"
DMG="dist/PhraseLoop-$ARCH_DIR.dmg"

# Build the signed .app (Next + native addons + Electron).
./electron/build-app.sh

if [ ! -d "$APP" ]; then
  echo "✗ Build did not produce $APP"
  exit 1
fi

echo "→ Building disk image…"
# --prepackaged builds the DMG from the already post-processed & signed .app
# (electron-builder's own `dmg` target would package an un-finished bundle).
rm -f "$DMG"
./node_modules/.bin/electron-builder --mac dmg --prepackaged "$APP"

# electron-builder names the dmg from productName + version; normalize to the
# arch-tagged name the rest of the tooling/docs expect.
PRODUCED_DMG="$(ls -t dist/*.dmg 2>/dev/null | head -1)"
if [ -z "$PRODUCED_DMG" ]; then
  echo "✗ Disk image was not produced"
  exit 1
fi
if [ "$PRODUCED_DMG" != "$DMG" ]; then
  mv "$PRODUCED_DMG" "$DMG"
fi

DMG_BYTES="$(stat -f%z "$DMG")"
MAX_DMG_BYTES=$((400 * 1024 * 1024))
if [ "$DMG_BYTES" -gt "$MAX_DMG_BYTES" ]; then
  echo "✗ DMG exceeds the 400 MiB size budget: $(du -h "$DMG" | awk '{print $1}')"
  exit 1
fi

# The .app and electron-builder metadata are only intermediate artifacts. Keep
# the download directory clean so this command leaves exactly one deliverable.
find dist -mindepth 1 -maxdepth 1 ! -name "$(basename "$DMG")" -exec rm -rf {} +

echo ""
echo "✓ Done: $ROOT/$DMG"
echo "  Size: $(du -h "$DMG" | awk '{print $1}')"
echo "  Share this file. The user opens the .dmg, drags PhraseLoop to Applications,"
echo "  and opens it once (right-click → Open the first time)."
