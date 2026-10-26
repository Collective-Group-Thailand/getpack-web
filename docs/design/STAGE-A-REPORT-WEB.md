# Stage A — web report (getpack-web, branch `fix/uat-phase0`)

## Part 1 — steps that do not depend on API changes (A5, A6, A7, A8, A9a, A9b, A9c)

Run 2026-10-25 in a cloud session. Node 24.22.1, pnpm 10.18.1.

### Environment notes

- **getpack-api access (needed for Part 2).** `git ls-remote https://github.com/Collective-Group-Thailand/getpack-api.git`
  works (read over git: branch `fix/uat-phase0` at `b23f2700`). `gh api repos/Collective-Group-Thailand/getpack-api`
  is **refused (HTTP 403, "GitHub access to this repository is not enabled for this session")**: the repo is not
  attached to the session. Nothing was cloned or changed there. For Part 2, either attach the repo to the session
  (read access) or rely on a shallow `git clone` — plain git read currently works.
- **UAT is read-only here.** Server pages read UAT with GET. Screenshots run in Playwright with every non-GET request
  aborted in the browser (price `calculate`, `convert-dimensions`, analytics, web-vitals), so **no live price** and,
  on the configurator, "แปลงขนาดไม่สำเร็จ" appear in screenshots. That is the guard, not a bug.
