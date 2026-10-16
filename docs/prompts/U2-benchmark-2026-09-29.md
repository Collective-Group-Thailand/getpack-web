# U2 — Update 2026-09-29 (frontend): configurator v2, Structure Advisor UI, samples, trust pages, library & repeat business

> สำหรับ repo ที่รัน F0–F6 และกำลังทำ U1 · อ่าน `CLAUDE.md`, `docs/prompts/00-master-plan.md`, `docs/decisions.md`, `docs/prompts/design-system.md`, `docs/benchmark/kumopack-2026-09-29.md` ก่อนทุก session
> **ลำดับ**: ทำ U-F0 (integration กับ contract จริง) ให้จบก่อน — งาน U2 ทุกชิ้นต้องรันบน API จริง ไม่ใช่ mock ที่เดาเอง
> **ทุก session เริ่มด้วย gap analysis** ใน Plan Mode → `docs/update-2026-09-29-gap.md` (met | partial | missing + evidence) แล้วทำเฉพาะที่ขาด
> ห้ามลอกดีไซน์ ข้อความ ภาพ เทมเพลต หรือคำเรียกหมวดหมู่ของเว็บอ้างอิงใด ๆ — ใช้เฉพาะ "งานที่ผู้ใช้ต้องทำได้" แล้วออกแบบใหม่ด้วย `packages/ui` ของเรา

---

## Why this update
`docs/benchmark/kumopack-2026-09-29.md` §4 lists what a live Thai competitor does that we do not, and where we can be clearly better. This prompt turns it into UI work. Each deliverable depends on the matching backend deliverable in `getpack-api/docs/prompts/U2-benchmark-2026-09-29.md`; until that tag exists, build against MSW with a `CONTRACT-REQUEST` entry as usual — and never invent a money or structural calculation on the client.

---

## U2.F1 — Configurator v2 (P0, needs API U2.1 + U2.2 + U2.3)
1. **Dimensions block**: unit switch (mm / cm / in, display only — always send mm), a labelled diagram that highlights the field being edited, and a **measurement-basis** selector (ภายใน / ภายนอก / ตามทับเส้น / ขนาดสินค้า) with all three derived sizes shown live from the API's conversion. Per-style min/max with inline, specific errors ("สูงสุด 800 มม. สำหรับกล่องแบบนี้ กับกระดาษที่เลือก").
2. **Product & logistics block**: weight per piece, units per box, stacking, fragility, transport mode, storage conditions — the inputs the advisor needs, with plain-Thai helper text and sensible defaults; never blocking (all optional, advisor degrades gracefully).
3. **Structure Advisor panel**: recommended board with the reasons as readable chips, the estimated strength range with an explicit "ค่าประมาณ ไม่ใช่การรับประกัน" note, and 2–3 alternatives as cards (ถูกที่สุด / แข็งแรงที่สุด / เร็วที่สุด) with real price and lead-time deltas. Selecting an alternative re-prices the whole configuration. A "ทำไมถึงแนะนำแบบนี้" sheet shows the factors and their effect.
4. **Target price**: optional field; when the quote is at or below target show a positive state, when above show the levers the API returns as actionable cards ("เพิ่มเป็น 3,000 ชิ้น → ฿x.xx/ชิ้น") plus one-click "คุยกับทีมขาย" carrying the whole context.
5. **Summary step**: completeness meter, per-section edit, style code + international name, tolerances, what happens next and when. Save draft, resume, share by link.
6. **Style codes everywhere**: configurator, quote PDF, order, proof, tracking.
7. Acceptance: e2e (configure → advisor → alternative → target price lever → add to cart) against the real API; axe clean; Lighthouse app budget; no client-side price or strength maths (lint rule + review).

## U2.F2 — Style library & free self-service artefacts (P2, needs API U2.6)
> **Precedence:** the library page is superseded by `U3-style-library.md` U3.5. In U2.F2 implement only the **dieline download** and **spec sheet** UI if U3.5 has not done them yet.
1. **Library page**: searchable, filterable (family, closure, use case, product type, printability, size range), card grid with 3D thumbnails from `@getpack/dieline`, favourites, "ใช้แบบนี้" → configurator with values carried over.
2. **Free dieline download** (PDF / DXF / SVG) for any configured size, no plan gate, with a short explainer of what the layers mean; download starts the "you can order this" nudge, never a paywall.
3. **Packaging spec sheet**: download button on approved orders and approved samples; preview before download.
4. Acceptance: SEO for the library (indexable, structured data), performance budget with many cards (virtualised), e2e for download flows.

