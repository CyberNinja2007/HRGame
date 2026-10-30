#!/usr/bin/env python3
"""Dev-only asset pipeline for hr-simulator/.

Reads originals from HR_Simulator_Static_HTML_Starter_Pack/assets (never modified) and the vendored
font in tools/fonts/NotoSans, and writes optimized derivatives into hr-simulator/assets.

  build            regenerate all derived assets + review sheets (tests/artifacts/asset-review)
  check            verify dimensions, alpha, byte budgets, font + licence presence
  glyphs FILE...   list code points used in FILE(s) that the font subset lacks
"""
from __future__ import annotations

import io
import json
import shutil
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "HR_Simulator_Static_HTML_Starter_Pack" / "assets"
OUT = ROOT / "hr-simulator" / "assets"
REVIEW = ROOT / "tests" / "artifacts" / "asset-review"

BACKGROUNDS = ["company", "office", "meeting_room", "victory"]
CHARACTERS = ["maria", "gennady", "pavel", "elena", "oleg", "darya"]

BG_SIZE = (1672, 941)
BG_SMALL_SIZE = (836, 471)  # Image.reduce(2) rounds 941/2 up
CHAR_SIZE = (543, 724)
AVATAR_SIZE = 192

BUDGET = {
    "bg": 300 * 1024,
    "bg_small": 100 * 1024,
    "character": 150 * 1024,
    "avatar": 24 * 1024,
    "font": 40 * 1024,
}

# Square head-and-shoulders crops on the ORIGINAL 1086x1448 portraits: (left, top, size).
CROPS = {
    "maria": (220, 60, 700),
    "gennady": (220, 90, 660),
    "pavel": (230, 110, 640),
    "elena": (210, 50, 680),
    "oleg": (220, 110, 660),
    "darya": (200, 20, 700),
}

# Pixelify Sans from the starter pack proved hard to read in Cyrillic; the game ships Noto Sans (OFL 1.1),
# vendored from the noto-fonts 2.015 release.
FONT_DIR = ROOT / "tools" / "fonts" / "NotoSans"
FONTS = {
    FONT_DIR / "NotoSans-Regular.ttf": OUT / "fonts" / "NotoSans-Regular-subset.woff2",
    FONT_DIR / "NotoSans-Bold.ttf": OUT / "fonts" / "NotoSans-Bold-subset.woff2",
}
OFL_SRC = FONT_DIR / "OFL.txt"
OFL_OUT = OUT / "fonts" / "OFL.txt"
# Noto Sans has no arrows; this one-glyph subset is loaded as part of the "Noto Sans" family (unicode-range).
SYMBOLS_SRC = FONT_DIR / "NotoSansSymbols-Regular.ttf"
SYMBOLS_OUT = OUT / "fonts" / "NotoSansSymbols-arrow.woff2"
SYMBOLS_RANGES = [(0x2192, 0x2192)]

# Pixel face for short display text only (titles, names, buttons), from the starter pack.
# "Press Start 2P" is a Reserved Font Name under its OFL, and a subset is a Modified Version,
# so the subset is renamed (name table) and loaded under that name.
PIXEL_SRC = SRC / "Press_Start_2P" / "PressStart2P-Regular.ttf"
PIXEL_OUT = OUT / "fonts" / "HRSimPixel-subset.woff2"
PIXEL_NAME = "HRSim Pixel"
PIXEL_OFL_SRC = SRC / "Press_Start_2P" / "OFL.txt"
PIXEL_OFL_OUT = OUT / "fonts" / "OFL-HRSimPixel.txt"

# Only what the Russian story can show: ASCII, basic Cyrillic and the punctuation it uses.
# `glyphs` fails if new text needs anything else.
UNICODE_RANGES = [
    (0x0020, 0x007E),
    (0x00A0, 0x00A0),
    (0x00AB, 0x00AB),
    (0x00B7, 0x00B7),
    (0x00BB, 0x00BB),
    (0x0400, 0x045F),
    (0x2010, 0x2027),
    (0x202F, 0x202F),
    (0x20BD, 0x20BD),
    (0x2116, 0x2116),
]



