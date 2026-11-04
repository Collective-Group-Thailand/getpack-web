# Stitch round — Points & Deals (P1 + P1.5) — 2026-11-04

**Stitch project:** `projects/10188146144340170426` ("getpack Points & Deals") —
https://stitch.withgoogle.com/projects/10188146144340170426
**Input:** `DESIGN.md` (this folder), translated from `src/ui/tokens/{primitives,semantic,scale}.ts`.
**Plan:** `../PLAN.md` §3 (earn checklist, P1) and §3.5 (deals surface, P1.5).

Stitch output is a proposal only. The tokens, `GLOBAL-RULES.md` and PLAN.md win. **No Stitch code goes into the repo.**
Every name, code, amount and date in these images is sample data (BOX10, "คุณมณีรัตน์", ฿1,331.00 …).

## How this round ran

- **Design system:** `upload_design_md` worked, but `create_design_system_from_design_md` and
  `create_design_system` both returned `invalid argument`. That is the same refusal as the 2026-10-28 round, probably
  because Anuphan is not in Stitch's font list. As in round 2, the full brief went at the top of every prompt. Every
  HTML file loads only `family=Anuphan` (see the audit below).
- **Variants:** `generate_variants` returned `invalid argument` for every option shape I tried. Each variant is
  therefore its own text prompt with a deliberately different direction (A and B), so A and B differ in structure,
  not just in style.
- **Sizes:** Stitch renders "desktop" at a **1280 px** viewport (PNG 2560 px @2x). The one exception is points A,
  which renders at 1440. Phone screens render as a 390 px column on a desktop canvas; the PNGs here are cropped to
  that column (780 px @2x). The B phone screens include Stitch's device frame.
- **LIFF:** `/liff/deals` exists only inside LINE, so it has phone variants only. The desktop `/deals` covers the
  wide case.
- **Evaluation:** the `ui-ux-pro-max` checklist (`getpack/_tools/ui-ux-pro-max-skill`, `references/quick-reference.md`
  §1–§9 and `pro-rules.md`), plus getpack's own rule "must not look AI-generated".

## Files

```
stitch/
  DESIGN.md                      brief given to Stitch
  STITCH-NOTES.md                this file
  deals/              a-card-grid-{desktop,phone}.png        b-ledger-{desktop,phone}.png
  deal-card/          a-ticket-{desktop,phone}.png           b-editorial-{desktop,phone}.png
  pdp-badge-ladder/   a-ladder-table-{desktop,phone}.png     b-quantity-tiles-{desktop,phone}.png
  cart-coupon-picker/ a-inline-summary-{desktop,phone}.png   b-popover-sheet-{desktop,phone}.png
  points-checklist/   a-checklist-rows-{desktop,phone}.png   b-next-best-grouped-{desktop,phone}.png
  liff-deals/         a-compact-cards-phone.png              b-list-sheet-phone.png
```

## Stitch screen ids

| Screen | Variant | Desktop screen id | Phone screen id |
|---|---|---|---|
| /deals | A card grid | b9886504076249b28dd18c22f1df289b | 71eca416d93a4e7e90870986e9c8961e |
| /deals | B ledger | dbdaad2780514917ae1c3a5e0186df89 | 462422787a654bd2b1a15107a4308591 |
| DealCard | A ticket | 441d4454cd464a8a8bccd81bbda6fadc | ad91ab80efbe4d2eaca6377d686269c1 |
| DealCard | B editorial | dc8f48b35d1548638455c2db4de0258a | 4b1c3a6a33d54d43af883a01fa073c53 |
| PDP badge + ladder | A ladder table | e68f3a33c0d744bf8defaad1a25ffba5 | 74388ec68b9b4ada860001e123b55865 |
| PDP badge + ladder | B quantity tiles | 6eae7cf044754beca4abe2f53be109f7 | 5ad89715fcda473cbbedb9253cb453d9 |
| Cart coupon picker | A inline in summary | a4414cbb412c4c06a56ccc5253ae7432 | 130314c755c34923abafcc476ea7797b |
| Cart coupon picker | B popover / sheet | a004ed5c9d8742e28f8e050ebea9a029 | 79dd940b5dca4702a255278882728a19 |
| /account/points checklist | A rows | 4b3ab7eee6de4c32996c0d800ba6900a | 3ff51ee17fa2483490c193df983c7a63 |
| /account/points checklist | B next-best + grouped | 55e7e8f76f9b4349aca419ec0ea52507 | a936be97f2ea40cb818dcd3d2dde7867 |
| /liff/deals | A compact cards | — | b80651f3ae0c4dcf8a8690d0fb6c5a58 |
| /liff/deals | B list + sheet | — | 7a8b1b53d56647ea827d6dbe2ffbff5e |

