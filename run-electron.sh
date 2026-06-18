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

if [ ! -x backend/.venv/bin/python ]; then
  echo "  [backend] Python virtualenv not found."
  echo "            Run:"
  echo "              cd backend"
  echo "              python3.11 -m venv .venv"
  echo "              .venv/bin/pip install -r requirements.txt"
  exit 1
fi

if [ ! -x backend/.venv/bin/uvicorn ]; then
  echo "  [backend] uvicorn not found in backend/.venv."
  echo "            Run: backend/.venv/bin/pip install -r backend/requirements.txt"
  exit 1
fi

echo "  [app] Opening Electron window..."
echo "        The launcher will start backend :5002 and frontend :3000."
echo ""

export TTS_PROJECT_ROOT="$ROOT"
exec npm run app
