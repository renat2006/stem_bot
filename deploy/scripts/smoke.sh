#!/usr/bin/env bash
set -Eeuo pipefail

url="$1" expected_version="${2:-}" timeout="${SMOKE_TIMEOUT:-120}"
deadline=$((SECONDS + timeout))
until body="$(curl -fsS --max-time 3 "$url/api/health" 2>/dev/null)"; do
  [ "$SECONDS" -lt "$deadline" ] || { echo "smoke: $url/api/health not healthy" >&2; exit 1; }
  sleep 2
done
if [ -n "$expected_version" ] && ! grep -q "\"version\":\"$expected_version\"" <<<"$body"; then
  echo "smoke: unexpected version in $body" >&2
  exit 1
fi
curl -fsS --max-time 3 -o /dev/null "$url/" || { echo "smoke: web app is not served" >&2; exit 1; }
echo "smoke: ok $body"
