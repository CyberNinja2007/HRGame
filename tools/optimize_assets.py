#!/usr/bin/env python3
"""Dev-only asset pipeline for hr-simulator/.

Reads originals from HR_Simulator_Static_HTML_Starter_Pack/assets (never modified) and writes
optimized derivatives into hr-simulator/assets.

  build            regenerate all derived assets + review sheets (tests/artifacts/asset-review)
  check            verify dimensions, alpha, byte budgets, font + licence presence
  glyphs FILE...   list code points used in FILE(s) that the font subset lacks
"""
from __future__ import annotations

import io
import json
import re
import shutil
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw

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

FONT_SRC = SRC / "Pixelify_Sans" / "PixelifySans-VariableFont_wght.ttf"
FONT_OUT = OUT / "fonts" / "PixelifySans-subset.woff2"
OFL_SRC = SRC / "Pixelify_Sans" / "OFL.txt"
OFL_OUT = OUT / "fonts" / "OFL.txt"

UNICODE_RANGES = [
    (0x0020, 0x007E),
    (0x00A0, 0x00FF),
    (0x0400, 0x045F),
    (0x2010, 0x2027),
    (0x2030, 0x203A),
    (0x2116, 0x2116),
    (0x2192, 0x2192),
]

# Pixelify Sans ships glyphs whose shapes are identical to these Cyrillic capitals but has no cmap entry
# for them (upstream gap: О and П render in the fallback font otherwise). Map them to the existing glyphs.
CMAP_ALIASES = {
    0x041E: "O",   # CYRILLIC CAPITAL LETTER O  -> Latin O
    0x041F: "Pi",  # CYRILLIC CAPITAL LETTER PE -> Greek Pi
}

# Code points the font genuinely lacks; rendered by the CSS fallback stack.
GLYPH_ALLOWLIST = {
    0x20BD: "RUBLE SIGN: absent from Pixelify Sans; rendered by fallback fonts",
    0x202F: "NARROW NO-BREAK SPACE: absent from Pixelify Sans; whitespace via fallback",
    0x2192: "RIGHTWARDS ARROW: absent from Pixelify Sans; used once in a verbatim source option",
}


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

    font = TTFont(FONT_SRC)
    glyph_order = set(font.getGlyphOrder())
    for table in font["cmap"].tables:
        if table.isUnicode():
            for cp, glyph in CMAP_ALIASES.items():
                assert glyph in glyph_order, glyph
                table.cmap.setdefault(cp, glyph)
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=[c for a, b in UNICODE_RANGES for c in range(a, b + 1)])
    sub.subset(font)
    font.flavor = "woff2"
    font.save(FONT_OUT)
    shutil.copyfile(OFL_SRC, OFL_OUT)
    metrics["font"] = {"bytes": FONT_OUT.stat().st_size}

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
    need(FONT_OUT.exists() and FONT_OUT.read_bytes()[:4] == b"wOF2", "font subset missing or not woff2")
    if FONT_OUT.exists():
        need(FONT_OUT.stat().st_size <= BUDGET["font"], f"font {FONT_OUT.stat().st_size} > {BUDGET['font']}")
        cmap = TTFont(FONT_OUT).getBestCmap()
        need(all(ord(c) in cmap for c in "АБВОПабвопЁёЙйЖжЯя«»—–…№"), "font subset lacks required Cyrillic/punctuation")
    need(OFL_OUT.exists(), "OFL.txt missing next to font")
    stray = [p.relative_to(ROOT) for p in OUT.rglob("*") if p.suffix.lower() in {".ttf", ".otf"}]
    need(not stray, f"raw font files shipped: {stray}")

    for e in errors:
        print("FAIL", e)
    print("assets check:", "OK" if not errors else f"{len(errors)} error(s)")
    return 1 if errors else 0


def glyphs(files: list[str]) -> int:
    cmap = TTFont(FONT_OUT).getBestCmap()
    used: set[int] = set()
    for f in files:
        text = (ROOT / f).read_text(encoding="utf-8")
        # Only characters that can reach the screen: skip ASCII control chars.
        used.update(ord(c) for c in text if ord(c) >= 0x20)
    missing = sorted(c for c in used if c not in cmap)
    bad = [c for c in missing if c not in GLYPH_ALLOWLIST]
    for c in missing:
        tag = "allowed" if c in GLYPH_ALLOWLIST else "MISSING"
        reason = GLYPH_ALLOWLIST.get(c, "")
        print(f"{tag} U+{c:04X} {chr(c)!r} {reason}")
    print("glyphs:", "OK" if not bad else f"{len(bad)} unsupported code point(s)")
    return 1 if bad else 0


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
