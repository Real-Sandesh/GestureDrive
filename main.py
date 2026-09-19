import os
import sys
import json
import math
import time
import urllib.request
from collections import deque

import cv2
import mediapipe as mp

from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

from PySide6.QtCore import QTimer, Qt, QObject, QByteArray
from PySide6.QtNetwork import QHostAddress
from PySide6.QtWebSockets import QWebSocketServer
from PySide6.QtGui import QImage, QPixmap
from PySide6.QtWidgets import (
    QApplication,
    QWidget,
    QLabel,
    QPushButton,
    QVBoxLayout,
    QHBoxLayout,
    QProgressBar,
    QMessageBox,
)

from pynput.keyboard import Controller

keyboard = Controller()


MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"
)

MODEL_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "hand_landmarker.task"
)


HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (5, 9), (9, 10), (10, 11), (11, 12),
    (9, 13), (13, 14), (14, 15), (15, 16),
    (13, 17), (17, 18), (18, 19), (19, 20),
    (0, 17),
]


def ensure_model():
    if not os.path.exists(MODEL_PATH):
        print("Downloading hand_landmarker.task...")
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)

    return MODEL_PATH


def clamp(value, minimum, maximum):
    return max(minimum, min(maximum, value))


def lerp(current, target, amount):
    return current + (target - current) * amount


def distance_2d(a, b):
    return math.hypot(a.x - b.x, a.y - b.y)


def draw_hand(frame, landmarks, color=(0, 255, 0)):
    h, w, _ = frame.shape

    points = [
        (
            int(clamp(p.x, 0, 1) * w),
            int(clamp(p.y, 0, 1) * h)
        )
        for p in landmarks
    ]

    for a, b in HAND_CONNECTIONS:
        cv2.line(
            frame,
            points[a],
            points[b],
            color,
            2,
            cv2.LINE_AA
        )

    for point in points:
        cv2.circle(
            frame,
            point,
            4,
            (0, 0, 255),
            -1,
            cv2.LINE_AA
        )


def finger_is_extended(landmarks, tip, pip, wrist=0):
    wrist_to_tip = distance_2d(
        landmarks[wrist],
        landmarks[tip]
    )

    wrist_to_pip = distance_2d(
        landmarks[wrist],
        landmarks[pip]
    )

    return wrist_to_tip > wrist_to_pip * 1.18


def index_extended(landmarks):
    return finger_is_extended(
        landmarks,
        8,
        6
    )


def get_palm_center(landmarks):
    ids = [0, 5, 9, 13, 17]

    x = sum(landmarks[i].x for i in ids) / len(ids)
    y = sum(landmarks[i].y for i in ids) / len(ids)

    return x, y


class WebBridge(QObject):

    PORT = 8765

    def __init__(self, parent=None):
        super().__init__(parent)

        self.clients = []

        self.server = QWebSocketServer(
            "GestureDrive",
            QWebSocketServer.SslMode.NonSecureMode,
            self
        )

        self.ok = self.server.listen(
            QHostAddress.SpecialAddress.LocalHost,
            self.PORT
        )

        if self.ok:
            self.server.newConnection.connect(
                self._on_connect
            )

    def _on_connect(self):
        socket = self.server.nextPendingConnection()

        self.clients.append(socket)

        socket.disconnected.connect(
            lambda s=socket: self._on_disconnect(s)
        )

    def _on_disconnect(self, socket):
        if socket in self.clients:
            self.clients.remove(socket)

        try:
            socket.deleteLater()
        except RuntimeError:
            pass

    def send(self, steer, gas, brake, hands, confidence=0):
        if not self.clients:
            return

        message = json.dumps({
            "steer": round(steer / 100.0, 3),
            "gas": bool(gas),
            "brake": bool(brake),
            "hands": hands,
            "confidence": round(confidence, 2)
        })

        for socket in list(self.clients):
            try:
                socket.sendTextMessage(message)
            except RuntimeError:
                if socket in self.clients:
                    self.clients.remove(socket)

    def send_frame(self, frame):
        if not self.clients:
            return

        small = cv2.resize(
            frame,
            (320, 240),
            interpolation=cv2.INTER_AREA
        )

        ok, buffer = cv2.imencode(
            ".jpg",
            small,
            [
                int(cv2.IMWRITE_JPEG_QUALITY),
                55
            ]
        )

        if not ok:
            return

        data = QByteArray(buffer.tobytes())

        for socket in list(self.clients):
            try:
                if socket.bytesToWrite() < 40000:
                    socket.sendBinaryMessage(data)
            except RuntimeError:
                if socket in self.clients:
                    self.clients.remove(socket)

    def close(self):
        self.server.close()


