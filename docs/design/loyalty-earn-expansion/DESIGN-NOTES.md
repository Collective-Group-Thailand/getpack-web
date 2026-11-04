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

---

# P2 design notes — surveys, lifecycle, "สำหรับคุณ", bundles, analytics

Prototypes: `prototypes/p2-survey.html`, `p2-lifecycle.html`, `p2-for-you.html`, `p2-loyalty-analytics.html`,
`p2-promotion-audience.html`. Screenshots: `screenshots/P2/` (390 and 1440, light, full page). Each file holds the
page first and, below a dashed rule, the review states. The base CSS (tokens, ticket masks, compact rows) is copied
from the P1.5 prototypes so the families match; every figure is a fake example (API-CHANGES-P2 samples).

## 1. Surveys (`SurveyCard`, `SurveySheet`)

- **Card**: one quiet row — 40 px `primary-subtle` icon tile, eyebrow "แบบสอบถาม · OR-…", title, one meta line
  "4 คำถามสั้น ๆ · ตอบครบรับ **8 แต้ม** · ตอบได้ถึง …". Actions: outline "ตอบแบบสอบถาม" and ghost "ไว้ทีหลัง"
  (never two filled buttons; the account overview keeps its own primary). Shown on `/account` after "ต้องทำตอนนี้",
  on the order page after delivery and on `/liff`. Rendering it calls `markSeen` once: "shown once" is the API's.
- **Desktop**: a 600 px dialog with every question, numbered in `subtle` tabular figures, hairlines between them.
- **Phone**: a bottom sheet, one question per step, "2 / 4" plus a 4-segment 3 px bar (no percentage), the question
  at 19 px, 52 px answer tiles, "ย้อนกลับ" as an icon button and "ถัดไป" filled; the reward line sits under the
  buttons, small.
- Rating 1–5 = five square buttons (a `radiogroup`) with the end labels "ไม่พอใจ" / "พอใจมาก" — not stars (stars mean
  review ratings, the one place "คะแนน" stays).
- PDPA purpose line in the `bg-subtle` panel above the submit: what the answers are used for and that the team sees
  them with the order code; links the privacy policy. No consent checkbox (the answers are optional feedback).
- Thanks state: success check, "ขอบคุณสำหรับคำตอบ", and "ได้รับ 8 แต้ม" only when the API says `rewardPoints > 0`.
- Closed/expired deep link: neutral clock icon, "แบบสอบถามนี้ปิดแล้ว", back to the account.

## 2. Reorder reminder and win-back

- **ReorderBonusBadge**: a `primary-subtle` line inside the replenishment card with a small solid `primary` tag
  "แต้ม ×1.5" and "เมื่อสั่งซ้ำภายใน 7 วัน · ถึง 12 พ.ย." — a static date, never a countdown (D-481). The card with
  an active campaign gets the filled "สั่งซ้ำ"; others keep the outline. "คาดว่าจะใช้หมด ประมาณ 18 พ.ย." is a
  label/value pair beside "แนะนำให้สั่งภายใน". The same tag (`sm`, no tint) appears on a cart line.
- **WinbackBanner**: same family as the earn banner — gift tile, "มี 40 แต้มโบนัสรอคุณอยู่", "ใช้เป็นส่วนลดได้ถึง …",
  link "ดูดีลที่ใช้ได้". The words never mention inactivity, absence or "we miss you". On `/account/points` the lot is
  a footnote inside the balance card; in the history the row "แต้มโบนัส" carries "หมดอายุ …".

## 3. "สำหรับคุณ" and bundles

- The tab is real: a reason line in `primary-subtle-fg` with a small people icon under the headline —
  "สำหรับลูกค้าใหม่", "สำหรับสมาชิกระดับ …", "สำหรับลูกค้าที่เคยสั่ง<ประเภท>". `forYouReason = null` shows no line
  (business-type and inactivity matches are never explained). Compact rows put the reason in the meta line.
- Signed out: a card "เข้าสู่ระบบเพื่อดูดีลที่ตรงกับบัญชีของคุณ" + filled "เข้าสู่ระบบ" above the new-customer deals.
  Empty: ticket icon, "ยังไม่มีดีลเฉพาะคุณตอนนี้", outline "ดูดีลทั้งหมด".
