# GestureDrive 3.14

GestureDrive is a gesture-controlled driving project with two complementary parts:

- **Web game (`index.html`)** — a browser-based open-world driving game that supports keyboard controls and browser camera/hand tracking.
- **Desktop controller (`main.py`)** — a Windows/Python application that uses OpenCV + MediaPipe to translate hand gestures into keyboard input for racing games. It also contains a local WebSocket bridge for compatible clients.

The project is designed to keep the existing gameplay and gesture-control experience while remaining simple to run locally and easy to publish on GitHub.

## Features

### Browser game

- Open-world driving gameplay rendered with Three.js.
- Keyboard controls.
- Browser camera gesture control using MediaPipe Tasks Vision.
- Steering, acceleration, braking/reverse, boost, ramps, traffic, coins, minimap, audio, and fullscreen support.
- Responsive HUD for desktop and smaller screens.

### Desktop controller

- Webcam hand tracking with MediaPipe.
- Two-hand steering with smoothing and calibration.
- Right index finger for acceleration.
- Left index finger for braking.
- Keyboard output through `pynput`.
- Camera preview and gesture status information.
- Local WebSocket bridge on `127.0.0.1:8765` for compatible local clients.

## Technologies Used

- HTML5 / CSS3 / JavaScript
- Three.js r128
- MediaPipe Tasks Vision 0.10.21 (browser)
- Python 3.14 target (desktop controller)
- OpenCV
- MediaPipe Tasks
- PySide6
- pynput
- NumPy

## Project Structure

```text
GestureDrive/
├── index.html              # Browser game
├── main.py                 # Desktop gesture controller
├── hand_landmarker.task    # Local MediaPipe hand model for Python
├── requirements.txt        # Python dependencies
├── install.bat             # Windows dependency installer
├── run.bat                 # Windows launcher
├── .gitignore
└── README.md
```

## Browser Game — Local Development

The browser game is a static web application. A local HTTP server is recommended instead of opening `index.html` directly, especially when using the camera.

For example, with Python:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

Camera access requires a secure context in normal browser security rules. `localhost` is treated as a secure development context, and a Vercel deployment is served over HTTPS.

### Browser controls

- **W / Arrow Up** — accelerate
- **S / Arrow Down / Space** — brake/reverse
- **A / Arrow Left** — steer left
- **D / Arrow Right** — steer right
- **R** — reset
- **F** — fullscreen
- **C** — camera mode
- **H** — horn
- **M** — sound toggle

The game can also use the camera mode from its start screen. Camera and MediaPipe resources are loaded from pinned external CDNs/model hosting at runtime.

## Desktop Controller — Windows

The desktop controller is intended for Windows because it uses Windows-friendly camera and keyboard automation workflows and the provided `.bat` launchers.

### Install

From PowerShell in the project folder:

```powershell
py -3.14 -m pip install -r requirements.txt
```

Or run:

```text
install.bat
```

### Run

```powershell
py -3.14 main.py
```

Or run:

```text
run.bat
```

The included `hand_landmarker.task` file is used locally by the Python controller, so the model does not need to be downloaded during normal startup.

## Environment Variables

This project currently does **not** require environment variables or API credentials.

Do not add real secrets to the repository if future integrations are introduced. Client-side variables such as Vite-style `VITE_*` variables are not relevant to the current static project.

## Build / Verification

There is no Node.js package or JavaScript build step in the current project. The browser game is a static `index.html` application.

The Python controller can be syntax-checked with:

```bash
python -m py_compile main.py
```

For the browser code, the JavaScript syntax can be checked by extracting the inline script and running it through a JavaScript parser such as Node.js.

## Vercel Deployment

The browser game can be deployed as a static site on Vercel.

Recommended settings for the current project:

```text
Framework Preset: Other
Build Command: None / leave empty
Output Directory: .
Install Command: None / leave empty
```

No `vercel.json` is required for the current single-page static application.

### Important limitation

Vercel hosts the browser game (`index.html`). It does **not** run the Windows Python desktop controller. The desktop controller remains a local Windows application.

If you want the published web game to use its browser camera mode, users should allow camera access in their browser when prompted.

## GitHub

Commit the source files, configuration, model file, and documentation. Do **not** commit local environments or generated artifacts such as:

```text
.venv/
node_modules/
dist/
.env
__pycache__/
```

The included `.gitignore` is configured to exclude these local/generated files.

## Future Improvements

Potential future improvements include:

- Additional browser gameplay features and levels.
- More gesture customization.
- Improved accessibility controls.
- Optional packaging of browser dependencies for environments where external CDN access is undesirable.
- A dedicated compatible WebSocket client if the local Python bridge is used for browser-game control.

## License

No license file is currently included. Add a license before accepting external contributions or redistributing the project if you want to define reuse terms.
