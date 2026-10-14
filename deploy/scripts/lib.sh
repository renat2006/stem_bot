#!/usr/bin/env bash
set -Eeuo pipefail

BASE=/srv/stem-bot
STATE_DIR="$BASE/state"
SHARED_DIR="$BASE/shared"
RENDERED_DIR="$BASE/rendered"
APP_IMAGE="${APP_IMAGE:-ghcr.io/renat2006/stem-bot}"
APP_PORT="${APP_PORT:-18200}"
export BASE STATE_DIR SHARED_DIR RENDERED_DIR APP_IMAGE APP_PORT

log() { printf '%s [%s] %s\n' "$(date -u +%FT%TZ)" "${LOG_TAG:-stem-bot}" "$*" | tee -a "$STATE_DIR/deploy.log" >&2; }
die() { log "ERROR: $*"; exit 1; }
need() { local name; for name in "$@"; do [ -n "${!name:-}" ] || die "$name is required"; done; }

compose() { BASE="$BASE" docker compose --project-directory "$REL" -f "$REL/compose.yml" "$@"; }

read_state() {
  local file="$1" key value
  [ -f "$file" ] || return 0
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^[A-Z_]+$ ]] && printf -v "$key" '%s' "$value"
  done <"$file"
}

runtime_value() { grep -E "^$1=" "$SHARED_DIR/runtime.env" 2>/dev/null | tail -1 | cut -d= -f2-; }