def webp_bytes(img: Image.Image, **opts) -> bytes:
    buf = io.BytesIO()
    img.save(buf, "WEBP", **opts)
    return buf.getvalue()


def fit_lossy(img: Image.Image, budget: int, start_q: int, min_q: int, **opts) -> tuple[bytes, int]:
    q = start_q
    while True:
        data = webp_bytes(img, quality=q, method=6, **opts)
        if len(data) <= budget:
            return data, q
        if q <= min_q:
            raise SystemExit(f"cannot fit budget {budget} at q>={min_q} (got {len(data)})")
        q -= 2


def rename_family(font: TTFont, family: str) -> None:
    name = font["name"]
    postscript = family.replace(" ", "") + "-Regular"
    for rec in list(name.names):
        if rec.nameID in (1, 16):
            name.setName(family, rec.nameID, rec.platformID, rec.platEncID, rec.langID)
        elif rec.nameID in (3, 4):
            name.setName(f"{family} Regular", rec.nameID, rec.platformID, rec.platEncID, rec.langID)
        elif rec.nameID == 6:
            name.setName(postscript, rec.nameID, rec.platformID, rec.platEncID, rec.langID)


def save_subset(font: TTFont, ranges: list[tuple[int, int]], out: Path) -> None:
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.name_IDs = ["*"]  # keep the copyright and licence records
    opts.notdef_outline = True
    opts.hinting = False  # browsers rasterise unhinted outlines well; hints were over a third of the file
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=[c for a, b in ranges for c in range(a, b + 1)])
    sub.subset(font)
    font.flavor = "woff2"
    font.save(out)