---

## a. `/deals` — **chosen: B "ledger" (desktop and phone)**

**Take**
- From B:
  - Header with the title on the left and a quiet "12 ดีลที่ใช้ได้ · อัปเดต …" on the right.
  - The hero as a typeset band on `bg-subtle` with no picture, and the coupon block (code, คัดลอก, เก็บโค้ด, เงื่อนไขทั้งหมด) on the right.
  - Underline tabs plus a product-type filter.
  - Deals as one bordered list of hairline rows with columns: badge · headline + condition · validity · code · action.
  - Row states "เก็บแล้ว" and "ใช้แล้ว" shown in place of the button.
  - "ใช้คูปองอย่างไร" 01–03 next to the FAQ.
- From A:
  - The card is the right unit for the **home deal strip** (3 cards, PLAN §3.5.3). Reuse DealCard there, not the ledger row.
  - The validity sits top-right of the card ("เหลือ 2 วัน" in `warning` text).
- Phone: B's single list with a 64 px badge column. On phone the product-type filter becomes one select button.

**Don't take, and why**
- **Ledger B on desktop puts an amber fill on almost every row.** That is badge spam (`ui-ux-pro-max` §4
  style-consistency). The rule: solid `accent` only on the hero and one row at most; every other row uses
  `accent-subtle`/`accent-subtle-fg`.
- **A's grid repeats a code field plus a full-width "เก็บโค้ด" on every card.** That is two actions of equal weight
  ×6, and it makes the page read as a template. B keeps one action per row.
- **A's B2B band claims "ภายใน 24 ชม."** That is an unverifiable promise (GLOBAL-RULES §3). If the band stays, it
  links to `/business` with no time claim.
- **A's kraft hero illustration** is generic decoration. The hero is the offer, set in type.
- **B's footer adds "ISO/IEC 27001".** That is a certification we do not hold. The footer is the existing site footer.
- **A-phone's hero line "สำหรับโรงงานและผู้ประกอบการ B2B"** breaks factory confidentiality.

## b. DealCard — **chosen: B "quiet editorial"**

**Take**
- From B:
  - The benefit is the hero of the card: "ลด 10%" at 28–32 px/600 with "สูงสุด ฿1,500" in `muted` on the same baseline.
  - The condition sits under it as one line.
  - Conditions are a definition list with hairlines: ขั้นต่ำ / ใช้ร่วมกับ / ถึง.
  - The footer row holds the code with a 44 px copy button and the action.
  - A product-type tag (neutral) sits top-left and the promo badge top-right.
  - The **compact one-line row** is the same component for the cart picker, the /deals ledger and LIFF.
- From A:
  - The state captions as the Storybook story list: guest / เก็บได้ / เก็บแล้ว / ใช้แล้ว / ไม่ตรงเงื่อนไข / ใกล้หมดเวลา.
  - "เก็บแล้ว" as a full-width success confirmation "เก็บไว้ในกระเป๋าคูปองแล้ว · ดูในกระเป๋า".
  - The disabled button with the reason written under it ("ใช้ได้กับบัญชีใหม่เท่านั้น"), never a bare greyed button
    (`ui-ux-pro-max` disabled-states).
  - Guest: "คัดลอกโค้ด" (secondary) plus the link "เข้าสู่ระบบเพื่อเก็บโค้ด".

