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
| `required-indicators` | The repo's `Field` marker: asterisk plus sr-only "จำเป็น"; optional groups say "(ไม่บังคับ)". (The prototype shows the word; the build follows `Field`.) |
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

---

# P1.5 design notes — deals surface (tickets)

Prototypes: `prototypes/p15-deals.html`, `p15-deal-card.html`, `p15-pdp-ladder.html`, `p15-cart-coupons.html`,
`p15-liff-deals.html`. Screenshots: `screenshots/P15/` (390 and 1440, light, full page). Source of each decision:
STITCH-NOTES round 2 (R2-a, R2-b, R2-f, "Building the ticket", colour mapping, owner decision 2026-11-04 15:02 /
D-486) and round 1 §c and §d — "Take" items only, rebuilt from the tokens; no Stitch markup was reused.
Sample deals in the prototypes are fake (BOX10, FREESHIP, LABEL8 …), like the UAT seed, which ships `hidden`.

## 1. The ticket (one primitive)

`Ticket` (`src/ui/components/Ticket.tsx`) takes `orientation` (vertical | horizontal), `notch` (both | end) and
`edge` (plain | stamp). It is two boxes: the outer one is the 1 px `border`, the inner one the face. Both carry the
same cut-outs — the outer 1 px larger and concentric — so the hairline follows every notch and every stamp bite,
and wraps the stub too (`primary-subtle` against the page is 1.10:1, so the stub needs it).

- **Every cut is a `mask-image` radial-gradient** combined with `mask-composite: intersect`. Nothing is painted in
  the page colour, so the notches show what is really behind: the page, a `bg-subtle` band (shown in
  `p15-deal-card.html`), the LIFF sheet's scrim, the dark theme.
- Notch radius 8 px (16 px notches) on grid and featured tickets, 6 px on the 64 px mini-stub, 10 px on the LIFF sheet.
- Stamp edge: 5 px bites every 13 px, only on the featured stub's outer edge (left on desktop, top on the phone hero
  and nowhere else). Stub padding ≥ 20 px keeps the bites off the numerals.
- Perforation: a 1 px dashed `border-strong` line at 55 % opacity across the tear line, stopping 14 px short of the
  notches; on a solid stub it is `primary-fg` at 35 %. `aria-hidden`.
- The design-language gate forbids CSS gradients; it now allows them in `Ticket.tsx` only, where they are masks (they
  cut, they never paint).

| Part | Token |
|---|---|
| Stub, normal | `primary-subtle` / value `primary-subtle-fg` |
| Stub, featured | `primary` / `primary-fg`, stamp edge |
| Stub, used | `neutral-subtle` / `subtle` (body text `subtle` too) |
| Body | `surface`, 1 px `border` around stub and body |
| "ดีลเด่น" (one per surface) | `Badge tone="accent" appearance="solid"` — amber with ink text |
| Product-type tag | `neutral-subtle` / `neutral-subtle-fg` chip |
| "เหลือ n วัน" | `warning` text, static (no countdown) |
| "เก็บแล้ว" | `success` text + check |
| Saving in the cart picker | `success`, right-aligned, tabular |
| "คุ้มที่สุด" | `primary-subtle` / `primary-subtle-fg` chip |
| Not-eligible reason | `muted` text + info icon (never `warning`) |

## 2. DealCard

- **Vertical ticket** for grids (home strip, /deals desktop): 116 px stub with the small word ("ลด", "แต้ม") top-left,
  the product-type tag top-right, the value at 52 px/600 tabular with its cap ("สูงสุด ฿1,500") on the same baseline;
  body = headline (2 lines max) · one condition line · validity; footer = dashed code box with a copy button, and
  the action on the right. Words ("ส่งฟรี") drop to 30 px. Body min-height keeps a row of cards level.
- Six states (Storybook): guest ("เข้าสู่ระบบเพื่อเก็บโค้ด" link), claimable (outline "เก็บโค้ด"), saved
  ("เก็บแล้ว" + "ดูในกระเป๋า"), used (stub neutral, text subtle, "ใช้แล้ว" chip), not eligible (reason line, no
  action), ending soon ("เหลือ 2 วัน · ถึง …" in warning). The API gives no date for "used", so the chip has none.
- An automatic promotion (no code) shows "ไม่ต้องใช้โค้ด · ลดให้ในตะกร้าเมื่อตรงเงื่อนไข" instead of the code box and
  has no save action.
- **The grid action is secondary** (ink outline). A solid primary button appears only on the featured ticket and in
  the LIFF sheet.
- **Compact row**: 64 × 56 mini-stub with one notch on its right edge · headline (one line, ellipsis) · condition
  line · validity line · 44 px action. Rows sit in one hairline container separated by hairlines (no card per row).
  Used on /deals (phone), the cart picker and LIFF.
- **Featured**: horizontal on desktop (248 px solid stub, white value 84 px/700 — the page's one big figure, stamp
  edge on the left, the amber badge in the body, solid "เก็บโค้ด", "เงื่อนไขทั้งหมด" link); on the phone the same
  ticket stands up with the stamp along the top (62 px value).
