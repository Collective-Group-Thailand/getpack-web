# P1 design notes — earn checklist and packaging profile

Prototypes: `prototypes/p1-earn-checklist.html`, `prototypes/p1-packaging-profile.html`.
Screenshots: `screenshots/P1/` (390 and 1440, light, full page). Each prototype holds the page first and,
below a dashed rule, the review states (they are not part of the page).

Source of each decision: STITCH-NOTES §e ("Take" only), GLOBAL-RULES, getpack tokens, `ui-ux-pro-max` quick
reference. Where these disagree, GLOBAL-RULES and the tokens win.

## 1. Token mapping

Only semantic keys. The prototypes copy the light `:root` values from `src/ui/generated/tokens.css`, so the
CSS variable names below are the Tailwind utilities used in the components.

| Element | Token / utility |
|---|---|
| Page | `bg-bg` |
| Card, rows, banner, form card | `bg-surface`, `border-border`, `rounded-panel` (16) |
| "แนะนำถัดไป" block | `bg-primary-subtle`, eyebrow + points `text-primary-subtle-fg`, `rounded-card` (14) |
| Primary button (one per surface) | `Button` primary (`bg-primary`, hover `primary-hover`), 44 px |
| Progress bar | 4 px `bg-primary` on `bg-bg-subtle`; `rounded-full` only on this bar track (a dot/line, CI allows) |
| Todo mark | 16 px circle, `border-border-strong` (the "16 px status circle" exception for `rounded-full`) |
| Held mark | `clock` icon `text-warning`; chip "รอตรวจสอบ" = `Badge tone="neutral"` (subtle) — never warning-filled |
| Done mark | `check` icon `text-success`; row text `text-muted`, points `text-subtle` |
| Secondary text, footer | `text-muted`; footer 12 px (`text-xs`) |
| Row hover | `bg-bg` (one step under the surface) |
| Form options (radio/checkbox tiles) | `border-border` → selected `border-primary bg-primary-subtle text-primary-subtle-fg`, `rounded-control` (10) |
| PDPA panel | `bg-bg-subtle`, `rounded-card` |
| Errors | `text-danger` text + icon under the group (no red borders on every tile — quieter) |
| Toast | the existing `Toaster` (sonner) |

No hex in components, no `accent` (amber) anywhere, no shadows on resting cards, no glass, no pills (chip radius
is the `Badge`'s `rounded-control`), Anuphan only (via `next/font` in the app; Google Fonts link only in the
prototypes), weights 400/500/600 (700 only for the balance figure that already exists).

## 2. Layout rules applied

- One card "ทำสิ่งนี้รับแต้ม" between `SummaryCards` and `TierProgress` (PLAN §3).
- Header: title left, "รับได้อีก X แต้ม · ทำแล้ว n จาก m" right (desktop) / under the title (phone); thin bar.
- "แนะนำถัดไป" block: the `recommended` task only, with the card's single primary button. The button says the
  verb ("เพิ่มข้อมูล"), not the title again. The recommended task is **not repeated** in the list below.
- One list in the API's order, no grouping: todo → held → done (done muted).
- A todo row is one link (whole row, chevron), ≥ 56 px tall on phone, 64 px on desktop. Held and done rows are not
  links (nothing to do) and carry no chevron, so a chevron always means "go".
- Points right-aligned, `tabular-nums`, "+40" without the unit in rows (the unit is in the header and next block).
- Phone hides the description of todo rows (titles are self-explanatory, the Thai descriptions wrapped into
  orphan words at 390). Held and done keep their status line.
- Footer: "แต้มจากกิจกรรมรวมได้สูงสุด 600 แต้มต่อ 12 เดือน · เหลือ N แต้ม" (both numbers from the API).
- Cap reached: no next block, rows' points in `subtle`, footer explains that tasks still work but earn nothing.
- All done: the card collapses to one line with a success check.
- `/account`: one-line banner "รับแต้มเพิ่ม X แต้ม · เริ่มจาก<recommended>" → `/account/points#earn`, hidden at 0;
  the suffix hides on phone.
- `/liff/points`: compact variant — tighter padding, no todo descriptions, first 5 rows + "ดูทั้งหมด n รายการ".
- Packaging profile: four fieldsets, each with a visible legend, "จำเป็น/ไม่บังคับ" marker and hint; volume is
  one column of radio tiles on phone, four across on desktop; categories and regions three across (two on phone);
  months six across (four on phone). PDPA purpose panel with the required acknowledgement just above the actions.
  Errors sit under each group. "รับ 40 แต้มเมื่อบันทึกครบครั้งแรก" sits beside the save button until completed.

## 3. ui-ux-pro-max checklist (items checked)

| Rule | How |
|---|---|
| `color-contrast` | Only token pairs the contrast gate already measures (`muted` on `surface`, `primary-subtle-fg` on `primary-subtle`, `success`/`warning` icons ≥ 3:1). |
| `color-not-only` | Every status has text: sr-only "ยังไม่ได้ทำ / รอตรวจสอบ / ได้รับแล้ว", plus the visible chip/date. |
| `focus-states` | `focus-visible:ring-2 ring-focus-ring` on rows, banner, tiles (ring on the box of a visually hidden input). |
| `touch-target-size` / `web-target-size` | Rows ≥ 56 px, buttons and tiles 44 px, month tiles 44 px. |
| `heading-hierarchy` | Card title is an `h2` under the page `h1`; form groups are `fieldset/legend`. |
| `input-labels`, `field-grouping` | Every tile is a `<label>`; groups are fieldsets with legends. |
| `error-placement`, `aria-live-errors`, `focus-management` | Error under each group, linked with `aria-describedby`, `role="alert"`; the first invalid group gets focus (`useFocusFirstInvalid`). |
| `required-indicators` | "จำเป็น" text next to the legend, not only an asterisk. |
| `submit-feedback`, `loading-buttons` | Save button shows loading and is disabled while saving; toast on success. |
| `toast-accessibility`, `toast-dismiss` | Sonner, polite, 5 s (`TOAST_DURATION_MS`). |
| `contextual-live-badge-updates` | The checklist refetch does not move focus; the toast is the announcement. |
| `empty-states` | All-done line; error state with retry; hidden banner at 0. |
| `progressive-disclosure` | Compact variant shows 5 rows and a link. |
| `reduced-motion` | No animation beyond the bar's width transition, disabled under `prefers-reduced-motion`. |

## 4. Copy rules

- Thai first, short, no "ทันที", "อัตโนมัติ", "โรงงาน", "coming soon".
- Held: only "รอตรวจสอบ" + "ทีมงานกำลังตรวจสอบข้อมูล" — never says a duplicate was found (DEC-5 privacy).
- PDPA text states the purpose only (materials and production planning, offers that fit), never the internal
  demand-mapping or partner-recruitment reasons (GLOBAL-RULES §2).
- Existing pages say "คะแนน"; the owner-approved P1 copy says "แต้ม". P1 follows the approved copy; unifying the
  word across the points page is an open item in WEB-P1-NOTES.md.
