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
