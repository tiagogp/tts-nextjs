#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "  Text to Speech — starting services"
echo ""

# ── Backend ───────────────────────────────────────────────────────────────────
cd "$ROOT/backend"

# Find a suitable Python (prefer 3.11, accept 3.9–3.12)
PYTHON=""
for candidate in python3.11 python3.10 python3.9; do
  if command -v "$candidate" >/dev/null 2>&1; then
    if "$candidate" -c 'import sys; assert (3,9) <= sys.version_info < (3,12)' 2>/dev/null; then
      PYTHON="$candidate"
      break
    fi
  fi
done

if [ -z "$PYTHON" ]; then
  echo "  [backend] ERROR: no compatible Python (3.9–3.11) found."
  echo "            TTS requires Python <3.12. Install one and re-run:"
  echo "              sudo dnf install python3.11"
  exit 1
fi

if [ ! -d .venv ]; then
  echo "  [backend] Creating virtual environment with $($PYTHON --version)…"
  "$PYTHON" -m venv .venv
  echo "  [backend] Installing dependencies…"
  .venv/bin/pip install -r requirements.txt || { echo "  [backend] ERROR: pip install failed. See output above."; exit 1; }
  touch .venv/.last_install
fi

# Sync deps only if requirements.txt is newer than the last install marker
if [ "requirements.txt" -nt ".venv/.last_install" ]; then
  echo "  [backend] requirements.txt changed — syncing dependencies…"
  .venv/bin/pip install -r requirements.txt || { echo "  [backend] ERROR: pip install failed. See output above."; exit 1; }
  touch .venv/.last_install
fi

echo "  [backend] Starting TTS server on :5002 (VITS loads now; Kokoro load on first use)"
.venv/bin/uvicorn tts_server:app --port 5002 --log-level warning &
BACKEND_PID=$!

# Wait until the backend is accepting connections (up to 30 s)
echo "  [backend] Waiting for server to be ready…"
for i in $(seq 1 30); do
  if curl -sf http://localhost:5002/health >/dev/null 2>&1; then
    echo "  [backend] Ready ✓"
    break
  fi
  sleep 1
done

# ── Frontend ──────────────────────────────────────────────────────────────────
cd "$ROOT"

if [ ! -d node_modules ]; then
  echo "  [frontend] node_modules not found — running npm install…"
  npm install || { echo "  [frontend] ERROR: npm install failed."; exit 1; }
fi

echo "  [frontend] Starting Next.js on :3000"
export BACKEND_PYTHON="$ROOT/backend/.venv/bin/python"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  App:     http://localhost:3000"
echo "  Backend: http://localhost:5002/health"
echo "  Press Ctrl+C to stop both services."
echo ""

# Ctrl+C kills both
trap "echo ''; echo '  Stopping…'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" INT TERM
wait
