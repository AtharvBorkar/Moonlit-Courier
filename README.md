# Moonlit Courier

**A tiny robot, a moonlit canyon, and an endlessly long delivery route.** Moonlit Courier is an endless runner made with HTML, CSS, and JavaScript. Play it in a browser or launch the standalone Windows desktop edition. Guide Pip past glowing crystals, old relay towers, and flying moon-moth drones as the route gets faster.



## Features

- **Automatic running:** Pip keeps moving while the world and hazards scroll toward you.
- **Jumping:** Leap over ground obstacles and low-flying drones.
- **Hold-to-duck:** Hold **↓** or **S** while grounded to use Pip’s compact ducking pose and shorter hitbox.
- **Quick-drop:** Press **↓** or **S** while airborne to accelerate the descent. This does not trigger while grounded.
- **Flying obstacles:** Original pixel-art drones animate through two wing poses and appear at three heights:
  - **Low:** jump over the drone.
  - **Middle:** jump over it or duck beneath it.
  - **High:** run underneath it.
- **Difficulty scaling:** The run speeds up over time, making each hazard arrive sooner.
- **Collision and restart:** A collision ends the run. Restart from the overlay or press Space to begin another run.
- **Score and personal best:** Distance is converted into a score, and the best score is saved in browser `localStorage`.
- **Original visuals:** Pip, the drones, crystals, relay towers, moon, stars, and canyon are drawn from original pixel-style shapes—no Chrome Dinosaur assets are used.
- **Responsive, phone-ready play:** The canvas scales to landscape and portrait screens; touch controls, safe-area spacing, and browser-gesture suppression are included.
- **Installable PWA:** A web app manifest, original pixel-art icons, and a service worker cache the game shell for offline browser play.

## Play

You can open `index.html` directly in a modern browser. Alternatively, serve the folder locally:

```bash
python -m http.server 8000
```

Then visit <http://localhost:8000>.

The browser edition requires no build step or external art assets. To install the PWA, publish it to HTTPS (or use localhost during development), open it once while online so the service worker can cache the game shell, then choose the browser's **Install app** or **Add to Home Screen** option. It will launch in a standalone window and work offline after its first visit. Opening `index.html` directly still works, but browsers do not allow service-worker installation from `file://`. The Windows desktop edition packages its own Electron/Chromium runtime and game files, so players do not need Chrome, a browser, or a separate runtime installed.

## Windows desktop application

This project can be packaged as a **single, portable Windows x64 `.exe`**. Double-click the executable to play; it does not install the game and does not need an internet connection at runtime.

### Build the portable executable

Building requires Node.js and npm on the developer's machine. From the project directory, run:

```bash
npm install
npm run dist:win
```

The packaged app is written to:

```text
dist/Moonlit Courier-1.0.0-Windows-Portable.exe
```

Share that `.exe` with Windows x64 users. The build downloads Electron and packaging tools as development dependencies; these are bundled into the portable executable and are not required by players. The application loads the local game files only; it does not fetch game assets or services from the network. The executable is unsigned, so Windows SmartScreen may show its standard warning for an unrecognized publisher.

For local development of the desktop edition:

```bash
npm start
```

## Controls

| Input | Action |
| --- | --- |
| **Space**, **↑**, or **W** | Jump; Space also starts/restarts a run |
| Hold **↓** or **S** on the ground | Duck under middle-height drones |
| Press **↓** or **S** in the air | Quick-drop toward the ground |
| Tap the right half of the screen | Jump or start a run |
| Hold the lower-left screen area or the **DUCK** button | Duck on the ground; quick-drop in the air |
| Start/restart button | Begin a fresh run |

## Gameplay details

### Hazards and pacing

Ground hazards include crystals, crystal clusters, and relay towers. Drones are held back until the score reaches **100**, so the early section focuses on learning the ground obstacles. Once unlocked, each eligible hazard spawn has a **55% chance** of being a drone; its altitude is selected from the low, middle, and high flight paths. Drones travel **16% faster** than ground obstacles.

Hazards are deliberately serialized: a new one is not placed on screen while the previous hazard remains there. After it clears, the game adds a short clear-runway pause before another spawn. This avoids overlapping ground/flying patterns and gives the player time to react.

### Score and speed

The score is derived from distance travelled. The runner begins at **310** speed units and accelerates gradually, up to a maximum of **700**. Longer survival therefore means faster movement and a higher score rate.

### Collision

The game uses axis-aligned rectangle overlap checks. Pip’s grounded duck pose has its own shorter vertical hitbox. Each drone uses a compact hitbox aligned with its animated sprite, so a drone’s height determines whether it can be jumped over, ducked under, or safely passed beneath.

## Project structure

```text
.
├── index.html          # Page markup, HUD, canvas, and start/game-over overlay
├── style.css           # Responsive layout, colors, and interface styling
├── game.js             # Game loop, input, physics, collision, and canvas art
├── manifest.json       # PWA name, theme, display mode, and icons
├── service-worker.js   # Offline app-shell cache
├── icons/
│   ├── icon-192.png    # Original pixel-art install icon
│   └── icon-512.png    # Original pixel-art install icon
├── electron/
│   └── main.cjs        # Secure desktop window and application lifecycle
├── package.json        # Electron development and Windows packaging scripts
├── .gitignore          # Excludes build output and installed dependencies
└── README.md            # Project guide
```

The canvas uses a fixed logical resolution of **960 × 360** and is scaled to fit the available screen area, including phone portrait and landscape layouts. Landscape is preferred for the widest view. On touch devices, tap the right half to jump and hold the lower-left area or the on-screen **DUCK** button to duck. All game art is drawn in `game.js` with canvas shapes, preserving crisp pixel edges without image downloads.

## Tuning the game

The main constants are near the top of `game.js`:

- `BASE_SPEED` and `MAX_SPEED` set starting and maximum run speed.
- `FLYER_SCORE_THRESHOLD` controls when drones become eligible.
- `FLYER_CHANCE` controls the chance of a drone at an eligible spawn (**0.55** by default).
- `FLYER_SPEED` controls drone speed relative to ground obstacles (**1.16** by default).
- `GROUND` sets the ground line; the height tiers in `createFlyer()` set low, middle, and high drone placement.

The best score is stored under `moonlit-courier-best-v1` in `localStorage`. Clearing site data or using a fresh browser profile resets it.

## Technology

- HTML5
- CSS
- Vanilla JavaScript
- Canvas 2D API
- Web App Manifest and Service Worker (installable offline PWA)
- Electron (Windows desktop wrapper and bundled Chromium runtime)

There is no server-side component. The local server command above is optional and is only useful when you prefer to run the browser edition over HTTP. The packaged desktop app renders the same local HTML/CSS/JavaScript game and runs offline.
