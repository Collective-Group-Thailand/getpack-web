# getpack — DESIGN.md (Points & Deals)

Source of truth: `getpack-web/src/ui/tokens/{primitives,semantic,scale}.ts` (light theme, D-180 + design language v3).
This file translates those tokens for Google Stitch. Stitch output is a proposal only; the tokens win.

## Who designs this
A senior product designer at the level of the best European and American product studios (Stripe, Linear,
Mercury, Pitch). Calm, precise commerce software for Thai SME brand owners and company buyers who order
custom packaging (กล่องลูกฟูก, กล่องกระดาษแข็ง, สติ๊กเกอร์และฉลาก). Every screen must look hand-made by a skilled human
with judgement and restraint. Nothing may look generated or templated.

## Typeface (hard rule)
- **Anuphan only**, every weight (300, 400, 500, 600, 700), for display, headings, body, labels, buttons, numbers,
  codes and money. No other family and no mono font.
- Weights: 400 body · 500 labels and UI · 600 headings and buttons · 700 only for the one big figure per screen.
- Numbers, money and codes use tabular figures. Money as "฿18,540.00", dates as "28 ต.ค. 2569".
- Type scale (px): 12 · 14 · 16 · 18 · 20 · 24 · 28 (working-page title) · 38 (marketing page title) · 48.
- Thai body line-height 1.6, headings ≥ 1.25. No ALL-CAPS Thai. Letter-spacing −0.01em at 24px and up.

## Colour — light theme only (no dark surfaces anywhere)
- **Page** `#F6F5F1` (warm paper) · **band** `#EFEEE9` · **surface/cards** `#FFFFFF`
- **Ink** `#16201B` · **secondary text** `#4A554F` · **muted/placeholder** `#79827D`
- **Hairline** `#E3E1DA` · **strong line** `#857B6F` (inputs only)
- **Primary (actions, links, current state)** `#17573F` · hover `#0E4430` · primary tint `#E2EDE7` (text on tint `#0E4430`)
- **Promotion accent — the ONLY colour for deals/campaign badges** amber `#E08A18` with **ink text** (never white
  on amber) · promo tint `#FDF0E3` with text `#5F2B00`. Amber is never a button, never a link, never a warning.
- **Sage** `#5F7264` (white text) · sage tint `#E8F1EE` — quiet full-width bands.
- **Kraft** `#DCCDB3` / `#C8A97B` — decoration and packaging illustration only, never text.
- **Status:** success `#15803D` (tint `#F6FCF7`, text `#00491B`) · warning (burnt orange, not promo) `#B45309`
  (tint `#FFF8F5`, text `#652300`) · danger `#B42318` (tint `#FFF7F6`) · info `#1D4ED8` (tint `#F6FAFF`) ·
  neutral tint `#F4F2F0` (text `#564E45`).
- Status is a 6px dot + text, or a small tinted chip. No big tinted banners.
- **Forbidden:** black or near-black panels, dark hero bands, dark footers, gradients, glassmorphism, glow.

## Spacing, radius, shadow
- 4px base, 8px rhythm: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64. Section gaps 48–64 on desktop, 32 on phone.
- Containers: storefront content max 1180px; nav 1320px. Desktop 1440 → 12 columns, 24px gutters.
  Phone 390 → 16px side gutters, no horizontal page scroll.
- Radius: **10px** controls (buttons, inputs, chips, tags) · **14px** cards, list rows, dialogs · **16px** panels and
  hero pictures · **6px** thumbnails. **No pills** — full rounding is for circles and status dots only.
- Shadow: cards rest flat with a 1px hairline (`0 1px 2px rgb(30 27 24 / .06)` at most). Overlay layers
  (popover, sheet, dialog, sticky bar) `0 8px 24px rgb(30 27 24 / .10)`. Buttons have no shadow.

## Components
- **Primary button:** `#17573F` fill, white 600 text, 10px radius, 40px tall (44px on phone). One per screen area.
- **Secondary button:** white fill, 1px `#E3E1DA` border, ink text. **Ghost/link:** primary text, underline on hover.
- **Card:** white, 1px hairline, 14px radius, 20–24px padding, no shadow at rest. No cards inside cards.
- **Promo badge:** amber `#E08A18` fill + ink text, 10px radius rectangle (not a pill), 12–13px 600; or promo tint
  `#FDF0E3` + `#5F2B00` for quieter use. Max one badge per card.
- **Tabs:** underline tabs (2px primary underline on the active tab, ink text; others secondary text). Not pills.
- **Chips / tags:** 10px radius, neutral tint `#F4F2F0`, 13px 500.
- **Coupon code:** code in tabular 600 on a `#EFEEE9` field with a dashed `#857B6F` 1px border, copy action beside it.
- **Inputs:** white, 1px `#857B6F` at 40% → `#E3E1DA` hairline style, 10px radius, visible label above, focus ring
  2px `#17573F` with 2px offset.
- **Icons:** 1.5px stroke line icons, 16–20px, only where they help scanning. No icon tiles, no icon-in-circle headers.

## Content rules
- Thai first, realistic B2B packaging copy of realistic length. Never mention factories, factory counts, "โรงงาน",
  production partners, or "coming soon". Say "ทีมงาน", "ฝ่ายผลิต", "การผลิต".
- No countdown timers, no flash-sale styling, no spin-the-wheel, no "x คนกำลังดู", no fake reviews or logos.
  An ending deal may say "เหลือ 2 วัน" or "ถึง 30 พ.ย. 2569" as plain text.
- Points: 1 แต้ม = ฿2.50. Earn 1 แต้ม per ฿500.
- LINE support daily 09:00–18:00. Entity: Collective Group (Thailand).

## Never use the AI tells
Gradients, glow, emoji, sparkles, 3D blobs, stock photos, centered-everything heroes, coloured icon tiles,
pill buttons everywhere, badge spam, drop shadows on every card, dark sections in a light page, confetti.
