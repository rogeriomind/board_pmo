#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/board_pmo}"
REPO_URL="${REPO_URL:-https://github.com/rogeriomind/board_pmo.git}"
TARGET_USER="${SUDO_USER:-${USER}}"

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  SUDO="sudo"
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This bootstrap script expects Ubuntu/Debian. Install Docker, Docker Compose, git, and OpenSSH manually for this OS."
  exit 1
fi

$SUDO apt-get update
$SUDO apt-get install -y ca-certificates curl git openssh-server ufw

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | $SUDO sh
fi

$SUDO usermod -aG docker "$TARGET_USER" || true
$SUDO mkdir -p "$PROJECT_DIR"
$SUDO chown "$TARGET_USER:$TARGET_USER" "$PROJECT_DIR"

if [ -n "${DEPLOY_PUBLIC_KEY:-}" ]; then
  mkdir -p "$HOME/.ssh"
  chmod 700 "$HOME/.ssh"
  touch "$HOME/.ssh/authorized_keys"
  chmod 600 "$HOME/.ssh/authorized_keys"
  grep -qxF "$DEPLOY_PUBLIC_KEY" "$HOME/.ssh/authorized_keys" || printf '%s\n' "$DEPLOY_PUBLIC_KEY" >> "$HOME/.ssh/authorized_keys"
fi

if [ ! -d "$PROJECT_DIR/.git" ] && [ -z "$(ls -A "$PROJECT_DIR" 2>/dev/null)" ]; then
  git clone "$REPO_URL" "$PROJECT_DIR"
fi

if command -v ufw >/dev/null 2>&1 && $SUDO ufw status | grep -q "Status: active"; then
  $SUDO ufw allow OpenSSH
  $SUDO ufw allow 80/tcp
fi

docker compose version
echo "Bootstrap finished. Reconnect SSH if Docker group permissions were just added."
