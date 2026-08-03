Currently it can run on chromium on the raspberry pi, but it is not optimised for the pi. When opened, it does not treat the app as a touchscreen application, showing a scroll bar. Additionally when fullscreened, the built in touchscreen keyboard does not work.  

Problems 1-5 below are now implemented. See `deployment/` for the Raspberry Pi setup files (setup script, systemd service, labwc autostart, README).

Solutions: 

1) Add an auto launch line, so that when the pi is booted, it automatically opens the app in fullscreen mode. It should also have touch screen events enabled, which should allow for the touch screen to work properly. **Implemented.**

chromium --kiosk --noerrdialogs --disable-pinch --touch-events=enabled \
  --app=http://localhost:5005
- NOTE: the app runs on port **5005** (`config.py`), not 5000 as originally written.
- --touch-events=enabled forces touch input support
- --kiosk removes scrollbars by hiding browser UI (app-level scrollbars are hidden too — see 2)
- --disable-pinch stops accidental zoom on double-tap
- --noerrdialogs --disable-infobars clean kiosk

Deployed on the Pi via:
- `deployment/pi_setup.sh` — one-shot installer (venv, pip, .env, systemd, autologin)
- `deployment/flask-dashboard.service` — systemd unit that runs the Flask server at boot
- `deployment/autostart` — labwc autostart file that waits for the server then opens Chromium in kiosk mode

2) Hide the scroll bar in the CSS and JS of the app, which should make it look more professional. **Implemented** in `frontend/static/css/style.css` (v27).

- Hide scrollbars: ::-webkit-scrollbar { display: none; } + scrollbar-width: none
- html, body { touch-action: manipulation; } — removes tap-zoom delay & double-tap zoom
- -webkit-tap-highlight-color: transparent; — cleaner tap feedback
- Use 100dvh instead of 100vh (fixes height overflow on mobile/kiosk viewports)
- Remove horizontal overflow: overflow-x: hidden
- Buttons/min touch targets enlarged to ~44px+ (fast-forward, goal toggles, modal close buttons)
- Note: wholesale click → pointerup migration is deferred to "Broader problems" — touch-action: manipulation already makes existing click handlers respond instantly on touch, so the migration is no longer needed for responsiveness.

3) For onscreen keyboard, the reason it doesnt work is because when chromium is fullscreened, it is fullscreened on the top layer. So the keyboard is opened, it is just behind chromium and therefore can not be seen by user. **Implemented — in-app HTML/JS keyboard chosen** (`frontend/static/js/keyboard.js`, styled in style.css).

- Chosen approach: an in-app HTML/JS keyboard. This is the surefire way to make it work in --kiosk fullscreen. Appears automatically when a text/email/password input is focused (login, register, plugs screens), with QWERTY + symbol layers, shift, backspace, space, enter.
- Alternatives considered (not used):
  - Patch Squeekboard to use the overlay layer: recompile with _TOP → _OVERLAY layer change. Works with fullscreen/kiosk but requires building from source (nontrivial).
  - matchbox-keyboard -d (daemon mode) or onboard: both run as their own window, but must be started after Chromium so they stay on top; only reliable in non-kiosk windows.

4) Add openai to requirements.txt. **Implemented.** Added `openai==1.63.0`. This was required for the app to boot at all: `app/llm_client.py` does `from openai import OpenAI` at module load.

5) Set FLASK_DEBUG to False in the pi's environment variables. **Implemented.** `config.py` now defaults `FLASK_DEBUG` to `False` (dev opt-in via `FLASK_DEBUG=True` in `.env`), and the Pi's systemd service sets it explicitly via `EnvironmentFile=.env`.

---

## Broader problems (documented only — NOT yet implemented)

These were found while reviewing the app for Pi use. They are not part of the current implementation.

- **Chart.js loaded from a CDN** (`frontend/templates/base.html`): if the Pi loses internet, charts break. Vendor `chart.umd.min.js` locally.
- **tapo==0.8.12 requires Python ≥ 3.11**: stock Raspberry Pi OS before Bookworm ships Python 3.9. Bookworm ships 3.11 so it works there; `deployment/pi_setup.sh --with-plugs` guards the version.
- **LLM calls have no timeout**: a slow/hung OpenAI call can block the UI. Add a timeout (and retry policy) to the OpenAI client.
- **Slow `get_all_time_trend` query** over all readings: index or cap the query for the Pi.
- **SECRET_KEY regenerates every boot** (`config.py`): sessions/logins reset after restart. Fix: set a fixed `SECRET_KEY` in `.env` (already supported — see `.env.example`).
- **Native alert()/confirm() dialogs** in `plugs.js`/`auth.js`: replace with in-app modals for a cleaner kiosk UX.
- **Click → pointerup migration**: deferred — not needed for responsiveness since `touch-action: manipulation` removes the tap delay.
- **backdrop-filter usage** (header, modals) can be expensive on low-end Pi GPUs; consider disabling in kiosk mode.
- **Single-breakpoint layout**: add kiosk/touchscreen-specific breakpoints for the large Pi screen.
- **Viewport meta lacks `maximum-scale=1`**: prevents pinch-zoom in app mode (currently handled by `--disable-pinch` + `touch-action`).
- **Swipe axis lock** for scrollable containers to avoid janky two-axis scrolling.
- **`seed_data.py` bugs and a UTC date bug** in date handling.
