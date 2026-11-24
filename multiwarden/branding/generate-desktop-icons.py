"""Generates the Multiwarden desktop app's icons from the extension's keyhole artwork.

Run: python3 multiwarden/branding/generate-desktop-icons.py
Writes to multiwarden/branding/desktop/, using the file names multiwarden/scripts/brand-desktop.mjs
copies over Bitwarden's: the installer/app icons (icon.png, icon.ico, icon.icns, icons/), the
in-app icons (images/) and the tray icons (template and highlight variants for macOS).
"""
import importlib.util
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
OUT = HERE / "desktop"

spec = importlib.util.spec_from_file_location("generate_icons", HERE / "generate-icons.py")
generate_icons = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generate_icons)


def silhouette(img, colour):
    """The artwork's shape in one colour (macOS menu bar template / highlight icons)."""
    alpha = img.getchannel("A")
    # The keyhole is cut out of the vault, so the template shows it as a hole.
    keyhole = img.convert("L").point(lambda v: 255 if v > 240 else 0)
    alpha = Image.composite(Image.new("L", img.size, 0), alpha, keyhole)
    out = Image.new("RGBA", img.size, colour + (0,))
    out.putalpha(alpha)
    return out


def main():
    (OUT / "icons").mkdir(parents=True, exist_ok=True)
    (OUT / "images").mkdir(parents=True, exist_ok=True)
    art = generate_icons.master()

    def sized(size):
        return art.resize((size, size), Image.LANCZOS)

    sized(1024).save(OUT / "icon.png")
    sized(256).save(OUT / "icon.ico", sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)])
    sized(1024).save(OUT / "icon.icns")
    for size in (16, 32, 64, 128, 256, 512, 1024):
        sized(size).save(OUT / "icons" / f"{size}x{size}.png")

    sized(512).save(OUT / "images" / "icon.png")
    sized(256).save(OUT / "images" / "icon.ico", sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)])
    for suffix, size in (("", 16), ("@2x", 32)):
        small = sized(size)
        silhouette(small, (0, 0, 0)).save(OUT / "images" / f"icon-template{suffix}.png")
        silhouette(small, (255, 255, 255)).save(OUT / "images" / f"icon-highlight{suffix}.png")


if __name__ == "__main__":
    main()
