#!/usr/bin/env bash
set -Eeuo pipefail

REL="${REL:-$(cd "$(dirname "$0")/.." && pwd)}"
export REL
export LOG_TAG=rollback
. "$REL/scripts/lib.sh"

exec 9>"$STATE_DIR/deploy.lock"
flock -n 9 || die "another deploy is running"

PREVIOUS_TAG="" PREVIOUS_VERSION="" CURRENT_TAG="" CURRENT_VERSION=""
read_state "$STATE_DIR/previous.env"
read_state "$STATE_DIR/current.env"
[ -n "$PREVIOUS_TAG" ] || die "no previous release to roll back to"

export APP_TAG="$PREVIOUS_TAG" APP_VERSION="$PREVIOUS_VERSION"
compose up --detach --remove-orphans --wait --wait-timeout 120
"$REL/scripts/smoke.sh" "http://127.0.0.1:$APP_PORT" "$APP_VERSION"

printf 'PREVIOUS_TAG=%s\nPREVIOUS_VERSION=%s\n' "$CURRENT_TAG" "$CURRENT_VERSION" >"$STATE_DIR/previous.env"
printf 'CURRENT_TAG=%s\nCURRENT_VERSION=%s\nCURRENT_RELEASE=rollback\nCURRENT_DEPLOYED_AT=%s\n' \
  "$APP_TAG" "$APP_VERSION" "$(date -u +%FT%TZ)" >"$STATE_DIR/current.env"
printf '{"ts":"%s","result":"rollback","tag":"%s","version":"%s","actor":"%s"}\n' \
  "$(date -u +%FT%TZ)" "$APP_TAG" "$APP_VERSION" "${DEPLOY_ACTOR:-unknown}" >>"$STATE_DIR/history.jsonl"
log "rolled back to $APP_VERSION ($APP_TAG)"