**Don't take, and why**
- **Ticket notches and perforation (A).** Decorative skeuomorphism is a coupon-app cliché and fights the calm,
  flat language of the rest of getpack.
- **Bulleted conditions (A).** They are harder to scan than label/value pairs.
- **The "ด่วน" amber chip on state 6 (B).** Urgency is the validity text in `warning` colour only, with no extra badge
  (DEC-9).
- **Two badges (product tag and promo) both filled.** Only the promo badge is coloured; the product tag stays neutral.

## c. PDP badge + volume ladder — **chosen: A "ladder table" on desktop, B "quantity tiles" on phone**

**Take**
- From A (desktop):
  - The ladder table "สั่งมากขึ้น ราคาต่อใบลดลง" directly under the price, with right-aligned ฿/ใบ.
  - The current row in `primary-subtle` with a 2 px left `primary` rule and the tag "ที่เลือกอยู่".
  - Other rows are clickable to set the quantity.
  - One nudge line under it ("เพิ่มอีก 500 ใบ ราคาต่อใบลดอีก 10% และใช้โปรลด 10% ได้").
- From B:
  - The promo box **below the price**, not above the selectors: `accent-subtle` with no border and one small `accent`
    badge "มีโปร", then the offer, "ใช้โค้ด BOX10 ในตะกร้า" and the link to /deals.
  - **"ราคาหลังโปรโดยประมาณ ฿x"**, computed by the same pricing service.
  - The `success` line "ถูกกว่าสั่ง 500 ใบ ฿1.48 ต่อใบ".
  - "ขอใบเสนอราคา (ล็อกราคา 15 วัน)" (D-051, true).
- Phone: B's horizontally scrolling quantity tiles inside their own container, with no page scroll, a "กำหนดเอง" tile,
  and a sticky bar holding ขอใบเสนอราคา + ใส่ตะกร้า. The full ladder table stays behind "ดูราคาทุกจำนวน".

**Don't take, and why**
- **A's promo chip above the selectors.** It competes with the title. The deal belongs next to the price it changes.
- **A's savings column mixing "-8.7%" and "ประหยัด 10%".** Use one format: "ประหยัด x%" against the smallest tier, or nothing.
- **Invented data in B:**
  - "ISO 9001 / FSC Certified Board" and TAPPI lab values (Burst 980 kPa, ECT …);
  - grade codes "KA150";
  - a "B2B" badge in the nav;
  - "ผลิตเสร็จ 3–5 วัน" in B-phone, which contradicts the 5 working days in GLOBAL-RULES §6.
- **B's step-line chart under the tiles.** It is decoration that repeats the tile numbers (`ui-ux-pro-max` §10 chart-type: no chart needed).
- **A's "ดาวน์โหลดไดคัท PDF" on the stage.** Only if that file already exists for the style.

## d. Cart coupon picker — **chosen: A "inline in summary" on desktop, B "bottom sheet" on phone**

**Take**
- From A (desktop):
  - "คูปองที่ใช้ได้กับตะกร้านี้" is always visible inside the order summary, with no hidden popover. It only shows
    what `GET /store/cart/applicable-codes` returns.
  - The "คุ้มที่สุด" tag (`accent-subtle`) on the best saving.
  - The manual entry "มีโค้ดอื่น?" stays (PLAN §3.5.3).
  - Applied codes appear as removable neutral chips.
  - The points switch "ใช้แต้ม … สูงสุด 20% ของยอด".
- From B:
  - **Checkboxes, not radios.** D-452 allows up to 3 codes, so the picker is a multi-select.
  - Each row shows its saving right-aligned in `success`.
  - A conflict note on a row that cannot stack ("ใช้ร่วมกับ BOX10 ไม่ได้").
  - A second group **"ยังใช้ไม่ได้"** with the reason ("สั่งกล่องเพิ่มอีก 1,000 ใบ") as an upsell. It reads from
    `checkCode` failure reasons, so we need those reasons in the API response.
  - The sheet footer "ประหยัดรวม ฿x" + "ใช้คูปอง".
