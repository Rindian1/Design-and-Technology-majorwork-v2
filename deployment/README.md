# Raspberry Pi Kiosk Deployment

Turns the Energy Dashboard into a fullscreen touchscreen kiosk on Raspberry Pi OS
(Bookworm, Wayland/labwc compositor).

## What this does

- Runs the Flask server as a **systemd service** (`flask-dashboard.service`) so it starts at boot.
- Launches **Chromium in kiosk mode** from the labwc autostart file, with touch events enabled.
- Enables **desktop autologin** so the kiosk appears without typing credentials.
- Creates a venv and installs dependencies, including `openai`.

The app itself is touch-optimised (hidden scrollbars, no tap delay, an in-app
on-screen keyboard, 44px touch targets) — see `Progress documentation/Iteration 5/Raspberry pi adaptation.md`.

## Prerequisites

- Raspberry Pi OS **Bookworm (64-bit)** with desktop, Wayland/labwc.
- The repo cloned to `/home/pi/Design-and-Technology-majorwork-v2`:

  ```bash
  cd /home/pi
  git clone https://github.com/Rindian1/Design-and-Technology-majorwork-v2.git
  ```

- Real TAPO plugs need **Python ≥ 3.11** (already the default on Bookworm).
  If your OS has an older Python and you want plugs, install 3.11 first:

  ```bash
  sudo apt update && sudo apt install -y python3.11 python3.11-venv
  ```

## Install

```bash
cd /home/pi/Design-and-Technology-majorwork-v2
chmod +x deployment/pi_setup.sh
deployment/pi_setup.sh                # without real plugs
deployment/pi_setup.sh --with-plugs   # require Python >= 3.11
```

Then, before rebooting:

1. Edit `/home/pi/Design-and-Technology-majorwork-v2/.env` and add your
   `OPENAI_API_KEY` and (recommended) a fixed `SECRET_KEY`.
2. Set screen blanking to OFF if desired:
   `sudo raspi-config` → **Display Options** → **Screen Blanking** → **No**
3. Reboot:

```bash
sudo reboot
```

## What runs at boot

1. `flask-dashboard.service` (systemd, multi-user) starts the Flask app from the venv.
   - Environment comes from `EnvironmentFile=.env` (`FLASK_DEBUG=False` here).
   - Logs: `journalctl -u flask-dashboard -f`
   - Status: `systemctl status flask-dashboard`
2. On login, labwc runs `~/.config/labwc/autostart`, which waits for the server
   on port 5005, then launches:

   ```
   chromium --kiosk --noerrdialogs --disable-pinch --touch-events=enabled \
     --disable-infobars --check-for-update-interval=315360000 \
     http://localhost:5005
   ```

## Manual checks

| What | Command |
|---|---|
| Server up | `curl -I http://localhost:5005` |
| Server logs | `journalctl -u flask-dashboard -f` |
| Restart server | `sudo systemctl restart flask-dashboard` |
| Kiosk relaunch | `DISPLAY=:0 ~/.config/labwc/autostart` (or `logout`) |

## Notes

- Port is **5005** (`config.py`), not 5000.
- The in-app keyboard (login/register/plugs screens) replaces the system keyboard,
  so it works inside kiosk fullscreen.
- Kiosk disables pinch-zoom and double-tap zoom; the page layout uses `dvh` units
  so it fills the touchscreen height correctly.
