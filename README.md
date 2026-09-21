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
Keyboard: W/A/S/D or arrows, Space = brake. R reset, G garage, C camera preview, H horn, M mute, Z minimap zoom, F fullscreen, Esc pause.
