#!/usr/bin/env python3
"""
Stage the locally collected StarCraft 1 reference assets for the optional
local-only asset pack.

The source pack is NOT redistributable and is excluded from git. This script
only prepares files for the local development machine. Public/CI builds must
run without the pack and fall back to the procedural visuals/audio.

Usage:
    python scripts/stage-starcraft-pack.py
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "artifacts" / "starcraft1"
DST = ROOT / "public" / "assets" / "sc-local"

AUDIO = [
    "Button.wav",
    "Marine.selected.wav",
    "Marine.attack.wav",
    "Tank.selected.wav",
    "Tank.attack2.wav",
    "upgrade.Terran.wav",
    "Zergling.death.wav",
    "Hydralisk.death.wav",
    "Ultralisk.death.wav",
    "TerranBuilding.death.wav",
    "YouWin.wav",
    "YouLose.wav",
]


def fit_frame(image: Image.Image, max_size: int) -> Image.Image:
    image = image.convert("RGBA")
    bbox = image.getchannel("A").getbbox()
    if bbox:
        image = image.crop(bbox)
    scale = min(max_size / max(1, image.width), max_size / max(1, image.height))
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    image = image.resize(size, Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    canvas.alpha_composite(image, ((96 - image.width) // 2, (96 - image.height) // 2))
    return canvas


def keep_largest_component(image: Image.Image) -> Image.Image:
    """Drop stray pixels from the neighboring sprite frame in a Zerg atlas."""
    image = image.convert("RGBA")
    width, height = image.size
    alpha = image.getchannel("A").load()
    seen: set[tuple[int, int]] = set()
    best: list[tuple[int, int, int, int]] = []
    best_count = -1
    for y in range(height):
        for x in range(width):
            if alpha[x, y] <= 20 or (x, y) in seen:
                continue
            queue = [(x, y)]
            seen.add((x, y))
            min_x = max_x = x
            min_y = max_y = y
            count = 0
            while queue:
                cx, cy = queue.pop()
                count += 1
                min_x, max_x = min(min_x, cx), max(max_x, cx)
                min_y, max_y = min(min_y, cy), max(max_y, cy)
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if (
                            0 <= nx < width
                            and 0 <= ny < height
                            and alpha[nx, ny] > 20
                            and (nx, ny) not in seen
                        ):
                            seen.add((nx, ny))
                            queue.append((nx, ny))
            if count > best_count:
                best_count = count
                best = [min_x, min_y, max_x + 1, max_y + 1]
    return image.crop(tuple(best)) if best else image


def crop_frame(path: Path, frame_w: int, frame_h: int, col: int, row: int) -> Image.Image:
    sheet = Image.open(path).convert("RGBA")
    return sheet.crop(
        (col * frame_w, row * frame_h, (col + 1) * frame_w, (row + 1) * frame_h)
    )


def build_explosion_sheet() -> Image.Image:
    sheet = Image.open(SRC / "images" / "effects-ui" / "BuildingBurst.png").convert("RGBA")
    frames: list[Image.Image] = []
    for row, col in [(0, 0), (0, 1), (0, 2), (0, 3), (0, 4), (1, 0), (1, 1), (1, 2), (1, 3)]:
        frame = sheet.crop((col * 200, row * 200, (col + 1) * 200, (row + 1) * 200))
        frames.append(frame.resize((160, 160), Image.Resampling.NEAREST))
    strip = Image.new("RGBA", (len(frames) * 160, 160), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * 160, 0))
    return strip


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"source pack not found: {SRC}")
    (DST / "audio").mkdir(parents=True, exist_ok=True)
    (DST / "images").mkdir(parents=True, exist_ok=True)

    for name in AUDIO:
        source = None
        for sub in ("terran", "zerg", "protoss", "interface"):
            candidate = SRC / "audio" / sub / name
            if candidate.is_file():
                source = candidate
                break
        if source is None:
            raise SystemExit(f"audio source missing: {name}")
        shutil.copy2(source, DST / "audio" / name)

    marine = fit_frame(crop_frame(SRC / "images" / "terran" / "Marine.png", 64, 64, 0, 0), 72)
    tank = fit_frame(crop_frame(SRC / "images" / "terran" / "Tank.png", 128, 128, 0, 0), 86)
    marine.save(DST / "images" / "sc-marine.png")
    tank.save(DST / "images" / "sc-tank.png")
    build_explosion_sheet().save(DST / "images" / "sc-explosion.png")

    # Zerg enemy frames: take a clear frame from the top-left of each atlas.
    zerg = {
        "sc-enemy-zergling": ("Zergling.png", (8, 5, 50, 35), 80),
        "sc-enemy-hydralisk": ("Hydralisk.png", (4, 5, 46, 64), 84),
        "sc-enemy-lurker": ("Lurker.png", (4, 2, 76, 72), 86),
        "sc-enemy-ultralisk": ("Ultralisk.png", (10, 8, 106, 82), 88),
    }
    for key, (filename, box, max_size) in zerg.items():
        source = Image.open(SRC / "images" / "zerg" / filename).convert("RGBA").crop(box)
        fit_frame(keep_largest_component(source), max_size).save(
            DST / "images" / f"{key}.png"
        )

    manifest = {
        "available": True,
        "note": "Local-only StarCraft reference pack. Do not commit or redistribute.",
        "images": {
            "sc-marine": "images/sc-marine.png",
            "sc-tank": "images/sc-tank.png",
            "sc-enemy-zergling": "images/sc-enemy-zergling.png",
            "sc-enemy-hydralisk": "images/sc-enemy-hydralisk.png",
            "sc-enemy-lurker": "images/sc-enemy-lurker.png",
            "sc-enemy-ultralisk": "images/sc-enemy-ultralisk.png",
        },
        "spritesheets": {
            "sc-explosion": {
                "path": "images/sc-explosion.png",
                "frameWidth": 160,
                "frameHeight": 160,
                "endFrame": 8,
            }
        },
        "audio": [
            "Button",
            "Marine.selected",
            "Marine.attack",
            "Tank.selected",
            "Tank.attack2",
            "upgrade.Terran",
            "Zergling.death",
            "Hydralisk.death",
            "Ultralisk.death",
            "TerranBuilding.death",
            "YouWin",
            "YouLose",
        ],
    }
    (DST / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"staged local StarCraft pack: {DST}")


if __name__ == "__main__":
    main()
    import runpy
    runpy.run_path(str(ROOT / "scripts" / "stage-motion-pack.py"), run_name="__main__")