- Phone: the coupon row in the summary ("คูปอง" + chips + "เลือก") opens B's bottom sheet. A's inline list made the
  phone cart 3 screens long.

**Don't take, and why**
- **Radio selection (A).** It is wrong for stackable codes.
- **Claims and data that are not true:**
  - A's nav pill "DEALS" and "ล็อกราคา 60 นาที" (the price lock is 15 days on quotations, none in the cart);
  - A's "พร้อมผลิตใน 5–7 วัน" (the real figure is 5 working days after artwork approval);
  - B's "© 2025 getpack.co" (wrong year and wrong entity);
  - LINE "ตอบใน 30 นาที".
- **A-phone's footer:**
  - "พาเลทมาตรฐานโรงงาน" breaks factory confidentiality;
  - a 13-digit tax ID is sample data that looks real;
  - a "B2B Ledger" chip in the header.

## e. `/account/points` checklist — **chosen: A "checklist rows" with B's next-best card**

**Take**
- From A:
  - One card "ทำสิ่งนี้รับแต้ม" between SummaryCards and TierProgress (PLAN §3).
  - The header "รับได้อีก X แต้ม · ทำแล้ว n จาก m" with a thin `primary` bar on `bg-subtle`.
  - One sorted list: highest points first, `held` next to todo, done last and muted.
  - Status marks: empty circle (todo), clock in `warning` (held, with the chip "รอตรวจสอบ" and the reason
    "ข้อมูลซ้ำกับบัญชีอื่น ทีมงานกำลังตรวจสอบ"), and a `success` check (done, with "ได้รับแล้ว 2 พ.ย. 2569").
  - The footer cap line "แต้มจากกิจกรรมรวมได้สูงสุด 600 แต้มต่อ 12 เดือน · เหลือ 564 แต้ม" (DEC-4).
- From B:
  - A **"แนะนำถัดไป" block** on `primary-subtle` at the top of the card for the single highest-value todo, with its
    one primary button. It is the one clear next step per screen (round-2 rule).
  - **The whole row is the link** (chevron), with no separate "ไปทำ" button. That gives a bigger tap target and less
    noise (`ui-ux-pro-max` touch-target-size).
  - On phone, the balance as a 44 px weight-300 figure without a card.
- Phone: A's list order, plus B's next-best block.

**Don't take, and why**
- **B's two-column grouping** (ข้อมูลธุรกิจ / บัญชีและการติดต่อ). It breaks the points-first sort the API returns and
  doubles the scan path.
- **Invented tier "บรอนซ์ (Bronze)" (B).** Tiers are member / silver / gold, plus platinum in Phase 3.
- **Other invented items:**
  - "+210 แต้ม" and "แต้มที่จะหมดอายุ … 31 ธ.ค." figures (B);
  - an icon-tile nav (B);
  - the "1,250" count badge on the nav item.
- **A's separate "ไปทำ" buttons on every row.** That is six equal secondary buttons.
- **A-phone's "ทำสำเร็จแล้ว" sub-header.** It is fine, but keep it only if the done group has more than 3 rows.

## f. `/liff/deals` — **chosen: B "list + sheet"**

**Take**
- From B:
  - The same list row as `/deals` phone, so one component serves both.
  - A points strip "แต้มของคุณ 1,250 · มูลค่า ฿3,125.00 · แลกแต้ม".
  - A segmented control "ดีลทั้งหมด | คูปองของฉัน (n)" (10 px radius), which is the wallet inside LINE.
  - The **bottom sheet** for deal detail: benefit, conditions with hairlines, code + คัดลอก, เก็บโค้ด, "ส่งดีลนี้ให้ทีม".
- From A:
  - The featured deal card at the top of the list.
  - The sticky bottom bar "แชร์ให้เพื่อน | เปิดกระเป๋าคูปอง". For agents, share uses `/deals/{slug}?ref=` (PLAN §3.5.3).