class GestureDrive(QWidget):

    def __init__(self):
        super().__init__()

        self.setWindowTitle(
            "GestureDrive - Advanced Gesture Controller"
        )

        self.resize(1050, 760)

        self.cap = None
        self.running = False

        self.key_state = {
            "a": False,
            "d": False,
            "w": False,
            "s": False
        }

        self.last_ts = 0
        self.note_shown = False

        # --------------------------------------------------
        # Gesture smoothing
        # --------------------------------------------------

        self.steer_history = deque(maxlen=7)

        self.filtered_steer = 0.0

        self.target_steer = 0.0

        self.steer_center = 0.0

        self.calibration_samples = []

        self.calibrating = False

        # --------------------------------------------------
        # Gesture stability
        # --------------------------------------------------

        self.accel_frames = 0
        self.brake_frames = 0

        self.accel_state = False
        self.brake_state = False

        self.hand_missing_frames = 0

        self.last_confidence = 0.0

        # --------------------------------------------------
        # Performance
        # --------------------------------------------------

        self.last_fps_time = time.monotonic()
        self.fps_counter = 0
        self.fps = 0

        # --------------------------------------------------
        # Settings
        # --------------------------------------------------

        self.STEERING_SENSITIVITY = 2.0

        self.STEERING_DEADZONE = 4

        self.STEERING_SMOOTHING = 0.20

        self.GESTURE_ON_FRAMES = 3

        self.GESTURE_OFF_FRAMES = 3

        self.HAND_LOST_TOLERANCE = 8

        self.MIN_CONFIDENCE = 0.60

        # --------------------------------------------------
        # UI
        # --------------------------------------------------

        self.title = QLabel(
            "GestureDrive"
        )

        self.title.setStyleSheet(
            "font-size: 28px; font-weight: bold;"
        )

        self.status = QLabel(
            "Camera stopped"
        )

        self.status.setStyleSheet(
            "font-size: 16px;"
        )

        self.video = QLabel(
            "Camera preview"
        )

        self.video.setAlignment(
            Qt.AlignmentFlag.AlignCenter
        )

        self.video.setMinimumSize(
            800,
            520
        )

        self.video.setStyleSheet(
            "background:#111;"
            "color:#aaa;"
            "border-radius:10px;"
        )

        self.steering = QProgressBar()

        self.steering.setRange(
            -100,
            100
        )

        self.steering.setValue(
            0
        )

        self.steering.setFormat(
            "Steering: %v"
        )

        self.controls = QLabel(
            "RIGHT INDEX = ACCELERATE     "
            "LEFT INDEX = BRAKE\n"
            "Rotate your hands like a steering wheel."
        )

        self.calibrate_btn = QPushButton(
            "Calibrate Steering Center"
        )

        self.start_btn = QPushButton(
            "Start Camera"
        )

        self.stop_btn = QPushButton(
            "Stop"
        )

        self.stop_btn.setEnabled(
            False
        )

        self.calibrate_btn.setEnabled(
            False
        )

        self.start_btn.clicked.connect(
            self.start_camera
        )

        self.stop_btn.clicked.connect(
            self.stop_camera
        )

        self.calibrate_btn.clicked.connect(
            self.start_calibration
        )

        row = QHBoxLayout()

        row.addWidget(
            self.start_btn
        )

        row.addWidget(
            self.stop_btn
        )

        row.addWidget(
            self.calibrate_btn
        )

        layout = QVBoxLayout(
            self
        )

        layout.addWidget(
            self.title
        )

        layout.addWidget(
            self.status
        )

        layout.addWidget(
            self.video,
            1
        )

        layout.addWidget(
            self.steering
        )

        layout.addWidget(
            self.controls
        )

        layout.addLayout(
            row
        )

        # --------------------------------------------------
        # MediaPipe
        # --------------------------------------------------

        options = vision.HandLandmarkerOptions(

            base_options=mp_python.BaseOptions(
                model_asset_path=ensure_model()
            ),

            running_mode=vision.RunningMode.VIDEO,

            num_hands=2,

            min_hand_detection_confidence=0.65,

            min_hand_presence_confidence=0.65,

            min_tracking_confidence=0.65,
        )

        self.hands = (
            vision.HandLandmarker.create_from_options(
                options
            )
        )

        # --------------------------------------------------
        # WebSocket
        # --------------------------------------------------

        self.bridge = WebBridge(
            self
        )

        if self.bridge.ok:

            self.controls.setText(
                self.controls.text()
                +
                "\nWeb game bridge: ON "
                "(ws://127.0.0.1:%d)"
                % WebBridge.PORT
            )

        else:

            self.controls.setText(
                self.controls.text()
                +
                "\nWeb game bridge unavailable "
                "(port %d is busy)"
                % WebBridge.PORT
            )

        # --------------------------------------------------
        # Timer
        # --------------------------------------------------

        self.timer = QTimer(
            self
        )

        self.timer.timeout.connect(
            self.process_frame
        )

    # ======================================================
    # CAMERA
    # ======================================================

    def start_camera(self):

        self.cap = cv2.VideoCapture(
            0,
            cv2.CAP_DSHOW
        )

        if not self.cap.isOpened():

            self.cap = cv2.VideoCapture(
                0
            )

        if not self.cap.isOpened():

            QMessageBox.critical(
                self,
                "Camera Error",
                "Could not open the webcam."
            )

            return

        self.cap.set(
            cv2.CAP_PROP_FOURCC,
            cv2.VideoWriter_fourcc(*"MJPG")
        )

        self.cap.set(
            cv2.CAP_PROP_FRAME_WIDTH,
            640
        )

        self.cap.set(
            cv2.CAP_PROP_FRAME_HEIGHT,
            480
        )

        self.cap.set(
            cv2.CAP_PROP_FPS,
            30
        )

        self.cap.set(
            cv2.CAP_PROP_BUFFERSIZE,
            1
        )

        self.running = True

        self.start_btn.setEnabled(
            False
        )

        self.stop_btn.setEnabled(
            True
        )

        self.calibrate_btn.setEnabled(
            True
        )

        self.status.setText(
            "Camera running - show both hands"
        )

        self.timer.start(
            1
        )

    # ======================================================
    # CALIBRATION
    # ======================================================

    def start_calibration(self):

        self.calibrating = True

        self.calibration_samples.clear()

        self.steer_history.clear()

        self.status.setText(
            "CALIBRATING... Hold both hands straight for 2 seconds"
        )

    def finish_calibration(self):

        if len(self.calibration_samples) < 10:

            self.calibrating = False

            return

        self.steer_center = (
            sum(self.calibration_samples)
            /
            len(self.calibration_samples)
        )

        self.calibration_samples.clear()

        self.calibrating = False

        self.status.setText(
            "Calibration complete"
        )

    # ======================================================
    # STOP
    # ======================================================

    def stop_camera(self):

        self.running = False

        self.timer.stop()

        self.stop_all()

        self.bridge.send(
            0,
            False,
            False,
            0,
            0
        )

        if self.cap:

            self.cap.release()

            self.cap = None

        self.start_btn.setEnabled(
            True
        )

        self.stop_btn.setEnabled(
            False
        )

        self.calibrate_btn.setEnabled(
            False
        )

        self.status.setText(
            "Camera stopped"
        )

        self.video.setText(
            "Camera preview"
        )

        self.note_shown = False

        self.filtered_steer = 0

        self.target_steer = 0

        self.steer_history.clear()

    # ======================================================
    # KEY CONTROL
    # ======================================================

    def stop_all(self):

        for key in (
            "a",
            "d",
            "w",
            "s"
        ):

            try:
                keyboard.release(
                    key
                )

            except Exception:
                pass

        for key in self.key_state:

            self.key_state[key] = False

    def set_key(
        self,
        key,
        pressed
    ):

        current = self.key_state[key]

        if pressed and not current:

            keyboard.press(
                key
            )

            self.key_state[key] = True

        elif not pressed and current:

            keyboard.release(
                key
            )

            self.key_state[key] = False

    # ======================================================
    # STEERING CALCULATION
    # ======================================================

    def calculate_steering(
        self,
        left_hand,
        right_hand
    ):

        lx, ly = get_palm_center(
            left_hand
        )

        rx, ry = get_palm_center(
            right_hand
        )

        dx = rx - lx

        dy = ry - ly

        if abs(dx) < 0.05:

            return 0

        angle = math.degrees(
            math.atan2(
                dy,
                dx
            )
        )

        while angle > 90:
            angle -= 180

        while angle < -90:
            angle += 180

        raw = (
            angle * self.STEERING_SENSITIVITY
        )

        raw -= self.steer_center

        raw = clamp(
            raw,
            -100,
            100
        )

        # Dead zone
        if abs(raw) < self.STEERING_DEADZONE:

            raw = 0

        # Smooth using history
        self.steer_history.append(
            raw
        )

        sorted_values = sorted(
            self.steer_history
        )

        middle = len(
            sorted_values
        ) // 2

        median = sorted_values[
            middle
        ]

        # Exponential smoothing
        self.filtered_steer = lerp(
            self.filtered_steer,
            median,
            self.STEERING_SMOOTHING
        )

        self.filtered_steer = clamp(
            self.filtered_steer,
            -100,
            100
        )

        return int(
            round(
                self.filtered_steer
            )
        )

    # ======================================================
    # GESTURE STABILIZATION
    # ======================================================

    def update_acceleration(
        self,
        requested
    ):

        if requested:

            self.accel_frames += 1

            self.brake_frames = 0

            if (
                self.accel_frames
                >= self.GESTURE_ON_FRAMES
            ):

                self.accel_state = True

        else:

            self.accel_frames = 0

            if self.accel_state:

                self.brake_frames += 1

                if (
                    self.brake_frames
                    >= self.GESTURE_OFF_FRAMES
                ):

                    self.accel_state = False

        return self.accel_state

    def update_braking(
        self,
        requested
    ):

        if requested:

            self.brake_frames += 1

            self.accel_frames = 0

            if (
                self.brake_frames
                >= self.GESTURE_ON_FRAMES
            ):

                self.brake_state = True

        else:

            self.brake_frames = 0

            if self.brake_state:

                self.accel_frames += 1

                if (
                    self.accel_frames
                    >= self.GESTURE_OFF_FRAMES
                ):

                    self.brake_state = False

        return self.brake_state

    # ======================================================
    # MAIN FRAME PROCESSING
    # ======================================================

    def process_frame(self):

        if not self.cap:

            return

        ok, frame = self.cap.read()

        if not ok:

            return

        frame = cv2.flip(
            frame,
            1
        )

        rgb = cv2.cvtColor(
            frame,
            cv2.COLOR_BGR2RGB
        )

        mp_image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=rgb
        )

        timestamp = int(
            time.monotonic() * 1000
        )

        if timestamp <= self.last_ts:

            timestamp = (
                self.last_ts + 1
            )

        self.last_ts = timestamp

        result = self.hands.detect_for_video(
            mp_image,
            timestamp
        )

        left_hand = None
        right_hand = None

        confidence_values = []

        # --------------------------------------------------
        # Detect hands
        # --------------------------------------------------

        for index, (
            landmarks,
            handedness
        ) in enumerate(
            zip(
                result.hand_landmarks,
                result.handedness
            )
        ):

            confidence = 0

            if handedness:

                confidence = (
                    handedness[0].score
                )

            confidence_values.append(
                confidence
            )

            if confidence < self.MIN_CONFIDENCE:

                continue

            draw_hand(
                frame,
                landmarks
            )

            label = (
                handedness[0]
                .category_name
            )

            # Camera image is mirrored.
            if label == "Left":

                right_hand = landmarks

            else:

                left_hand = landmarks

        # --------------------------------------------------
        # Both hands
        # --------------------------------------------------

        both_hands = (
            left_hand is not None
            and
            right_hand is not None
        )

        if both_hands:

            self.hand_missing_frames = 0

            if confidence_values:

                self.last_confidence = (
                    sum(confidence_values)
                    /
                    len(confidence_values)
                )

            # ----------------------------------------------
            # Steering
            # ----------------------------------------------

            steer = self.calculate_steering(
                left_hand,
                right_hand
            )

            # ----------------------------------------------
            # Calibration
            # ----------------------------------------------

            if self.calibrating:

                self.calibration_samples.append(
                    steer
                )

                cv2.putText(
                    frame,
                    "CALIBRATING...",
                    (20, 45),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1,
                    (0, 255, 255),
                    2,
                    cv2.LINE_AA
                )

                if len(
                    self.calibration_samples
                ) >= 45:

                    self.finish_calibration()

            # ----------------------------------------------
            # Finger gestures
            # ----------------------------------------------

            right_index = index_extended(
                right_hand
            )

            left_index = index_extended(
                left_hand
            )

            right_accel = (
                self.update_acceleration(
                    right_index
                )
            )

            left_brake = (
                self.update_braking(
                    left_index
                )
            )

            # ----------------------------------------------
            # Keyboard steering
            # ----------------------------------------------

            steer_threshold = 12

            self.set_key(
                "a",
                steer < -steer_threshold
            )

            self.set_key(
                "d",
                steer > steer_threshold
            )

            self.set_key(
                "w",
                right_accel
                and not left_brake
            )

            self.set_key(
                "s",
                left_brake
            )

            # ----------------------------------------------
            # Visual status
            # ----------------------------------------------

            cv2.putText(
                frame,
                f"STEERING: {steer:+d}",
                (20, 45),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (255, 255, 255),
                2,
                cv2.LINE_AA
            )

            cv2.putText(
                frame,
                (
                    "ACCEL: ON"
                    if right_accel
                    else "ACCEL: OFF"
                ),
                (20, 78),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.65,
                (0, 255, 0)
                if right_accel
                else (180, 180, 180),
                2,
                cv2.LINE_AA
            )

            cv2.putText(
                frame,
                (
                    "BRAKE: ON"
                    if left_brake
                    else "BRAKE: OFF"
                ),
                (20, 108),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.65,
                (0, 0, 255)
                if left_brake
                else (180, 180, 180),
                2,
                cv2.LINE_AA
            )

            cv2.putText(
                frame,
                f"CONFIDENCE: {self.last_confidence:.0%}",
                (20, 138),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.65,
                (255, 255, 255),
                2,
                cv2.LINE_AA
            )

            self.status.setText(
                f"Hands detected | "
                f"Steering {steer:+d} | "
                f"Accelerate "
                f"{'ON' if right_accel else 'OFF'} | "
                f"Brake "
                f"{'ON' if left_brake else 'OFF'} | "
                f"Confidence "
                f"{self.last_confidence:.0%} | "
                f"FPS {self.fps}"
            )

        else:

            self.hand_missing_frames += 1

            # --------------------------------------------------
            # Don't instantly kill controls.
            # Camera detection can briefly lose a hand.
            # --------------------------------------------------

            if (
                self.hand_missing_frames
                <= self.HAND_LOST_TOLERANCE
            ):

                steer = int(
                    self.filtered_steer
                )

                self.set_key(
                    "a",
                    steer < -15
                )

                self.set_key(
                    "d",
                    steer > 15
                )

                self.status.setText(
                    "Hand temporarily lost - "
                    "recovering..."
                )

            else:

                steer = 0

                self.filtered_steer = lerp(
                    self.filtered_steer,
                    0,
                    0.18
                )

                self.set_key(
                    "a",
                    False
                )

                self.set_key(
                    "d",
                    False
                )

                self.set_key(
                    "w",
                    False
                )

                self.set_key(
                    "s",
                    False
                )

                self.accel_state = False

                self.brake_state = False

                self.status.setText(
                    "Show both hands to control the car"
                )

        # --------------------------------------------------
        # Steering UI
        # --------------------------------------------------

        self.steering.setValue(
            int(
                clamp(
                    self.filtered_steer,
                    -100,
                    100
                )
            )
        )

        # --------------------------------------------------
        # Send to web game
        # --------------------------------------------------

        self.bridge.send_frame(
            frame
        )

        hands_count = 2 if both_hands else len(
            result.hand_landmarks
        )

        self.bridge.send(
            int(
                clamp(
                    self.filtered_steer,
                    -100,
                    100
                )
            ),
            self.accel_state if both_hands else False,
            self.brake_state if both_hands else False,
            hands_count,
            self.last_confidence
        )

        # --------------------------------------------------
        # FPS
        # --------------------------------------------------

        self.fps_counter += 1

        now = time.monotonic()

        elapsed = (
            now - self.last_fps_time
        )

        if elapsed >= 1.0:

            self.fps = int(
                self.fps_counter
                /
                elapsed
            )

            self.fps_counter = 0

            self.last_fps_time = now

        # --------------------------------------------------
        # Browser game connected
        # --------------------------------------------------

        if self.bridge.clients:

            if not self.note_shown:

                self.video.clear()

                self.video.setText(
                    "Camera view is shown inside "
                    "the game window.\n"
                    "You can minimize this window."
                )

                self.note_shown = True

            return

        # --------------------------------------------------
        # Local camera preview
        # --------------------------------------------------

        self.note_shown = False

        height, width, _ = frame.shape

        image = QImage(
            frame.data,
            width,
            height,
            frame.strides[0],
            QImage.Format.Format_BGR888
        )

        self.video.setPixmap(
            QPixmap.fromImage(
                image
            ).scaled(
                self.video.size(),
                Qt.AspectRatioMode.KeepAspectRatio,
                Qt.TransformationMode.FastTransformation
            )
        )

    # ======================================================
    # CLOSE
    # ======================================================

    def closeEvent(self, event):

        self.stop_camera()

        self.hands.close()

        self.bridge.close()

        event.accept()


if __name__ == "__main__":

    app = QApplication(
        sys.argv
    )

    window = GestureDrive()

    window.show()

    sys.exit(
        app.exec()
    )