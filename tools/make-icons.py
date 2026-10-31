#!/usr/bin/env python3
"""Draw the Alcove launcher icons. No third-party libraries."""

import struct
import zlib
from pathlib import Path


def chunk(tag, data):
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path, width, height, pixel):
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        for x in range(width):
            raw.extend(pixel(x, y, width, height))
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    Path(path).write_bytes(png)


def inside_arch(x, y, width, height):
    """A recessed alcove: rounded arch cut into a dark slab."""
    nx = (x + 0.5) / width
    ny = (y + 0.5) / height
    if nx < 0.12 or nx > 0.88 or ny < 0.08 or ny > 0.92:
        return False
    arch_cx = 0.50
    arch_r = 0.34
    arch_cy = 0.46
    if ny < arch_cy:
        dx = (nx - arch_cx) / arch_r
        dy = (ny - arch_cy) / arch_r
        return dx * dx + dy * dy <= 1
    return 0.16 <= nx <= 0.84


def icon_pixel(x, y, width, height):
    bg = (18, 17, 16, 255)
    brass = (214, 176, 106, 255)
    recess = (32, 36, 42, 255)
    photo_a = (92, 122, 138, 255)
    photo_b = (186, 154, 112, 255)
    if not inside_arch(x, y, width, height):
        # Thin brass rim just outside the opening.
        rim = inside_arch(
            int(x * 0.92 + width * 0.04),
            int(y * 0.92 + height * 0.03),
            width,
            height,
        )
        return brass if rim else bg
    nx = (x + 0.5) / width
    ny = (y + 0.5) / height
    if ny > 0.62:
        return photo_b if nx < 0.5 else photo_a
    return photo_a if nx > 0.42 else recess


def main():
    root = Path(__file__).resolve().parents[1] / "app"
    root.mkdir(parents=True, exist_ok=True)
    write_png(root / "icon.png", 80, 80, icon_pixel)
    write_png(root / "largeIcon.png", 130, 130, icon_pixel)


if __name__ == "__main__":
    main()
