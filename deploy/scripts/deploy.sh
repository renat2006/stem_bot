#!/usr/bin/env bash
set -Eeuo pipefail

REL="${REL:-$(cd "$(dirname "$0")/.." && pwd)}"
export REL
export LOG_TAG=deploy
. "$REL/scripts/lib.sh"

mkdir -p "$STATE_DIR" "$SHARED_DIR" "$RENDERED_DIR"
need APP_TAG APP_VERSION
exec 9>"$STATE_DIR/deploy.lock"
flock -n 9 || die "another deploy is running"

ACTOR="${DEPLOY_ACTOR:-unknown}"
log "release ${RELEASE_SHA:-manual} ($APP_VERSION) by $ACTOR: tag=$APP_TAG"

for env_file in runtime.env db.env; do
  if [ -f "$REL/$env_file" ]; then
    install -m 600 "$REL/$env_file" "$SHARED_DIR/$env_file"
    shred -u "$REL/$env_file" 2>/dev/null || rm -f "$REL/$env_file"
  fi
  [ -f "$SHARED_DIR/$env_file" ] || die "$env_file is missing"
done
mkdir -p "$BASE/backups"

if [ -f "$REL/.ghcr-token" ]; then
  need GHCR_USER
  docker login ghcr.io --username "$GHCR_USER" --password-stdin <"$REL/.ghcr-token" >/dev/null
  shred -u "$REL/.ghcr-token" 2>/dev/null || rm -f "$REL/.ghcr-token"
  trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
fi

CURRENT_TAG="" CURRENT_VERSION=""
read_state "$STATE_DIR/current.env"
PREV_TAG="$CURRENT_TAG" PREV_VERSION="$CURRENT_VERSION"

apply_app() {
  export APP_TAG="$1" APP_VERSION="$2"
  compose pull --quiet
  compose up --detach --remove-orphans --wait --wait-timeout 120
}

render_ingress() {
  local domain resolved=()
  for domain in $(runtime_value APP_DOMAINS | tr ',' ' '); do
    if getent ahostsv4 "$domain" >/dev/null; then resolved+=("$domain"); else log "skip $domain: DNS record not found"; fi
  done
  [ "${#resolved[@]}" -gt 0 ] || die "no resolvable domains in APP_DOMAINS"
  APP_DOMAINS="$(printf '%s, ' "${resolved[@]}" | sed 's/, $//')" envsubst '${APP_DOMAINS} ${APP_PORT}' \
    <"$REL/caddy/stem-bot.caddy.tmpl" >"$RENDERED_DIR/stem-bot.caddy.new"
  mv -f "$RENDERED_DIR/stem-bot.caddy.new" "$RENDERED_DIR/stem-bot.caddy"
  chmod 644 "$RENDERED_DIR/stem-bot.caddy"
}

record() {
  printf '{"ts":"%s","result":"%s","tag":"%s","version":"%s","sha":"%s","actor":"%s"}\n' \
    "$(date -u +%FT%TZ)" "$1" "$APP_TAG" "$APP_VERSION" "${RELEASE_SHA:-manual}" "$ACTOR" >>"$STATE_DIR/history.jsonl"
}

on_failure() {
  local code=$?
  trap - ERR
  log "deploy failed with exit code $code"
  record failed
  if [ -n "$PREV_TAG" ]; then
    if apply_app "$PREV_TAG" "$PREV_VERSION" >/dev/null 2>&1; then
      log "rolled back to $PREV_VERSION ($PREV_TAG)"
    else
      log "rollback failed"
    fi
  fi
  exit "$code"
}
trap on_failure ERR

backup_before_deploy() {
  local file
  file="$BASE/backups/predeploy-$(date -u +%Y%m%d-%H%M%S).dump"
  if compose ps --status running --services 2>/dev/null | grep -qx db; then
    compose exec -T db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' >"$file"
    log "pre-deploy backup: $(basename "$file") ($(du -h "$file" | cut -f1))"
  fi
  find "$BASE/backups" -name 'predeploy-*.dump' | sort | head -n -10 | xargs -r rm -f
}

TARGET_TAG="$APP_TAG" TARGET_VERSION="$APP_VERSION"
backup_before_deploy
apply_app "$TARGET_TAG" "$TARGET_VERSION"
"$REL/scripts/smoke.sh" "http://127.0.0.1:$APP_PORT" "$TARGET_VERSION"

render_ingress
sudo -n /opt/stem-bot/bin/caddy-apply "$RENDERED_DIR"

trap - ERR
printf 'PREVIOUS_TAG=%s\nPREVIOUS_VERSION=%s\n' "$PREV_TAG" "$PREV_VERSION" >"$STATE_DIR/previous.env"
printf 'CURRENT_TAG=%s\nCURRENT_VERSION=%s\nCURRENT_RELEASE=%s\nCURRENT_DEPLOYED_AT=%s\n' \
  "$TARGET_TAG" "$TARGET_VERSION" "${RELEASE_SHA:-manual}" "$(date -u +%FT%TZ)" >"$STATE_DIR/current.env"
ln -sfn "$REL" "$STATE_DIR/current"
record ok

docker image ls --format '{{.Repository}}:{{.Tag}}' "$APP_IMAGE" \
  | grep -v -e ":$TARGET_TAG\$" -e ":${PREV_TAG:-none}\$" | xargs -r docker rmi >/dev/null 2>&1 || true
find "$BASE/releases" -mindepth 1 -maxdepth 1 -type d | sort | head -n -5 | xargs -r rm -rf

log "deployed $TARGET_VERSION ($TARGET_TAG)"