def build() -> None:
    for sub in ("backgrounds", "characters", "avatars", "ui", "fonts"):
        (OUT / sub).mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)
    metrics: dict[str, dict] = {}

    for name in BACKGROUNDS:
        src = Image.open(SRC / "backgrounds" / f"{name}.png").convert("RGB")
        assert src.size == BG_SIZE, (name, src.size)
        data, q = fit_lossy(src, BUDGET["bg"], 88, 80)
        (OUT / "backgrounds" / f"{name}.webp").write_bytes(data)
        small = src.reduce(2)
        sdata, sq = fit_lossy(small, BUDGET["bg_small"], 88, 80)
        (OUT / "backgrounds" / f"{name}-836.webp").write_bytes(sdata)
        metrics[f"bg/{name}"] = {"bytes": len(data), "q": q, "small_bytes": len(sdata), "small_q": sq}
        sheet = Image.new("RGB", (BG_SIZE[0] * 2, BG_SIZE[1]))
        sheet.paste(src, (0, 0))
        sheet.paste(Image.open(io.BytesIO(data)).convert("RGB"), (BG_SIZE[0], 0))
        sheet.save(REVIEW / f"bg-{name}.png")

    contact = Image.new("RGBA", (AVATAR_SIZE * len(CHARACTERS) + 10 * (len(CHARACTERS) + 1), AVATAR_SIZE + 20), (60, 70, 100, 255))
    for i, name in enumerate(CHARACTERS):
        src = Image.open(SRC / "characters" / f"{name}.png").convert("RGBA")
        small = src.reduce(2)
        assert small.size == CHAR_SIZE, (name, small.size)
        data = webp_bytes(small, lossless=True, method=6)
        mode = "lossless"
        if len(data) > BUDGET["character"]:
            data, q = fit_lossy(small, BUDGET["character"], 90, 70, alpha_quality=100)
            mode = f"q{q}"
        (OUT / "characters" / f"{name}.webp").write_bytes(data)

        left, top, size = CROPS[name]
        crop = src.crop((left, top, left + size, top + size)).resize((AVATAR_SIZE, AVATAR_SIZE), Image.LANCZOS)
        adata, aq = fit_lossy(crop, BUDGET["avatar"], 90, 70, alpha_quality=100)
        (OUT / "avatars" / f"{name}.webp").write_bytes(adata)
        metrics[f"character/{name}"] = {"bytes": len(data), "mode": mode, "avatar_bytes": len(adata), "avatar_q": aq}

        sheet = Image.new("RGBA", (CHAR_SIZE[0] * 2, CHAR_SIZE[1]), (90, 110, 160, 255))
        sheet.alpha_composite(small, (0, 0))
        sheet.alpha_composite(Image.open(io.BytesIO(data)).convert("RGBA"), (CHAR_SIZE[0], 0))
        sheet.save(REVIEW / f"character-{name}.png")
        contact.alpha_composite(Image.open(io.BytesIO(adata)).convert("RGBA"), (10 + i * (AVATAR_SIZE + 10), 10))
    contact.save(REVIEW / "avatars-contact.png")

    fav = Image.open(SRC / "characters" / "maria.png").convert("RGBA")
    left, top, size = CROPS["maria"]
    fav = fav.crop((left, top, left + size, top + size)).resize((32, 32), Image.LANCZOS)
    bgfav = Image.new("RGBA", (32, 32), (38, 60, 112, 255))
    bgfav.alpha_composite(fav)
    bgfav.save(OUT / "ui" / "favicon.png", optimize=True)

    for src, out in FONTS.items():
        save_subset(TTFont(src), UNICODE_RANGES, out)
        metrics[f"font/{out.name}"] = {"bytes": out.stat().st_size}
    save_subset(TTFont(SYMBOLS_SRC), SYMBOLS_RANGES, SYMBOLS_OUT)
    metrics[f"font/{SYMBOLS_OUT.name}"] = {"bytes": SYMBOLS_OUT.stat().st_size}
    shutil.copyfile(OFL_SRC, OFL_OUT)
    pixel = TTFont(PIXEL_SRC)
    rename_family(pixel, PIXEL_NAME)
    save_subset(pixel, UNICODE_RANGES, PIXEL_OUT)
    metrics[f"font/{PIXEL_OUT.name}"] = {"bytes": PIXEL_OUT.stat().st_size}
    PIXEL_OFL_OUT.write_text(
        f"{PIXEL_OUT.name} (family \"{PIXEL_NAME}\") is a subset of Press Start 2P, renamed because\n"
        "\"Press Start 2P\" is a Reserved Font Name. Original licence below.\n\n"
        + PIXEL_OFL_SRC.read_text(encoding="utf-8"),
        encoding="utf-8",
    )

    (REVIEW / "metrics.json").write_text(json.dumps(metrics, indent=2))
    print(json.dumps(metrics, indent=2))


