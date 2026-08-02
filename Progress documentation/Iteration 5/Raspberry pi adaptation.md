Currently it can run on chromium on the raspberry pi, but it is not optimised for the pi. When opened, it does not treat the app as a touchscreen application, showing a scroll bar. Additionally when fullscreened, the built in touchscreen keyboard does not work.  

Solutions: 

1) Add an auto launch line, so that when the pi is booted, it automatically opens the app in fullscreen mode. It should also have touch screen events enabled, which should allow for the touch screen to work properly 

chromium --kiosk --noerrdialogs --disable-pinch --touch-events=enabled \
  --app=http://localhost:5000
- --touch-events=enabled forces touch input support
- --kiosk removes scrollbars by hiding browser UI (app-level scrollbars can persist — see 1b)
- --disable-pinch stops accidental zoom on double-tap
- --noerrdialogs --disable-infobars clean kiosk

2) Hide the scroll bar in the CSS and JS of the app, which should make it look more proffesional. 

- Hide scrollbars: ::-webkit-scrollbar { display: none; } or set scrollbar-width to 0
- html, body { touch-action: manipulation; } — removes tap-zoom delay & double-tap zoom
- -webkit-tap-highlight-color: transparent; — cleaner tap feedback
- Use 100dvh instead of 100vh (fixes height overflow on mobile viewports)
- Replace click-only handlers with pointerup (responds to touch instantly)
- Enlarge buttons/min touch targets to ~44px+ (touch ergonomics)
- Remove horizontal overflow: overflow-x: hidden

3) For onscreen keyboard, the reason it doesnt work is because when chromium is fullscreened, it is fullscreened on the top layer. So the keyboard is opened, it is just behind chromium and threrfore can not be seen by user. To fix this i can: 
- Patch Squeekboard to use the overlay layer.

    - recompile with _TOP → _OVERLAY layer change. Works with fullscreen/kiosk but requires building from source (nontrivial).

- Use a different keyboard:

    - matchbox-keyboard -d (daemon mode) or onboard. Both run as their own window, but must be started after Chromium so they stay on top; only reliable in non-kiosk windows.

- Make an in-app HTML/JS keyboard. This is the surefire way to make it work, but could use a little bit of extra work.  

4) Add openai to requirements.txt 

5) Set FLASK_DEBUG to False in the pi's environment variables 