#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo ""
echo "  PhraseLoop - Electron"
echo ""

if [ ! -d node_modules ]; then
  echo "  [setup] node_modules not found."
  echo "          Run: npm install"
  exit 1
fi

echo "  [app] Opening Electron window..."
echo "        The launcher will start the native-capable frontend on :3000."
echo ""

export TTS_PROJECT_ROOT="$ROOT"
unset ELECTRON_RUN_AS_NODE
exec npm run app
