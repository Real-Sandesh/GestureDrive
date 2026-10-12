# GestureDrive

GestureDrive is a browser-based 3D driving game that uses real-time hand gestures and webcam tracking for vehicle control. It combines interactive gameplay with gesture recognition for a hands-free driving experience.

tial: https://gesturedrive.vercel.app/

## Features

- 3D browser-based driving game with PBR paint, reflections, real sun shadows, a day/night sky, clouds and stars
- Webcam-based hand gesture controls (or keyboard)
- **Garage and shop**: 8 cars and 4 motorbikes, each with its own look, stats and engine sound
- **Coins are a real currency**: collect coins and gems, chain them for streak multipliers, land jumps for bonuses, then unlock vehicles
- Repaint any vehicle (9 colours), your progress is saved in the browser
- District-aware minimap with extruded buildings, a compass bezel, zoom and a pointer to the nearest coin
- Tyre smoke, exhaust flames, sparks, street lamps that light up at night
- Optional local Python gesture controller

## Technologies

- HTML, CSS and JavaScript
- Three.js
- MediaPipe
- Python (local controller)
- OpenCV
- NumPy
- PySide6
- pynput
- WebSockets

## Project Structure

```text
GestureDrive/
├── index.html              (page markup: menu, HUD, garage, settings)
├── css/style.css           (all styling)
├── fonts/                  (Unbounded + Barlow Semi Condensed, self-hosted)
├── js/
│   ├── vehicle-kit.js      (helpers that build cars/bikes procedurally)
│   ├── vehicles-cars.js    (car builder + Comet S)
│   ├── vehicles-cars2.js   (the other 7 cars + civilian traffic)
│   ├── vehicles-bikes.js   (bike builder + 4 bikes)
│   └── game.js             (world, physics, audio, HUD, minimap, garage, gestures)
├── desktop-controller/
│   ├── gesture_controller.py
│   ├── hand_landmarker.task
│   └── requirements.txt
├── install.bat
├── run.bat
├── .gitignore
└── README.md
```

## Run the Browser Game

The browser game is a static HTML/JavaScript application.

Open `index.html` in a modern browser and allow camera access when prompted.

### Deploy to Vercel

This repository is intentionally configured as a static website. There is no Node.js build step and no Python serverless function.

Use these Vercel settings:

```text
Framework Preset: Other
Build Command: None
Output Directory: .
Install Command: None
Root Directory: .
```

Do not configure the Python controller as a Vercel Function. It is a local desktop application and is not required for hosting the browser game.

## Run the Local Python Controller

The Python controller is intended for a local Windows environment.

Create a virtual environment:

```bash
python -m venv .venv
```

Activate it:

```bash
.venv\Scripts\activate
```

Install its dependencies:

```bash
pip install -r desktop-controller/requirements.txt
```

Run it:

```bash
python desktop-controller/gesture_controller.py
```

The included `install.bat` and `run.bat` files can also be used on Windows.

## Environment Variables

No environment variables or API keys are currently required.

## GitHub

Do not commit local development environments or generated files such as:

```text
.venv/
__pycache__/
.env
dist/
build/
```

These are covered by `.gitignore`.

## Notes

The browser game and Python controller are separate components.

Vercel hosts the browser game as a static website. The Python controller requires a local Windows environment and is not executed by Vercel.

## Future Improvements

- Additional gesture controls
- More vehicles and environments
- Improved hand-tracking accuracy
- Additional game modes
- Score and leaderboard features
- Further performance improvements

## License

This is a personal project. Third-party libraries and assets remain subject to their respective licenses.


## Vehicles and coins

| Vehicle | Type | Price (coins) |
|---|---|---|
| Comet S | Hot hatch | free |
| Dust Devil MX | Dirt bike | 350 |
| Bulldog 69 | Muscle car | 450 |
| Blade 600 | Sport bike | 900 |
| Kaze RX | Tuner coupe | 950 |
| Ridgeback | Pickup 4x4 | 1,300 |
| Outlaw 1200 | Cruiser | 1,500 |
| Volt Aero | Electric GT | 1,900 |
| Zephyr | Roadster | 2,600 |
| Ghost RR | Superbike | 3,600 |
| Vanta S1 | Supercar | 4,200 |
| Spectre X | Hypercar | 8,000 |

- A coin is worth 1, a gem 10. Ten coins in a row (each within 2.5 s) doubles the reward, 25 in a row triples it.
- Landing a ramp jump pays a bonus that grows with air time.
- Press **G** (or use the pause menu) to open the Garage mid-game.
- Prices, stats and looks live in the `K.defs.push({...})` blocks in `js/vehicles-*.js`.

### Testing the shop quickly

Open the browser console (F12) and use the debug helpers:

```js
__gd.addCoins(10000)   // give yourself coins
__gd.unlockAll()       // unlock every vehicle
__gd.setVehicle('spectre')
```

Progress is stored in `localStorage` under `gesturedrive_save_v1` (clear it to start over).

## Controls

