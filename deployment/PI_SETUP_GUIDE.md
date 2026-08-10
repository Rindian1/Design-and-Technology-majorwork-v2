# Raspberry Pi Setup Guide — Energy Dashboard

Step-by-step guide to set up the Energy Dashboard on a Raspberry Pi with a
touchscreen. Covers the automated install, configuration, running it, and how
to update it later.

Applies to: Raspberry Pi OS **Bookworm (64-bit)** with desktop (Wayland/labwc).

---

## 1. What you need

- Raspberry Pi (3B+, 4, 5, or Zero 2 W) with SD card / SSD
- Raspberry Pi official 7" touchscreen, or any DSI/HDMI touch display
- Keyboard + mouse (only for setup; not needed afterwards)
- A way to reach the Pi's terminal: keyboard + monitor, or SSH over the network
- An **OpenAI API key** (needed for the AI recommendations / chat features)

---

## 2. Install the operating system

1. Download **Raspberry Pi Imager** for your computer
   (<https://www.raspberrypi.com/software/>).
2. Open Imager → **Choose OS** → *Raspberry Pi OS (64-bit)* (Bookworm, with desktop).
3. **Choose Storage** → your SD card / SSD.
4. Click the gear icon (⚙) and set:
   - **Enable SSH** → allow `ssh` and set a username + password (e.g. `pi`)
   - **Set username and password** → e.g. user `pi`
   - (optional) **Configure wireless LAN** → your Wi-Fi + country
5. **Write** the image, then insert the card into the Pi and power it on.

---

## 3. Connect to the Pi

Find the Pi's IP address (router admin page, or use the Imager's "Advanced" IP
resolution). Then from your computer:

```bash
ssh pi@<PI-IP-ADDRESS>
```

---

## 4. Clone the repository

Clone it into your home directory (the repo path is used everywhere below, e.g.
`~/Design-and-Technology-majorwork-v2`):

```bash
cd ~
git clone https://github.com/Rindian1/Design-and-Technology-majorwork-v2.git
cd Design-and-Technology-majorwork-v2
```

> Note: your Linux username may differ from `pi` (e.g. `rj`). Everything below
> uses `~/…`, which points to your actual home directory
> (`/home/pi`, `/home/rj`, …).

---

## 5. Add your OpenAI API key and a secret key

Before running the setup script, create `.env` with your real keys so the
script doesn't have to be re-run afterwards:

```bash
nano ~/Design-and-Technology-majorwork-v2/.env
```

Fill it in like this:

```env
OPENAI_API_KEY=sk-proj-...your-real-key...
FLASK_DEBUG=False
SECRET_KEY=any-long-random-string-here
```

> Get an OpenAI key from <https://platform.openai.com> → **API keys**.
> Set a fixed `SECRET_KEY` so logins survive server restarts.
> Keep this file private: `chmod 600 .env`.

```bash
chmod 600 ~/Design-and-Technology-majorwork-v2/.env
```

---

## 6. Run the setup script

The script creates a Python virtual environment, installs dependencies,
installs the Flask systemd service, installs the Chromium kiosk autostart, and
enables desktop autologin.

```bash
cd ~/Design-and-Technology-majorwork-v2
chmod +x deployment/pi_setup.sh
deployment/pi_setup.sh
```

Use `deployment/pi_setup.sh --with-plugs` if you want **real TAPO smart plugs**
(this requires Python ≥ 3.11, the Bookworm default). Without plugs the app runs
in demo mode.

What the script does:
- `venv/` — Python virtual environment with all dependencies
- `/etc/systemd/system/flask-dashboard.service` — starts the server at boot
  (uses **your** username, substituted automatically as `User=<whoami>`)
- `~/.config/labwc/autostart` — opens Chromium in fullscreen kiosk mode at login
- Enables desktop **autologin** (no credentials needed to start the kiosk)

---

## 7. Turn off screen blanking (optional but recommended)

```bash
sudo raspi-config
```

**Display Options → Screen Blanking → No**

---

## 8. Reboot

```bash
sudo reboot
```

