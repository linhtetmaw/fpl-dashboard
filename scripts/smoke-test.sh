#!/usr/bin/env bash
# Smoke test: does the committed app start and serve pages in a Railway-like container?
#
# Builds the COMMITTED tree (git HEAD, not uncommitted edits), then removes everything Railway's runtime
# container doesn't have (client/src, client/public, …: only server/ and client/dist remain), starts the server
# and checks the key pages. Exits non-zero with the server log if anything fails.
#
# Used by .githooks/pre-push (blocks the push) and .github/workflows/smoke-test.yml (blocks the deploy when
# Railway's "Wait for CI" is on). Run by hand: bash scripts/smoke-test.sh [git-ref, default HEAD]
set -euo pipefail

REPO="$(git rev-parse --show-toplevel)"
REF="${1:-HEAD}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/fpl-smoke.XXXXXX")"
PORT="${SMOKE_PORT:-39$((RANDOM % 900 + 100))}"
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT

fail() {
  echo "✗ Smoke test failed: $1" >&2
  if [ -f "$WORK/server.log" ]; then
    echo "--- server log (last 40 lines) ---" >&2
    tail -n 40 "$WORK/server.log" >&2
  fi
  exit 1
}

echo "▸ Smoke test: $(git -C "$REPO" log --oneline -1 "$REF")"

# 1. Exactly what's committed (what Railway will build).
APP="$WORK/app"
mkdir -p "$APP"
git -C "$REPO" archive "$REF" | tar -x -C "$APP"

# Reuse installed dependencies instead of reinstalling (CI installs them fresh before running this).
for d in client server; do
  [ -d "$REPO/$d/node_modules" ] || fail "$d/node_modules missing – run npm run install:all first"
  ln -s "$REPO/$d/node_modules" "$APP/$d/node_modules"
done

# 2. Build the client the same way Railway does.
(cd "$APP/client" && npm run build >"$WORK/build.log" 2>&1) || { tail -n 30 "$WORK/build.log" >&2; fail "client build"; }

# 3. Keep only what the runtime container has: the server and the built client.
find "$APP/client" -mindepth 1 -maxdepth 1 ! -name dist ! -name package.json -exec rm -rf {} +

# 4. Start the server like production does.
mkdir -p "$WORK/data"
(cd "$APP" && PORT="$PORT" DATA_DIR="$WORK/data" NODE_ENV=production node server/index.js >"$WORK/server.log" 2>&1) &
SERVER_PID=$!

for _ in $(seq 1 40); do
  if curl -fs -o /dev/null "http://localhost:$PORT/api/health"; then break; fi
  kill -0 "$SERVER_PID" 2>/dev/null || fail "server exited during startup"
  sleep 0.5
done
curl -fs -o /dev/null "http://localhost:$PORT/api/health" || fail "server did not answer /api/health within 20s"

# 5. Key pages.
check() {
  local path="$1" expect="$2" code
  code="$(curl -s -o "$WORK/page" -w '%{http_code}' "http://localhost:$PORT$path")"
  [ "$code" = "$expect" ] || fail "$path returned $code (expected $expect)"
}
check / 200
grep -q '<div id="root">' "$WORK/page" || fail "/ did not return the app page"
check /player-stats 200
grep -q '<title>FPL Player Stats' "$WORK/page" || fail "/player-stats has no page title (seo-routes.json not found?)"
check /squad-planner 200
check /sitemap.xml 200
check /this-page-does-not-exist 404

echo "✓ Smoke test passed (server started, pages and titles OK)"
