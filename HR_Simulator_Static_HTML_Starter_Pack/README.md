# HR Simulator — AI Agent Starter Pack

This pack is **source material for an AI coding agent**, not a finished game.

1. Give the agent `SPEC.md` as the authoritative English implementation requirements.
2. `STORY_REFERENCE_RU.md` contains the extended Russian narrative and education feedback.
3. The `assets/` directory contains four pixel-art backgrounds, six separate character portraits, and one dialogue UI reference image.
4. Ask the agent to implement a working offline static HTML game from these resources.

Use `SPEC.md` when it disagrees with the older Russian reference (especially: **no grading or results screen**).

Character portraits (`assets/characters/*.png`, 1086×1448 RGBA) are cut-out sprites with transparent backgrounds; place them directly over scene backgrounds. The dialogue reference has a black background; reproduce the frame with CSS, rather than pasting that image on top of game scenes.

Pixelify Sans (SIL OFL 1.1, Cyrillic-capable) is included in `assets/Pixelify_Sans/` as TTF (variable + static Regular/Medium/SemiBold/Bold); host it locally via `@font-face`. The font has no `₽` glyph — that character renders in the fallback font.
