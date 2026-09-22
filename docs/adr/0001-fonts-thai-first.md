# ADR-0001 — Thai-first typography: Noto Sans Thai (UI), Anuphan (display), JetBrains Mono (codes)

**Status:** Accepted (2026-09-21)

## Context
design-system.md §2 asks for one Thai + Latin open-licence UI family self-hosted via `next/font/local`, chosen after checking Thai vowel/tone-mark rendering and numerals, plus a display face and a mono face.

## Decision
- UI: **Noto Sans Thai (variable, wght 100–900)**. Tone marks (่ ้ ๊ ๋) and upper vowels stack correctly at 14–16 px on Chrome/Safari/Android; Latin companion glyphs are metrically matched (Noto Sans), so mixed Thai/English lines keep one x-height. Lining, tabular figures available (`font-variant-numeric: tabular-nums`).
- Display: **Anuphan (variable)** for h1–h4 — a Thai-native geometric that pairs with Noto without the looped-terminal look of Kanit/Prompt, and stays legible at 48 px.
- Mono: **JetBrains Mono (variable)** for order codes / job numbers / tax ids.
- Subsets: Thai + Latin only (180 KB total for all three), shipped from `src/ui/fonts/`, `font-display: swap`, body line-height ≥ 1.6.

IBM Plex Sans Thai was rejected for the UI role: only static weights (7 files), slightly wider Thai glyphs that break dense admin tables at 12–13 px.

## Consequences
- No runtime Google Fonts in any app (the designer's previous Google Fonts `<link>` is removed).
- Fonts for *artwork* inside the designer remain a separate catalogue (`FONT_FAMILIES`) and must be outlined/embedded in print PDFs (F4 Part C).
