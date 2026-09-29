# U5 — UX excellence layer: measurable superiority, guidance, assistant, messaging, polish (frontend)

> อ่าน `CLAUDE.md`, `00-master-plan.md`, `docs/decisions.md`, `docs/prompts/design-system.md` (รวม Art direction D-180), `docs/ui/voice-and-tone.md`, `docs/ux/competitive-scorecard.md`, `docs/ux/feature-parity-matrix.md` ก่อนทุก session
> ลำดับ: U5.0 ทำ **ตอนนี้** (เก็บ baseline คู่แข่ง) · U5.1–U5.7 ทำควบคู่กับ U4/U2 ตาม `RUN-ORDER-U1-U5.md` · U5.8 คือ release gate ก่อนเปิดตัว
> **ทุก session เริ่มด้วย gap analysis** · ห้ามลอกดีไซน์/ข้อความ/asset ของใคร · ใช้ `src/ui` เท่านั้น

---

## Why
U2–U4 make Packio **more complete** than the competitor. U5 makes it **measurably easier and more modern**: every key journey has a step budget, a first-run path, zero dead ends, fast perceived performance, polished interaction details, and a release gate based on real users (`competitive-scorecard.md`).

## U5.0 — Baseline and instrumentation (no UI changes)
1. Write the moderator guide, consent text (PDPA) and task cards (th) from the scorecard; add `docs/ux/scorecard-results/` template.
2. Implement the Playwright **step counters** for T1–T12 on Packio (mock where the flow is not built yet, marked `pending`), wired into CI as non-blocking until U5.8.
3. Funnel events and dashboards (studio, configurator, checkout, claims, reorder), session replay with PII masking behind consent.
4. Output: the list of journeys that currently exceed their step budget → input for U5.1.

## U5.1 — Journey step budgets & zero dead ends
1. For each journey in the scorecard, map the current steps (screens, decisions, fields) and cut to the budget: pre-fill from context (last address, company tax profile, brand kit, last material), merge screens, move optional fields behind "เพิ่มเติม", defaults that are right for 80 % of SMEs.
2. **Quick start everywhere**: home quick-start strip → configurator pre-filled; product page → studio pre-filled; LINE notification → exact screen (deep link with token).
3. **Zero dead ends**: every empty, error, not-found, out-of-range, RFQ-only and offline state offers the next action (fix, alternative style, talk to CS with context, save and continue later). Lint/test: every route's error and empty components are non-default.
4. Signed-in home becomes a **personal launchpad**: continue last design, reorder top products, orders needing action, recommended next step.

## U5.2 — First-run guidance
1. Intent picker on first visit to the studio/configurator: "มีสินค้าแล้ว อยากได้กล่อง" · "มีไฟล์แบบแล้ว" · "ยังไม่มีแบบ ช่วยออกแบบ" · "สั่งซ้ำ" → routes to the shortest path for that intent.
2. Studio coach marks: at most 3, dismissible, never blocking, re-openable from "?"; a sample design ("ลองเล่นกับแบบตัวอย่าง") that can be discarded.
3. Inline glossary chips on jargon (ลอน E, ECT, bleed, spot UV …) using `docs/ui/glossary.md`; short looping demo clips (our own) for the three hardest concepts (measurement basis, bleed/safe zone, print methods).
4. Help centre deep links from every checks/validation message.

## U5.3 — Messaging (parity gap #15, #40)
1. In-app conversation per order, per design and a general support thread (customer ↔ Packio CS; never directly with a factory): text, images, files, quick replies, typing/read state, notifications via outbox (in-app, LINE, email per preference).
2. Context cards in the thread (design thumbnail, quote, order status) so CS never asks "เลขออร์เดอร์อะไรครับ".
3. Staff inbox in the admin zone (extend the CS chat screens already built; do not build a second inbox): assignment, SLA timers, canned responses, internal notes, link to order/design; LINE OA messages from the same customer merged into the same thread when the account is linked.

## U5.4 — Parity fixes (#2, #29)
1. **Multi-item RFQ basket** for RFQ-only types: add several configured items, one submission, one response thread, quotes per item that convert into cart lines.
2. Dieline downloads: PDF named and layered for designers ("Illustrator-compatible PDF" with `CutContour`, `Crease`, `Bleed`, `Safe` layers), plus DXF and SVG; the download dialog shows a 3-line guide for opening it correctly.

## U5.5 — Packio Assistant (optional, behind a flag, honest AI)
1. Chat panel (Thai-first) available on catalogue, configurator, studio and account. It uses **tools** on the API only: style search, Structure Advisor, quote, order status, glossary, help articles, hand-off to CS. It never states a price, date, strength or policy that did not come from a tool response in the same turn, and shows the source card for each fact.
2. Can fill the configurator on the user's behalf ("กล่องไปรษณีย์ใส่แก้วกาแฟ 2 ใบ ส่งต่างจังหวัด") and shows exactly what it changed, with undo.
3. Evaluation set of ≥ 100 Thai questions with expected tool calls and answers; CI fails below the agreed pass rate; red-team cases (price manipulation, other customers' data, off-topic).
4. Clearly labelled as AI, opt-out, conversation retention per PDPA settings, no training on customer data.

## U5.6 — Content that sells and teaches (parity gap #22)
1. **Materials library**: every material with real spec data from the API (caliper, gsm/flute, printability, food-contact status, recyclability), comparison view, "ใช้วัสดุนี้" CTA.
2. Buyer learning paths (e.g. "สั่งกล่องครั้งแรก", "เลือกวัสดุให้ประหยัด", "เตรียมไฟล์พิมพ์") built from articles, each ending in a pre-filled action.
3. Microcopy review of every U2–U5 screen against `voice-and-tone.md`; error messages specific and actionable; reading level suitable for non-specialists.

## U5.7 — Interaction polish & perceived speed
1. Motion spec for key moments (within D-180 motion tokens): price change highlight with the reason chip, add-to-cart confirmation with the 3D thumbnail flying to the cart (reduced-motion alternative), box open/close on hover in the library, success state after ordering with the production timeline preview.
2. Perceived performance: every interaction acknowledges within 100 ms; skeletons shaped like final content; prefetch the next step's data; optimistic updates for reversible actions; no full-screen spinners.
3. Mobile excellence: thumb-zone primary actions, bottom sheets for options, one-handed studio light edits, LIFF parity for order status/reorder/slip upload.
4. Design QA checklist in the PR template (one primary action, all states designed, tokens only, Thai copy reviewed, a11y checked, step budget unchanged) + Storybook visual review for every new component state.

## U5.8 — Release gate
1. Run the scorecard round on Packio (UAT with production-like data) and compare with the U5.0 baseline.
2. Fix blocking failures, re-test affected tasks.
3. Make the step counters blocking in CI.
4. Publish `docs/ux/scorecard-results/<date>.md` with evidence; launch only journeys that pass.

## Definition of Done (each session)
- Gap table, tests (component, e2e, step counters), axe, Lighthouse budgets, visual review.
- Every new string in th/en via `src/i18n`, reviewed against voice-and-tone.
- PROGRESS entry with before/after step counts for touched journeys.
