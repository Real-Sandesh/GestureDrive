# GestureDrive

GestureDrive is a browser-based 3D driving game that uses real-time hand gestures and webcam tracking for vehicle control. It combines interactive gameplay with gesture recognition for a hands-free driving experience.

tial: https://gesturedrive.vercel.app/

## Features

- 3D browser-based driving game
- Webcam-based hand gesture controls
- Real-time hand tracking
- Keyboard controls
- Interactive driving environment
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
├── index.html
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