- Accessibility: the article's name is the text equivalent of the value (`benefit.summary`, "ส่วนลด 10% สูงสุด
  ฿1,500"); reading order stub → headline → validity → code → action; the copy button is named "คัดลอกโค้ด BOX10" and
  announces "คัดลอกแล้ว" in a polite live region.

## 3. /deals

- Header: h1 "ดีลและโปรโมชัน", one lede line, and "n ดีลที่ใช้ได้ · อัปเดต HH:MM น." (time of the read, Bangkok).
- Signed in: one strip "คูปองของคุณ · เก็บไว้ n ใบ · ใช้ได้กับตะกร้าตอนนี้ n ใบ" → wallet. Not an aside (it would cut
  the grid to two columns).
- Featured ticket (`featured: true`, the first one), then underline tabs with plain muted counts (no pills) and a
  quiet product-type select; tabs with a zero count are not shown ("แลกด้วยแต้ม" waits for P3; "สำหรับคุณ" only when
  signed in, since it equals "ทั้งหมด" until P2).
- Desktop: 3 columns of vertical tickets, 20 px gaps. Phone: the stamp hero, then compact rows in one container.
- Below: "ใช้คูปองอย่างไร" 01–03 (5/12) beside the FAQ (7/12), hairline above; FAQ as `<details>` rows.
- /deals/[slug]: the same ticket large, the terms, the FAQ from the API, share URL with copy; JSON-LD `Offer`.

## 4. PDP and configurator

- The deal sits **inside the price field**, under a perforation: the price tint becomes a ticket stub. Rows:
  "มีโปร" (a small solid `primary` label, not amber — amber is reserved for "ดีลเด่น"), the offer + "ดูดีล",
  "ใช้โค้ด BOX10 ในตะกร้า", and "ราคาหลังโปรโดยประมาณ" with the API's `estimatedTotal` (never computed here).
  Hidden when no promotion matches the product type.
- VolumeLadder (desktop): a table "สั่งมากขึ้น ราคาต่อใบลดลง" — quantity, ฿/ใบ right-aligned, and one savings
  format "ประหยัด x%" against the smallest row (the API's `savingPct`), "—" for the smallest. The current row is
  `primary-subtle` with a 2 px `primary` inset rule and "ที่เลือกอยู่". Each row is a button (44 px) that sets the
  quantity. One nudge line under it, worded without arithmetic.
- Phone: tiles 112 px wide scrolling inside their own bordered frame (no page scroll), "กำหนดเอง" as the last tile,
  "ดูราคาทุกจำนวน" opening the table.

## 5. Cart coupon picker

- Desktop: inline in the order summary under the totals, always visible. Checkboxes (D-452, up to `maxCodes`).
  Each row: checkbox · mini-stub · code (+ "คุ้มที่สุด") · benefit line · saving in `success`, right-aligned.
  A row that conflicts with a chosen code is disabled with "ใช้ร่วมกับ BOX10 ไม่ได้"; when the cart holds
  `maxCodes`, the remaining rows are disabled with "ครบ 3 ใบแล้ว".
- "ยังใช้ไม่ได้ n": muted mini-stubs, the reason in `fg` (it is the upsell line), no control.
- Manual entry "มีโค้ดอื่น?" stays under the list; codes applied by hand show as chips as before.
- No "ประหยัดรวม" total: the API returns per-code savings only and the web never adds money. The checkout shows the
  combined discount.
- Phone: one "คูปอง" row in the summary (chips + "เลือก") opens a bottom sheet with the same content and a "เสร็จ"
  button; the sheet traps focus and closes on Esc and on the scrim.

## 6. LIFF /liff/deals

- No fake LINE chrome: the app's own slim bar and tabs. Points strip, segmented "ดีลทั้งหมด | คูปองของฉัน (n)",
  the featured ticket, compact rows. Sticky "แชร์ให้เพื่อน | เปิดกระเป๋าคูปอง" above the LIFF tabs.
- Tapping a row opens a bottom sheet **rendered as a ticket**: solid green stub band, notches cut into the sheet's
  edges at the perforation (they show the scrim), label/value conditions, dashed code box with "คัดลอก", the solid
  "เก็บโค้ด" and a quiet "ส่งดีลนี้ให้ทีม".

## 7. Copy rules applied

No "ทันที", "อัตโนมัติ", "โรงงาน", scarcity counters, countdowns or time promises; "เหลือ n วัน" is a static label;
no refund promise in the FAQ; the FAQ says only what the system does (max 3 codes, one per stack group, the cart
names conflicts). Every string is in `messages/{th,en}`; deal text comes from `promotions.display`.

## 8. Self-review (what was changed after the first render)

- A class name clash pushed the grid button below the code box; fixed. Featured cap and tag were touching; spaced.
- Compact-row meta wrapped the year onto a third line at 390; split into a condition line (ellipsis) and a date line.
- The phone summary strip wrapped; the phone drops "เก็บไว้ n ใบ" and "เปิด".
- PDP: the phone tile selection disagreed with the price (1,000 vs 500); fixed. The LIFF sheet's second action was a
  second full outline button; now a quiet text button.
- Cart heading "ใช้ได้ 2 จาก 3" read as "2 usable"; now "เลือกแล้ว 2 จาก 3 ใบ".