## U2.F3 — Sample / prototype flow (P1, needs API U2.4)
1. Customer: request a sample from the configurator or an existing quote; sample quote card (cost, lead time, credit rule as the API states it); pay; track; **approve with a checklist** (dimensions, colour, material, construction) and evidence; on approval a pre-filled bulk order with the spec and artwork locked, clearly showing what is locked and how to change it.
2. Admin: sample queue, sample vs bulk distinction everywhere, evidence review, re-sample loop.
3. Partner zone: sample jobs with the extra evidence requirements (photos, measured dimensions, board used).
4. Timeline and notifications treat the sample arc as first-class.
5. Acceptance: e2e customer + admin + partner path; visual snapshots of the approval screen; a11y on the checklist.

## U2.F4 — Trust surfaces (P1, needs API U2.5)
1. **Guarantee page**: the remedies matrix rendered from the API (never hard-coded), with tolerances in plain Thai, timelines, and what evidence we need; linked from product pages, checkout and order detail.
2. **Network page**: audited-partner count, audit criteria, regional capability/capacity map, aggregate on-time and quality figures with the measurement window stated. No factory identity, no invented numbers; empty-state text when a figure is not yet available.
3. **Claim timeline** in the account area: status, SLA countdown, who owns it now, what we need from the customer, decision and remedy.
4. **Verified reviews**: show only real, order-backed reviews with the product type and date; if there are none, show the honest empty state (D-181) — never placeholder testimonials.
5. Acceptance: content comes from the API in both languages; axe; e2e for claim timeline; snapshot tests for empty states.

## U2.F5 — Buyer dashboard & repeat business (P2, needs API U2.7)
1. **Account dashboard**: spend over time, open requests, in production, arriving this week, reorder suggestions, documents to download — one screen answering "where is my money and my boxes".
2. **Reorder**: one click from a past order, explicit "ไม่มีค่าบล็อก/เพลทซ้ำ" saving line, artwork version shown and lockable, price differences explained.
3. **Replenishment**: suggested reorder date/quantity per SKU with the reasoning (usage rate, lead time, safety stock), snooze and "remind me" settings.
4. **Call-off orders**: commitment overview, release schedule, remaining balance, create-release flow, stock visibility as the API provides it.
5. **B2B integration**: API keys and webhook subscriptions UI (create, scope, rotate, revoke, delivery log) inside company settings, with copy-once secrets and audit trail.
6. Acceptance: e2e reorder and release creation; permission tests (only company roles that may commit money see the actions).

## U2.F6 — 3D, AR and designer polish (P3)
> **Precedence:** superseded by `U4-3d-studio.md` (U4.3, U4.7). Skip this section; do not implement it separately.
1. 3D preview with real material appearance (kraft vs coated), open/close animation control, and **AR at real size** on supported phones (GLB/USDZ via `model-viewer`), with a graceful fallback and a "ขนาดเท่าของจริง" note.
2. Designer: library integration, style code display, quick "download dieline" and "make a sample" actions, and the real-time check panel surfacing the same tolerances the guarantee page publishes.
3. Acceptance: performance budget on mid-range Android (the designer route's app budget), no regression in existing designer e2e.

## U2.F7 — Partner zone parity (P2, needs API U2.9)
1. Partner "Today" and dashboard: period-over-period comparison for earnings and jobs; counters include sample jobs and claims involving the factory.
2. Settings: business hours editor with exceptions (holidays, shutdowns) and a preview of how it changes acceptance deadlines; logistics settings.
3. Billing: toggle "ตามใบสั่งซื้อ / ตามรายการจ่าย", totals that match the statement, **payout calendar** view (upcoming, paid, retained with release date), statement downloads.
4. Partner knowledge base section with search, rendered from the API, linked contextually (e.g. the QC photo standard from the QC step).
5. Release hygiene in the web build: fail CI when debug strings or mock flags appear in production bundles or rendered HTML (Playwright scan of key routes).
6. Acceptance: partner e2e on a mobile viewport, axe, Lighthouse partner budget.

---

## Definition of Done (each session — same as F0–F6 plus)
- Runs on the real backend contract (no `CONTRACT-REQUEST` mock left for the flow); contract lock pinned to a tagged release.
- Every number shown (price, strength, date, tolerance, saving) comes from the API; the client formats, never computes.
- Thai + English; statuses and reason codes via `src/domain/status` so a new backend enum fails the build until it has copy.
- axe clean, keyboard path, Lighthouse budgets, visual snapshots reviewed.
- `docs/PROGRESS.md`: screens done, decisions implemented, deferred, assumptions.