- **Bundle ticket**: word "ประหยัดประมาณ", figure = the API's `estimatedSaving` with "ก่อน VAT", tag "ชุดสินค้า";
  the body lists the pieces with quantities on hairline-dashed rows. Grid action is the outline full-width
  "เพิ่มชุดนี้ลงตะกร้า" (D-486 grid rule); `/deals/[slug]` uses the filled one.
- **Bundle sheet**: right side sheet on desktop (480 px), bottom sheet on phone. Each item: index, product, preset
  summary, quantity, the API's VAT-inclusive unit price, and a two-way segmented "ใช้ไฟล์ของฉัน | จ้างออกแบบ".
  No total (the web adds no money); the note says the bundle discount is decided in the cart and repeats the API's
  saving. Confirm = "เพิ่ม 2 รายการลงตะกร้า".

## 4. Admin — analytics

- Period: two month selects. KPI row of four: liability at the D-480 rate (the one tinted card) with the amber-free
  "รอ CPA ยืนยัน" chip; outstanding points; actual vs assumed breakage with "ข้อมูล 7 จาก 12 เดือน"; difference to
  ledger 2330 with the GL balance and a link (the Finance reconciliation line).
- **Monthly movement**: the repo's chart rule (`ui/components/charts`: one green series, greys for what it is read
  against). Earned above the zero line in `primary`; redeemed (`muted`) and expired (`border-strong`) stacked below
  with a 2 px gap; 4 px rounded data ends; one direct label (the latest month); hairline dashed grid; legend top
  right; `<title>` per month for hover. The full table follows (opening, four sources, redeemed, returned, reversed,
  expired, closing) in tabular figures. Earn by source is a `Composition` bar + table with `BarValue`, not a
  per-month stack (four greens would not be readable).
- Retention: two horizontal meters (redeemers vs non-redeemers, with counts) beside the programme table (window, sent,
  converted, rate with `BarValue`); a null rate (k < 10) shows "—" with a title.

## 5. Admin — audience and bundle

- New tabs "กลุ่มลูกค้า" and "ชุดสินค้า" in the promotion editor. The audience builder is a list of criteria, each
  with a checkbox that reveals its control (toggle chips, a days input); the active rule reads back as one sentence
  on `bg-subtle` ("ระดับ Silver หรือ Gold และ เคยสั่งกล่องลูกฟูก"). Aside: the live estimate ("120 ราย", rounded,
  hidden under 10), the listing choice, an info note on what customers can see, and the save.
- Bundle editor: a table of 2–4 items with the preset summary, quantity, today's price from the API and a per-row
  price check; the minimum product-type count; `stackGroup` shown locked as `bundle`; the publish guard as a
  checklist.

## 6. Self-review (changed after the first render)

- Survey dialog sat in an over-tall scrim; trimmed. Three phone frames overflowed the 1180 column; 360 px frames.
- The reorder badge said ×1.5 twice (tag and sentence); the sentence now carries only the window and date.
- The win-back link inherited ink colour; now `primary`. A cart line stretched to its neighbour's height; fixed.
- Analytics: a sixth "programme" row was invented; removed (the API has four). The phone chart was unreadable at
  390; it now scrolls inside its panel at a 640 px minimum, as do the wide tables.
- "สำหรับคุณ" phone header kept the desktop nav; hidden like P1.5.

# P3 design notes — reward catalogue, tier perks, "แลกด้วยแต้ม"

