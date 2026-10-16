# U4 — getpack 3D Studio: design → check → price → order (frontend)

> อ่าน `CLAUDE.md`, `docs/prompts/00-master-plan.md`, `docs/decisions.md`, `docs/prompts/design-system.md`, `docs/design-tool/architecture.md`, **`docs/design-tool/studio-spec.md`** ก่อนทุก session
> ลำดับ: หลัง U-F0 (integration) และ U3.1–U3.3 (module system, solver, auto-3D) · ทำทีละ session U4.1 → U4.8
> **ทุก session เริ่มด้วย gap analysis** เทียบกับ designer v2 ที่ทำไปแล้วใน F4 (Parts A–E) — ห้ามรื้อของที่ใช้ได้ ให้ต่อยอด
> Original design only: ห้ามใช้ layout, pattern, icon, template, ข้อความ หรือ asset ใดๆ ของผลิตภัณฑ์อื่น

---

## Goal
Turn the designer into **getpack 3D Studio** as specified in `studio-spec.md`: one route (`/[locale]/studio/[designId]`) with five reversible steps, a price dock that always shows the real price, face-aware 3D editing, continuous print checks, and ordering without leaving the page. Success metrics in spec §1 are instrumented from U4.1.

## U4.1 — Studio shell, step bar, price dock, instrumentation
1. Route + layout per spec §2/§3 (desktop split view, tablet, mobile), step bar (เลือกกล่อง · ขนาดและวัสดุ · ออกแบบ · ตรวจงาน · สั่งผลิต), all steps reversible with state preserved.
2. **Price dock** bound to the quote API (debounced, cancellable, cached by spec hash); shows per-piece, quantity chip, VAT total, lead time/delivery date, reason for the last change; RFQ-only types show the RFQ CTA + SLA. Never computes money client-side (lint rule + test).
3. Studio document model in the API (autosave with ETag, version counter) — replace any remaining local storage; offline queue in IndexedDB; conflict dialog.
4. Analytics events for the funnel in spec §1 (start, box confirmed, first artwork, checks clean, add to cart, order) with session id; Web Vitals for the studio route.
5. Acceptance: e2e from style card → studio → price visible → change quantity → price updates; axe on non-canvas UI; Lighthouse app budget.

## U4.2 — ① Start and ② Box
1. Entry points (library card, product page, configurator, reorder, share link, LIFF) all land in the studio with the right step preselected.
2. "Describe your product" helper → Structure Advisor + style constraints → 3 suggestions with reasons.
3. Box step: variant picker (U3.5), measurement basis + three derived sizes, unit switch, material swatches with PBR previews, advisor card, **print method** selector that configures the editor (flexo spot mode with colour limit, digital/offset CMYK, no-print structural only), print sides and finishes with price deltas.
4. Acceptance: switching print method changes editor capabilities and price; invalid size explains why (solver reason codes).

## U4.3 — ③ Design core: split view and face-aware 3D editing
1. Split view (3D + flat) with synchronised selection; mobile 3D-first with swipe to flat.
2. Face picking in 3D: camera turns to the face, face label, edit in place; objects clipped per face; optional **wrap across fold** with warning.
3. Smart guides and snapping (face centre/edges, safe zone, objects), distance labels in mm, rulers; layers panel as an accessible tree; undo/redo ≥ 200; keyboard shortcuts overlay.
4. Outside/inside toggle with cost notice before first inside object.
5. Performance: 60 fps orbit with 150 objects on a mid-range device profile; texture atlas per face; LOD.
6. Acceptance: e2e place text on "ฝาบน" in 3D, verify it appears on the matching flat panel within 0.5 mm; perf test in CI (Playwright + CPU throttling).

## U4.4 — ③ Design content: templates, brand kit, elements, data blocks, images
1. **Templates** (our own) as constraint layouts that re-flow to any size of the chosen style; at least 5 use cases × 3 layouts at launch; author guide in `docs/design-tool/template-authoring.md`.
2. **Brand kit** (company-scoped via API): logos, palette extraction from logo (editable), font pairs (print-licensed Thai + Latin), "ใช้แบรนด์ของฉัน" one-click apply.
3. **Elements**: our own shapes/icons, packaging handling marks; certification marks only when the company has declared the right (API flag).
4. **Data blocks**: EAN-13/UPC/Code-128/QR generators with validation (check digit, quiet zone, minimum module size for the print method); ingredients/nutrition/manufacturer structured blocks with correct Thai typography.
5. **Images**: upload (multipart, resumable), crop/replace, background removal (API worker), effective-DPI badge, colour-space warning.
6. **Background**: colour, gradient, our own tileable patterns scaled in mm, full-wrap image with bleed.
7. **Finishes as layers**: foil, spot UV, emboss, window film painted as separate layers rendered with PBR in 3D and exported as separations.

## U4.5 — ④ Check: continuous checks, one-click fixes, soft proof
1. Checks engine (shared rules with the API preflight — same rule ids and thresholds from settings): every rule in spec §2 ④ with severity, message th/en, the object/face it concerns, and a safe auto-fix where listed.
2. Checks panel with counts, click-to-select, "fix" buttons, acknowledgement for warnings (stored with the design version).
3. Soft proof toggle (CMYK simulation per substrate profile supplied by the API; kraft absorption approximation).
4. Acceptance: fixture designs that trigger each rule; auto-fix leaves no violation; parity test that client and server produce the same rule ids for the same document.

## U4.6 — ⑤ Order from the studio
1. Order sheet: quantity tiers with best value, delivery dates, sample option, target price and levers, tolerances, inclusions.
2. Write **ADR-0012 "Server-side print PDF for orders"** superseding ADR-0009 (browser print PDF stays for customer downloads only). "เพิ่มลงตะกร้า" / "สั่งเลย": lock the design version via API, trigger server print-PDF + preflight + digital proof, show progress, then continue to cart/checkout without a page reload; B2B "ส่งขออนุมัติ" path with share link.
3. Proof approval for studio orders: the proof screen reuses studio rendering + checklist; approval evidence per B4.
4. After order: "แก้ไขแบบ" creates a new version; order detail links to its locked version.
5. Acceptance: e2e studio → order → checkout → proof approve → production job created; checkout total equals studio price for the same options (test).

## U4.7 — Collaboration, versions, presentation, AR
1. Share links (view/comment/edit), comments pinned to 3D positions or flat points, @mentions, resolve.
2. Version history with named versions, side-by-side/overlay diff, restore.
3. Presentation mode: turntable, open/close animation, our own scene presets, PNG/MP4 export; free dieline and mockup downloads (no plan gate).
4. AR at real size (GLB/USDZ via `model-viewer`) with fallback.

## U4.8 — Reorder, product library, design service hand-off, polish
1. Ordered designs appear as products in the account library; reorder one click; duplicate to new size with re-flow and re-check.
2. "ให้ทีมออกแบบให้" in-studio: brief pre-filled; designer works in the same document; customer comments/approves there.
3. Usability pass: 5 moderated sessions with first-time users (Thai SMEs) against the spec §1 targets; fix the top issues; record findings in `docs/design-tool/usability-2026-Q4.md`.
4. Release checklist spec §7 all ticked with evidence (links to tests/screens).

## Definition of Done (each session)
- Runs on the real API (no `CONTRACT-REQUEST` mocks left for the session's flows); contract pinned to a tagged release.
- Unit/component, e2e, perf and visual tests green; axe clean for non-canvas UI; Lighthouse studio budget met.
- No client-side money, strength or tolerance maths; checks rule ids shared with the API.
- `docs/PROGRESS.md` updated with metrics instrumentation status and deviations.
