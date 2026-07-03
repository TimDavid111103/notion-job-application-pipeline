#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"
npm install
npx playwright install chromium
mkdir -p .auth
echo "Setup complete."
echo "  Auth:    npm run auth:wobo && npm run auth:handshake && npm run auth:jackjill"
echo "  Verify:  npm run test:access"
echo "  Source:  npm run source:all:parallel"
