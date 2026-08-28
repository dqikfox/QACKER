#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# QACKER — WSL / Linux startup script
# Run from WSL or any Linux shell:  bash start-qacker.sh
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Optional env overrides ──────────────────────────────────────
export PORT="${PORT:-3000}"
export HOST="${HOST:-127.0.0.1}"
# Running natively in WSL/Linux — no WSL wrapper needed
export USE_WSL="${USE_WSL:-false}"
export TOOL_TIMEOUT_MS="${TOOL_TIMEOUT_MS:-600000}"
export SECLISTS_PATH="${SECLISTS_PATH:-/usr/share/seclists}"

# ── Check node ──────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "[ERROR] node not found. Install Node.js first."
  exit 1
fi

# ── Install deps ────────────────────────────────────────────────
if [[ ! -d node_modules ]]; then
  echo "[QACKER] Installing dependencies..."
  npm install
fi

# ── Start ───────────────────────────────────────────────────────
echo ""
echo "  Starting QACKER (native Linux/WSL mode)..."
echo "  USE_WSL=false — tools run directly, no wrapper"
echo "  Press Ctrl+C to stop."
echo ""
exec node server/index.js