def check() -> int:
    errors: list[str] = []

    def need(cond: bool, msg: str) -> None:
        if not cond:
            errors.append(msg)

    def img(path: Path) -> Image.Image | None:
        if not path.exists():
            errors.append(f"missing {path.relative_to(ROOT)}")
            return None
        return Image.open(path)

    for name in BACKGROUNDS:
        for suffix, size, budget in (("", BG_SIZE, BUDGET["bg"]), ("-836", BG_SMALL_SIZE, BUDGET["bg_small"])):
            p = OUT / "backgrounds" / f"{name}{suffix}.webp"
            im = img(p)
            if im:
                need(im.format == "WEBP", f"{p.name} not WEBP")
                need(im.size == size, f"{p.name} size {im.size} != {size}")
                need(p.stat().st_size <= budget, f"{p.name} {p.stat().st_size} > {budget}")
    for name in CHARACTERS:
        for sub, size, budget in (("characters", CHAR_SIZE, BUDGET["character"]), ("avatars", (AVATAR_SIZE, AVATAR_SIZE), BUDGET["avatar"])):
            p = OUT / sub / f"{name}.webp"
            im = img(p)
            if im:
                need(im.size == size, f"{sub}/{p.name} size {im.size} != {size}")
                need(im.mode == "RGBA" and im.getchannel("A").getextrema()[0] < 255, f"{sub}/{p.name} lost alpha")
                need(p.stat().st_size <= budget, f"{sub}/{p.name} {p.stat().st_size} > {budget}")
    fav = img(OUT / "ui" / "favicon.png")
    if fav:
        need(fav.size == (32, 32), "favicon not 32x32")
    for out in FONTS.values():
        need(out.exists() and out.read_bytes()[:4] == b"wOF2", f"{out.name} missing or not woff2")
        if out.exists():
            need(out.stat().st_size <= BUDGET["font"], f"{out.name} {out.stat().st_size} > {BUDGET['font']}")
            cmap = TTFont(out).getBestCmap()
            need(all(ord(c) in cmap for c in "АБВКОПабвкопЁёЙйЖжЯя«»—–…№₽\u202f"), f"{out.name} lacks required Cyrillic/punctuation")
    need(OFL_OUT.exists(), "OFL.txt missing next to the fonts")
    need(SYMBOLS_OUT.exists() and set(TTFont(SYMBOLS_OUT).getBestCmap()) >= {0x2192}, f"{SYMBOLS_OUT.name} missing or lacks U+2192")
    need(PIXEL_OUT.exists() and PIXEL_OUT.read_bytes()[:4] == b"wOF2", f"{PIXEL_OUT.name} missing or not woff2")
    if PIXEL_OUT.exists():
        pixel = TTFont(PIXEL_OUT)
        need(PIXEL_OUT.stat().st_size <= BUDGET["font"], f"{PIXEL_OUT.name} {PIXEL_OUT.stat().st_size} > {BUDGET['font']}")
        need(all(ord(c) in pixel.getBestCmap() for c in "АБВКОПабвкопЁёЙйЖжЯя«»—–…№"), f"{PIXEL_OUT.name} lacks required Cyrillic/punctuation")
        names = " ".join(str(r) for r in pixel["name"].names if r.nameID in (1, 3, 4, 6, 16))
        need("Press Start" not in names and "PressStart" not in names, f"{PIXEL_OUT.name} still uses the Reserved Font Name")
    need(PIXEL_OFL_OUT.exists(), f"{PIXEL_OFL_OUT.name} missing")
    shipped = {p.name for p in (OUT / "fonts").iterdir()}
    expected = {OFL_OUT.name, SYMBOLS_OUT.name, PIXEL_OUT.name, PIXEL_OFL_OUT.name} | {p.name for p in FONTS.values()}
    need(shipped == expected, f"unexpected files in assets/fonts: {sorted(shipped)}")
    stray = [p.relative_to(ROOT) for p in OUT.rglob("*") if p.suffix.lower() in {".ttf", ".otf"}]
    need(not stray, f"raw font files shipped: {stray}")

    for e in errors:
        print("FAIL", e)
    print("assets check:", "OK" if not errors else f"{len(errors)} error(s)")
    return 1 if errors else 0


def glyphs(files: list[str]) -> int:
    # The "Noto Sans" family as the CSS declares it: the text subset plus the arrow subset.
    cmap = set(TTFont(next(iter(FONTS.values()))).getBestCmap()) | set(TTFont(SYMBOLS_OUT).getBestCmap())
    used: set[int] = set()
    for f in files:
        text = (ROOT / f).read_text(encoding="utf-8")
        # Only characters that can reach the screen: skip ASCII control chars.
        used.update(ord(c) for c in text if ord(c) >= 0x20)
    missing = sorted(c for c in used if c not in cmap)
    for c in missing:
        print(f"MISSING U+{c:04X} {chr(c)!r}")
    print("glyphs:", "OK" if not missing else f"{len(missing)} unsupported code point(s)")
    return 1 if missing else 0


def main(argv: list[str]) -> int:
    if not argv or argv[0] not in {"build", "check", "glyphs"}:
        print(__doc__)
        return 2
    if argv[0] == "build":
        build()
        return check()
    if argv[0] == "check":
        return check()
    return glyphs(argv[1:])


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