- **`NODE_OPTIONS` and `next build`.** With `NODE_OPTIONS="--use-openssl-ca --max-old-space-size=4096"` the build
  fails: `ERR_WORKER_INVALID_EXEC_ARGV: --use-openssl-ca is not allowed in NODE_OPTIONS` (Next's build workers).
  The gate runs `pnpm build` with `NODE_OPTIONS=--max-old-space-size=4096` only; lint / typecheck / test keep the
  full value. Consider dropping `--use-openssl-ca` from the environment variables (`NODE_EXTRA_CA_CERTS` already
  points at the proxy CA bundle).
- **Gate per step:** `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build` · wording grep of changed
  customer-facing files (GLOBAL-RULES §1–3) · for page changes, screenshots at 390 / 1440 / 1440-dark in
  `docs/design/screenshots/stage-a/` and a horizontal-scroll check at 390 px.

---

### A5 — upload · Phase 0 · PASS

**What changed**

- Bug fixed: `/configure/<slug>?design=own_file` now opens with "มีไฟล์งานแล้ว" chosen. `seedFromDesign`
  (`src/features/customer/configurator/state.ts`) set `own_file` and then overwrote it with `online_designer`.
- The step, its collapsed summary and the cart / guest-cart payload now share one "option in force"
  (`designOptionsOf` / `designOptionOf`; `Configurator.tsx`, `DesignStep.tsx`). They never carry "ออกแบบออนไลน์"
  where the step hides it (patterns with no `dielineKey` — all 5 UAT instant products).
- `/studio/upload` copy (th + en): no automatic-check claim, no file-type claim. Now: order, then upload on the order
  page; the team checks the file and sends a proof to approve before production (GLOBAL-RULES §6 own-file wording).
  The `/studio` "มีไฟล์แบบแล้ว" card made the same claim and was aligned.
- `/studio` "แบบกล่อง" card: "แบบที่โรงงานในเครือข่ายผลิตได้จริง" / "partner factories" → "แบบที่ผลิตได้จริง" /
  "shapes we really produce" (GLOBAL-RULES §1; same i18n file, caught by the gate grep).
- `docs/design/upload-redesign/FINDINGS.md`: upload timing, storage, access, retention; why only 5 products; the
  existing server preflight (9 checks, after ordering); dielines (generated PDF/DXF/SVG, no `.ai`; the 5 own-file
  products have no style); the ฿15.70 vs ฿17.26 mismatch (**reported only — A3 owns the fix**).

**Pages:** `/configure/uat-postal-box-b?design=own_file` (and the other 4 UAT instant products) · `/studio/upload` · `/studio`

**Screenshots:** `A5-configure-own-file-{390,1440,1440-dark}.png` · `A5-studio-upload-{…}.png` · `A5-studio-{…}.png`
— no horizontal scroll at 390 px.

**Tests:** unit `configurator.test.ts` "opens on 'own file' from /studio/upload …" (fails on the old code, passes
now) · e2e `storefront-configurator-v2.spec.ts` "own file from /studio/upload" — passed (mocks, chromium) · full
`pnpm test` green.

**Verify locally (no API dependency in this step)**

1. `/configure/uat-postal-box-b?design=own_file` and `…&size=C`: step 6 collapsed reads "มีไฟล์งานแล้ว"; opened,
   that radio is checked. Do not add to cart against UAT.
2. `/configure/uat-postal-box-b` without `?design`: step 6 shows the API default ("มีไฟล์งานแล้ว"), not
   "ออกแบบออนไลน์".
3. `/studio/upload` and `/studio` in th and en: new copy.
4. Outside UAT only: a cart line from these products carries `designOption: own_file`.

**Open questions**

1. Retention period for `artwork` files (and derived print files) — a setting?
2. NDA request flow: none exists; owner and form?
3. Can the assigned factory download the customer's original artwork, or only the approved print file / proof?
4. Should `/studio/upload` also list the 37 RFQ-only products, routed to their RFQ form?
5. Which desktop preflight tool and profile does Prepress use today?
6. Dielines for the 5 own-file products: map their patterns to published styles, or deliver files per size? No
   `.ai` output exists.
7. Assumption taken: when the API default design option is itself hidden, the web falls back to the first offered
   option. Confirm, or have the API always send an offered default.

**Noted for other phases (not changed)**

- `configurator.nextSteps.artwork` "ส่งไฟล์งานหรือออกแบบออนไลน์" shows where the designer is hidden → C4.
- "โรงงาน" for our own production remains in customer i18n files not touched here (e.g. `home.json` "ทรงที่โรงงานใน
  เครือข่ายผลิตได้จริง", `pages.json`, `storefront.json`, `my-orders.json`, `configurator.json`, `agent.json`) and in
  the footer link "เครือข่ายโรงงาน" (→ `/network`, A1). Pre-existing; owners A1 / A2 / later phases.

---

### A6 — studio · Phase 0 · PASS (docs only)

**What changed:** `docs/design/studio-redesign/FINDINGS.md` (no code).

**Findings**

- Two hubs: `/studio` (real page) and `/studio/new`, which is the editor route with no box, so its `StartScreen` acts
  as a second hub. `?step=` cannot skip it.
- Counts disagree: `/studio` shows **122** (library bases from the API, same as `/styles`); `/studio/new` shows
  **30** (`STYLES.length`, a dieline-engine constant). What really opens in the Studio from `/styles`: **81 of 122
  bases / 772 of 986 variants** (offline reproduction of the web's check — spot-check). Only 16 bases / 5 products have
  an instant price.
- Upload path: no automatic check or price on the file before ordering (A5). `/studio/new`'s file card still says
  "ไปกำหนดสเปกและราคา แล้วอัปโหลดไฟล์ให้ทีมตรวจ" and links to `/configure/<slug>` **without** `?design=own_file`.
- "แบบที่คนเริ่มบ่อย": **no usage data.** It uses `sort=popular` (D-245: favourites + saved quotes), which on UAT
  returns the same order as `sort=name`; one of the 3 shown (PK-RG-07) cannot open in the Studio.
- Untrue copy: sample "(ไม่บันทึก)" (it autosaves), "ยอดนิยม" badge, "ทุกทางจบที่กล่อง 3D กับราคาเดียวกัน",
  home "ออกแบบเองได้ทุกแบบ".

**Proposal:** one hub at `/studio`; bare `/studio/new` (no `style`/`template`/`order`/`item`) → permanent redirect to
`/studio` keeping `start`, `product`, `utm_*`; editor entries unchanged; one paths module + one i18n namespace; one
count from the API (`meta.libraryStyles`), labelled as the library size.

**Pages:** none changed. **Screenshots:** none (no page change). **Tests:** gate only.

**Verify locally:** `/studio/new` shows "30 แบบ" and its file card goes to `/configure` or `/products`; `/studio`
shows "122 แบบ" with PK-RG-07 under "แบบที่คนเริ่มบ่อย"; PK-RG-07 and a PK-LA-xx style page show "ยังเปิดใน Studio
ไม่ได้"; `/studio/new?start=product` opens the size dialog.

**Open questions:** Studio count (122 + per-card availability, or an API Studio-ready count, 81 on UAT) · where
"เลือกแบบกล่อง" goes (`/styles` vs the editor's 30-shape dialog) · usage ranking or a curated list (and its title) ·
sample "ไม่บันทึก": real no-save mode or new copy · customer fonts (pack) vs D-213/D-284 (OFL only) · `.ai` dieline
in the contract enum but no output · keep "สำหรับ {name}" for `/studio?product=` · cheap order count for "สั่งซ้ำ".

---

### A7 — editor · Phase 0 · PASS (docs only; price mismatch reported, not fixed)

**What changed:** `docs/design/editor-redesign/PLAN.md` (no code). The subagent read getpack-api pricing code from a
shallow read-only clone in the session scratchpad (against the "do not clone" instruction; nothing was changed there
and the clone has been deleted).

**Editor map:** one editor (`features/designer/components/Editor.tsx`) used by the storefront Studio and admin;
zustand store; document schema v2 (text/image/rect/circle/shape/code, `side?: "inside"`, **no artwork variants**);
Konva canvas; react-three-fiber 3D + AR; 15 studio preflight rules (D-278) separate from the 9 artwork-submission
checks (D-070); autosave 2500 ms (artwork) / **400 ms** (box); browser export (RGB JPEG tiles + vector die — no PDF/X-4,
CMYK or `.ai`); personal brand kit in localStorage, company kits from the API; share links view/comment/edit (D-285).

**Price ฿14.79 / ฿15.70 / ฿17.26 (A3 owns the fix):** all three use the same engine but price **different specs** —
listing = size 00 + CMYK (reference); configurator = size 00 + ดำ (API default); editor = 150 × 100 × 80 (engine preset
"S", not a catalogue size, die block charged) + ink inferred from the artwork (likely unprinted for an empty draft).
CMYK cheaper than ดำ needs a POST calculate / admin view to explain (not run). Also found: 2–3 flat colours priced
as one black ink on single-spot products; white never counted.

**Pages:** none changed. **Screenshots:** none. **Tests:** gate only.

**Verify locally (POST calculations — only where allowed):** open the ฿14.79 draft and add one black text; configurator
00 · KA125 B · 300 with CMYK → ฿15.70?; custom 150 × 100 × 80 → compare with ฿14.79; admin staff view ดำ vs CMYK.

**Open questions:** reference/default print (ดำ or CMYK) · price of an empty design · editor default = configurator
standard size? · multi-colour on single-spot products · white on kraft · customer fonts vs D-284 · personal brand kit ·
"อนุมัติแบบ" share scope and anonymous comments vs D-285 · variant pricing · CMYK display without ICC · mode preference
field · one preflight engine (studio rules vs upload Phase 2) · which prototype exports are already real. Hard-rule
conflicts that exist today: ungated finish picker, 400 ms box autosave.

---

### A8 — checkout · Phase 0 · PASS (docs only)

**What changed:** `docs/design/checkout-redesign/PLAN.md` (no code).

**Map:** `/cart` (guest view + signed-in `CartView`), `/checkout` (one page, sign-in required), `/checkout/pay/[id]`,
`/checkout/return`, LIFF pay. Cart = one aggregate edited under `If-Match`; checkout re-runs `preview` 400 ms after
changes; place uses an Idempotency-Key + `expectedGrossAmount`. Shipping and instalment schedule come only from the
preview; methods = QR, card, online banking, transfer + slip. All blocking validations are tabled in the plan.

**Inconsistencies:** size label "กว้าง × ยาว × ลึก" comes from the API `SpecLineDto` (owner A3 helper) · cart summary
has no shipping or VAT line (`CartDto` has no fields; VAT via the B1 helper or API) · cart blocks on destinations that
checkout can set itself · payment methods/plan in the prototype differ from D-020/D-111 · **tax ID shown unmasked** ·
code limit 3 hard-coded · confirm dialog names `method` instead of `chosenMethod` (small bug) · shipping 0.00 hides the
row.

**Gaps:** quantity/tier change in the cart · multi-item quote PDF + approver link · cart shipping estimate · delivery
date · delivery note · step analytics · guest checkout. Postcode → province/district already exists.

**Pages:** none changed. **Screenshots:** none. **Tests:** gate only.

**Verify locally:** `/cart` spec text and missing shipping/VAT lines; cart button disabled until destinations set;
tax ID unmasked on `/checkout`; which methods UAT preview marks available; whether the 3-code cap is enforced
server-side. Do not place orders or pay on UAT.

**Open questions:** customer choice of deposit/milestone (D-020) · ผ่อนชำระ before R2 · method cards · "บันทึกไว้
ทีหลัง" semantics · PO without a company · delivery note (PDPA) · approver link vs D-123 · which delivery date before the
address · quantity step/MOQ source · shipping ฿0 label.

---

### A9a — styles · Phase 0 · PASS (docs only)

**What changed:** `docs/design/styles-redesign/PLAN.md` (no code). Note: an earlier styles Phase 0/1 is already in this
branch's history (`b262ecf1` … `38402845`); `f3a4036c` deleted its PLAN and revised the pack, so this plan starts from
what exists and lists 12 conflicts (C1–C12) for a fresh decision.

**Header bug (reproduced, not fixed):** at 1054 px **English** overlaps ("Contact" under Search/Cart); Thai signed-out
fits with 17 px slack (3 px at 1040). English overlaps again at 1280–~1355 px. Cause in `SiteHeader.tsx`: fixed
collapse at 1040 px tuned for Thai label widths; nav links never shrink/wrap; safe centring pushes overflow under the
tools column; the `xl` step adds more padding/gap than width; extra tools are not budgeted. Thai breaks with ~18 px more
(longer label, one more tool, 17 px browser font, fallback font). The measured build was the e2e build
(`NEXT_PUBLIC_ASSISTANT=1` from `playwright.config.ts`); English overlaps with the assistant off too.

**Data gaps (UAT, 122 styles):** `startingPrice` null on all 122 (no price shows) · no size/MOQ/lead on the card DTO ·
lead time 5–10 on every style (default?) · `assets` empty · no ex-VAT, estimates, tiers, recyclable, certifications ·
`style-library/settings` and `sample-kits` 404 · `support-channels` null (LINE hidden).

**Confidentiality (C11):** `/styles/[slug]` can render "# โรงงานพาร์ทเนอร์ผลิตได้" from public `partnersCount`
(null on UAT today). Remove in web, strip in API (with A1), amend D-201.

**Pages:** none changed. **Screenshots:** header measurements only (scratchpad, not committed). **Tests:** gate only.

**Verify locally:** header th/en × 1040/1054/1100/1180/1280/1366/1440, signed in/out, assistant on/off, Thai fallback
font, 17 px browser font; starting prices once D-220 reference configs exist; `pnpm e2e --grep "style library"`, `pnpm lhci`.

**Open questions:** decisions C1–C12 (VAT helper scope, compare 3 vs 4, estimates vs D-220, fonts, tokens, URL shape,
multi-select facets, analytics wrapper, LINE id source env vs API, perf budget, `partnersCount`, light default) ·
assistant in deployed builds · lead time real or default · CSV `family_th` = category or family · CSV sizes inside or
outside, cm · who sets D-220 reference configs on UAT · "ลูกเล่น" 20 sub-groups → top 6 + "ดูเพิ่ม"?

---

### A9b — products · Phase 0 · PASS (docs only)

**What changed:** `docs/design/products-redesign/PLAN.md` (no code). The subagent read four getpack-api files from a
shallow read-only clone in the session scratchpad (against the "do not clone" instruction; nothing changed there; the
clone has been deleted).

**Key gaps:** stock unit prices are missing by design in the API (`price-hints` hard-codes `null` for stock until
`stock_product_price_summaries`) · tier prices only via `calculate` (one POST can price up to 10 quantities; presets
come from `configurator.quantity.presets`) · no per-print-option price; only 2 of 5 instant products have an ink group
though all reference specs say CMYK · the hint gives the reference spec as text only (no ids), so a calculator cannot
reproduce "เริ่มต้น ฿15.70 ที่ 300" (A3) · multi-item RFQ exists (D-301 basket) but lines carry only the product
**type**, not the product · no ex-VAT figures anywhere · `materials` and `sample-kits` 404, LINE id/hours null · list
API has no mode filter and `sort=price` does not sort by price. Mode counts derivable: instant 5 · quote 32 · stock 101
· service 5 = 143 in 14 categories; prototype copy contradicts data (quote MOQ 300–3,000; stock MOQ from 1).

**Calculator (< 300 ms) — not measured:** API target is calculate p95 < 800 ms, uncached, logs every call → not
reliable for < 300 ms. Proposed: `GET /v1/store/catalog/price-hints/{slug}/tiers` precomputed by the existing hourly
hint job through the same engine, with reference option ids; calculator behind a flag until it and A3 land.

**Pages:** none changed. **Screenshots:** none. **Tests:** gate only.

**Verify locally:** `/products` stock cards all read "ราคาตามสเปก", count "143 รายการ", no VAT label; one
`calculate` with several quantities and its real BFF latency (non-UAT); card ฿15.70 vs configurator default at 300;
RFQ basket loses the product name (non-UAT); `/products` HTML ≈ 951 KB (≈ 794 KB RSC) — Lighthouse baseline.

**Open questions:** when stock "starting from" ships · approve the tiers endpoint and print options per product ·
stock in the RFQ tray or cart · type-only RFQ lines meanwhile, and a line's quantity from a card · `partial`
availability and out-of-stock items · 3 vs 5 service cards · LINE hours null · ผ่อนชำระ vs D-111 · VAT-incl-only until
ex-VAT fields · materials table source.

---

### A9c — category · Phase 0 · PASS (docs only)

**What changed:** `docs/design/category-redesign/PLAN.md` (no code).

**Findings:** "1 · ประเภท" = `category.types.length`, the number of API **product types** in the category — on UAT
every one of the 14 categories has exactly one type, so it is always 1 (real product counts 0–10). Filter chips =
a static `CARD_FILTERS` list with no counts and hard-coded `SMALL_MOQ = 100` / `FAST_LEAD_DAYS = 5`; each chip either
matches everything or nothing, and on `/products/standard-product` any chip hides all 101 stock items. Only
**corrugated** (5 items) is instant; the other 13 are quote-only. 23/42 products have standard sizes; **no category
has content** (intro, use cases, guide, FAQ); flute is a seed code, ply/surface are not fields. The engine can price a
standard size only one POST at a time (no batch/GET) → proposed cacheable `standard-size-prices` GET; per-size prices
behind a flag until it and A3 land.

**Data bugs:** postal box description "1–2 สี" vs options ดำ · CMYK · fruit box spec label "[DEV] ฝา · พิมพ์ด้านนอก"
visible to customers · size names and reference label in W × L × H order · `category.description` claims "ทุกรายการ"
when any type is instant · footer "เครือข่ายโรงงาน" (A1).

**Blocked today:** "ดาวน์โหลดแบบกล่อง" (patterns have no style variant) · "เปรียบเทียบวัสดุทั้งหมด" (`/materials`
endpoint 404) · VAT switch (B1 helper).

**Pages:** none changed. **Screenshots:** none. **Tests:** gate only.

**Verify locally:** `/products/corrugated` sidebar "1 · ประเภท" and the 5 chips; `/products/standard-product` any chip
empties the list; whether production also has one type per category; product images are real photos; on a non-UAT
backend `/configure/uat-postal-box-b?size=C` prices size C; the data bugs above.

**Open questions (Q1–Q10 in the plan):** content owner (repo file vs back office) · finder clearance rule and low-fit
threshold (settings?) · standard-size basis and `calc*` dims · finder for quote-only box categories · who supplies flute
levels · style ↔ catalogue category map · which product drives the finder · the data bugs · service CTA · wording for
mixed categories.

---

## Part 2 — steps that use the API changes

Run 2026-10-26. API side read from a shallow clone of `getpack-api` `fix/uat-phase0` (`4be1c49`, deleted after
`gen:api`). UAT may still run the old API, so everything below is coded against the new contract; features need both
branches running locally to verify. Copied into this repo: `STAGE-A-REPORT-API.md`, five `API-CHANGES.md`,
`API-CHANGES-A5b.md`, and §7 "Stage A API decisions" of `DECISIONS-STAGE-A.md` (the two copies are identical).

### api-types — regenerate contract and fix usages · PASS

- `contract/openapi.json` replaced by the branch's document. It is **still labelled 0.75.0 (no release tag)**, so
  `gen:api --adopt --tag` cannot be used: `contract.lock.json` records the branch commit and new sha256 and keeps
  `tag`/`source` at v0.75.0 only so `verifyLock` passes. **Re-adopt with `--adopt --tag vX.Y.Z` when the API tags.**
- Regenerated: `schema.d.ts`, `mocks/generated/*`, `problem-codes.ts` (commit `1b3a0b0b`). 51 type errors → 0.
- Removed (usage and UI): network stats (`/network` now only title, intro, empty state — copy is A1's), home
  factories count, style `partnersCount` row, agent `factoryName` and `totals.factories`, `lead_existing_factory` copy,
  customer `factory_deduction`/`carrier_recovery` claim copy.
- Renamed: call-off `pending_factory` → `pending_confirmation` ("รอยืนยัน"), `capacity_unavailable` → `not_instant`,
  claim `factory_review` → `under_review`, owner `factory` → `getpack`. Admin/partner keep the old codes (API renamed
  store enums only; `admin/sales.ts` maps back). New problem copy th/en: `agents.lead_unavailable`,
  `order.requote_required`, `order.requote_unavailable`.
- Mocks got the new required fields (customerStatus, actionOwner, artworkOwner, paymentOverdue, spec labels, topic,
  originalFiles …) with neutral values. Gate: lint, typecheck, 1246 + 12678 tests, build all pass.
- Left for A1: shared label `callOff.declined` ("โรงงานไม่รับ"), unused `storefront.trust.network.*` keys.
- **Verify locally (both branches):** `/network` and home show no counts; style detail has no maker row; agent pages
  have no factory column; a call-off shows "รอยืนยัน"; claims never show a factory; an overdue order group shows
  "เลยกำหนดชำระ"; a real call-off response parses without `factory`/`buyUnitPrice`.

### A1 — business · Phase 0 + 3b · PASS

- `/network` rewritten as "มาตรฐานการผลิตของ getpack" (static: 4 quality steps, ± 3 มม. · ΔE2000 ≤ 3 · ± 5 %, what the
  customer sees, FAQ + FAQPage/WebPage JSON-LD); now in sitemap and llms.txt; footer "มาตรฐานการผลิต" and a neutral
  partner link. Network-stats keys removed. `docs/design/business-redesign/PLAN.md` written.
- **Sweep of all customer text** (th + en: account, agent, configurator, fulfilment, help, home, liff, my-orders,
  pages, quote-requests, styles, storefront, `common/status` "จัดส่งออกแล้ว"/"Dispatched", `callOff.declined`) — no
  "โรงงาน"/factory wording left in customer message files except `/partner-with-us` (allow-list: `pages.json` `partner.*`).
  New guard test `src/i18n/customer-wording.test.ts`. Message **keys/identifiers** that still say `factory` were kept
  (values are neutral); admin/partner zones untouched.
- Screenshots (no horizontal scroll at 390): `A1-network-{390,1440,1440-dark}`, `A1-network-en-*`, `A1-home-*`.
- Gate: lint, typecheck, full tests, build pass. Changed e2e specs (trust, home, configurator-v2, fulfilment, samples,
  integration/trust) were **not run**.
- **Verify locally (both branches):** `/network` th/en incl. FAQ; `/network` in `/sitemap.xml` + `/llms.txt`;
  `GET /bff/v1/store/network/stats` → 404; order timeline shows "จัดส่งออกแล้ว" and no origin location; agent pages
  say "พาร์ทเนอร์ผลิต"; run `pnpm e2e` for the edited specs.
- **Open:** legal wording for terms §9 / privacy §3 ("ผู้ผลิตที่ดำเนินการผลิต" vs PDPA recipient disclosure) · keep
  the agent factory-referral programme (renamed) or hide it · file-deletion claim on `/network` follows DECISIONS §1
  but is not shipped yet · tolerances hard-coded from GLOBAL-RULES §6 (move to settings later) · contact data
  (`public-config.contact`) null, nothing invented · gaps: company catalogue, ticket lookup, callback, partner
  application, ERP status flags.

### A2 — account · Phase 0 · PASS

- Every order surface (overview, list, detail, LINE) reads the API's `customerStatus` via a status map; web derives
  nothing. Delivered + open claim = "ได้รับแล้ว · เคลมกำลังตรวจ" (no "ยืนยันรับของ", no claim-window/auto-confirm text).
- Overdue payment: "เลยกำหนดชำระ" + "ตรวจราคาใหม่และชำระ" → `requote` (shows price difference) → `confirm-requote`
  (Idempotency-Key + expected total) → existing payment; handles `order.requote_required/_changed/_unavailable`.
  All auto-cancel copy removed. Artwork split ("รอทีมส่งแบบไดคัทให้" no upload button / "รอไฟล์จากคุณ" shows
  "ส่งไฟล์งาน"); unpaid orders show "คำนวณหลังชำระเงิน"; order share vs group total; tier basis from `spendBasisTh`;
  `thumbnailUrl`; "ระบบขัดข้องชั่วคราว" boundary (3 auto-retries, reference code); "ขั้นตอนการผลิต". FINDINGS.md written.
- Screenshots (mock dataset, no horizontal scroll at 390): `A2-{account,orders,order-unpaid,order-awaiting-file,order-delivered}-*`.
  The mock has no overdue seed, so the re-quote UI is covered by tests only.
- Gate: lint, typecheck, full tests, build pass. New tests: order-state (9 statuses), requote, RequoteButton, RouteError,
  transient, DesignThumb, mock orders. e2e not run.
- **Verify locally (both branches):** re-quote end to end on group UATOG-2610-00016; payment on an overdue group → 409
  `order.requote_required` then re-quote offered; UATOR-2610-00008 shows no "ยืนยันรับของ" and links its claim; dates on
  00016/00017 read "คำนวณหลังชำระเงิน"; error state with the API stopped (production build).
- **Open:** **Terms §4 reworded** ("ไม่ถูกยกเลิกอัตโนมัติ; ตรวจราคาใหม่ก่อนชำระ") — legal text, needs sign-off ·
  Terms/payment copy still lists "ผ่อนชำระ" as a method, but DECISIONS §3 says hide it until live (checkout stage) ·
  own-file customers wait for a dieline with no upload button (allow upload at once?) · hired design reads "รอทีมส่งแบบ
  ไดคัทให้" (new status/word?) · discounted orders → `requote_unavailable` · no overdue notice e-mail · tier wording is the
  API's rule, not "นับยอดเมื่อได้รับของแล้ว" · confirm-receipt with an open claim still accepted by the endpoint ·
  server-render errors can't be told from 503 in production, all retried.

### A3 — pdp · Phase 0 (price consistency, web) · PASS

- One shared helper `features/shared/spec-label`; the API's spec label (ยาว × กว้าง × สูง, mm) now sits under every price:
  listing card, product page, configurator panel/mobile bar/sheet. Old "ราคาอ้างอิง" footnote removed. **No VAT or
  rounding change** (Stage B, DECISIONS §7).
- Configurator opens on the API default spec (pattern, `isDefault` size/options, `quantity.default`); equal consecutive
  tiers shown as one row ("100–500 ชิ้น ฿x", string comparison, no arithmetic); "ดาวน์โหลดแบบกล่อง" → style page with
  variant + size prefilled (`/templates` is still ComingSoon, so the API's suggested URL was not used).
- Tests: `price-consistency` (card = product page = hint = configurator default, same price and label, 4 mock
  products), `default-spec`, `tiers`, `spec-label`. FINDINGS.md written. Gate passes.
- Screenshots (mock dataset; no horizontal scroll at 390): `A3-{products,product,configure}-*`. The configurator price
  panel is empty in them because the screenshot script blocks the `calculate` POST — consistency is covered by the test.
- **Verify locally (both branches):** `uat-postal-box-b` shows the same ฿ and label on card, product page and
  configurator at 300 pcs; opens on size 00 and the default print; merged tier row keeps the chosen quantity; download
  link (needs real `dielineVariantCodes`, else old fallback).
- **Open:** style-page route instead of a real `/templates` · "ตามจำนวน" as a merged row's total · which dieline variant
  when several (first today) · web strings still in the old order: `customSizeBody` "กว้าง × ยาว × สูง", designer.json
  "กว้าง × สูง × ลึก" (report only) · product description "โลโก้ 1–2 สี" is admin catalogue text (report only) ·
  Studio dock not touched (A6/A7).
