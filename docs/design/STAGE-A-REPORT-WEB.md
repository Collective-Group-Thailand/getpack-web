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
