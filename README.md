# Auto Rally

A small top-down auto-rickshaw racing game. Race 3 laps round a looping road, collect coins, dodge cones and barrels, grab blue boosts, and beat your best time. It is an offline PWA: plain HTML, CSS and JavaScript, no framework, no build step, no downloads at runtime.

## Run or install

- Laptop test: open the folder in a static server, for example `python -m http.server 8000`, then visit `http://localhost:8000`. (Opening `index.html` directly also plays, but the offline install needs http.)
- GitHub Pages: push the folder contents to a repo, then Settings, Pages, deploy from the branch root. Share the `https://...github.io/...` link.
- Phone: open the link once while online, then use the browser menu, "Add to Home screen" / "Install app". After that it runs in flight mode.
- After editing any file, change `CACHE` in `sw.js` (for example `auto-rally-v2`) so phones pick up the update.

## Controls

- Keyboard: arrow keys or WASD (up = gas, down = brake/reverse, left/right = steer).
- Touch: Left, Right, Brake and Gas buttons on screen.

## Features

- Auto-rickshaw drawn with canvas shapes, on a smooth looping road. Grass slows you down quickly.
- Coins (counted), cones and barrels (a crash cuts your speed, then you get 0.9 s of protection so one hit costs one penalty), blue boost pads (2.5 s speed boost).
- 3 laps with a timer, a countdown, and 3 checkpoints plus the finish line. They must be passed in order, so cutting across the grass or driving back and forth over the line does not count. The next checkpoint is highlighted yellow. A "Wrong way" warning appears if you turn round.
- Best time saved in the browser (localStorage).
- Sound from the Web Audio API (engine, coins, boost, crash, checkpoints, lap, finish). Mute button, remembered.
- Start screen with one line of instructions; finish screen with your time, best time and coins.
- Fits phone portrait and landscape and laptop screens.

## Files

`index.html`, `style.css`, `game.js` (all game code), `manifest.json`, `sw.js` (offline cache), `icon.svg`, `icon-192.png`, `icon-512.png`.

## Done when - how to check each one

1. **A full race plays on a real phone in flight mode.** Open the hosted link online once and install it. Turn on flight mode, close the app, reopen it, and play all 3 laps.
2. **A friend finishes a race with no instructions.** Hand over the phone. The start screen line, labelled buttons, highlighted checkpoint and chevrons on the road should be enough.
3. **Crashes and lap counts feel fair.** Hit a cone: you slow down once, then blink for under a second and cannot be hit again. Try cutting the corner over the grass or reversing over the finish line: the lap does not count until every checkpoint was passed in order. The lap toast shows after each lap.
4. **The best time survives a restart.** Finish a race, fully close and reopen the app (or reload the tab). The start screen shows the same best time. A slower race does not replace it.
5. **Fits phone screens in portrait and landscape.** Rotate the phone during the start screen and during a race; the HUD, buttons and cards stay visible and nothing scrolls.
6. **Sound and mute.** Sounds play after you press Start Race. Press the Sound button, reload: it keeps your choice.
