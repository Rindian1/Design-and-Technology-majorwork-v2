#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="$REPO_DIR/venv"
SERVICE_NAME="flask-dashboard"
WITH_PLUGS=0

usage() {
  cat <<EOF
Usage: $0 [--with-plugs]

Sets up the Energy Dashboard for Raspberry Pi kiosk use:
  - Creates a Python virtual environment and installs dependencies
  - Writes .env from .env.example if missing
  - Installs and enables the flask-dashboard systemd service
  - Installs the labwc autostart file (Chromium kiosk mode)
  - Enables desktop autologin

Options:
  --with-plugs   Fail if Python < 3.11 (required by the tapo plug library).
EOF
  exit 0
}

while [ $# -gt 0 ]; do
  case "$1" in
    --with-plugs) WITH_PLUGS=1 ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1" >&2; usage ;;
  esac
  shift
done

PYTHON_BIN="${PYTHON_BIN:-python3}"

echo "==> Checking Python version"
PY_VERSION=$("$PYTHON_BIN" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "    Found Python $PY_VERSION"
PY_MAJOR=${PY_VERSION%%.*}
PY_MINOR=${PY_VERSION#*.}

if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 11 ]; }; then
  if [ "$WITH_PLUGS" -eq 1 ]; then
    echo "ERROR: Python >= 3.11 is required for the tapo plug library." >&2
    echo "       Install it, e.g.:" >&2
    echo "         sudo apt update && sudo apt install -y python3.11 python3.11-venv" >&2
    echo "       then re-run: PYTHON_BIN=python3.11 $0 --with-plugs" >&2
    exit 1
  fi
  echo "    WARNING: Python < 3.11. The tapo plug library will not install."
  echo "    The app will still run in demo mode (no real plugs)."
fi

echo "==> Creating virtual environment"
"$PYTHON_BIN" -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install --upgrade pip
"$VENV_DIR/bin/pip" install -r "$REPO_DIR/requirements.txt"

echo "==> Writing .env"
if [ ! -f "$REPO_DIR/.env" ]; then
  cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
  echo "    Created $REPO_DIR/.env from .env.example"
  echo "    !!! Edit it and add your OPENAI_API_KEY and SECRET_KEY !!!"
else
  echo "    .env already exists, leaving it unchanged"
fi

echo "==> Installing systemd service"
sed -e "s|__REPO_DIR__|$REPO_DIR|g" \
  "$REPO_DIR/deployment/flask-dashboard.service" |
  sudo tee "/etc/systemd/system/$SERVICE_NAME.service" > /dev/null
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME.service"
sudo systemctl restart "$SERVICE_NAME.service"

echo "==> Installing labwc autostart"
mkdir -p "$HOME/.config/labwc"
cp "$REPO_DIR/deployment/autostart" "$HOME/.config/labwc/autostart"
chmod +x "$HOME/.config/labwc/autostart"

echo "==> Enabling desktop autologin"
sudo raspi-config nonint do_boot_behaviour B4 || {
  echo "    Could not enable autologin automatically."
  echo "    Do it manually: sudo raspi-config > Boot Options > Desktop Autologin"
}

echo ""
echo "Done."
echo "  1) Set screen blanking to OFF if desired: raspi-config > Display Options > Screen Blanking > No"
echo "  2) Reboot: sudo reboot"
echo "  After boot, Chromium opens the dashboard in kiosk mode."
