#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Backend
cd "$ROOT/backend"
.venv/bin/uvicorn tts_server:app --port 5002 &
BACKEND_PID=$!
echo "Backend running (PID $BACKEND_PID)"

# Frontend
cd "$ROOT"
npm run dev &
FRONTEND_PID=$!
echo "Frontend running (PID $FRONTEND_PID)"

# Ctrl+C kills both
trap "kill $BACKEND_PID $FRONTEND_PID" INT
wait
