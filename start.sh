#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "  Text to Speech — starting services"
echo ""

# ── Backend ───────────────────────────────────────────────────────────────────
cd "$ROOT/backend"

if [ ! -d .venv ]; then
  echo "  [backend] ERROR: .venv not found."
  echo "            Create it with Python 3.9–3.11 and install dependencies:"
  echo "            python3.11 -m venv .venv"
  echo "            .venv/bin/pip install -r requirements.txt"
  exit 1
fi

# Sync deps only if requirements.txt is newer than the last install marker
if [ "$ROOT/backend/requirements.txt" -nt "$ROOT/backend/.venv/.last_install" ]; then
  echo "  [backend] requirements.txt changed — syncing dependencies…"
  .venv/bin/pip install -q -r requirements.txt
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
echo "  [frontend] Starting Next.js on :3000"
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