- LINE draws its own header in the tall LIFF size, so our page starts at the points strip and does not draw a second header.

**Don't take, and why**
- **The fake iOS status bar and LINE header drawn inside the page (both).** They are the host app's chrome.
- **Stitch-invented conditions in B's sheet** ("ยอดสั่งซื้อขั้นต่ำ ฿5,000", "1 สิทธิ์ / บัญชี"). The conditions come from
  `promotions.display.terms`.
- **A's second tab row plus the featured card plus the sticky bar plus greeting.** Four stacked bands before the
  first deal is too much chrome for a LIFF height.

---

## Rules to watch when building the real prototype (where Stitch drifts from the tokens)

1. **Fonts and weights:**
   - The HTML hard-codes `font-family: 'Anuphan' !important` on `*`. In the repo the font comes from
     `next/font/local` (`--font-pk-*`). Do not add the Google Fonts link.
   - Stitch uses **700 for every heading**. Tokens use 600 for headings and 700 only for the one big figure.
2. **Hex values outside the tokens:**
   - hover `#124532`, active `#0E3627`, dashed border `#CECCC4`, kraft line `#CEBF9F`, stage `#EDECE6`;
   - the warm scrim `#2A2520`, where the token is `overlay`.
   - Map them to `primary-hover`, `border-strong`, `bg-subtle` and `canvas`. Never paste hex (`ui-ux-pro-max` §6
     color-semantic; the contrast gate only sees semantic keys).
3. **Shadows:** `shadow-sm` on resting cards. Tokens say `card` at most, and none on a flat hairline card. Only
   popover, sheet and sticky bar get `overlay`.
4. **Glass:** a `backdrop-blur` sticky header on phone. Not in the language: use a solid `bg` with a hairline.
5. **Tab counts:** shown as tinted little pills. Use plain `muted` numbers after the label ("สำหรับคุณ 3").
6. **Amber discipline:** Stitch spreads `accent` everywhere. Solid `accent` + `fg` only for one badge per surface;
   all others use `accent-subtle`/`accent-subtle-fg`. Never put amber on a button, a link or "ใกล้หมดเวลา"; that last
   one is `warning` text.
7. **Radii:** Stitch kept 10/14/16 correctly. The repo aliases are `rounded-control` / `rounded-card` /
   `rounded-panel`. `rounded-full` is for dots and the 16 px status circle only (CI refuses it elsewhere).
8. **Desktop width:** Stitch drew most desktops at 1280 px, so check the real pages at 1440 with content max 1180
   (`CONTAINER.content`) and at 360/390 with no horizontal scroll. The quantity tiles scroll inside their own container.
9. **Dark mode:** GLOBAL-RULES §7 still requires dark mode via tokens. These references are light only by brief, so
   build them with semantic keys and the dark theme follows.
10. **Copy and data:**
    - Everything in the images is sample data. In the real UI, deal text comes from `promotions.display`, conditions
      from the engine, prices from the pricing service, and the checklist from `GET /loyalty/tasks`.
    - Each surface must hide itself when there is no data (home strip with fewer than 1 public deal, PDP badge with
      no matching promotion, picker with no applicable codes, which falls back to manual entry only).
11. **Truthfulness pass on every string before merge:**
    - no "โรงงาน" (Stitch slipped it into two phone screens);
    - no time promises other than the decided ones (5 working days, LINE 09:00–18:00, 15-day quote lock);
    - no certifications;
    - no "ทันที"/"อัตโนมัติ" unless true (e.g. the A-phone deals footer "ส่วนลดทันที ฿200" must become plain "ลด ฿200").
12. **Accessibility** (`ui-ux-pro-max` §1–§2):
    - The copy button needs an accessible name ("คัดลอกโค้ด BOX10") and an `aria-live` "คัดลอกแล้ว".
    - The checklist status marks need text for screen readers (ยังไม่ได้ทำ / รอตรวจสอบ / ได้รับแล้ว).
    - Disabled coupon rows keep their reason as text, not colour alone.
    - All tap targets ≥ 44 px.
    - The bottom sheet traps focus and closes on Esc and on scrim tap.

