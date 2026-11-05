# Prompts

## Prompt 1 - build

Build 'Auto Rally' in the folder C:\Users\admin\Documents\Harsh Vanguard\Vscode\28. BSERC AI Projects\08-Auto-Rally. It's a cute auto-rickshaw racing game on an HTML canvas that friends can play on their phones, made as an offline PWA (manifest, service worker, icon) that I'll host on GitHub Pages.

What to build:
1. A driveable auto-rickshaw on a looping road (top-down view, drawn with canvas shapes, no image files needed). Going off the road slows you down.
2. Keyboard controls (arrow keys/WASD) and on-screen touch buttons for phones.
3. Coins, obstacles and at least one power-up (for example a short speed boost).
4. 3 laps with a timer. Use checkpoints so a lap only counts after going all the way round.
5. A best time saved in the browser.
6. Sound made with the Web Audio API (no audio files) and a mute button that's remembered.
Add a start screen with one line of how to play and a finish screen with time and best time.

Done when: a full race plays on a real phone in flight mode; a friend finishes a race with no instructions; crashes and lap counts feel fair; the best time survives a restart. It should fit phone screens in portrait and landscape.

Rules: plain HTML, CSS and JavaScript with no framework and no build step. It must work fully offline: no CDN, no paid API, no login (if you need a library, save its file inside the folder). Make it look good: clear layout, readable text, buttons that say what they do, works on phone and laptop, no gradients or emojis. Keep the code short and easy to read. Add a short README.md: what it is, how to run or install it, the features, and the 'Done when' list with how to check each one. Don't run git commands and don't use the browser preview pane; I'll test it myself. First save this message word for word in prompts.md under '## Prompt 1 - build'. When you're done, reply with the file list and what I should test.

## Prompt 2 - fix 1

Fix 1: I tested it. A full 3-lap race works (about 12 s a lap), checkpoints count properly and the best time survives a reload. One problem: on a 375 x 812 phone screen the Gas button sits at x 284 with width 103, so it runs 12 px off the right edge, and Brake (x 189) touches Right (ends at x 190). Keep all four touch buttons fully inside the screen with a small gap between them and some padding from the edges (respect the phone's safe area too), on narrow phones (320 px) as well as in landscape. Also bump CACHE in sw.js since files changed. Add this message to prompts.md as '## Prompt 2 - fix 1'. Don't run git or use the browser preview pane.
