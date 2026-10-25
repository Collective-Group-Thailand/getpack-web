#!/usr/bin/env bash
# Setup script for a Claude Code cloud environment (paste into the environment's setup script,
# or run `bash scripts/cloud-setup.sh` from the repo root).
#
# - Node: package.json `engines` and .nvmrc ask for 24; the image ships 22 on PATH and nvm at
#   /opt/nvm, so install 24 through nvm and put it first on PATH.
# - pnpm: the version pinned in `packageManager`, through corepack.
# - Playwright: the image's Chromium lives at /opt/pw-browsers (PLAYWRIGHT_BROWSERS_PATH) and
#   matches the repo's @playwright/test, so no `playwright install` — a second download would
#   only waste disk.
set -euo pipefail

cd "$(dirname "$0")/.."

export NVM_DIR="${NVM_DIR:-/opt/nvm}"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
nvm install "$(cat .nvmrc)"
nvm alias default "$(cat .nvmrc)"
NODE_BIN="$(dirname "$(nvm which "$(cat .nvmrc)")")"
export PATH="$NODE_BIN:$PATH"

# Later shells in the session (the agent's Bash tool) start from the profile, not this script.
PROFILE_LINE="export PATH=\"$NODE_BIN:\$PATH\""
grep -qxF "$PROFILE_LINE" "$HOME/.bashrc" 2>/dev/null || echo "$PROFILE_LINE" >>"$HOME/.bashrc"

corepack enable
corepack prepare "$(node -p 'require("./package.json").packageManager')" --activate

pnpm install --frozen-lockfile

# Local env for the session: copy the safe template unless one already exists.
[ -f .env.local ] || cp .env.cloud.example .env.local

node -v
pnpm -v