## HTML audit (fonts, banned words, dark surfaces, pills)

All 21 HTML files were downloaded and checked. **Fonts:** every screen loads only `family=Anuphan`; some stacks put
system fallbacks behind it. Stitch also uses `font-mono` on codes in deal-card A desktop, points B desktop and cart A
phone; in the build, codes are Anuphan with tabular figures. There are no gradients, emoji, star ratings or reviews,
and no dark sections. The only dark areas are the two full-screen sheet scrims (cart B phone, LIFF B phone); the build
uses the `overlay` token.

"เหลือ 2 วัน" is static text, which PLAN §3.5.3 allows (a "< 72 ชม." label with no live countdown). The rest must not
reach the build:

| Screen | Wording or data that must not ship |
|---|---|
| deals A desktop | "ลดทันที ฿300", "หักลด…ทันที", "ออกใบกำกับภาษี…ได้ทันที", "คำนวณอัตโนมัติ", "โดยอัตโนมัติภายใน 24 ชม.", "ใบเสนอราคา…ภายใน 24 ชม." |
| deals B desktop | "ISO/IEC 27001", "ภายในเวลาไม่เกิน 1 ชั่วโมง", "สองเท่าอัตโนมัติ", "โดยอัตโนมัติ", "หักลดราคาทันที" |
| deals A phone | "สำหรับโรงงานและผู้ประกอบการ B2B", "ส่วนลดทันที ฿200", "ทุกโค้ดส่วนลดสามารถออกใบกำกับภาษีได้" |
| deals B phone | "บันทึกเข้าบัญชีอัตโนมัติ", "หักออกจากยอดรวมทันที" |
| deal-card A desktop | `font-mono` on codes |
| deal-card B desktop | "ด่วน" badge |
| pdp A desktop | "สเปกมาตรฐานโรงงานส่งออก", "FEFCO 0201", "Box Compression Test … 30 กก.", "Digital Proof ฟรีภายใน 24 ชม." |
| pdp B desktop | "ISO 9001 / FSC Certified Board", "FEFCO 0201", "TAPPI T810", "980 kPa", "5.8 kN/m", footer "มาตรฐานโรงงานอุตสาหกรรม" |
| pdp A phone | "ขั้นราคาโรงงาน" |
| pdp B phone | "RSC SPEC · FEFCO 0201", "ผลิตเสร็จ 3–5 วัน" |
| cart A desktop | "ระบบเสนอราคาและสต็อกอัตโนมัติ", "ล็อคราคาและคูปองนาน 60 นาที", "© 2025 GetPack Platform Co., Ltd." |
| cart B desktop | "© 2025 getpack.co", "e-Tax Invoice ได้ทันที", "ตรวจสอบไฟล์ภายใน 30 นาที", pill switch |
| cart A phone | tax ID "0105562000000", entity "เก็ทแพ็ค คอร์ปอเรชั่น จำกัด", "มาตรฐานโรงงาน", `font-mono`, pill switch |
| points A desktop | tiers "สมาชิกทั่วไป" / "สมาชิกธุรกิจ", "สั่งพิมพ์กล่องได้ทันที" |
| points B desktop | tier "บรอนซ์ (Bronze)", "ได้ทันที" ×3, "ภารกิจด่วน", `font-mono` |
| points A phone | "ออกใบกำกับภาษีเต็มรูปอัตโนมัติ", "ได้ทันที", "รับสิทธิพิเศษโรงงาน" |
| liff B phone | "ลดทันที" badge, "Tier Silver", dates in the past ("30 พ.ย. 67") |
| deal-card A phone, points B phone, liff A phone | clean |

Summary: "ทันที"/"อัตโนมัติ" appear on 11 screens, "โรงงาน" on 5, and certifications or lab values on 4. Stitch adds
these unprompted, even when the brief forbids them, so the copy for every surface comes from `messages/*.json`,
reviewed against GLOBAL-RULES §1 and §3. Do not copy it from these images.
