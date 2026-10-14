#!/usr/bin/env bash
set -Eeuo pipefail

REL="${REL:-$(cd "$(dirname "$0")/.." && pwd)}"
export REL
. "$REL/scripts/lib.sh"

cat "$STATE_DIR/current.env" 2>/dev/null || echo "STATE=empty"
compose ps --format '{{.Name}} {{.Status}}' 2>/dev/null || true
tail -n 5 "$STATE_DIR/history.jsonl" 2>/dev/null || true