Camera: both hands up like a wheel to steer, right index finger up = gas, left index finger up = brake/reverse.
Keyboard: W/A/S/D or arrows, Space = brake, Shift = nitro boost. R reset, G garage, C camera preview, H horn, M mute,
Z minimap zoom, F fullscreen, P photo mode, Esc pause/exit.

While driving, typing a vehicle's name (its id works too, e.g. `comet`, `spectre`, `ghost`) instantly unlocks and
selects it, GTA-style - just start typing, there's no dedicated "enter cheat" key. A few bonus words also work:
`GIVEMECASH` (+5000 coins), `UNLOCKALL` (every vehicle), `NIGHTTIME` / `DAYTIME` (snap the sky). The buffer clears
itself after a couple of seconds of not typing.

## Changelog - Phase 2 hotfix: broken rendering & camera feel

Two bugs got through the first Phase 2 pass and made it into your hands - sorry about that.
Both are fixed now:

- **Buildings/world rendering glitchy, "half gone."** The bloom effect renders the scene into
  an off-screen buffer before compositing it back, and that buffer was accidentally created
  *without a depth buffer* (an argument-order mistake - the option that was supposed to turn
  it on got immediately overwritten back off). With no depth buffer, the GPU has no way to
  know which surface is in front of which, so buildings, roads and everything else could draw
  in the wrong order - exactly the "glitchy / half gone" look. Fixed; verified by driving
  through dense parts of the city at high quality (where overlapping geometry would have
  shown it worst) and confirming everything draws correctly.
- **Driving felt unsmooth, couldn't drift.** The camera-smoothing pass added a slight lag and
  a sideways lean to *where the camera looks*, not just where it sits. That's exactly the cue
  you read to judge the car's heading mid-drift, so lagging or skewing it made the car feel
  disconnected from the view. The look direction is back to tracking the car's heading
  instantly, with zero lag and zero lean - identical to how it worked before Phase 2. The
  camera's *position* still trails smoothly (unchanged from before) and the crash-shake wander
  is still smoothed (that part never touched steering feel), so the improvements that didn't
  hurt control are kept.

## Changelog - Phase 2: cheats, camera, photo mode & visuals

- **Cheat codes.** GTA-style: type a vehicle's name or id while driving and it unlocks and
  becomes your ride immediately, with a distinct amber "cheat activated" toast. A handful of
  bonus words are included too (see Controls above). Typing shares the keyboard with a few
  existing single-letter shortcuts (R/G/Z/C/F/M/P) - a bare tap of one of those still fires
  it normally, but once you're partway through typing a word, those letters are claimed by
  the cheat buffer instead so e.g. typing "SPECTRE" is never interrupted by the P (photo
  mode) shortcut firing on the P in the middle. The one exception: starting completely fresh
  with "G" (for "GHOST" or "GIVEMECASH") gets a short grace window before the garage
  shortcut fires, so it doesn't pop open mid-word either.
- **Smoother camera.** The chase camera now eases toward a look-ahead point instead of
  snapping to it every frame, leans slightly into turns based on your steering, and the
  crash-shake is a smoothed wander instead of raw per-frame jitter - it reads as a handheld
  wobble rather than static noise.
- **Photo mode (P).** Freezes the car and the world, and gives you a free-look orbit camera
  - drag to look around, scroll to zoom, S to save a PNG, P or Esc to exit. A hint bar at the
  bottom shows the controls while it's active.
- **Bloom.** Bright lights (headlights, taillights, neon window glow, boost pads) now bloom
  softly, most noticeable at night. Three-pass, dependency-free (threshold → blur → add
  back), scaled to quality: off on Low, a light pass on Medium, a fuller one on High.
- **City shopfronts.** About half of the taller city buildings now get a bright ground-floor
  band and awning, so street level reads as storefronts rather than a plain tower base.
- Your own ramp-removal and Shift-nitro changes from the last upload are untouched and still
  the base this phase was built on - this round didn't touch ramp or boost logic at all.

## Changelog - Phase 1: ramp & boost fixes

- **Ramps rebuilt.** The guard rails used to be a plain floating box sized independently of
  the slope, which from a distance read as a solid black wall. They're now generated so the
  rail's bottom edge is mathematically the same line as the ramp's own slope, tapering from
  a low kerb at the base to a proper guard height at the lip - no floating geometry, no gap.
  Brighter rail colour, white chevrons, a red boost strip and amber lamps (lit at night).
- **Ramps moved off the road.** They now sit on the grass shoulder beside the road, reached
  by a short paved peel-off lane with a painted hazard stripe, so through traffic is never
  blocked and there's nothing in the middle of a driving lane to swerve around.
- **Ramps are now solid.** Hitting one from the side or the back stops the car like a real
  obstacle instead of letting it clip through; riding it properly (lined up, from the low
  end) still works exactly as before. The same fix (solid-but-not-tunnelable collision)
  already covered buildings; ramps now use the same system.
- **Boost smoothed out.** The blue speed pad no longer snaps your speed up instantly - it
  now eases in over about a second, same peak speed, no jolt. The exhaust-flame effect and
  the camera's speed-kick now fade in and out instead of switching on/off like a light switch.