Prototypes: `prototypes/p3-redeem.html`, `p3-deals-points.html`, `p3-tier-perks.html`. Screenshots: `screenshots/P3/`
(390 and 1440, light, full page). Each file holds the page first and, below a dashed rule, the review states. The base
CSS (tokens, ticket masks, compact rows, account frame) is copied from the P2 prototypes so the families match; every
figure is a fake example (API-CHANGES-P3 samples and the UAT seed's eight items).

## 1. The reward ticket (`RewardCard`)

- Same `Ticket` as a deal (D-486): **the stub is the price** — "60 แต้ม" at 40 px/600 tabular on `primary-subtle`, the
  word "แต้ม" at 14 px on the same baseline. The stub is 76 px (a deal's is 116 px): a cost is one short figure and
  carries no cap or tag, so a taller stub was empty green. A tier lock ("Gold ขึ้นไป", lock icon, `surface` chip on
  the stub) sits at the stub's end only when `tierRequired` is set.
- **The body is the reward**: name (16/600), one condition line from the API's `conditions` joined with " · ", then
  the footer. Validity is **not** repeated on every card (all eight said "90 วันหลังแลก"); it is in the page lede and in
  the confirm sheet, with the date.
- Footer: outline "แลก" (grid rule: never a filled button in a grid) or — never both — the blocked reason as a muted
  line with an icon: `insufficient_points` "แต้มไม่พอ — ขาดอีก 12 แต้ม" (info), `tier` "สำหรับสมาชิก Gold ขึ้นไป"
  (lock), `frequency` "แลกได้อีกครั้ง 12 ม.ค. 2570" (clock), `open_limit` "มีคูปองนี้ที่ยังไม่ใช้ 2 ใบแล้ว" (wallet),
  `held` "บัญชีอยู่ระหว่างตรวจสอบ แลกได้เมื่อตรวจเสร็จ" (shield). A blocked ticket's stub turns `neutral-subtle`; the
  text stays readable (not `subtle`), the reason is the first thing to read.
- Phone: compact rows with the 64 px mini-stub ("60" over "แต้ม"), as /deals.
- Groups "ส่วนลดค่าสินค้า" (`cash_off`; the plan said "ส่วนลดเงินสด", renamed so no customer word says cash) and "สิทธิพิเศษ" (everything else), each with a one-line explainer beside the
  heading. Three columns in the account frame, four on /deals.

## 2. `/account/points/redeem`

- Back link to "แต้มและสิทธิพิเศษ", h1 "แลกแต้ม", lede, "คูปองของฉัน" outline at the right (jumps to the list).
- **Balance strip**: one card, three facts split by hairlines — the available balance is the one big figure (30 px);
  "จะหมดอายุเร็ว ๆ นี้" in `warning` text with its date (static); open coupons + link. Phone: balance full width, the
  two facts below.
- **Confirm** (desktop 440 px dialog, phone bottom sheet): the item as a mini-stub row, then the sentence that matters
  at 19 px — "ใช้ 60 แต้ม · คงเหลือ 1,190 แต้ม" — and two quiet facts with icons (validity with the date, the 7-day
  cancel rule). Buttons: ghost "ไว้ก่อน", filled "ยืนยันแลก 60 แต้ม" (the verb with the cost, so the click is the
  decision). No checkbox, no second confirmation.
- **Success** replaces the sheet's content: success check, "คูปองอยู่ในกระเป๋าโค้ดแล้ว", the API's balance after, the
  coupon as a horizontal ticket (stub = what it is, body = dashed code box with copy + "ใช้ได้ถึง …"), filled "ใช้กับตะกร้า"
  and ghost "แลกต่อ".
- **คูปองของฉัน**: a segmented control (ยังไม่ใช้ · ใช้แล้ว · หมดอายุ · ยกเลิก, with counts where known), rows in one
  hairline container: mini-stub with a word ("ส่งฟรี", "ลด ฿50", "ด่วน"), name, "แลกด้วย 60 แต้ม · date" or, for a tier
  perk, "สิทธิ์ระดับ Platinum · ไตรมาส 4/2569" in `primary-subtle-fg`; code box; at the end "ยกเลิกการแลก" (quiet bordered
  button) with "คืนแต้มได้ถึง …" under it — the window's end as a date and time, never a countdown. A perk says
  "สิทธิ์ตามระดับ ยกเลิกไม่ได้".
- Cancel asks once in a small sheet: what happens to the code and the points, and that lots expired meanwhile are not
  revived (ADR-0007). Buttons "เก็บคูปองไว้" / "ยกเลิกและคืนแต้ม".
- "วิธีใช้" in three numbered columns at the foot (01 แลก · 02 ใช้ตอนชำระเงิน · 03 เปลี่ยนใจได้ 7 วัน), hairline above.

## 3. `/deals?tab=points`

- The tab is real ("แลกด้วยแต้ม 8"). Signed in: one line "แต้มของคุณ 1,250 แต้ม · คูปองที่แลกแล้วอยู่ในกระเป๋าโค้ด
  ใช้ได้ 90 วัน" with a link to the points page; then the reward tickets, four across, each "แลก" links to
  `/account/points/redeem#<code>` (the redeem page scrolls to and opens it — the sheet lives on one page only).
- Guest: the sign-in card ("เข้าสู่ระบบเพื่อแลกแต้ม" + filled "เข้าสู่ระบบ") above the tickets; tickets show costs and
  conditions and **no** action (a link on every card repeated the card above eight times). Never an empty state while
  items exist.

## 4. Tier and perks on `/account/points`

- Header actions: "ชวนเพื่อน" (outline) and **"แลกแต้ม" (filled — the page's one primary)**.
- One panel, two columns (5 : 7). Left: eyebrow "ระดับสมาชิก", the tier name at 28 px (the panel's figure), "แต้ม ×2"
  beside it; "ระดับสูงสุดแล้ว · ยอดซื้อ 12 เดือน …" at the top tier, or the 4 px meter and "ยอดซื้อ 12 เดือน ฿325,000 จาก
  ฿500,000 เพื่อเป็น Platinum". Below a hairline, "ตัวคูณแต้มที่ใช้อยู่ตอนนี้": one row per `activeMultipliers` item —
  a small tag "×2" (solid `primary` for the tier, `primary-subtle` for time-boxed ones) and its name with "· ถึง 30 พ.ย."
  (static). Footnote "รวมกันสูงสุด ×3 ต่อคำสั่งซื้อ แต้มที่ได้จริงแสดงตอนชำระเงิน" (the web never multiplies).
- Right: "สิทธิ์ของคุณ", rows with a 32 px `bg-subtle` icon tile, the perk and one line of what it means. **Active
  perks carry no status** (the first render said "ใช้อยู่" four times); only a granted coupon gets "ดูคูปอง", a used one
  "ใช้แล้ว", a not-yet one "ไตรมาสถัดไป". Below, "เมื่อถึง Platinum": the next tier's perks, muted, with a dashed tile.
- Customer words: "คิวผลิตลำดับพิเศษ — งานของคุณได้ลำดับก่อนในคิวผลิต" (no date promise), "ผลิตด่วนฟรี (ตามคิว)",
  "ดูแลก่อนเมื่อทักแชต". No factory words, no 30-day terms, no account manager (not automated, D-500).
- `/liff/points`: a "แลกแต้ม" row link to the redeem page.

## 5. Admin (no prototype; the console's own components)

- **Reward catalogue** (`/marketing/loyalty/rewards`): the console `DataTable` (code, name, kind, cost, tier, status,
  redemptions 30 d) and a form in `FormSection` cards: what (kind, Thai/English names and descriptions), value (only the
  fields of the kind: amount / max amount / addon code / days saved / rounds), conditions (minimum order, product
  types, every N months), cost and validity, window and order. The cash-off rule (minimum ≥ 5 × amount) is shown as a
  hint under the field and the API's `cap_floor` lands on it. Code and kind lock once active.
- **Loyalty campaigns** (`/marketing/loyalty/campaigns`): the P2 list gains "สร้างแคมเปญ", edit before start and
  cancel with a reason; the form reuses the audience criteria of the promotion editor.
- **Benefit v2** in the promotion editor: four more kinds in the same select; a v2 kind shows its fields and an info
  line "ใช้รูปแบบสิทธิ์ v2". Perks say what the order gets, never money.
- **Credit uplift** (`/finance/credit-uplifts` + the company credit tab): a table of uplift versions with base → new,
  a "เพดาน" badge when capped and the above-cap target, "ขออนุมัติวงเงินเต็ม" opening the existing request form
  prefilled; in the credit tab a summary row (company tier, 12-month spend, base, target) and the mode as a segmented
  control (อัตโนมัติ · หยุดไว้ · ปิด) that asks for a reason; versions carry an origin badge.
- **Capacity deals** (`/marketing/promotions?origin=capacity_deal`): product type, week, free %, discount, approval
  state and a link to the approval. The free % is per product type only.

## 6. Self-review (changed after the first render)

- The stub said "แลกด้วย" above every cost and the figure sat on the perforation; the word went and the stub is now a
  76 px band with the cost centred.
- "คูปองใช้ได้ 90 วันหลังแลก" on all eight cards → once in the lede, with the date in the confirm sheet.
- Guest cards each had "เข้าสู่ระบบเพื่อแลก" → removed; the sign-in card above says it once.
- Perks list said "ใช้อยู่" on every row → active perks carry nothing; only states that need action or explain a gap
  have a word.
- "แลกแต้ม" appeared twice on `/account/points` (header and a row under the panel) → the row went; the header button is
  the page's primary.
