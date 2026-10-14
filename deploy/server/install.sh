#!/usr/bin/env bash
set -Eeuo pipefail

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
DEPLOY_PUBKEY="${1:?usage: install.sh '<deploy ssh public key>'}"
HERE="$(cd "$(dirname "$0")" && pwd)"
USER_NAME=stembot
BASE=/srv/stem-bot

id "$USER_NAME" >/dev/null 2>&1 || useradd --system --home-dir "$BASE" --shell /bin/bash --user-group "$USER_NAME"
usermod -aG docker "$USER_NAME"

install -d -m 750 -o "$USER_NAME" -g "$USER_NAME" "$BASE" "$BASE/releases" "$BASE/state" "$BASE/rendered"
install -d -m 700 -o "$USER_NAME" -g "$USER_NAME" "$BASE/shared" "$BASE/.ssh"
chmod 755 "$BASE/rendered"
printf 'restrict,command="/opt/stem-bot/bin/entrypoint" %s\n' "$DEPLOY_PUBKEY" >"$BASE/.ssh/authorized_keys"
chown "$USER_NAME:$USER_NAME" "$BASE/.ssh/authorized_keys"
chmod 600 "$BASE/.ssh/authorized_keys"

install -d -m 755 /opt/stem-bot/bin
install -m 755 -o root -g root "$HERE/entrypoint" /opt/stem-bot/bin/entrypoint
install -m 755 -o root -g root "$HERE/caddy-apply" /opt/stem-bot/bin/caddy-apply

sudoers=/etc/sudoers.d/stem-bot
printf '%s ALL=(root) NOPASSWD: /opt/stem-bot/bin/caddy-apply /srv/stem-bot/rendered\n' "$USER_NAME" >"$sudoers.tmp"
visudo -cf "$sudoers.tmp" >/dev/null
install -m 440 -o root -g root "$sudoers.tmp" "$sudoers"
rm -f "$sudoers.tmp"

sshd_conf=/etc/ssh/sshd_config.d/01-stem-bot.conf
printf 'AllowUsers %s\n' "$USER_NAME" >"$sshd_conf"
chmod 644 "$sshd_conf"
sshd -t
systemctl reload ssh

cat >/etc/logrotate.d/stem-bot <<ROTATE
$BASE/state/deploy.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
  su $USER_NAME $USER_NAME
}
ROTATE

echo "stem-bot deploy target installed"
