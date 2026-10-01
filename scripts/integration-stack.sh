#!/usr/bin/env bash
# The local packio-api that `pnpm e2e:integration` runs against (U1 U-F0.5, docs/integration.md).
#
#   scripts/integration-stack.sh up      worktree at the lock's tag, .env, database, migrate, dev seed, API + worker,
#                                        and the catalogue prepared for the launch path (scripts/integration-prepare.ts)
#   scripts/integration-stack.sh reset   drop and re-seed the database, restart API + worker (a clean run)
#   scripts/integration-stack.sh down    stop API + worker (the database and the worktree stay)
#   scripts/integration-stack.sh status
#
# Isolated from a developer's own packio-api: its own worktree (detached at the tag
# `contract.lock.json` pins), port, database, Redis db index and bucket, so the API and worker it
# starts never share data or queues with another API on this machine. It needs packio-api's
# `docker compose up -d` infrastructure (Postgres, Redis, LocalStack, Mailpit) to be running.
#
# Environment: PACKIO_API_REPO (packio-api checkout, default ../packio-api), PACKIO_API_IT_DIR
# (worktree, default ../packio-api-it), IT_API_PORT (3400), IT_DB (packio_it_web), IT_REDIS_DB (5),
# IT_BUCKET (packio-it-web), IT_SEED_PASSWORD (packio-it-password — what the staff tests sign in with).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="${PACKIO_API_REPO:-$ROOT/../packio-api}"
DIR="${PACKIO_API_IT_DIR:-$ROOT/../packio-api-it}"
[ -d "$DIR" ] && DIR="$(cd "$DIR" && pwd)"
PORT="${IT_API_PORT:-3400}"
DB="${IT_DB:-packio_it_web}"
REDIS_DB="${IT_REDIS_DB:-5}"
BUCKET="${IT_BUCKET:-packio-it-web}"
PASSWORD="${IT_SEED_PASSWORD:-packio-it-password}"
TAG="$(node -p "require('$ROOT/contract.lock.json').tag")"
PG_CONTAINER="${IT_PG_CONTAINER:-packio-api-postgres-1}"
S3_CONTAINER="${IT_S3_CONTAINER:-packio-api-localstack-1}"
LOGS="${IT_LOG_DIR:-${TMPDIR:-/tmp}}"

log() { printf '[integration-stack] %s\n' "$*"; }

pids() { pgrep -f "$DIR/dist/src/(main|worker).js" || true; }

stop() {
  local running
  running="$(pids)"
  if [ -n "$running" ]; then
    log "stopping API + worker ($running)"
    # shellcheck disable=SC2086
    kill $running
  fi
}

worktree() {
  if [ ! -d "$DIR" ]; then
    log "worktree $DIR at $TAG"
    git -C "$REPO" worktree add --detach "$DIR" "$TAG"
  elif [ "$(git -C "$DIR" rev-parse HEAD)" != "$(git -C "$REPO" rev-parse "$TAG^{commit}")" ]; then
    log "moving $DIR to $TAG"
    git -C "$DIR" checkout --detach "$TAG"
  fi
  (cd "$DIR" && pnpm install --frozen-lockfile --prefer-offline >/dev/null)
}

env_file() {
  # Every value the stack isolates, over packio-api's own .env.example (fake integrations).
  node - "$DIR" "$PORT" "$DB" "$REDIS_DB" "$BUCKET" "$PASSWORD" <<'EOF'
const [dir, port, db, redisDb, bucket, password] = process.argv.slice(2);
const fs = require("node:fs");
const values = {
  NODE_ENV: "development",
  INTEGRATIONS_MODE: "fake",
  PORT: port,
  LOG_PRETTY: "false",
  DATABASE_URL: `postgresql://packio:packio@localhost:5432/${db}`,
  SHADOW_DATABASE_URL: `postgresql://packio:packio@localhost:5432/${db}_shadow`,
  REDIS_URL: `redis://localhost:6379/${redisDb}`,
  S3_BUCKET: bucket,
  DEV_SEED_PASSWORD: password,
  PUBLIC_API_BASE_URL: `http://localhost:${port}`,
  // The whole suite signs in from one address; the defaults (10 sign-ins, 300 requests a minute
  // per IP) are production's and would throttle it. The throttles themselves are packio-api's tests.
  AUTH_LOGIN_THROTTLE_LIMIT: "10000",
  THROTTLE_LIMIT: "100000",
};
const seen = new Set();
const lines = fs.readFileSync(`${dir}/.env.example`, "utf8").split("\n").map((line) => {
  const key = line.split("=", 1)[0];
  if (line.startsWith("#") || !(key in values)) return line;
  seen.add(key);
  return `${key}=${values[key]}`;
});
for (const key of Object.keys(values)) if (!seen.has(key)) lines.push(`${key}=${values[key]}`);
fs.writeFileSync(`${dir}/.env`, `# packio-web e2e:integration stack — written by scripts/integration-stack.sh\n${lines.join("\n")}`);
EOF
}

database() {
  local exists
  exists="$(docker exec "$PG_CONTAINER" psql -U packio -d postgres -Atc "select 1 from pg_database where datname = '$DB'")"
  if [ "$1" = "fresh" ] && [ -n "$exists" ]; then
    log "dropping $DB"
    docker exec "$PG_CONTAINER" psql -U packio -d postgres -qc "drop database \"$DB\" with (force)"
    exists=""
  fi
  [ -n "$exists" ] || docker exec "$PG_CONTAINER" psql -U packio -d postgres -qc "create database \"$DB\""
  docker exec "$PG_CONTAINER" psql -U packio -d postgres -Atc "select 1 from pg_database where datname = '${DB}_shadow'" | grep -q 1 ||
    docker exec "$PG_CONTAINER" psql -U packio -d postgres -qc "create database \"${DB}_shadow\""
  docker exec "$S3_CONTAINER" awslocal s3 mb "s3://$BUCKET" >/dev/null 2>&1 || true
  (cd "$DIR" && pnpm -s db:migrate >/dev/null && pnpm -s db:seed:dev | tail -1)
}

start() {
  stop
  log "starting API on :$PORT and the worker (logs in $LOGS/packio-api-it-*.log)"
  (cd "$DIR" && nohup node "$DIR/dist/src/main.js" >"$LOGS/packio-api-it-api.log" 2>&1 &)
  (cd "$DIR" && nohup node "$DIR/dist/src/worker.js" >"$LOGS/packio-api-it-worker.log" 2>&1 &)
  for _ in $(seq 1 90); do
    if curl -s -m 2 "http://localhost:$PORT/health" | grep -q '"status":"ok"'; then
      log "API healthy at http://localhost:$PORT ($TAG)"
      (cd "$ROOT" && INTEGRATION_API_URL="http://localhost:$PORT" IT_SEED_PASSWORD="$PASSWORD" pnpm -s exec tsx scripts/integration-prepare.ts)
      return 0
    fi
    sleep 2
  done
  log "API did not become healthy; see $LOGS/packio-api-it-api.log"
  exit 1
}

case "${1:-status}" in
  up)
    worktree
    env_file
    database keep
    start
    ;;
  reset)
    env_file
    stop
    database fresh
    start
    ;;
  down) stop ;;
  status)
    log "tag $TAG · worktree $DIR · port $PORT · db $DB · redis db $REDIS_DB · bucket $BUCKET"
    log "processes: $(pids | tr '\n' ' ')"
    curl -s -m 2 "http://localhost:$PORT/health" || log "API not answering on :$PORT"
    echo
    ;;
  *)
    echo "usage: $0 up|reset|down|status" >&2
    exit 2
    ;;
esac
