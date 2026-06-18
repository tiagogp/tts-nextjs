#!/usr/bin/env bash
# Builds the native macOS app: production Next build + Electron package + a
# valid ad-hoc code signature (required by Electron's asar-integrity fuse —
# without it the .app launches and silently exits).
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP="dist/mac-arm64/PhraseLoop.app"

echo "→ Building Next.js (production)…"
npm run build

echo "→ Packaging Electron app…"
rm -rf dist
./node_modules/.bin/electron-builder --mac dir

echo "→ Ad-hoc signing…"
codesign --remove-signature "$APP" 2>/dev/null || true
codesign --force --deep --sign - "$APP"
codesign --verify --deep --strict "$APP"

echo ""
echo "✓ Done: $ROOT/$APP"
echo "  Drag it to /Applications, or run:  open \"$APP\""
