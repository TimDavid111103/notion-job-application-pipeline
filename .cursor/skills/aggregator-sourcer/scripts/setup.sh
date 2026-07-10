#!/usr/bin/env bash
# Skill wrapper — resolves repo root from .cursor/skills/aggregator-sourcer/ and runs scripts/setup.sh.
set -euo pipefail
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"
cd "$REPO_ROOT"
bash scripts/setup.sh
