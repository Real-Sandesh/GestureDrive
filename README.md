# GestureDrive

GestureDrive is a browser-based 3D driving game that uses real-time hand gestures and webcam tracking for vehicle control. It combines interactive gameplay with gesture recognition for a hands-free driving experience.

## Features

- 3D browser-based driving game
- Webcam-based hand gesture controls
- Real-time hand tracking
- Keyboard controls
- Interactive driving environment
- Python desktop gesture controller
- MediaPipe hand tracking

## Technologies

- HTML, CSS and JavaScript
- Three.js
- MediaPipe
- Python
- OpenCV
- NumPy
- PySide6
- pynput
- WebSockets

## Project Structure

```text
GestureDrive/
├── desktop-controller/
│   ├── main.py
│   └── hand_landmarker.task
├── index.html
├── requirements.txt
├── install.bat
├── run.bat
├── .gitignore
└── README.md
```

The browser game is the part deployed to Vercel. The Python controller is a separate local Windows component and is not executed by Vercel.

## Run the Browser Game

The web version is a static HTML/JavaScript application.

You can open `index.html` in a modern browser and allow camera access when prompted.

For deployment, the project can be connected directly to Vercel. No Node.js build step is required.

### Vercel settings

```text
Framework Preset: Other
Build Command: None
Output Directory: .
Install Command: None
```

The project does not require a `vercel.json`.

## Run the Python Controller

The Python controller is intended to run locally on Windows.

Create a virtual environment:

```bash
python -m venv .venv
```

Activate it:

```bash
.venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run the controller:

```bash
python desktop-desktop-controller/gesture_controller.py
```

You can also use the included `install.bat` and `run.bat` files.

## Environment Variables

GestureDrive does not currently require any environment variables or API keys.

## GitHub

The repository intentionally does not include local development environments such as `.venv` or Python cache files.

Before committing, make sure files such as these remain ignored:

```text
.venv/
__pycache__/
.env
dist/
build/
```

## Notes

The browser version and Python controller are separate parts of the project.

Vercel hosts the browser game as a static website. The Python controller requires a local Windows environment with access to the required hardware and Python dependencies.

## Future Improvements

- Additional gesture controls
- More vehicles and environments
- Improved hand-tracking accuracy
- Additional game modes
- Score and leaderboard features
- Further performance improvements

## License

This is a personal project. Third-party libraries and assets remain subject to their respective licenses.
