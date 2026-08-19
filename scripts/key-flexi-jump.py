"""One-off: gray-screen Flexi jump -> WebM/WebP with alpha."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import cv2
import imageio_ffmpeg
import numpy as np
from PIL import Image

SRC = Path(r"c:\Users\mathi\OneDrive\Documenten\flexishift\flexi jump.mp4")
FRAMES = Path(r"C:\Users\mathi\flexishift\tmp-frames\seq")
PUBLIC = Path(r"C:\Users\mathi\flexishift\public")
SIZE = 420


def key(bgr: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    s = hsv[:, :, 1].astype(np.float32)
    v = hsv[:, :, 2].astype(np.float32)
    bg = np.clip((34 - s) / 24.0, 0, 1) * np.clip((v - 165) / 40.0, 0, 1)
    alpha = np.clip(1 - bg, 0, 1)
    alpha = np.maximum(alpha, np.clip((130 - v) / 35.0, 0, 1))
    alpha = np.maximum(alpha, np.clip((s - 32) / 28.0, 0, 1))
    a = (alpha * 255).astype(np.uint8)
    k = np.ones((3, 3), np.uint8)
    a = cv2.erode(a, k, iterations=1)
    a = cv2.GaussianBlur(a, (3, 3), 0)
    rgba = cv2.cvtColor(bgr, cv2.COLOR_BGR2BGRA)
    rgba[:, :, 3] = a
    return rgba


def main() -> None:
    if FRAMES.exists():
        shutil.rmtree(FRAMES)
    FRAMES.mkdir(parents=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(str(SRC))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    idx = 0
    pil_frames: list[Image.Image] = []
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        rgba = key(frame)
        rgba = cv2.resize(rgba, (SIZE, SIZE), interpolation=cv2.INTER_AREA)
        cv2.imwrite(str(FRAMES / f"f{idx:04d}.png"), rgba)
        pil_frames.append(Image.fromarray(cv2.cvtColor(rgba, cv2.COLOR_BGRA2RGBA)))
        idx += 1
    cap.release()
    print("frames", idx, "fps", fps)

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    webm = PUBLIC / "flexi-jump.webm"
    cmd = [
        ffmpeg,
        "-y",
        "-framerate",
        f"{fps:.4f}",
        "-i",
        str(FRAMES / "f%04d.png"),
        "-c:v",
        "libvpx-vp9",
        "-pix_fmt",
        "yuva420p",
        "-auto-alt-ref",
        "0",
        "-b:v",
        "0",
        "-crf",
        "36",
        "-an",
        str(webm),
    ]
    subprocess.run(cmd, check=True)
    print("webm", webm, webm.stat().st_size)

    webp = PUBLIC / "flexi-jump.webp"
    duration = int(round(1000 / fps))
    pil_frames[0].save(
        webp,
        save_all=True,
        append_images=pil_frames[1:],
        duration=duration,
        loop=1,
        lossless=False,
        quality=78,
        method=4,
    )
    print("webp", webp, webp.stat().st_size)


if __name__ == "__main__":
    main()
