#!/usr/bin/env bash
# Setup script for a Claude Code cloud environment (paste into the environment's setup script,
# or run `bash scripts/cloud-setup.sh` from the repo root).
#
# - Node: package.json `engines` and .nvmrc ask for 24; the image ships 22, with nvm at /opt/nvm.
#   Install 24 through nvm, make it the default and link node/npm/npx into /usr/local/bin so
#   non-interactive shells get it too (they do not read ~/.bashrc).
# - pnpm: the version pinned in `packageManager`, through `npm install -g` (not corepack, which
#   failed on this VM), linked into /usr/local/bin with the rest.
# - Playwright: the image's Chromium lives at /opt/pw-browsers (PLAYWRIGHT_BROWSERS_PATH) and
#   matches the repo's @playwright/test, so no `playwright install` — a second download would
#   only waste disk.
# - NODE_OPTIONS (--max-old-space-size=4096 for typecheck/build) comes from the environment's
#   variables, not from here.
set -euo pipefail

cd "$(dirname "$0")/.."

export NVM_DIR="${NVM_DIR:-/opt/nvm}"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
nvm install 24
nvm alias default 24
nvm use 24
NODE_BIN="$(dirname "$(nvm which 24)")"

PNPM_VERSION="$(node -p 'require("./package.json").packageManager.split("@")[1]')"
# A corepack shim left from an earlier setup blocks `npm install -g` with EEXIST.
for shim in pnpm pnpx; do
  [ -L "$NODE_BIN/$shim" ] && readlink "$NODE_BIN/$shim" | grep -q corepack && rm -f "$NODE_BIN/$shim"
done
npm install -g "pnpm@$PNPM_VERSION"

for bin in node npm npx pnpm pnpx; do
  [ -e "$NODE_BIN/$bin" ] && ln -sf "$NODE_BIN/$bin" "/usr/local/bin/$bin"
done

# The image puts /opt/node22/bin ahead of /usr/local/bin on PATH, so point its Node tools at
# Node 24 as well. The originals are kept once in .orig-node22/ (symlinks saved with their
# resolved target, since theirs are relative); links already on Node 24 are left alone.
NODE22_BIN=/opt/node22/bin
if [ -d "$NODE22_BIN" ]; then
  BACKUP="$NODE22_BIN/.orig-node22"
  mkdir -p "$BACKUP"
  for bin in node npm npx corepack pnpm pnpx; do
    target="$NODE_BIN/$bin"
    current="$NODE22_BIN/$bin"
    [ -e "$target" ] || continue
    [ "$(readlink -f "$current" 2>/dev/null)" = "$(readlink -f "$target")" ] && continue
    if [ -e "$current" ] && [ ! -e "$BACKUP/$bin" ] && [ ! -L "$BACKUP/$bin" ]; then
      if [ -L "$current" ]; then
        ln -s "$(readlink -f "$current")" "$BACKUP/$bin"
      else
        cp -p "$current" "$BACKUP/$bin"
      fi
    fi
    ln -sfn "$target" "$current"
  done
fi

pnpm install --frozen-lockfile

# Local env for the session: copy the safe template unless one already exists.
[ -f .env.local ] || cp .env.cloud.example .env.local

node -v
pnpm -v
