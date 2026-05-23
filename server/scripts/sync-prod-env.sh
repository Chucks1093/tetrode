#!/usr/bin/env bash

set -euo pipefail

# Which local env file to sync to the server.
# Default is .env.production (you can override with ENV_SYNC_SOURCE=.env)
SOURCE_ENV_FILE="${ENV_SYNC_SOURCE:-.env.production}"
REMOTE_TMP="/tmp/tetrode-server.env"

if [[ ! -f "${SOURCE_ENV_FILE}" ]]; then
  echo "Missing ${SOURCE_ENV_FILE}"
  echo "Set ENV_SYNC_SOURCE=<file> or create ${SOURCE_ENV_FILE}."
  exit 1
fi

read_env_value() {
  local file="$1"
  local key="$2"
  [[ -f "${file}" ]] || return 0

  local line
  line="$(grep -E "^[[:space:]]*${key}=" "${file}" | tail -n 1 || true)"
  [[ -n "${line}" ]] || return 0

  local value="${line#*=}"
  # trim leading/trailing spaces
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  # strip optional matching quotes
  if [[ "${value}" =~ ^\".*\"$ || "${value}" =~ ^\'.*\'$ ]]; then
    value="${value:1:${#value}-2}"
  fi
  printf '%s' "${value}"
}

# Allow sourcing Lightsail connection values from env file(s) when not exported in shell
LIGHTSAIL_HOST="${LIGHTSAIL_HOST:-$(read_env_value .env.production LIGHTSAIL_HOST)}"
LIGHTSAIL_USER="${LIGHTSAIL_USER:-$(read_env_value .env.production LIGHTSAIL_USER)}"
LIGHTSAIL_SSH_PRIVATE_KEY="${LIGHTSAIL_SSH_PRIVATE_KEY:-$(read_env_value .env.production LIGHTSAIL_SSH_PRIVATE_KEY)}"

if [[ -z "${LIGHTSAIL_HOST}" || -z "${LIGHTSAIL_USER}" || -z "${LIGHTSAIL_SSH_PRIVATE_KEY}" ]]; then
  echo "Set LIGHTSAIL_HOST, LIGHTSAIL_USER, and LIGHTSAIL_SSH_PRIVATE_KEY first."
  echo "You can export them in shell or put them in .env.production."
  exit 1
fi

KEY_PATH="${LIGHTSAIL_SSH_PRIVATE_KEY}"

if [[ ! -f "${KEY_PATH}" ]]; then
  echo "SSH key file not found at: ${KEY_PATH}"
  exit 1
fi

echo "Syncing ${SOURCE_ENV_FILE} -> ${LIGHTSAIL_USER}@${LIGHTSAIL_HOST}:${REMOTE_TMP}"
scp -i "${KEY_PATH}" -o StrictHostKeyChecking=no "${SOURCE_ENV_FILE}" "${LIGHTSAIL_USER}@${LIGHTSAIL_HOST}:${REMOTE_TMP}"

ssh -i "${KEY_PATH}" -o StrictHostKeyChecking=no "${LIGHTSAIL_USER}@${LIGHTSAIL_HOST}" <<'EOF'
set -euo pipefail
sudo mkdir -p /etc/tetrode
sudo cp /tmp/tetrode-server.env /etc/tetrode/server.env
sudo chmod 600 /etc/tetrode/server.env
if [[ -d /home/ubuntu/tetrode/server ]]; then
  cp /tmp/tetrode-server.env /home/ubuntu/tetrode/server/.env
fi
if systemctl list-unit-files | grep -q '^tetrode-api'; then
  sudo systemctl restart tetrode-api
fi
echo "Production env synced for tetrode."
EOF
