#!/usr/bin/env bash
# One-time environment setup: npm deps, Playwright Chromium, .auth/ directory.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"
npm install
# Prefer real user cache; avoid Cursor sandbox browser path.
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/Library/Caches/ms-playwright}"
if [[ "$(uname -m)" == "arm64" ]]; then
  export PLAYWRIGHT_HOST_PLATFORM_OVERRIDE="${PLAYWRIGHT_HOST_PLATFORM_OVERRIDE:-mac15-arm64}"
fi
npx playwright install chromium
mkdir -p .auth data \
  .cursor/skills/application-filler/references/documents
RESUME_PDF=".cursor/skills/application-filler/references/documents/resume.pdf"
if [[ ! -f "$RESUME_PDF" ]]; then
  echo "WARNING: missing $RESUME_PDF — copy your resume there as resume.pdf before fill:application"
fi
echo "Setup complete."
echo "  Auth:    npm run auth:wobo && npm run auth:handshake && npm run auth:jackjill"
echo "  Verify:  npm run test:access"
echo "  Source:  npm run source:all:parallel"
echo "  Resume:  $RESUME_PDF"
echo "  Browsers: $PLAYWRIGHT_BROWSERS_PATH"