After boot you should see:
1. The desktop login (auto), then
2. Chromium opening `http://localhost:5005` in **fullscreen kiosk mode**.

---

## 9. Verify it's running

On the Pi, or over SSH:

```bash
# Is the Flask server up?
curl -I http://localhost:5005

# Is the service healthy?
systemctl status flask-dashboard

# Live server logs
journalctl -u flask-dashboard -f
```

| Check | Expected |
|---|---|
| `curl -I http://localhost:5005` | `200 OK` |
| `systemctl status flask-dashboard` | `active (running)` |
| `chromium --kiosk http://localhost:5005` | fullscreen dashboard |

---

## 10. Log in and use the app

- **Demo dashboard** — on the login page tap **View Demo Dashboard**
  (logs in as `demo@example.com` / `demo`). No setup needed.
- **Real account** — create one via **Register**, complete the survey
  (it starts with **plug connection** so you can add your TAPO plug first).

The app is touch-optimised:
- **Drag anywhere to scroll** (`touch-scroll.js`) — works with the mouse-like
  touch input Raspberry Pi presents to Chromium.
- **On-screen keyboard** — appears on login/register/plug screens, so no system
  keyboard is needed in fullscreen.

If scrolling still doesn't work, reload the page with a debug overlay:

```
http://localhost:5005/?tsdebug=1
```

A badge in the corner shows whether the touch-scroll system loaded.

---

## 11. Exit button

The user menu (top-right) has an **Exit** button:

1. Tap **Exit** → leaves fullscreen (if using the Fullscreen API), then
2. Sends a request to the server which closes Chromium → you land on the desktop.

Useful for getting out of the kiosk during the demo/presentation.

---

## 12. Updating the dashboard later

When you change code on your computer and push it to GitHub, update the Pi:

```bash
cd ~/Design-and-Technology-majorwork-v2
git pull
sudo systemctl restart flask-dashboard
```

Then reload the Chromium page (F5 / tap the reload). If Chromium is in kiosk
mode, use the **Exit** button and reopen:

```bash
DISPLAY=:0 chromium --kiosk --noerrdialogs --disable-pinch --touch-events=enabled \
  --disable-infobars --check-for-update-interval=315360000 http://localhost:5005
```

> New JS/CSS files are cache-busted with version query strings
> (`style.css?v=31`, `Medal.svg?v=1`), so a hard reload isn't usually needed.

---

## 13. Troubleshooting

| Problem | Fix |
|---|---|
| Server not starting | `journalctl -u flask-dashboard -f` for errors; check `.env` has a valid `OPENAI_API_KEY` and `SECRET_KEY` |
| Service fails instantly with `status=217/USER` | The unit's `User=` doesn't match your Linux username. Re-run `deployment/pi_setup.sh` (it now substitutes your username automatically) or fix it manually: `sudo sed -i 's/User=pi/User=<your-username>/' /etc/systemd/system/flask-dashboard.service && sudo systemctl daemon-reload && sudo systemctl restart flask-dashboard` |
| `.env` missing after setup | The script only creates `.env` if it doesn't exist. Create it manually (see step 5) and `sudo systemctl restart flask-dashboard` |
| Blank screen at boot | Check `systemctl status flask-dashboard` and `~/.config/labwc/autostart` exists and is executable |
| Touch scroll doesn't work | Reload with `?tsdebug=1` and check the badge; confirm Chromium was launched with `--touch-events=enabled` |
| Chromium won't reopen after Exit | Run the `chromium --kiosk ...` command from step 12 manually |
| Port conflict | The app uses port **5005** (`config.py`), not 5000 |

---

## 14. Useful paths

| Thing | Location |
|---|---|
| App code | `~/Design-and-Technology-majorwork-v2` |
| Config/keys | `~/Design-and-Technology-majorwork-v2/.env` |
| Virtual environment | `~/Design-and-Technology-majorwork-v2/venv` |
| Flask service | `/etc/systemd/system/flask-dashboard.service` |
| Kiosk autostart | `~/.config/labwc/autostart` |
| Server logs | `journalctl -u flask-dashboard -f` |
