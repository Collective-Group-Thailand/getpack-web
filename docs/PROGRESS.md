# PROGRESS — packio-web

Running log maintained by the coding agent. Newest entry on top. This log starts fresh on 2026-09-22; nothing before this date may be assumed to exist in the codebase.

| Date | Deliverable | Done | Deferred | Assumptions / questions (legacy file:line) |
|---|---|---|---|---|
| 2026-09-22 | Start | Repo contains the original BoxStudio single Next.js app (designer: RSC / tuck-end / tray dieline editor, localStorage designs, PNG/PDF/SVG export) plus the Packio prompt pack v3 (`docs/decisions.md` D-001…D-155, `docs/accounting-design.md`). Brand: **Packio — Your Packaging Production Partner** (Collective Group (Thailand)). | Everything from F0 Session 0.1 | ADR-0001…0003 are accepted decisions not yet implemented |
| 2026-09-22 | **F0 Session 0.1** — structure, tooling, dieline package, zone-ready routes, rebrand | pnpm + Node 24; strict TS, ESLint flat config, Prettier; Vitest + Playwright safety net (41 unit, 4 e2e); Next 16 + React 19.3; `@packio/dieline` extracted; target folder structure; `[locale]` customer zone + `src/proxy.ts`; rebrand to Packio with localStorage migration; CI; ADR-0004…0007 | F0 Session 0.2 (`src/ui` foundation: tokens, fonts, components, Storybook, Lighthouse CI) | See the notes under this table |
| 2026-09-23 | **F0 Session 0.2** — design-system foundation (`src/ui`) | Tokens in TS → generated CSS with a WCAG contrast gate (ADR-0003); self-hosted Noto Sans Thai / Anuphan / JetBrains Mono (ADR-0001); 30 Radix + CVA components with axe tests (ADR-0002); `pk_theme` light/dark/high-contrast; namespaced th/en messages, `formatTHB`, Buddhist-era dates, `src/domain/status` shape; Storybook 10 + docs; designer, home and My designs migrated onto `src/ui`; Lighthouse CI; React Compiler rules back to `error` | The rest of `design-system.md` §3 (DataTable, Combobox, DatePicker, PhoneInput, AddressForm, FileDropzone, Timeline, PriceSummary, ProofViewer, charts, partner shop-floor set) — built when F1–F5 first needs them | See the notes under the F0.2 heading |
| 2026-09-23 | **F1 Deliverable 1.1** — zones, proxy, root layouts, security headers | Env schema (zod, server/client split, boot-validated); `src/proxy.ts` resolving zone from `Host`, rewriting admin/partner hosts, refusing cross-zone paths, per-zone nonce CSP + security headers, session-refresh decision; three root layouts with zone providers (theme, next-intl, TanStack Query, toasts), per-zone `not-found`/`error` and `global-error`; admin/partner locale from `pk_locale`; ESLint zone boundaries with a fixture test; 31 e2e (3 hosts, cross-zone 404s, noindex, CSP) and 76 new unit tests | F1 1.2 (contract, API clients, BFF, auth) and 1.3 (shells, observability, SEO, push, analytics) | See the notes under the F1.1 heading |
| 2026-09-23 | **F1 Deliverable 1.2** — contract, API clients, BFF, auth | `pnpm gen:api` + `contract.lock.json` + vendored contract + CI drift gate; adopted packio-api **B1.3**'s auth contract, retiring the seed F1.2 started against; `serverApi`/`browserApi`/`upstreamApi` on openapi-fetch with `ApiError` from problem details, `Idempotency-Key`, `If-Match`, query keys and real TanStack retry rules; `createBffHandler(zone)` on all three zones (allow-list, CSRF, refresh-once, streaming, body cap); `refreshSession` implemented; shared session-cookie module; `getActor(zone)` + route guards; staff, partner and customer OTP sign-in with sign-out; `FormField`, `OTPInput`, `PhoneInput`; shared `auth` messages; Firebase/LINE CSP origins; MSW + `pnpm dev:mock`; 378 unit and 45 e2e | F1 1.3 (shells, per-feature i18n split, status maps, observability, SEO, push, analytics). Firebase and LINE SDK wiring — UI, endpoints and CSP are in place, the SDKs load on click in F3 | See the notes under the F1.2 heading |
| 2026-09-24 | **F1 Deliverable 1.3** — shells, i18n, domain presentation, observability, quality gates | Eleven status maps behind one `contract.ts` indirection + the `status` namespace + `nextActions` renderer; messages split per zone with `react/jsx-no-literals`, ICU gates and the packaging glossary; the three zone shells (admin sidebar from `/v1/admin/me` entitlements, ⌘K, `?`, notification centre, storefront header/footer/bottom nav, partner shop-floor frame) and four new `src/ui` primitives; Sentry on all three runtimes with trace headers through the BFF and Web Vitals RUM; robots/sitemap/canonical/hreflang/JSON-LD on the indexed zone only; SSE→cache invalidation, web push, PWA manifest; typed D-102 funnel events behind a PDPA consent gate; five Lighthouse URL sets and Storybook visual snapshots. 481 unit, 78 e2e, 4 visual | F2–F6. The storefront's initial-JS budget is breached on every route type (see below) | See the notes under the F1.3 heading |
| 2026-09-25 | **F2 Deliverable 2.1** — admin foundation | Adopted packio-api B1.3's platform contract (users, roles, approvals, audit, settings, flags, notifications, web push, realtime, files); status layer realigned to the backend's approved schema-design §4 (44 vocabularies, 7 typed on contract enums); contract requests as code (zod registry → typed calls, schema-checked mocks, an OpenAPI handoff document, a self-retiring test); mock API with the 14 D-140 personas over the backend's own seed data; `src/ui` back-office set (DataTable on TanStack Table 9, Combobox, FileDropzone, SlaTimer…); console framework (URL-driven lists, saved views, export, upload → preview → confirm import, `defineResource`, typed confirmations); dashboard, approvals inbox + detail + delegations, users & role grants with SoD/escalation checks, roles matrix, audit log, effective-dated settings editor, feature flags, notification templates & routes, outbox; ⌘K search; grouped sidebar. 555 unit, 100 e2e | 2.2–2.8 | See the notes under the F2.1 heading |
| 2026-09-25 | **F2 Deliverable 2.2** — orders & CS desk | Nine contract-request groups (orders, order notes and actions, customers, geo, CS calculators, quotations, discount memos, CS create-order) with stateful mocks; the six CS queues; the order screen (sticky header with the API's next action, ten tabs, slip review, manual start, cancel, notes with @mentions, unified timeline, order groups); the seven D-100 calculators with a factory × print × quantity comparison and the D-052 memo threshold from the API; quotations, discount memos, create-order with split delivery; `keys-used` and `server-imports` unit gates. 562 unit, 113 e2e | 2.3–2.8 | See the notes under the F2.2 heading |
| 2026-09-25 | **F2 Deliverable 2.3** — RFQ workspace | Adopted packio-api B2.1 (catalogue, CMS, geography; committed HEAD only); six contract-request groups for the RFQ desk with a stateful mock; RFQ queues with the SLA per category; the RFQ screen (request, factory costs, quote versions, thread; SLA, owner, customer and activity rail); request factory cost from capable factories (D-043); quote composer from a factory's suggested price with API-priced amounts; send, record acceptance → quotation → CS create-order; decline with an unmet-demand reason (D-102); shared `NextActionBar`; mock `catalog.read` aligned with the backend. 564 unit, 127 e2e | 2.4–2.8 | See the notes under the F2.3 heading |
| 2026-09-25 | **F2 Deliverable 2.4** — prepress & design services | Six contract-request groups (B4.1) with a mock on the commerce orders; the prepress desk by stage with SLA; the per-order workspace: preflight report by severity with accept/send back (D-070), proof versions with upload & send and decision evidence, annotation page map with reply/resolve, template sending and dieline drawing (501 engine-unavailable handled), hired-design rounds with free-round meter and next-round fee (D-071), mockup job (D-072); read-only `DesignViewer` in the shared designer + "working copy"; shared `AssignDialog`; submission & drawing status maps. 568 unit, 138 e2e | 2.5–2.8 | See the notes under the F2.4 heading |
| 2026-09-26 | **F2 Deliverable 2.5** — catalogue & CMS | On the **published** B2.1 contract (no contract requests): a stateful table mock (ETag/If-Match, archive by status) seeded from the contract's own list examples, now emitted by `gen:api`; a typed table registry of ~40 catalogue, CMS and geography tables driving one CRUD screen; product types with the reasoned quote-mode action (D-100); Excel import with preview → confirm by hash (D-005, D-170); home-section ordering; articles with a TipTap `RichTextEditor` in `src/ui`; catalogue/CMS maps by section; `catalog.import`, `seo.manage`, `geography.manage` from `docs/rbac.md`. 576 unit, 154 e2e | 2.6–2.8 | See the notes under the F2.5 heading |
| 2026-09-26 | **F2 Deliverable 2.6** — partners & price governance, production floor | On the **published** B2.2 contract (adopted in 1aaa711 and 2880e4e) plus contract requests for the production board, inspections and scorecards: the factory pipeline and a seven-tab workspace (onboarding, profile, KYC, bank accounts behind D-033, capabilities/capacity/zones, versioned terms with D-173 approvals, site visits and D-041 activation, prices); proposal review with suggestions, line decisions and the 90-day simulation; Packio rate cards drafted line by line; coverage (D-043); index months; production board with at-risk, QC recording (D-076), scorecards; `SectionNav`; price-component names. 581 unit, 169 e2e | 2.7–2.8 | See the notes under the F2.6 heading |
| 2026-09-26 | **F2 Deliverable 2.7** — marketing, B2B, customers | Eight contract-request groups for B3.3–B3.5 (campaigns, promotions, coupons, referrals, customer points and consents, companies, company credit) with stateful mocks; campaigns with the budget meter against the alert threshold (D-154); the promotion editor with typed D-053 conditions and benefit and its coupon codes; promotion priority; the referral review queue decided in approvals (D-136); loyalty and referral rules as setting versions; customers (profile, orders, points ledger, referrals, consents); companies (KYC review D-120, members, branches, credit via the `credit_limit` policy D-121, overdue block D-122, statements D-125, orders). Validation codes now read as words in every form; the approvals mock routes by step condition and notifies the subject. 584 unit, 184 e2e | 2.8 | See the notes under the F2.7 heading |
| 2026-09-26 | **F2 Deliverable 2.8** — logistics, claims, analytics, hardening | Five contract-request groups (B4.3, B4.5, B6.1, B6.2) with stateful mocks: shipments (queues, split, fallback carrier quotes and booking, exceptions, labels, POD review with the tolerance result), claims (evidence, liability by rule with a permissioned override, idempotent resolutions), the demand dashboard on a new accessible `Chart` (Recharts, data-table fallback, loaded on demand) with suppressed small groups and the anonymised prospectus, and typed operational reports with the API's totals. Hardening: every role's menu opens cleanly (14 roles), axe on the new screens, chart visual baselines, and zod out of the browser — admin shell 490 → 363 KB, lists 501 → 390 KB — with the admin Lighthouse set split and re-ratcheted. 595 unit, 211 e2e, 8 visual | F3 onwards | See the notes under the F2.8 heading |
| 2026-09-26 | **F3 Phase 3.1** — IA, content, auth, search | Seven storefront contract requests (price hints, product FAQs, public categories, profile, order by code; category filter and FAQ search hits as docs-only) with a storefront mock that reads the back office's own catalogue/CMS rows and two customer personas; every F3 route answers (later phases as `noindex` placeholders); a cached public catalogue read (Next data cache, no token, no per-request header); home from the API's sections and banners; `/products`, `/products/[key]` (category, product or stock product), articles, `/faq`; Product/BreadcrumbList/FAQPage JSON-LD; global search (GET page + instant dialog); Google/Apple/LINE sign-in with SDKs on click, PDPA consent after sign-in, progressive profiling; `/account` guarded; four `src/ui` components; storefront JS 341 → 256 KB. 639 unit (+31), 236 e2e (+25) | ISR/CDN for storefront HTML; the consent preferences centre (3.4); legal page content; LINE `link_phone`; cookie-banner choice synced to the account; the last 106 KB to the 150 KB budget | Caching at the data level because the CSP nonce makes every page dynamic; `/products/[key]` resolves category → product → stock; FAQ search client-side until `store.search-faq-hits`; consent asked after the session exists (texts need a customer token); `pnpm dev:mock` does not intercept server fetches (found, pre-existing, open) |
| 2026-09-27 | **F3 Phase 3.2** — configurator, 3D/2D preview, instant quote, RFQ | Adopted packio-api's committed B2.3/B2.4 contract (`store.quotes.calculate` for folding); nine store contract-request groups with mocks (configurator, the six other calculators' configuration, saved quotes with share/PDF, promo check, support channels, RFQ forms, RFQs, cart) whose RFQs are the RFQ desk's own rows; `/configure/[slug]` for the seven instant types — adaptive stepper, pattern size rules explained as typed, display-only units, choices with swatches and explainers, quantity tiers, postcode, design option, D-072 mockup, promo code — beside a live CSS 3D box / 2D mockup and the quote dock (debounced, cancelled, price breaks, tolerance, validity, route to RFQ with the API's reason; add to cart / save / share / PDF behind a sign-in gate, design now, ask CS on LINE); `/rfq/[category]`, `/account/rfqs` and the status page with messages and a confirmed acceptance into the cart; six `src/ui` components. 660 unit (+21), 247 e2e (+11) | Cart page, checkout (3.3); `/account/quotes` (3.4, the save toast links to it); estimated receive date in the dock (not on committed HEAD); the other six calculators' own DTOs | Live price from the published endpoint, quotation kept only on an action; one cast for the non-folding bodies and the duplicate `AssemblyDto`; saving/sharing needs sign-in; mockup and promo applied on the quotation, not in the live price |
| 2026-09-27 | **F3 Phase 3.3** — cart, checkout, instalments, payments, promotions, points | Four contract-request groups with mocks (address book, checkout preview/placement, payments, instalments) whose orders are the back office's own rows; `/cart` with per-line design option, split delivery across addresses (D-110) and confirmed re-pricing (D-051); `/checkout` on one page — contact, delivery, tax invoice (checksum-checked profiles, withholding), codes with automatic and capped promotions (D-053), points within the API's limits (D-133), the API's schedules (D-020), method — priced by the API's preview and re-priced on placement with old/new totals confirmed; `/checkout/pay/[paymentId]` (QR with countdown and live status, 2C2P redirect and `/checkout/return`, bank transfer with the slip, D-061) and `/account/instalments`; shared address and tax-profile forms. 668 unit (+8), 252 e2e (+5) | Account orders, documents (3.4) — the success page links to `/account/orders`; B2B credit-term checkout and PO numbers (3.7); realtime payment updates (polling covers it until the channel exists) | The schedule belongs to the order group, each order carrying its share; sign-in required for a cart; a slip that fails the automatic check joins the CS slip queue and Finance's decision flows back; the mock settles QR payments through a mock-only webhook endpoint and 2C2P through a mock gateway page |
| 2026-09-27 | **F3 Phase 3.4** — account | Five contract-request groups with mocks (orders, loyalty, wallet, privacy requests, identities) over the back office's own order rows, plus the published notification preferences and consents; an account frame; overview with to-dos from the API's `nextActions`; orders by view; the order page (timeline with promised vs actual and photos, this order's share of each group instalment and paying it, documents as signed downloads, deliveries with POD, tolerance outcome, claims, public tracking link, lines); saved quotations reopened in the configurator; address book and tax profiles; notification matrix (order e-mail locked, D-144) and linked accounts (LINE linking via signed-in LINE sign-in, D-151); consents with texts and PDPA export/deletion requests; points with tier progress and history, referral with masked friends, promo wallet and store credit. 674 unit (+6), 261 e2e (+9) | Artwork, proofs (3.5); confirm receipt, claims, reorder (3.6) — their routes are placeholders; the linked-LINE flow needs a LIFF id to exercise | Seeded orders get a group payment schedule on first use so any due instalment can be paid; the account layout shows its sections only with a session, pages guard themselves (`/account/designs` stays a guest's) |
| 2026-09-27 | **F4 Part A** — `@packio/dieline` engine v2 | Geometry model with line/arc/Bézier edges carrying roles (cut, crease, perforation, half-cut, glue area, bleed), non-convex faces with holes, multi-piece dielines; `BoxStyleDef` registry with aliases (`rte`), parameter schemas, bilingual `validate()`, caliper compensation from `MaterialSpec` (catalogue allowances win); tube and tray constructions; tuck end, reverse tuck end, RSC, four-corner tray with window, thumb notch, rounded tucks, glue side, grain arrow; Clipper2 offsetting isolated from the registry; `checkDieline`; 3D fold transforms; SVG (true arcs), R12 DXF, vector PDF with spot-colour layers; BoxStudio spec migration with artwork remapped face by face; app moved onto it; major changeset and release workflow; ADR-0008. 700 app unit, 275 engine, 69 box-related e2e | Parts B–E (style library, API integration, editor v2, quality gates) | Compensation constants marked ⚠ in `constants.ts` need prepress confirmation |
| 2026-09-27 | **F4 Part B** — style library mapped to the legacy pattern catalogue | 30 styles in the registry: tuck end, reverse tuck end, snap-lock and crash-lock bottoms, seal end, hang tab (euro slot/round hole), sleeve, sleeve + drawer (two pieces), gable with handle, hexagonal; RSC, HSC, FOL, CSSC (hand holes), roll-end mailer, wrap-around; four-corner, six-corner and double-wall trays, two-piece telescope (full/partial); pillow (true arcs); rectangle, rounded rectangle, circle, oval, custom SVG path, hang tag, cup sleeve (unrolled frustum), band, pouch templates (3-side, 4-side, centre seal, gusset, stand-up). Catalogue aliases incl. every legacy drawing-service name. `docs/design-tool/style-mapping.md` (every legacy pattern → style, the meaning of `b`, `s`, `cs`, `dl`, `dw` and the rest, constraints, patterns not drawn, assumptions) with thumbnails from `pnpm style:thumbnails`. The setup dialog picks by category with dieline previews, sizes and options from each style's schema. 700 app unit, 1,411 engine, 44 designer-related e2e | Parts C–E | The legacy repo has no pattern rows with limits and no drawing files; every construction read from a formula alone is marked ⚠ in the mapping |
| 2026-09-27 | **F4 Part C** — designer on the Packio API | Contract requests `store.designs` (CRUD, autosave under `If-Match`, versions + restore, duplicate, one-time import), `store.design-assets`, `store.designer-catalog` (patterns with dieline keys and limits, materials with caliper and flute allowances, templates, colours, fonts, artwork rules) and `GET`/`PUT` on `admin.design-documents`, with stateful mocks; persistence layer (guest in the browser, account designs autosaved with a conflict choice, IndexedDB drafts, version history, image assets); materials and pattern limits from the catalogue (placeholder boards deleted); entry points from the configurator, the order's artwork page (design linked to the order) and prepress (read-only or an editable copy, same editor); live price from the published calculation; send to print with a client-side print PDF (ADR-0009) submitted as the order's artwork; configurator seeded from a design. 707 app unit, 1,411 engine, designer e2e + 5 new account flows | Parts D–E | Templates are listed but applying one to an open design is Part D's panel; `design_asset` is requested as a file purpose (artwork until then) |
| 2026-09-27 | **F4 Part D** — editor v2 | Left rail (box & faces, templates applied to the open design, shapes library, QR/EAN-13 with quiet zones, text styles, uploads, brand kit, background, layers); right panel (properties incl. crop/replace, clip to face, lock, name, CMYK warning; arrange: align/distribute/group/lock; live print checks; WebGL 3D preview folded by the engine with fold slider/play, lighting presets, PNG — ADR-0010); multi-select (Shift, marquee), groups, locks, copy/paste, snapping with guides, rulers, grid, face focus turned upright with Escape back; status bar with face under pointer and issue count; `?` shortcuts overlay; phone bottom bar with inline panels; view-only share links (`store.design-share`) and the public `/design/shared/[token]` page; the read-only viewer draws every new element type. Captures (thumbnail, PNG, print PDF) lay a focused sheet flat first. 723 app unit, 1,411 engine, 287 e2e (4 new editor flows, the share flow, axe over every panel); designer route 456 KB initial JS (ratchet lowered from 540 to 460 KB), Lighthouse accessibility 100 | Part E; comments on shared designs | Upright rule for lids (reads from the front) and the CMYK warning heuristic need prepress confirmation; brand kit kept in the browser until an account endpoint exists |
| 2026-09-27 | **F4 Part E** — quality gates, docs, final summary | `patternFixtures()` + 92 per-legacy-pattern SVG snapshots (`fixtures/patterns`) for packio-api's golden comparison, beside the style × preset × material matrix and SVG/DXF fixtures; designer panel stories and 9 visual baselines of editor states; panel component tests (store, words, axe); e2e product page → designer → live price following quantity and artwork (with Part C's order → send to print → preflight); face names that tell repeated faces apart; product page and configurator open the designer with their product; `docs/design-tool/` architecture, style authoring guide (worked example verified against the engine), print-PDF spec for factories, index. 737 app unit, 1,504 engine, 288 e2e, 17 visual; designer route 456 KB, Lighthouse a11y 100 | — | See "Assumptions needing prepress confirmation" below |
| 2026-09-27 | **F5 Session 5.1** — partner onboarding & price tables | On the **published** B2.2 partner surface plus four contract requests (`partner.references`, `partner.change-requests`, `partner.site-visits`, `partner.proposal-evidence`) and one contract defect logged; a stateful partner mock over the back office's own factory rows with one persona per factory role (rbac.md) plus an applicant and an assisted owner, other factories' ids → 404 (D-044), idempotent replays; factory context (`/me` + `pk_factory`), status- and role-aware nav (phone bar, tablet side list), factory name in the shell; Today with what waits for the factory; the 13-step onboarding tracker and one screen per step (company, addresses, contacts, submit under `If-Match`; KYC upload; bank-account change with typed confirmation; capability, capacity, zones, tier, tolerance, payout policy read-only with a change request; agreement e-acceptance; site-visit dates) with **review & sign off** of staff-entered steps; price tables by mode and tier: price list read one component at a time, draft proposals line by line or from an Excel/CSV sheet (parsed in the browser, no dependency) with a future effective date, reason and evidence, submit/withdraw, counter answers, rate-card acceptance whole or per line with counters, assisted-entry sign-off, shipping payout card. 761 unit (+24), 6 new e2e on a phone | 5.2 jobs/QC/ship, 5.3 billing/payouts/settings; a back-office queue for change requests | See the notes under the F5 5.1 heading |
| 2026-09-27 | **F5 Session 5.2** — jobs, milestones, QC, ship & POD | Seven contract requests (`partner.today`, `partner.jobs`, `partner.job-milestones`, `partner.job-qc`, `partner.job-issues`, `partner.capacity-calendar`, `partner.shipments`) and proposed factory-floor permission keys, mocked over the commerce mock's own jobs and the logistics desk's own shipment rows; the shop-floor set in `src/ui` (BigActionButton, StageStepper, CameraCapture with in-browser compression and the EXIF shutter time, ScanButton, SignaturePad with a typed-name alternative, QRCode, LabelSheet); Today with counters, alerts and the queue; jobs by the floor's tabs with search and scan; the job screen (accept/reject within the window with the PO restated, milestones with quantities and photos, QC before the QC step, approved artwork only with its watermark, PO, recipients by D-142, inspection notices, issues, history); ship (per-destination split, carton labels with a tracking QR, own-fleet dispatch or a carrier request, POD with photos, receiver, signature and delivered quantity, the tolerance result); capacity calendar; every report with `clientRef`, `clientReportedAt` and an `Idempotency-Key`, a 409 showing the server's state. 783 unit (+22), 4 new e2e; partner login 326 → 251 KB | 5.3 billing, payouts, claims, performance, settings | See the notes under the F5 5.2 heading |
| 2026-09-27 | **F5 Session 5.3** — billing, payouts, performance, settings | Six contract requests (`partner.billing-statements`, `partner.payouts`, `partner.claims`, `partner.scorecard`, `partner.users`, `partner.notification-preferences`) mocked over the factory's own jobs, the logistics desk's delivered shipments and claims, and its payout-policy version; billing statements with production (min(delivered, shipped)), shipping, deductions and the advance already paid, confirm with the BS number typed, dispute, and the factory's own tax invoice (PDF or e-Tax) with the input-VAT status; the payout schedule per job (30 % on acceptance, balance after POD + 7-day window, 5 % retention released 30 days later), payouts with remittance advice and 50 ทวิ, the statement of account; claims answered back to the claims desk; the monthly scorecard; users and roles (Owner), notification channels with device push, label size, language, high contrast; the manifest no longer locks tablets to portrait. 796 unit (+13), 4 new e2e; partner JS 251–292 KB | Partner offline sync (R2, D-111); the 180 KB budget | See the notes under the F5 5.3 heading |
| 2026-09-28 | **F6 Deliverable 6.1** — finance queues & customer documents | Adopted packio-api's B2–B6 contract (745 paths; 86 now-published requests kept on a shrink-only list); the finance workspace (`/finance`, grouped desk nav); home queues with SLA from `admin.dashboard` (`finance.*`); slip review (D-061) with the slip image, bank reference and duplicate check; payments and refunds (maker-checker, D-169); customer document registers with gapless series, void (IV/DN), PDF, resend, debit note; credit-note wizard through the Finance Manager's approval; AR open items, aging, allowance (P30), write-off requests, customer 50 ทวิ with upload, B2B statements, dunning log, per-customer balance; journal list and detail (the drill-down's ledger step); finance mocks over one balanced journal | 6.2–6.4 | Five contract requests (slip image, document resend + deliveries, dunning log, credit-note reasons, document payment filter); the contract is packio-api main @ `945f02e`, still labelled `0.1.0` |
| 2026-09-28 | **F6 Deliverable 6.2** — payables, payouts, banking | On the published B5.3 surface: AP open items with their payable dates, factory POs, GRs from POD (D-165), billing statements with tax-invoice capture, tax-invoice validation against the vendor record (P17V), the vendor master with bills (P25/P26) and bank-account changes under dual approval + call-back; payout runs from eligible payables → propose → C-Level approval (proposer ≠ approver) → bank file → confirmation import (P14/P16/P17/P18), PV numbers, 50 ทวิ, exceptions; banking: cash position, statement import with auto-match (P05/P04), the matching workbench with suggestions and split, unidentified receipts (P29) to identification, settlements, company accounts under dual approval | 6.3–6.4 | Four contract requests (payout item documents, bank-line suggestions, split, settlement list); the partner zone's statements and tax invoices are the same rows Finance validates |
| 2026-09-29 | **F6 Deliverable 6.3** — ledger, tax, fixed assets | On the published B5.1 / B5.4 / B5.5 surface: the chart of accounts with changes under `coa_change`, cost centres and the dimension catalogue; journals with the manual-journal editor (draft under If-Match → submit → Finance Manager other than the maker approves → posted with a JV number), reversals through the same approval, auto-reversing and recurring journals (`recurring_journal`); posting rules with versions, the template in force, a dry-run preview and version proposals; fiscal periods open ⇄ soft-closed → closed → locked in order; tax: the seven monthly papers built from the books with their GL reconciliation, finalise at 0 (ภ.พ.30 posts P27), attachment export, filing, payment (P27P / P28), calendar, rates as approved versions, nature of sale and the tax settings read from Settings, document series, e-Tax off until R2; fixed assets: categories (If-Match), register (FA01), monthly depreciation preview → post (FA02), disposal / write-off (FA03), roll-forward with the register reconciled to the GL | 6.4 | One contract request (`admin.depreciation-preview`); the close checklist gates close / lock in 6.4 |
| 2026-09-29 | **F6 Deliverable 6.4** — period close, reports, auditor | On the published B5.6 surface: the close index and each month's checklist (nine §7 steps with owners, automatic blocking checks, evidence, waivers by a Finance Manager, submit → review by a Finance Manager other than the submitter → closed → locked, the auditor's year-end sign-off), gating the ledger's close and lock; trial balance with CSV export, GL detail with drill-down and paging, balance sheet, profit and loss pivoted by factory / product type / channel / campaign / cost centre, indirect cash flow, points-liability and retention roll-forwards, sub-ledger ↔ GL reconciliation; the auditor's desk (access window from the role grant, registers, audit trail), exception reports, reproducible samples, hashed PBC pack. Month simulation e2e: trial balance, statements, sub-ledgers and the seven tax papers at zero; last month closed and locked through the checklist, then refused by the posting UI | — | Two contract requests (`admin.account-roll-forward`, `admin.subledger-reconciliation`); a 6.2 mock bug fixed (payout item ids could collide) |
| 2026-09-29 | **U-F2** — art direction tokens (D-180) | D-180 palette in light/dark/high contrast (129 gated pairs pass); `accent` tone for promotions, `kraft` decorative slots; 12/16 px radii with pill CTA on the storefront only (`data-zone`); two elevation levels; 150/200/250 ms ease-out; `text-display` h1; `SectionDivider`; token-usage lint; Storybook art-direction docs; 33 visual baselines across all zones | Linux CI visual baselines (one-time `e2e:visual:update` on the runner); placing dividers and the hero is U-F3 | Dark primary-700 adjusted (below); secondary CTA stays 12 px — see §U-F2 |
| 2026-09-29 | **U5.0** — UX baseline and instrumentation | Moderator guide, PDPA consent (th/en), Thai task cards, step-counting rule, results template; step counters for T1–T12 (`e2e/journeys/`, budgets checked against the scorecard, non-blocking `step-counters` CI job); journey funnel events (studio, claims, reorder) and an admin Journeys dashboard with the API's drop alert; consent-gated Sentry Replay, off by default; step baseline: **8 of 12 journeys over budget** | Running the competitor baseline round (people, not code); turning replay on; T6 walk (U2.3) | Replay gated on analytics consent (not a new purpose); seeded paid orders now carry a TR — see §U5.0 |
| 2026-09-29 | **U-F0.1** — adopt & reconcile the tagged contract | Lock pinned to packio-api **`v0.2.0`** (tag, commit, release asset, sha256); `gen:api --adopt --tag` reads only tagged releases; `pnpm gen:triage` imports packio-api's triage — all 135 open rows carry its verdict (62 published differently, 52 open in U-B0.N, 19 mixed, 2 awaiting triage) and `contract-requests.openapi.json` carries only the 89 operations still to build; BFF and server calls forward the visitor's IP (`TRUSTED_PROXY_HOPS`); admin menu `ops` + signals screen; generated error-path mocks for 265 codes and the `?mock=<operationId>:<code>` switcher (dev + Storybook story); th/en title for every problem code with a per-zone cut and the unmapped-code gate | Migrating call sites (U-F0.2–0.4); `CONTRACT-DEFECT` narrowings (packio-api U-B0.3); `e2e:integration` (U-F0.5) | `scheduleKey` stays requested (user); problem titles are packio-api's wording, for content review — see §U-F0.1 |

---

## U-F0.1 — Adopt & reconcile the tagged contract — 2026-09-29

`docs/prompts/U1-update-2026-09-29.md` §U-F0.1, on `feat/u-f0.1-adopt-reconcile` (worktree `../packio-web-u1`, from `main` at `81cce53`). Gap table: `docs/update-2026-09-29-gap.md` §U-F0.1. Screens keep their behaviour; one new admin screen; no call site was migrated (that is U-F0.2–0.4).

### Done
- **Tagged contract.** `pnpm gen:api --adopt --tag vX.Y.Z` reads the document *at the tag* (`git show <tag>:./openapi.json` in the sibling checkout, or a downloaded release asset through `API_CONTRACT_SOURCE`) and refuses a missing tag or a document whose `info.version` is not the tag's. `contract.lock.json` now pins `v0.2.0` — `tag`, `commit` `6b12ccd`, `source` = the release-asset URL, sha256 `90cb8752…` (equal to the one in the tag's message). `--check` also fails on a lock without a tag, a `source` that does not name it, or a vendored version that differs. The vendored document differed from `v0.2.0` only in `info.version`, so adopting changed no type. packio-api's working tree is ahead of the tag (U-B6 corrugate, +331 contract lines) and is deliberately **not** adopted. ADR-0006 amended.
- **Triage imported.** `pnpm gen:triage` parses packio-api's `docs/contract-requests-triage.md` (per-operation verdict, operationId, group, additive-gap count) into `src/lib/api/requests/triage.ts` and writes the verdict at the start of every open Status cell in `docs/contract-requests.md`, keeping our note after ` · web:`; re-run it whenever packio-api ships a group. 293 of the registry's 294 operations have a verdict (88 implement, 204 published differently, 1 published); the journeys read is in `awaiting-triage.ts`. `contract-requests.openapi.json` holds only what packio-api still has to build: **89 operations, 62 ids** (was 294 / 116). New gates in `registry.test.ts`: every request has a verdict or is awaiting triage; every published verdict names an operationId the pinned contract has at that method and path; every markdown status agrees with the triage; the requests document is exactly the open set.
- **Visitor IP** (packio-api B6.3, `SECURITY.md` §7 #1). `src/lib/security/client-ip.ts` takes the entry `TRUSTED_PROXY_HOPS` places from the right of the incoming `X-Forwarded-For` — the address our outermost load balancer saw — and sends **only that one address** on. The browser's chain is never forwarded, since anyone can write it. It is applied to the BFF, `serverApi`, the auth Server Actions and token refresh (proxy and BFF). Default `0` sends nothing. The cached public catalogue read sends none, so it stays one cache entry.
- **Admin `ops`.** Menu icon, `system` group, th/en label; `/ops` renders `admin.ops.signals` (value, threshold, `OpsSignalStatus` badge from `src/domain/status`); the admin mock persona holds `ops.read`, as in packio-api's roles catalogue.
- **Error-path mocks.** `gen:api` writes `mocks/generated/problems.ts`: every operation's documented codes with their status (931 operations) and one contract example body per code (265). `?mock=<operationId>:<code>` (comma-separated; `?mock=off` ends it; remembered in a cookie) makes the mock answer that operation with that problem. The proxy stamps the scenario on the request and the BFF, `serverApi` and the auth actions pass it on. Every step requires `API_MOCKS=1`, and off the mock the proxy strips the header. An unknown code answers `500 mock.scenario_unknown`, listing the codes the operation documents. Storybook: **Patterns/API problems**, args-driven (`scenario`, `locale`), renders `QueryError` with the same catalogue.
- **Problem copy.** `common/problems.json` (th, en): a title for each of the 265 contract codes, seeded from packio-api's own `src/i18n/{th,en}/errors.json`, plus the BFF's 7 codes. The API's localised `detail` stays beneath the title because it carries the values (93 details have placeholders). Each zone loads only its surface's codes plus auth and the BFF's (customer ≈ 2.7 KB gzipped instead of 5.4 KB). `problemCopy()` / `useProblemCopy()` map an `ApiError`, and `QueryError` uses them. **Gate** `src/i18n/problems.test.ts`: scans every typed contract call (`.GET("/v1/…")` …) and fails on a documented code without th and en copy, one the zone's cut drops, or copy for a code the contract no longer has (checked: removing `auth.otp_invalid` names both call sites).

### Decisions taken, with reasons
- **`store.checkout` `scheduleKey` stays requested** (user, 2026-09-29), although packio-api proposes not adding it (rules pick the schedule, D-020). The picker stays mock-backed; packio-api's "needs the user's OK" is answered **no** for now.
- **Release-asset URL by convention.** packio-api has no git remote in this environment, so the URL `…/releases/download/v0.2.0/openapi.json` is where the asset will be, following the lock's existing form; adopt read the tag from the sibling checkout. Once the remote exists, CI can download it and check the sha256.
- **The web copy is a title per code, not a full sentence.** `ProblemDetails` carries no params, so a param-free sentence would lose what the API's detail says (attempts left, blocking status). The seeded titles are packio-api's wording, and some are developer-flavoured (`ต้องระบุ If-Match`). They are ours to edit now and belong to the U5.6 content pass. One title had a placeholder (`reports.schedule_state`) and was rewritten without it.
- **Only typed contract calls are gated.** Calls still going through request definitions (`awaiting-migration.ts`) have no documented codes yet. They join the gate automatically as U-F0.2–0.4 migrate them.
- **The switcher also rides Server Actions**, not only the BFF and `serverApi`, so sign-in errors (e.g. `auth.customer.verifyOtp:auth.otp_invalid`) can be looked at too.

### For packio-api
- Triage the two rows written after `9cbd99a`: `analytics.journey-events`, `admin.analytics-journeys` (U5.0).
- Set `TRUST_PROXY` = 1 + the proxies between packio-web and the API, and set packio-web's `TRUSTED_PROXY_HOPS` to the load balancers in front of it. Then verify in the k6 run (`docs/launch/PERFORMANCE.md`).
- Publish the `v0.2.0` release asset once the remote exists.
- Open questions 1–6 of the triage stand (partner issue resolve, POD review, tracking province, profile e-mail, sample-kit / guided-help / PDPA business values, claim resolution visibility). None blocks the frontend.

### Verification
- `pnpm lint` · `pnpm typecheck` · `pnpm test` (941 app, 1,504 dieline) · `pnpm gen:api:check` (contract 0.2.0) · `pnpm format:check` · `pnpm build` · `pnpm build-storybook`.
- `pnpm e2e` (mocks): **349 passed**, one run. The new cases: the `ops` menu entry and screen for an admin, none for CS; `/ops` axe-clean; `?mock=admin.ops.signals:auth.forbidden` shows the error state, persists to the next page and ends on `?mock=off`.
- `pnpm e2e:journeys`: 11 walks pass, T6 skipped as pending; every count equals the U5.0 baseline.
- Unit gates proven to bite: removing `auth.otp_invalid`'s th copy fails `problems.test.ts`, naming both call sites; `gen:api --check` refuses the old untagged lock; `--adopt` refuses no tag and an unknown tag.
- `pnpm lhci`: the same three script-size ratchets fail as on `main`, and nothing else. U-F0.1 adds 77 B to customer pages and 258 B to partner `/settings` (the `QueryError` copy hook):

  | URL | budget | U5.0 | U-F0.1 |
  |---|---|---|---|
  | `/account/designs` | 293,000 | 304,596 | 304,673 |
  | `/configure/tuck-end-box` | 293,000 | 319,549 | 319,626 |
  | partner `/settings` | 300,000 | 300,998 | 301,256 |
- Not run: `e2e:integration` (U-F0.5); the visitor IP behind a real load balancer (unit-tested with a spoofed chain; to verify in packio-api's k6 run).

---

## U5.0 — UX baseline and instrumentation — 2026-09-29

`docs/prompts/U5-ux-excellence.md` §U5.0, on `feat/u5.0-baseline` (worktree `../packio-web-u1`, from `main` at `d9931b6`, after U-F2 was merged). Gap table: `docs/ux/u5.0-gap.md`. No UI change for customers; one new admin section. No backend involved.

### Done
- **Study materials** (`docs/ux/`): `moderator-guide.md` (roles, screener, the rules that are never bent on the competitor, the Thai session script, block-randomised task order, what to record, SEQ and our own Thai rendering of SUS), `consent-pdpa.md` (th/en, separate consents for recording, camera, assistive technology and clips; **draft for legal review**, placeholders for the registered name, DPO, retention), `task-cards.md` (participant cards in Thai, the moderator sheet with start state, stop point and "done when" per side, English reference), `step-counting.md` (one rule for moderators and the counters), `scorecard-results/` (README and a template carrying the §3 gates).
- **Step counters** (`e2e/journeys/`): a `journey` fixture that counts screens, decisions and taps by `step-counting.md`, fails a walk on a navigation nobody declared, reports required fields not on the journey's allow-list, and asserts the funnel events the journey should send (captured in the page, since `sendBeacon` bodies are invisible to Playwright). Budgets live in `budgets.ts` and a Vitest test fails when they drift from `competitive-scorecard.md` §2. The reporter writes `test-results/journeys/step-counts.{json,md}` and the CI job summary. `pnpm e2e:journeys`; CI job `step-counters` is `continue-on-error` until U5.8, which sets `STEP_BUDGETS=enforce` (checked: T9 then fails "over its budget of 5").
- **Funnel events**: `design_started` / `design_saved` (declared since F3, never sent) are sent now, plus `design_ordered`, `claim_started`, `claim_submitted`, `reorder_started`, `reorder_added_to_cart`. `docs/ux/funnels.md` defines the five funnels. The designer's persistence gained an optional `onSaved`; only the storefront's wrapper uses it.
- **Journeys dashboard** (admin analytics): sessions per step, conversion from the step before, change against last week, status badge (icon + words) and callout where the **API** flags a drop; the threshold is shown as the API returns it. Mocked with a claims drop.
- **Session replay**: Sentry Replay, loaded only when `NEXT_PUBLIC_REPLAY_ENABLED=1`, a browser DSN, analytics consent, a key-journey route pattern and the sample (`NEXT_PUBLIC_REPLAY_SAMPLE_RATE`, default 0.1) all hold; all text, inputs and media masked, no bodies. With the flag off the replay code is not in any bundle. The consent banner mentions replay only in a build that has it on.
- **Output**: `docs/ux/step-baseline-2026-09-29.md` — the U5.1 input.

### Step counts before U5 (shortest path today, mocks)
| Task | Count | Budget | | Task | Count | Budget |
|---|---|---|---|---|---|---|
| T1 | 7 | ≤ 4 | | T7 | 2 (from LIFF home) | ≤ 2 |
| T2 | 8 | ≤ 6 | | T8 | 3 | ≤ 3 |
| T3 | 2 unexplained | 0 | | T9 | 7 | ≤ 5 |
| T4 | 6 | ≤ 5 | | T10 | 4 | ≤ 2 |
| T5 | 3 (mockup add-on, not a sample) | ≤ 4 | | T11 | 7 taps | ≤ 4 |
| T6 | pending (U2.3) | lever | | T12 | 5 | ≤ 3 |
Over budget: T1, T2, T3, T4, T9, T10, T11, T12. The walks and what owns each fix are in the baseline doc.

### Decisions taken, with reasons
- **Replay is gated on the existing analytics consent** (confirmed with the user), not a new purpose. The cookie-policy page is still a "coming soon" stub, so the disclosure is in the banner instead, and only when replay is on. **Before the flag is turned on**: counsel confirms, the U2.0 intake answers vendor data terms (Sentry stores recordings outside Thailand — PDPA s. 28), the cookie policy is written, and a **new consent version** re-asks everyone who consented before replay existed.
- **Funnel events stay first-party and not consent-gated**, as `consent.ts` already reasons (legitimate interest; counsel to confirm, as noted in F1). They carry dimensions only: route pattern, quantity band, claim type.
- **`track()` is not moved onto the published batch contract** — that is U-F0.2 (confirmed with the user). The mapping of our names onto the published `AnalyticsEventName` is in the `analytics.events` row.
- **Seeded paid orders carry a tax invoice/receipt (TR)**, not a bare receipt (`mocks/admin/commerce.ts`): accounting-design P01 issues a TR on a paid instalment, and T10 needs one to be walkable. No test depended on the old type.
- **A walk counts a tool that is already open as free**, and an accepted default as free (step-counting rule 4) — the counts are the shortest honest path, not the worst case.
- **Required-field allow-lists are today's fields** (`budgets.ts`): a field added from now on is reported; the checkout's contact fields are pre-filled from the account.
- **`e2e:journeys` runs on two workers**: twelve parallel walks plus a production server on a laptop made the sign-in helper miss its 5 s redirect window; CI uses one worker anyway.
- **The SUS text is our own Thai rendering** (Brooke 1986, free to use). If the business prefers a published validated Thai SUS, swap it before the baseline round — scores compare only across rounds that used the same text.

### Contract requests
`analytics.journey-events` (add the journey names to `AnalyticsEventName`), `admin.analytics-journeys` (the journeys funnel with the weekly alert against setting `analytics.funnel_drop_alert_pct`, proposed 15), and `analytics.events` narrowed with the mapping onto the published batch.

### Parity-matrix follow-ups
#17 affiliate payouts: referral rewards are **points** (D-136), no cash payouts — covered as Adapt. #39 fast-ship promise: stock pages show stock and MOQ but **no dispatch or delivery estimate** — a gap for U-F3 (lead time on every card) and U5.1, needing the lead time from the API.

### Verification
- `pnpm lint` · `pnpm typecheck` · `pnpm test` (907 app, 1,504 dieline) · `pnpm gen:api:check` · `pnpm format:check` · `pnpm build`.
- `pnpm e2e` (mocks): **346 passed**, one run, including the new Journeys dashboard case (axe clean).
- `pnpm e2e:journeys`: 11 walks pass and T6 is skipped as pending, on fresh servers (T4 once counted 7: the walk checked the selected quantity before the price breaks loaded — fixed, one run since); every expected funnel event seen; no unlisted required field. `STEP_BUDGETS=enforce` fails the over-budget walks, as U5.8 needs.
- `pnpm lhci`: the same three script-size ratchets fail as on `main` (U-F2's figures) and nothing else. U5.0 adds 388 B of uncompressed script on customer pages — the new event names and calls and the replay component's dynamic stub; **no replay code ships** with the flag off (the gate is a `next/dynamic` import behind a build-time `false`):

  | URL | budget | `main` | U5.0 |
  |---|---|---|---|
  | `/account/designs` | 293,000 | 304,208 | 304,596 |
  | `/configure/tuck-end-box` | 293,000 | 319,161 | 319,549 |
  | partner `/settings` | 300,000 | 300,823 | 300,998 (build-to-build noise: U5.0 touches no partner code; an earlier U5.0 build measured 300,825) |
- Replay with the flag on is covered by component tests (`SessionReplay.test.tsx`, the flag mocked on) and the rule table (`replay.test.ts`), not by a browser run: a real run needs a Sentry DSN, which this environment does not have.

### Open questions (for the U2.0 intake)
- **Baseline round**: moderator and note-taker; incentive; recording tool and where it stores data; and a **real small order on the competitor**, without which T7–T10 are "not possible" there and T7/T9 drop out of the time comparison.
- **Replay**: vendor data terms (Sentry, outside Thailand) and whether replay is wanted at all before launch.
- **Consent text**: registered name, DPO contact, retention period (placeholder 12 months), response time (placeholder 30 days).

---

## U-F2 — Art direction tokens (D-180) — 2026-09-29

`docs/prompts/U1-update-2026-09-29.md` §U-F2, on `feat/u-f2-art-direction` (worktree `../packio-web-u1`, from `main` at `94aa968`). Gap table: `docs/update-2026-09-29-gap.md` §U-F2. No backend involved.

### Decisions implemented
D-180 (visual direction, values Proposed) and the D-181 card facts in the new storefront story. Token **values** changed; the semantic key set grew by the `accent` tone and `kraft` / `kraft-strong`, and no component names a palette.

### Values that differ from the proposal, with the ratios
| Token | Proposed | Shipped | Why |
|---|---|---|---|
| dark `primary-hover` (`--c-primary-700`) | `#0D7A66` | `brand-400` (one ramp step *lighter*) | the proposal gives 3.26:1 under the dark button label and 3.49:1 as a hovered link on the dark page; the shipped step gives 8.90:1 for both |
| light `subtle` (placeholders; not in the spec) | — (ramp step 500) | ramp 500 at L 0.64 | step 500 gives 2.97:1 on paper-50; shipped 3.18:1 |
| dark `surface-raised` (not in the spec) | — | surface + 0.04 L | menus need one step above a dark card; fg 12.74:1, muted 7.35:1 on it |
The tightest pass is light `primary` on the paper band, 4.52:1. `pnpm contrast` prints all 129 pairs.

### Also decided
- **Warning ≠ promotion.** `warning` is the spec's `#B45309` with a white label (5.02:1), on its own burnt-orange ramp; amber is `accent` alone. A campaign badge is `<Badge tone="accent">`.
- **Print marks and artwork defaults are frozen** to their pre-rebrand values (`PRINT` and `ARTWORK_DEFAULTS` are literals now): they are ink on board and must not move with a UI rebrand. Designer chrome (selection, panel labels) follows the new palette.
- **Motion values supersede design-system.md §2** (120/200/320 → 150/200/250 ms, standard easing ease-out), as §Art direction specifies.
- **Pill = the primary CTA only**, in the whole customer zone (checkout and account included), as the spec says; the secondary button stays at 12 px. This is the most literal reading; it is easy to widen if you prefer both storefront CTAs as pills.
- **Dialogs 24 → 16 px** (cards), menus and popovers stay 12 px, callouts unchanged.
- **`cn` now knows the semantic scale names.** Plain tailwind-merge took `text-display` for a text colour and silently dropped it beside `text-fg`; it registers the `RADIUS` / `SHADOW` / `FONT_SIZE` keys from the tokens (test in `cn.test.ts`).
- **Visual suite tightened.** Playwright's default per-pixel `threshold` (0.2) let the whole rebrand (white → `#FBF8F3`, cool → warm greys) pass against the old baselines; it is 0.02 now, and the browser clock is fixed so the SLA countdown in the back-office story does not change the shot. Two consecutive runs were identical.

### Lint rules (`eslint.config.mjs`)
`text-kraft*` (and placeholder/caret/decoration) everywhere; raw palette steps (`bg-brand-600`…) in `src/app`, `src/features` and `src/ui` components; `*-accent*` / `*-kraft*` utilities in `src/app` and `src/features`. "Teal for actions only" cannot be linted — it is in Storybook (Docs/Tokens → Art direction) and `docs/ui/brand.md`.

### Deferred
- Linux CI visual baselines: the `visual` job needs its one-time `pnpm e2e:visual:update` on the runner (only darwin baselines exist, as before).
- Using `SectionDivider`, the hero and the paper bands on real pages is U-F3.

### Verification
- `pnpm contrast` 129/129 · `pnpm tokens:check` · `pnpm lint` · `pnpm typecheck` · `pnpm test` (867 app, 1,504 dieline) · `pnpm build`.
- `pnpm e2e:visual`: 33 shots, two identical runs after regenerating; before/after pairs were produced for the user's review.
- `pnpm e2e` (mocks): 340 passed, 5 failed in the parallel run — the designer-panel axe walk (timeout), two admin-console flows and the `/audit-logs` axe case (staff sign-in timed out before the account button appeared), and the finance-close month (reconciliation table empty). None is a colour or axe finding; all five (14 cases) pass when re-run on one worker. Not compared against a parallel run on `main`.
- `pnpm lhci`: every set passes except the script-size budget in `customer-app` and `partner` — and those three URLs **already fail on `main`** (measured on a clean `main` build, same machine, one after the other). U-F2 adds 0.3–1.1 KB of uncompressed script (the art palette and `hexToOklch` reach the designer bundle through `canvas-colors`, plus the tailwind-merge config):

  | URL | budget | `main` | U-F2 |
  |---|---|---|---|
  | `/account/designs` | 293,000 | 303,913 | 304,208 |
  | `/configure/tuck-end-box` | 293,000 | 318,043 | 319,161 |
  | partner `/settings` | 300,000 | 300,522 | 300,823 |

  `cn` keeps its scale names inline (not imported from the tokens) so the design-system change stays out of every client bundle. Bringing these three pages back under budget is not U-F2 work; flagged below.

### Open questions
- **Performance (pre-existing)**: the three pages above are over their script-size ratchet on `main`; who owns bringing them back (the ratchets were last lowered in F5 5.3)?
- **Design**: pill on the storefront's primary CTA only (as specified), or on both storefront CTAs?

---

## F6 Deliverable 6.4 — 2026-09-29

Period close, financial reports and the auditor, on `feat/f6.4-close-reports-audit` (from the 6.3 merge). All on packio-api's published B5.6 surface, with two contract requests.

### What is now enforced rather than advised
| Rule | Mechanism |
|---|---|
| A month closes only through its checklist (§7) | the ledger asks the close before it closes or locks a month (`registerCloseGate`, packio-api's `PERIOD_CLOSE_GATE`): closing needs the checklist in review with step 9 done, locking needs it closed and, at the year end, the auditor's sign-off; `close.checklist_incomplete` otherwise — unit-tested by trying the ledger's own close action first |
| Automatic steps block until their check passes | steps 1, 2, 3, 6, 7, 8 re-run their check when marked done and refuse with `close.check_failed` (the step shows as blocked); only a Finance Manager waives one, with a reason kept on the step |
| The submitter never approves the close (§8 SoD) | the approve button is disabled for the submitter with the reason; the mock answers `iam.sod_conflict`; Finance holds no `close.approve` and is never offered it (unit test: a Finance Manager submits, is refused, returns it; Finance submits; the other approves) |
| A locked month refuses postings, and says so first | after the e2e locks last month, the journal editor shows that an entry dated in it lands in the next open month, and the depreciation page does not offer the run for it; unit-tested end to end — the late journal keeps its document date and posts into this month |
| Every report carries its own zero | trial balance (Σ debit = Σ credit, balances sum to 0), balance sheet (assets − liabilities − equity), cash flow (net change − cash accounts' movement), sub-ledger reconciliation (AR, factory AP, vendor bills, retention, store credit, fixed assets) — each computed by the mock over the same posted journals, asserted zero in `finance-mocks.test.ts` and shown as zero in the month-simulation e2e, together with the seven tax papers |
| Exports say exactly what the API said | report CSVs are serialised from the API's strings, nothing added up or reformatted (UTF-8 BOM, CRLF, RFC 4180 quoting); snapshot tests pin the trial-balance export and the ภ.ง.ด.53 attachment layout (`csv.test.ts`), and the e2e reads the downloaded trial balance's total row |
| The auditor reads, for a set time | the desk shows the access window from the auditor's own role grant (`validTo`); every write action is gated by a permission the auditor does not hold (e2e checks the manual-journal and depreciation actions are absent); samples are reproducible from their seed (mulberry32, as packio-api draws) and the PBC pack carries its SHA-256 |

### Decisions taken, with reasons
- **Last month is the month the e2e closes**; months before it are seeded locked (the new business had nothing in them, D-092), so closing and locking run in sequence as packio-api requires. The month simulation reads this month and changes nothing.
- **Points liability is posted from the loyalty ledger** (P10 earned, P11 redeemed) so 2330 carries what the roll-forward and balance sheet show.
- **The PBC pack is CSV sections in the mock**; packio-api writes an xlsx workbook with the same sheets. The download is named `.csv` accordingly.
- **Owner assignment is "take this step"**: Finance does not hold `users.read`, so the screen assigns the step to whoever takes it rather than offering a staff picker.
- **Fixed a 6.2 mock bug**: payout item ids mixed in `Math.random()`, so two items of one run could share an id and a bank confirmation landed on the wrong item (it showed as a rare ภ.ง.ด.3 / AP difference under load). Item ids — and the partner proposal line ids, same pattern — are plain sequences now.
- Byte-order marks written as literal characters in string and regex literals (finance, partner price sheet, business CSV) are spelled `\uFEFF` — the same value, visible in review.

### Contract requests raised
`admin.account-roll-forward` (2330 / 2130 month by month, by rule), `admin.subledger-reconciliation` (§7 step 8 as a read-only report).

### Deliberately not done here
Year-end closing entries (P&L to retained earnings) — the balance sheet computes prior-year and current-year profit as the backend does; a staff picker for step owners (needs `users.read`); scheduling the close (the backend has no calendar for it).

### Open questions
- **Backend**: the two requests above; whether step 3's "POD without GR" check has an endpoint for the items (the mock always passes it); whether the PBC pack should include the samples drawn for the month.
- **Finance / CPA (⚖)**: the business hours for the out-of-hours exception (`audit.business_hours`), and whether `close.unmatched_items_threshold` stays 0.

---

## F6 Deliverable 6.3 — 2026-09-29

The general ledger, tax and fixed assets, on `feat/f6.3-ledger-tax-assets` (from the 6.2 merge). All on packio-api's published B5.1 / B5.4 / B5.5 surface; one contract request.

### What is now enforced rather than advised
| Rule | Mechanism |
|---|---|
| A manual journal posts only after another person checks it (§8, D-169) | a draft is created and edited by its maker only (`If-Match`, 403 for anyone else), submitted into the `manual_journal` approval, and posted with a JV number by the approval — the maker is never offered the decision and the engine refuses it; the e2e and `finance-mocks.test.ts` both walk it |
| The screen adds nothing up | the editor sends the lines; balance, postable accounts, control accounts and required dimensions are the API's answer (`ledger.unbalanced`, `ledger.account_invalid`), shown against the lines it names — there is no client-side total |
| Sub-ledger entries are corrected by documents, not reversals | reverse is offered only for posted manual / recurring / closing entries not yet reversed; the mock answers `ledger.not_reversible` for an automatic one |
| A posting never lands in a month that no longer takes postings (§1.4) | `PostingPeriodNotice` reads the fiscal periods and says, before saving, that an entry dated in a soft-closed / closed / locked month lands in the next open month with its document date kept — in the journal editor, submit, reversal, asset registration and disposal; the depreciation run refuses a month that is not open and the page does not offer the button |
| Periods move in order | the mock refuses reopening a closed month, closing a month while an earlier one is open, locking before earlier months are locked (`ledger.period_transition`); only `ledger.periods.manage` sees the actions; a gate hook (`registerCloseGate`) is where 6.4's checklist blocks close / lock |
| A tax paper is final only at a GL difference of zero (§7 step 7) | the mock builds each of the seven papers the way `TaxReportsService` does — tagged journal lines (VAT) or 50 ทวิ certificates (WHT) against the movement of the `tax.gl_accounts` in the same posted entries, the tax papers' own postings left out; finalise refuses `tax.gl_difference`, then freezes the figures and the CSV. Unit-tested: all seven at zero for the current month, and still zero after ภ.พ.30's own P27 |
| Rates and rules change only by approved, dated versions | tax rates (`tax_setting_change`), posting-rule versions (`posting_rule_change`) and account changes (`coa_change`) are proposals until a Finance Manager other than the proposer approves; a version effective "today" is sent as now, never back-dated |
| Depreciation posts what the preview showed, once a month | preview and run share one computation (straight line, catch-up, last month takes the rounding); a second run is `fixed_assets.run_exists`; disposal needs depreciation up to the month before; the roll-forward reconciles 1510 / 1519 to the GL at zero (unit and e2e) |

### Decisions taken, with reasons
- **Journal status and the new vocabularies come from `src/domain/status`**: `JOURNAL_STATUS`, `PERIOD_STATUS`, `RECURRING_JOURNAL_STATUS`, `TAX_REPORT_STATUS`, `TAX_CALENDAR_STATUS`, `ASSET_STATUS` — the 6.1 journal badges now use them too.
- **The tax settings page reads Settings, it does not edit them**: nature of sale per product type, rounding, calendar and GL accounts are the backend's settings (`tax.nature_by_product_type` etc., owner Finance Manager); the page shows their values and links to the setting. They were added to the settings mock with their backend seeds and owner role.
- **Seeded equipment is the founders' contribution** (Dr 1510 / Cr 3100) so the bank stays reconciled; last month's depreciation is posted, this month's waits for Finance.
- **Recurring journals run as the backend's job does** on load and on approval / resume: last month's accrual is posted and reversed on the 1st.
- **Approval subjects follow the backend's changed seeds** (`account_change`, `posting_rule_version`, `tax_rate_version`); the approval inbox now formats the new payload fields.
- Journal source types without a label or link in 6.1/6.2 (goods receipt, payout item, vendor bill, bank line, tax return, asset, depreciation run) now have both.
- The journals list page used the single-journal title key ("รายการบัญชี {number}"); fixed.

### Contract requests raised
`admin.depreciation-preview` — `GET /v1/admin/depreciation-runs/preview?period=` (the run posts at once; F6.3 asks for preview → post).

### Deliberately not done here
Editing the settings from the tax page (Settings owns them); a template editor beyond JSON for rule versions; auto-reversal of manual journals by date (the backend's job — the journal says when it will happen); asset barcode tagging (D-150 says none).

### Open questions
- **Backend**: `admin.depreciation-preview`; whether a manual journal approved into a soft-closed month posts there for a Finance Manager holding `ledger.post_soft_closed` (the mock moves it to the next open month).
- **Finance / CPA (⚖)**: useful lives per category, the gain / loss account on disposal (seeded 6900), and the `fixed_assets.depreciation_start` rule.

---

## F6 Deliverable 6.2 — 2026-09-28

Payables, payouts and banking, on `feat/f6.2-payables-payouts-banking` (from the 6.1 merge). All on packio-api's published B5.3 surface, with four contract requests where it has a gap.

### What is now enforced rather than advised
| Rule | Mechanism |
|---|---|
| The AP sub-ledger agrees with its control accounts | every AP event posts through the books (P15 at GR, P16 when an advance meets its balance — also when the advance is paid after the GR, P14/P17/P18 on payment, P25/P26 for other vendors' bills); `finance-mocks.test.ts` asserts open balances = 2110, open bills = 2120, open retention = 2130 — before and after a paid run |
| A run is paid only after a C-Level other than the proposer approves it (D-166) | propose opens the `payout_run` approval; the proposer is told they cannot approve and the engine refuses it; the bank file needs the approved run, the confirmation needs the file, each step typed with the run number and idempotent |
| Payable by a date, withheld by line type, retention held (D-022, D-164) | a run takes payables whose date falls on or before its pay date; WHT is worked per line type (⚖ hire of work 3 %, transport 1 %, service 3 % — the backend reads its tax-rate versions); the 5 % retention is held on balances and becomes its own payable after the release period |
| Input VAT only with a valid tax invoice (§2) | VAT paid before the factory's tax invoice is validated goes to 1242; validation checks the seller's tax id and branch against the vendor record and the amounts against the statement, then moves it to 1241 (P17V) |
| A bank-account change pays only after two approvers and a call-back (§8, D-169) | a new account is `pending_approval` until the approval (Finance → Finance Manager) is complete **and** a call-back on the number on record confirms it — either may come last (`activateIfReady`); a duplicate account number is flagged |
| Whoever records a vendor's bills cannot change its bank account (SoD) | the mock remembers who recorded each vendor's bills; their account-change request is 403 `sod.bill_recorder_bank_change` |
| A vendor without a verified account is not paid | its items are `excluded` from the run with the reason, and listed in the exceptions |
| Money meets the bank once | statement lines match one target each (or a split whose parts add up); a file is imported once and overlapping lines are skipped; P05 / P04 post at the match, P29 when money is parked |

### Decisions taken, with reasons
- **Factory AP is the partner zone's own rows**: POs are the factories' released jobs, GRs their delivered shipments, statements and tax invoices the partner billing mock's state (exported, not copied) — so the factory confirming a statement or submitting its invoice is what Finance validates, and a rejection reason is what the factory reads.
- **Last week's run is seeded as confirmed** (the advances the partner zone already shows as paid), so the books, the bank statement and the partner view start in agreement.
- **The bank statement is seeded oldest first with a running balance**, opening with the paid-up capital (a manual JV, Dr 1121 / Cr 3100), and holds one line of each kind the workbench handles: auto-matched collections, slips and a settlement, a slip line without a reference, a settlement still waiting, an unknown transfer (the unpaid instalment of PK-2569-00105), a transfer between own accounts, a bank charge.
- **Statement import reads a generic CSV** (`date,description,reference,amount,balance`) through the published `fileId` + `format`; bank-specific adapters are the backend's.
- **Masked account numbers go through i18n** (`AccountNo`): "xxx4417" is copy, and the lint rule said so.
- e2e axe scans now wait for network idle and settled animations and leave the transient toaster out: under four workers they had measured a list mid-refetch and a sheet mid-fade.

### Contract requests raised
`admin.payout-documents` (remittance advice and 50 ทวิ of a paid item), `admin.bank-line-suggestions`, `admin.bank-line-split`, `admin.gateway-settlements` (list).

### Deliberately not done here
Bank-specific file adapters and parsing the bank's confirmation file (the mock treats an uploaded file as "all paid"); a vendor statement per factory (the partner zone has its statement of account); proposing a factory's bank change from Finance (Partner team or the factory, B2.2).

### Open questions
- **Backend**: the four requests above; whether the payout-run list should filter by status; how a confirmation file is matched to items when the bank does not echo the item id.
- **Finance / CPA (⚖)**: the WHT rates per line type and whether retention's WHT is withheld at the balance or at release (the mock withholds at release).

---

## F6 Deliverable 6.1 — 2026-09-28

Queues and customer documents in the admin zone's finance workspace, on `feat/f6.1-queues-documents` in the worktree `../packio-web-f6` (from `chore/contract-adopt`, merged first). The user asked for deliverables 6.1–6.4 in one run; each is its own branch, merged into `main` before the next. The kickoff dropped "Plan first", so the plan is recorded here rather than waited on.

### The contract came first
packio-api has published the whole B5 finance surface (B5.1 ledger … B5.6 close and audit, ~140 operations), while this repo still vendored the B1-era contract. Building F6 on contract requests would have re-described shapes the backend already owns, so `chore/contract-adopt` ran `pnpm gen:api --adopt` against the sibling checkout (main @ `945f02e`; its `info.version` is still `0.1.0`, so the lock pins it by sha256 — the backend is asked to tag a release). The change was additive except four new quote-step fields, which the store quote mock now fills. It also made **86 existing contract requests** real at once; migrating every F2–F5 screen onto the published shapes is its own change per screen (ADR-0006), so they stay on `src/lib/api/requests/awaiting-migration.ts`, which `registry.test.ts` lets only shrink. The full e2e suite passed on the adoption (one storefront test flaked under load and passed alone).

### What is now enforced rather than advised
| Rule | Mechanism |
|---|---|
| The books balance, and sub-ledgers agree with their control accounts | every finance mock posts through `books.post()`, which throws on an unbalanced entry or a heading account; `finance-mocks.test.ts` asserts debits = credits over every journal, open receivables = the 1210 balance, and output VAT (2210) = what the issued documents put at the tax point |
| Gapless numbering per series (§4) | `nextNumber()` keeps one sequence per (type, BE year, month) — IV per year; the test checks every series runs 1…n; a void keeps its number and reason |
| Mocks cannot drift from the published contract | `finance.get/post(…)` take the OpenAPI path and type the resolver's return value as that operation's success body; they also apply its `x-required-permissions` and, where the contract requires it, `Idempotency-Key` (400 without, the first answer with `Idempotent-Replayed: true` on a replay) |
| Slips are Finance's, within 4 business hours (D-061) | the queue sorts by the API's `slaDueAt`; approval needs the bank's transaction reference (a reference already used is 409 `payments.slip_duplicate`) and a typed group code; the uploader of a slip cannot review it; CS reads the queue without the decision |
| Maker-checker on credit notes, refunds, write-offs (§8, D-169) | each is a request that opens the backend's approval policy; the requester is never offered the approval (the engine refuses it too); a refund's requester cannot record its payout (403) |
| Every irreversible act restates its target and is idempotent | slip approval, refund request and payout, credit note, debit note, void, write-off and allowance go through `ConfirmAction` (typed code or amount + one `Idempotency-Key` per intent) |
| Every number drills down | document → order, payment, original document, receivable and the journals it posted → journal → source, domain event, posting rule and version, maker and checker (`StaffName` resolves the ids) |
| No money arithmetic in the UI | totals, buckets and balances are the API's; typed amounts go through `moneyText` (moved to `src/domain/money.ts`, tested), and nothing sums a column |

### Decisions taken, with reasons
- **One finance layout with a grouped desk nav** (daily · customers · suppliers · banking · books · close), a column beside the work on a wide screen and one scrolling row on a phone. Sixteen desks by F6.4 do not fit a tab row; each desk is gated on the permissions that work it, and the menu entry `finance` is proposed for `admin.menu-entries` (anyone with one of those permissions).
- **The finance home reads `admin.dashboard`** and shows its `finance.*` queues — no second queue endpoint; the finance mocks register theirs, gated like the backend would gate them.
- **Personas carry the backend's real finance permission keys** from `docs/rbac.md` (B5), replacing nothing; the finance menu follows them.
- **PDF "preview" opens the signed URL in a new tab** (the browser's viewer): the CSP allows frames from `'self'` only, so a signed storage URL cannot be framed, and a pdf.js viewer is not in `src/ui` yet. The document page itself shows everything the PDF does.
- **A credit note is always a request**: the wizard ends in the approval inbox, and the CN is numbered and posted when the Finance Manager approves. Cash back is a separate refund (its own approval), as B5.2 describes.
- **The commerce mock's slip decision is one function** (`decideSlip`) used by the order screen and the finance queue, and publishes `onPaymentSettled`, which the finance mock turns into the TR and P02 — so approving from either screen produces the same document and journal.
- **Seeded books** (all obviously fake): every paid instalment has its TR (P01/P02), every completed order its final TR (P06 with P09 discounts), the two credit companies their IVs (P07) summing to what the companies mock already shows (฿84,000 open; ฿61,500 with ฿38,200 twelve days overdue), two collections net of 3 % WHT (P08) with one 50 ทวิ still awaited, a shortage credit note (P19), a claim credit note waiting for approval, refunds at two stages, and dunning per D-122.
- A few copy and layout fixes found by looking at the screens: document and order codes never wrap; a mismatched seeded slip now actually shows a different amount.

### Contract requests raised
`admin.slip-file` (the slip image), `admin.document-resend` (resend + delivery log), `admin.dunning-log`, `admin.credit-note-reasons` (the backend's seeded statutory list, served verbatim by the mock), `admin.document-payment-filter` (one cast at the call site); additions to `admin.menu-entries` (`finance`) and `admin.dashboard` (the `finance.*` queue keys).

### Deliberately not done here
Migrating the 86 published requests (each screen its own change); a pdf.js viewer; QT stays the sales-side register (`/quotations`), linked from the documents register; the journal list is read-only until 6.3 adds manual entry.

### Open questions
- **Backend**: tag a contract release; the five requests above; whether `CreditNoteReasonDto` should carry a `direction` (the seed marks debit reasons only by name).
- **Finance**: the default channel of a refund on a slip payment (bank transfer assumed); whether the dunning log should show SMS for B2B (none are sent in the mock).

---

## F5 Session 5.3 — 2026-09-27

Billing, payouts, claims, performance and settings, on `feat/f5.3-billing` (from the 5.2 merge). This closes F5. packio-api has published none of B5.3's partner surface, so it is contract requests with mocks derived from what the other mocks already hold.

### What is now enforced rather than advised
| Rule | Mechanism |
|---|---|
| The zone never computes money | statements, schedules, payouts and the statement of account arrive as decimal strings; the zone formats them (`formatTHB`) and nothing else — the arithmetic is the mock's, in satang, standing in for the API |
| Confirming a statement is a financial act | the BS number is typed to confirm and the amount restated (00-master-plan §8), with one `Idempotency-Key` per intent; a replay answers with the confirmed statement |
| The tax invoice is the factory's own (D-090, accounting-design §2) | only against a confirmed statement (409 otherwise), with the factory's own tax id (422 otherwise), a PDF or an e-Tax reference; input VAT stays `pending_document` until Finance validates it |
| Payouts follow the payout-policy version (D-022, D-164) | the schedule shows each job's advance, balance and retention with their date or what they wait for (acceptance, POD, the claim window, the retention period); the seeded policy now carries the decided 5 % / 30 days (it had 0 %) |
| A factory answers claims, Packio decides them (D-083) | the answer goes back to the claims desk's own row (`under_review`, the factory's note in its messages); the customer is never named (D-142) |
| An operator cannot manage users or see billing | no billing in the nav or "more", `/billing` answers "no access", and settings shows only the operator's own notifications and device |
| A factory keeps an owner | the owner cannot remove their own owner role or deactivate themselves (409 `users.last_owner`) |

### Decisions taken, with reasons
- **This period's statement follows the PODs until it is confirmed**, then freezes: it is what the factory checks, and a POD recorded today belongs in it. Last period's is confirmed with a validated invoice, so the input-VAT status has both states to show.
- **WHT is shown as the API gives it** (the mock uses 3 %, hire of work) — ⚖ the auditor confirms whether factory jobs are hire of work (D-022); the zone does not know the rate.
- **Remittance advice and the 50 ทวิ are signed downloads**; the mock hands out a small PDF so the links work offline.
- **Label size is a device setting** (cookie `pk_label`: 100 × 150 mm or 4 × 6 in) read by the labels page; language and theme reuse the shell's own controls, so the high-contrast theme is one tap from settings as well as from the top bar.
- **Device push is asked for only from its button** (`usePushSubscription`'s rule); the notification matrix keeps locked rows on (a job to accept, account security).
- **The manifest leaves orientation to the device** (was portrait): design-system §5 names landscape tablets, and a portrait lock turned the installed app sideways on them.
- `formatDate` gains a `month` style ("ก.ย. 2569") for the scorecard.

### Performance
Lighthouse partner set, eight URLs (adds /settings): accessibility 100 on each; initial JS 251 KB (/login) to 292 KB (/settings), under the 300 KB ratchet. LCP ~3.4–4.1 s simulated on 4G (warning level, target 2.5 s).

### Contract requests raised
`partner.billing-statements`, `partner.payouts`, `partner.claims`, `partner.scorecard`, `partner.users`, `partner.notification-preferences`, with the money and account permission keys (`factory_billing.read·confirm`, `factory_payouts.read`, `factory_claims.read·respond`, `factory_scorecard.read`).

### Final summary (F5)
**The partner zone, end to end on a phone**: onboarding (13 steps, sign-off of staff-entered data), prices by mode and tier (proposals line by line or from a sheet, rate cards, shipping payout cards), the floor (Today, jobs, milestones with photos, QC, issues, capacity), shipping (split per destination, labels, dispatch, POD), money (statements, tax invoices, payouts, statement of account), claims, performance and settings. Published contract: B2.2's partner surface. Contract requests: 17 groups, every one with a stateful mock over the same rows the back office reads, so a factory's action shows on the admin side.

**Gates run**: 796 unit, 14 partner e2e flows on a 390 × 844 viewport (with axe on every screen they open, high contrast included), the full e2e suite, Lighthouse partner set (8 URLs, accessibility 100).

**Still open**
- The 180 KB initial-JS target (251–292 KB now; the shared zone runtime is most of it) and a 2.5 s LCP on simulated 4G.
- Offline sync (R2, D-111): the floor needs a connection; a report that fails keeps its key for the retry.
- Everything in `docs/contract-requests.md` marked `partner.*`, the proposed permission keys, and the `RateCardLineResponse` contract defect.
- A back-office queue for change requests; adopting packio-api's newer committed contract (its own PR, ADR-0006).

---

## F5 Session 5.2 — 2026-09-27

The production floor and shipping in the partner zone, on `feat/f5.2-jobs` (from the 5.1 merge). packio-api has published none of B4.2/B4.3's partner surface, so it is contract requests with stateful mocks over the rows the back office already has.

### What is now enforced rather than advised
| Rule | Mechanism |
|---|---|
| A report from the floor is sent once and never twice | every write carries `clientRef` + `clientReportedAt` and an `Idempotency-Key` minted **once per intent** (`newReport`, kept across a retry, dropped on success); the mock answers the same `clientRef` with the state it made |
| Server wins on a conflict (B4.2) | another device's report on the same step is `409 job.conflict`; `useFloorAction` says so and re-renders the job from the server |
| Quantities add up | the API checks good + scrap ≤ in and in ≤ what the previous step put out (422 per field); the form pre-fills from the previous step and refuses the obvious overflow before sending |
| Evidence where the route asks for it | `requiresPhoto` steps need a photo (422), the QC step completes only after a passing QC (409 `jobs.qc_required`), POD needs photos, a signature (drawn or typed) and the delivered quantity (D-013) |
| A factory sees the recipient and nothing else of the customer (D-142) | `PartnerDestinationDto` has name, address, phone, quantity only; the labels print the same |
| Approved artwork only | the job carries the approved proof version, watermarked `APPROVED vN` on screen |
| Shipping follows the money and the inspection | an unpaid before-shipping instalment holds dispatch (409), an open or failed inspection holds the shipment; the ship plan says why |
| A zone loads what its code reads | new `zone-namespaces.test.ts`: every `useTranslations`/`getTranslations` namespace in a zone's files is in `ZONE_NAMESPACES` for that zone — added after the two new partner namespaces rendered as raw keys |

### Decisions taken, with reasons
- **The mock's jobs are the commerce mock's own.** Two in-production jobs are put back to `released` at start: one due tomorrow, and one due within hours that is paid up and not held by an inspection, split across two addresses — the one the e2e takes from acceptance to POD. Partner-created shipments are pushed into the logistics mock's rows, so the desk's POD review sees them; dispatch moves the order to `shipping`.
- **Accepting restates the PO** (job, quantity, ship date, buy amount): it commits the factory to produce at that price and starts the advance (D-022). Rejecting asks for a reason code and a note (D-012, D-101).
- **Photos are compressed in the browser** to 1600 px JPEG (a 12 MP shot is ~5 MB; on 4G that decides whether a report gets sent) and keep the shutter time from EXIF `DateTimeOriginal`, read by a 60-line parser; the POD's `capturedAt` is its first photo's.
- **Scanning uses `BarcodeDetector`** where the browser has it, and a typed code always — no scanning library in the bundle, and the floor never depends on a camera.
- **The signature pad has a typed-name mode** that renders the name as the signature image (WCAG 2.5.7 alternative to dragging).
- **Carton labels are a 100 × 150 mm print sheet** with a vector QR of the public tracking link; the print stylesheet hides the rest of the app.
- **Nav now leaves out what a role cannot open** (jobs, ship, billing by permission); billing stays hidden until 5.3 defines its key, so no link points at a 404.
- **The partner login form imports `src/ui` components by path**: a client component importing the `@/ui` barrel pulled every client component of the library (now including the camera and signature pad) into the first page — 326 KB; by path it is 251 KB.

### Performance
Lighthouse partner set now seven URLs (adds /jobs, /ship): accessibility 100 on each; initial JS 251 KB (/login) to 286 KB (/jobs); the ratchet is lowered from 330 to **300 KB**. Still over the 180 KB target (see 5.1).

### Contract requests raised
`partner.today`, `partner.jobs`, `partner.job-milestones`, `partner.job-qc`, `partner.job-issues`, `partner.capacity-calendar`, `partner.shipments`, `partner.permissions` (proposed factory-floor keys for rbac.md).

### Deliberately not done here
Offline queueing of reports (R2, D-111: the floor needs a connection; a failed report keeps its key for the retry); a printable job traveller (the job number is typed or scanned from carton labels); a real dieline viewer (the approved dieline is a signed link).

### Open questions
- **Backend**: the requests and permission keys above; whether a QC `conditional` result lets the QC step complete (the mock says yes).
- **Factory**: label printers in use (100 × 150 mm assumed, B4.3).

---

## F5 Session 5.1 — 2026-09-27

Onboarding and price tables in the partner zone, on `feat/f5.1-onboarding` (from the F4 Part E merge), in the worktree `../packio-web-f5`. The user asked for sessions 5.1–5.3 in one run; each session is its own branch, merged into `main` before the next.

### What is now enforced rather than advised
| Rule | Mechanism |
|---|---|
| A factory reaches its own rows only (D-044) | every partner mock handler goes through `own()`: no token 401, another audience 403, **another factory's id 404** (never 403), a role without the rbac.md permission 403; `partner-mocks.test.ts` asserts all four, and the e2e opens F006's rate card as F001 |
| No suggestion, benchmark or peer price reaches a factory | the partner DTOs have no field for one; a test scans the price-list, proposal and configuration answers for `suggest|benchmark|peer|p75|median` |
| A factory never edits what Packio records | capability, capacity, delivery zones, tolerance, tier, payout policy and site visits are read-only on the published contract; the screens offer a change request (`partner.change-requests`) instead of a form |
| Staff-entered data is the factory's word only once signed off (D-100 note) | steps with `enteredByStaff` and no `factorySignedOffAt` show "รอคุณรับรอง" on Today, the tracker and the step; the sign-off restates the step; assisted price lists apply only after the version's sign-off (idempotent) |
| Prices are never back-dated (D-040, B2.2) | the proposal's effective date is a future day in the form and a 422 in the mock |
| Irreversible partner actions replay, never repeat | submit, respond, sign-off of a version and the shipping-card answer carry an `Idempotency-Key` minted per intent (`ConfirmAction`); the mock's `once()` answers a replay with the first response |
| Two tabs cannot both change the company | profile edits and the application submit go under `If-Match`; a stale ETag is a 412 the form explains and refreshes |
| Decimals are shown as the API sent them | price rows keep six places as strings (`decimalText`), a sheet's decimals are padded to the column's scale as text, counter amounts become money strings by text (`moneyText`) |

### Decisions taken, with reasons
- **Server-rendered screens with small client islands.** Every partner page reads on the server (`serverApi("partner")`) and the forms call the BFF, then `router.refresh()` — "server wins" (B4) without a client cache to reconcile, and less JavaScript on the 180 KB route type. The one client read is the proposal editor's rows for the chosen component.
- **Pages ask for the factory themselves** (`factoryContext()`): a page renders in parallel with its layout, so the layout's sign-in redirect does not stop a page running without a session — it did, and crashed on `null`, in the zones e2e.
- **The factory's name comes from `GET /v1/partner/factories`** (the token's scopes), since `/me` names factories by id (`partner.factory-name`, still open). A user of several factories switches in the account menu; the choice is an httpOnly `pk_factory` cookie, accepted only for a factory in `/me`.
- **Nav follows the stage**: an onboarding factory's bar is today · onboarding · prices · more; from trial on it is today · jobs · ship · billing · more (≤ 5 targets of 64 px). Tablets get the same list as a side column (AppShell's sidebar), so the zone has navigation above `md` — before, it had none.
- **A price list is read one component at a time** (`?component=`): a tier-A table has ~40 components; one small read per view instead of forty.
- **Excel upload without a spreadsheet library**: `sheet.ts` reads the first worksheet of an `.xlsx` with the zip directory, `DecompressionStream("deflate-raw")` and `DOMParser`, and CSV by RFC 4180 — loaded on demand. The template is the factory's own current rows as a UTF-8 CSV with a BOM (Excel opens it in Thai), one `change` line per row, identified by `lineKey`.
- **Rate cards and assisted entry are separate flows**: a `packio_to_factory` proposal is answered (accept all, or accept/counter per line); an `assisted_entry` version is signed off. Both are on Today and the prices page.
- **Seed changes in `mocks/admin/partners.ts`**: an applicant (F005) has no step complete (its application was not submitted); F006 (under review, assisted) has capability and capacity awaiting sign-off, a tier-B price list awaiting sign-off, and a rate card sent for its tier-A type; seeded tax ids carry a valid check digit (the company form checks it). The shipping card's initial state is taken at seed time, so the back-office e2e moving F006 to trial does not change what the partner test sees.
- `ConfirmAction` and `QueryError` moved to `src/features/shared/actions` (admin re-exports them); the tax-id checksum moved to `src/domain/tax-id.ts`; `SegmentedControl` gained a shop-floor `xl` size.

### Contract requests raised
`partner.references`, `partner.change-requests`, `partner.site-visits`, `partner.proposal-evidence`; `contract.rate-card-line-response` is a **defect** in the published contract (the enum and the DTO share a name, so `response` is typed as its own object), narrowed at the one call site.

### Performance
Lighthouse partner set (mobile, simulated 4G), now five URLs: accessibility 100 on each; initial JS **264 KB** on Today, onboarding and requests, 285 KB on a step with a form, **316 KB on /login** (361 KB before) — the ratchet is lowered from 380 to **330 KB**. Still over the 180 KB target, and LCP measures ~3.8 s against 2.5 s (simulated, warning level, as before F5). Every screen is server-rendered with small client islands; the sheet reader, the proposal editor's row read and the file flow load only where used.

### Deliberately not done here
A back-office queue for change requests (the Partner team has no screen for them yet — F2.6 follow-up); materials and finishes in the capability matrix (`CapabilityDto` has neither); adopting packio-api's newer committed contract (it adds partner RFQ consultations; a contract bump is its own PR, ADR-0006).

### Open questions
- **Backend**: the four requests and the enum defect above; whether a factory may propose capability or capacity itself (B2.2 says the Partner team records them — the conservative reading taken here).
- **Partner team**: the wording of the tier explainer (what providing prices unlocks).

---

## F4 Part E — 2026-09-27

Quality gates and documentation, on `feat/f4e-quality` (from the Part D merge). This closes F4.

### What is now enforced rather than advised
| Gate | Mechanism |
|---|---|
| Every style folds, closes, validates and draws the same | `styles.test.ts`: every style × preset × reference material — closed cut loops ≤ 0.01 mm, no overlaps, no dangling cuts, anchored at the origin, labelled in both languages, `validate()` accepts presets and rejects out-of-range sizes, folded bounding box = nominal size within the caliper allowance ± 1 mm; SVG and DXF snapshots per style × preset |
| packio-api can compare with the legacy drawings | `patternFixtures()` (exported, published): each mapped legacy pattern key with the values, material, SVG and DXF; `fixtures/patterns/<key>.svg` snapshots ship in the package; a test asserts every mapped key is covered once |
| The editor looks the way it did | 9 Storybook stories of designer panels in fixed states (text, image with crop, shape with an out-of-gamut colour, a locked code, arrange, print checks, layers, box, elements) under `e2e/visual.spec.ts` |
| The designer stays within its budget | `lighthouse/designer.json`: 456 KB measured, ceiling 460 KB (Part D) |

### Decisions taken, with reasons
- **Visual regression runs on Storybook, not the app**, as the existing suite argues: a story is a fixed store and context, so a diff is a UI change, not a mock or a clock. Storybook now also reads `src/features/designer/**/*.stories.tsx`.
- **Repeated face names are qualified by position** (`lib/faceNames.ts`): "ปีกกันฝุ่น (ด้านขวา · บน)" instead of four identical "ปีกกันฝุ่น" in the Box panel, the focus chip, the status bar and the clip menu — found in the Box panel baseline.
- **The product page's "design online" and the configurator pass the product** (`?product=`), so the designer loads that product's patterns and materials and shows its live price; before, the product page opened a blank designer with no price.
- **The style authoring guide's example is not in the registry.** A table tent is not a legacy pattern; it was compiled and run through the same checks (`checkDieline`, `validate`, fold bounds = `closedSize`) and then removed.

### Final summary (F4)

**Styles implemented: 30**, all in the registry with presets, bilingual parameters, validation, 3D hinge maps (flat pieces excepted) and SVG/DXF/PDF export — folding carton: tuck end, reverse tuck end, snap-lock bottom, crash-lock bottom, seal end, hang-tab tuck, sleeve, sleeve + drawer, gable, hexagonal, pillow; corrugated: RSC, HSC, FOL, CSSC, mailer, wrap-around; trays and lids: four-corner, six-corner, double-wall, telescope; flat: rectangle, rounded rectangle, circle, oval, custom SVG path, hang tag, cup sleeve, band, pouch.

**Mapped to the legacy catalogue** (`docs/design-tool/style-mapping.md`): 26 legacy patterns drawn exactly (✅), 18 by the nearest style with the construction to confirm (≈), 92 legacy keys (incl. drawing-service names) covered by fixtures.

**Still on the `DRAWING_URL` fallback** (prepress uploads the die through the drawing job; the catalogue leaves `dielineKey` empty, so no 3D and no designer):
- pid 5 insert / cushion with `x` cells — depends on the product it holds; needs a sample and a partition model.
- pid 11 Japanese-sweet box with double lid — the construction cannot be read from the formula alone.
- pid 12, 13 snack boxes — trays with side tucks of unknown shape.
- pid 45–48 fixed-size food boxes — each size had its own SVG in S3, not in the repository; fixed stock dies are best uploaded as files.
- mapping 30's presale parameters `G`, `SLT`, `TFC`, `BFC`, `DC` — meaning not recoverable; the RSC is drawn without them.

**Assumptions needing prepress confirmation**
- Caliper compensation (`constants.ts`): panels + 1 t, depth + 2 t (+ 1 t for trays), meeting flaps + t/2, glue-side panel − 1 t, hexagon panels + t·tan 30° — reproduces legacy folding's fixed ±0.5 / ±1 mm within 0.1 mm on ~0.45 mm board.
- Snap-lock and crash-lock bottoms are simplified lock shapes; compare with a die sample before launch.
- Style equivalences: pop-up (pid 7, 8) = crash-lock; handle boxes (pid 27, 28) = gable (the rim of pid 28 not drawn); single/double-flap corrugated (pid 20–23, 25) = mailer (elephant-ear locks of pid 21 not drawn); pid 10 = six-corner box or mailer; pid 2 tray may be double-walled.
- Windows keep ≥ 6 mm of board to every cut and crease; hand holes 90 × 30 mm, 30 mm below the top; corrugated slot width = 2 × caliper, ≥ 3 mm.
- Pillow crease bow = a third of the thickness; cup-sleeve presets indicative; dust flap reach = min(0.45 L, 0.9 W); tuck shoulder 1.5 mm, tuck corner radius 6 mm.
- The print file: 300 dpi RGB artwork with text rasterised (ADR-0009) — enough for small text on board?
- The designer's checks: minimum text 2.1 mm, minimum stroke 0.25 pt, the CMYK warning's thresholds, and "lids read from the front" for face focus (Part D).

### Deliberately not done
Comments on shared designs (Part D); ICC-accurate CMYK soft-proofing; Linux visual baselines: the committed set is macOS, like the existing suite's, and CI's `visual` job stays non-blocking until someone generates the Linux set on the runner (`pnpm e2e:visual:update`, see `.github/workflows/ci.yml`).

---

## F4 Part D — 2026-09-27

Editor v2 UX, on `feat/f4d-editor` (from the Part C merge). One contract request (`store.design-share`); everything else is the app.

### What is now enforced rather than advised
| Rule | Mechanism |
|---|---|
| Print problems are seen while designing, not at preflight | `lib/checks.ts` runs on every change against the engine's geometry: text/codes outside the safe zone (settings' `safeMarginMm`), text or codes across a crease/perforation/half-cut, artwork on the glue flap, text under 2.1 mm (~6 pt), strokes under 0.25 pt, images under the settings' `minDpi` (error under half), artwork stopping short of the bleed, off-sheet elements, invalid or undersized codes. Each issue selects its element |
| Every canvas gesture has a non-drag path (WCAG 2.5.7) | layers list (select, lock, reorder), arrange buttons, properties as numbers, face chips for focus, 3D rotate/tilt buttons, keyboard nudges |
| Codes scan | QR (qrcode-generator, error level M, 4-module quiet zone) and EAN-13 (check digit computed, 11/7-module quiet zones, 29.83 mm minimum at 80 %) are drawn as vectors by the designer, never images |
| A focused face never skews an export | `withFlatWorld` sets the world group's rotation to 0 for the synchronous capture; thumbnails, PNG, print PDF and the 3D texture all use it |
| Copy stays in i18n | 223 new th/en keys under `designer.*`; `keys-used.test.ts` passes |

### Decisions taken, with reasons
- **Face focus turns the face the way it reads on the box.** `uprightAngles` folds the dieline and compares each face's flat "up" with world up (walls) or with "away from the viewer" (a face lying flat: lids, bases), snapped to 90°. A tuck-end's top lid reads 180°; walls 0°. **Assumption for prepress**: lids read from the front of the box.
- **Escape steps back one level** — the selection first, then the focused face.
- **Templates are applied proportionally** from the template's sheet to this box (face bounds of both sheets), replacing the elements after a confirmation; undo restores the design.
- **Brand kit in the browser** (`packio.brandkit`): colours and a logo, plus the catalogue's colours on every colour field. No account endpoint exists; a business account's shared brand assets are F3 3.7's.
- **CMYK warning is a heuristic** (`lib/colour.ts`: very saturated, very bright, outside the hues process inks reach) — no ICC profile in the browser; the proof is the authority.
- **Share links are view-only, one per design**, revocable, no account needed to open, never indexed. **Comments are deferred** to after launch: they need a thread model, notifications and moderation on the API side, and nothing in the order flow depends on them.
- **Phones get the same panels inline above a bottom bar**, not in a modal sheet, so the canvas stays usable while a panel is open.
- `Stat`'s polymorphic `as` is narrowed because `@react-three/fiber`'s JSX elements made the bare `React.ElementType` union reject children (ADR-0010).

### Contract requests raised
`store.design-share` (create/return the live link, revoke, public read).

### Deliberately not done here
Comments on shared designs; ICC-accurate CMYK soft-proofing; per-glyph text-to-outline in the print file (ADR-0009 stands).

### Open questions
- **Prepress**: the lid "reads from the front" rule; the CMYK heuristic's thresholds; whether 2.1 mm is the right minimum text height for board (vs 1.8 mm on coated paper).
- **Backend**: `store.design-share`; a customer brand-kit endpoint (colours, logo asset) so the kit follows the account.

---

## F4 Part C — 2026-09-27

The designer on the Packio API, on `feat/f4c-api` (from `4764127`, Part B merged). packio-api has published nothing of B4.1's designs, so it is contract requests with stateful mocks that enforce the same rules.

### What is now enforced rather than advised
| Rule | Mechanism |
|---|---|
| Two tabs cannot overwrite each other | every save is `PUT` under `If-Match` (the ETag is the version); a stale save answers `412 concurrency.stale` and the designer offers keep mine / use the latest / save mine as a new design — the loser stays in the history |
| Unsaved work survives a closed tab or a dropped network | changes go to IndexedDB a moment after they are made and are removed once the API has the version; a newer draft is offered back on open; offline saves retry on `online` |
| No material list in the designer | materials (caliper from `materials.micron`, flute allowances `col_a/col_c/col_dd`), pattern limits and artwork rules come from `GET /v1/store/designer/catalog`; the setup dialog applies the pattern's limits on top of the engine's; the placeholder boards are gone |
| The designer never prices | the top bar's price is the published `store.quotes.calculate` for the design's pattern, size, material and print inferred from the artwork (none, n flat colours, or full colour), at a quantity chosen there |
| A customer's design is never changed by staff | the admin designer opens a customer's document read-only; *make a copy* creates a staff-owned copy, the only kind `PUT /v1/admin/design-documents` accepts (`403 design.read_only` otherwise) |
| The print file is what the customer designed | made in the browser (ADR-0009): artwork clipped to the settings' bleed at 300 dpi under the engine's vector die on spot layers, uploaded and submitted as the order's artwork with `designDocumentId`; preflight answers in the dialog |

### Decisions taken, with reasons
- **A guest keeps designing in the browser.** Sign-in is not required to design; after sign-in My designs offers a one-time import (replays by local id are no-ops) and keeps the browser copies. A signed-in customer opening a browser-only id still gets it from the browser.
- **Live price through `quotes/actions/calculate`**, not `POST /v1/store/quotes`: the prompt names the quotes API; creating a saved quotation on every change would fill the account with them. The saved quote stays the configurator's "save".
- **"Order this" goes through the configurator** with the design's pattern, size and material filled in (new `seedFromDesign`); the order's artwork page then opens the designer linked to the order (an order is one product line, so the line id is the order id — assumption).
- **The designer takes its navigation from the zone**: the storefront's locale-aware router, the back office's plain one (its locale is a cookie, a `/en` prefix would 404 there). The admin designer is full screen at `/designs/[documentId]`, outside the console shell, behind the same guard.
- **Materials are listed thinnest first**, so a small box does not default to BC flute.
- **A `designer` mock persona** (0856789012, the tenth fake customer, orders set up for the online designer) owns the new e2e flows.
- **Mock uploads keep their bytes** (≤ 8 MB) so a mock "signed URL" shows the picture after a reload.

### Contract requests raised (docs/contract-requests.md)
`store.designs`, `store.design-assets` (+ `FilePurpose` `design_asset`), `store.designer-catalog`; `admin.design-documents` gains `GET`, `PUT` and `editable`.

### Deliberately not done here
Applying a template or semi-design to an open design, the left rail, checks panel and 3D preview (Part D); sharing and comments (Part D, phase-able); CMYK conversion of the print file (ADR-0009 follow-up).

### Open questions
- **Backend**: the requests above; whether autosave versions should be thinned (keep every manual save, the last autosave per hour); `design_asset` as a file purpose.
- **Prepress**: is 300 dpi enough for small text in the print file (ADR-0009)?

---

## F4 Part B — 2026-09-27

The style library, on `feat/f4b-styles` (from `7342c80`, Part A merged).

### What is now enforced rather than advised
| Rule | Mechanism |
|---|---|
| Every style is cuttable, foldable and closes to its size | the Part A suite iterates the registry, so all 30 styles run it for every preset × reference board: `checkDieline` clean, validation accepts presets and rejects out-of-range sizes, SVG/DXF snapshots, and the folded model within caliper of its nominal size (`closedSize` where the shape is not a plain box: gable roof, telescope lid over its base, hexagon across corners, pillow) |
| A catalogue key always means one style | `STYLE_ALIASES` resolves short codes and every legacy drawing-service name (`folding-truck-end-snap-lock-bottom`, `corrugate-rsc-full-overlap`, `tag-curve`…); a test resolves every alias and forbids a legacy key on two styles unless the mapping calls it ambiguous |
| Styles with other sizes than L × W × H are sized by their own parameters | the setup dialog draws size fields from the style's schema (hexagon side, circle diameter, cup-sleeve diameters, pouch gussets); boxes keep "size from my product" |

### Decisions taken, with reasons
- **Constructions shared, one file per style.** A four-panel tube with pluggable closures (tuck, snap-lock, crash-lock, seal-end flaps, gable roof, polygon lid) and a cross tray with wall extras (hinged lid, inner walls) carry 20 of the 30 styles; style files hold parameters, compensation and rules.
- **Unequal neighbouring flaps split their shared slit** so a die line is drawn once (seal ends).
- **Curved creases hinge about their chord** in 3D (pillow ends); a piece can be rotated before placement (the sleeve laid along its drawer).
- **Legacy patterns with no readable construction are not guessed** (inserts, the Japanese double-lid and snack boxes, fixed-size food boxes): prepress uploads their die, as Locopack called `DRAWING_URL`. Constructions inferred from a formula alone (pop-up = crash-lock, handle box = gable, single/double-flap corrugated = mailer) are drawn with ⚠ in the mapping.
- **FEFCO codes only where certain** (0200, 0201, 0203, 0204, 0427); no ECMA codes.
- The designer's placeholder boards gained a rigid board, a label film and a pouch film so every category has a material until the catalogue is wired (Part C removes the list).

### Deliberately not done here
Style-specific 3D polish (curved pillow panels), insert/partition construction, and the options exposed outside the setup dialog — the properties panel is Part D.

---

## F4 Part A — 2026-09-27

Engine v2 of `@packio/dieline`, on `feat/f4a-engine` (from `47c5307`, F3 merged), in the worktree `../packio-web-f4`. The user asked for Parts A–E in one run; each part is its own branch, merged into `main` before the next.

### What is now enforced rather than advised
| Rule | Mechanism |
|---|---|
| A dieline can be cut and folded | `checkDieline()`: unique face ids, outlines and holes closed within 0.01 mm, every free edge a cut, every fold shared by two faces, no overlapping faces, no cut ending mid-board, each piece connected. The style suite runs it for every style × preset × reference material |
| Customers give inside sizes; the engine scores the board | caliper compensation in `constants.ts` (panel + t, depth + 2t, flaps meeting at the centre + t/2, the glue-side panel t narrower), catalogue flute allowances (`col_a`, `col_c`, `col_dd`) win when present; the folded model closes to L × W × H within the allowance |
| A window keeps board round it | `window.outside_panel` unless it sits 6 mm inside its panel (pure polygon test, no Clipper) |
| Old designs still open | `migrateSpec` + `remapV1Point`: a BoxStudio design keeps its box and every element moves to the same place on the same face of the v2 layout (v1 builders frozen in `compat/v1.ts`) |
| The storefront does not pay for offsetting | the style registry never imports Clipper2; only `offset.ts` and the exports do |

### Decisions taken, with reasons
- **Style ids kept** (`tuck-end`, `rsc`, `tray`): the configurator, the artwork page and saved designs already carry them. Catalogue keys resolve through `resolveStyleId` (`rte` → `reverse-tuck-end`, which the mocks had been drawing as a straight tuck end).
- **Clipper2 via `clipper2-ts` 2.0.1** (pure TypeScript, no dependencies, BSL-1.0) rather than a WASM build: it runs unchanged in Node for the drawing service.
- **A hand-written PDF writer** in the engine: jsPDF has no Separation colour spaces or optional-content layers, and the print file needs both (`CutContour`, `Crease`).
- **Product sizing adds clearance only** (`dimsFromProduct`); the board thickness is now the engine's compensation, not a guess added in the dialog.
- The 0.x unit tests were rewritten against the new model (their assertions — unique ids, closed polygons, panel sizes — live on in the style suite); `insetConvex` is gone (ADR-0007 updated).

### Deliberately not done here
Everything the later parts own: the rest of the style library (B), the designs API, catalogue materials and price (C), the editor v2 and WebGL preview (D), docs, thumbnails and the full gate list (E).

---

## F3 Phase 3.7 — 2026-09-27

Packio for business, LINE LIFF and help, on `feat/f3.7-b2b` (from `274632d`, 3.6 merged). This is the last phase of F3. packio-api has published none of it for the storefront, so it is all contract requests. The mocks work over the back office's company rows (F2 2.7): a company signed up here waits on the KYC desk, and its members, branches and statements are the desk's.

### What is now enforced rather than advised
| Rule | Mechanism |
|---|---|
| KYC before a company is active (D-120) | sign-up asks for the certificate's issue date and refuses one older than 6 months (`company.certificate_too_old`). It requires ภ.พ.20 when VAT-registered and the signatory's ID (`company.kyc_missing`). The company then shows "under review", and ordering prepaid still works |
| Orders over the company threshold wait for the approver (D-123) | the checkout preview says so (`company.needsApproval`). The buyer's button becomes "send to approver" and posts the checkout with its preview token to `approvals`. `POST /v1/store/checkout` refuses such a checkout (`company.approval_required`). Approving places the orders as checked out; a moved cart expires the approval (`approval.repriced`) |
| PO numbers follow the company's policy (D-125) | a `po_required` blocker until one is typed; the field is hidden under `none` |
| Credit is the API's (D-121, D-122) | a `credit_term` schedule option appears only while credit is available and not blocked. Nothing is due today on it (`firstInstalment: null`), and the order adds to what is owed. Overdue over 7 days hides it, and the dashboard and credit page say why |
| Roles decide what a member sees | `can` on the company (manage members/settings, approve, finance, order) drives the nav and every action; the API refuses the rest (403 `company.forbidden`); the last admin cannot be demoted |
| Bulk reorder never adds an unchecked row (D-153) | the CSV is parsed in the browser (`parseReorderCsv`, unit-tested: header, BOM, separators, bad lines), each row is re-priced or refused by the API, and only the checked rows go to the cart, under a preview token |
| Help asks for a person only once | the guided help hand-off carries the page, the answers and the recommended styles; the LINE link carries only the ticket number. Contact, hand-off and sample kits are rate-limited, and a 429 says how long to wait |
| The guided help costs one button | only the launcher ships with each storefront page; the sheet and questions load on first click. `pnpm lhci customer-app` still meets every budget |

### Decisions taken, with reasons
- **Approval is a separate request, not a variant of placement.** A pending approval is not an order, and making `PlacedOrderDto` sometimes orderless would have blurred both. The preview token holds the price, and the approver places the orders under the requester's checkout.
- **LIFF is its own frame, `/[locale]/liff/*`, outside the storefront group.** It has a slim bar and four tabs (home, orders, points, chat), and no site header, footer or marketing tags. It reuses the site's components: stages, `OrderActions`, `ProofViewer`, `ReorderView`, `PaymentPanel` (slip upload). `OrderActions` and `PayInstalmentButton` take `surface: "liff"`, so proof, reorder and pay stay inside LIFF; everything else opens the site. LIFF pages never redirect: without a session they show `LiffSignIn`. That signs in with LINE through the LIFF SDK when a LIFF id is configured, and offers the phone sign-in otherwise (the e2e has no LIFF id).
- **Three more mock personas**: `companyadmin` (0867890123, admin and approver of B2601) and `companybuyer` (0878901234, buyer) belong to the first fake company. `founder` (0889012345) has none and signs one up. Mock tokens only allow letters in a persona name, hence no digits.
- **The guided help launcher hides where a page has its own dock or one job**: configure, cart, checkout, account, tracking, LIFF and the chat page itself. It is icon-only on a phone.
- **Spend and aging are shown as tables of the API's figures.** Charts would have meant drawing bars sized from money, which the UI does not compute.

### Contract requests raised (docs/contract-requests.md)
`store.support`, `store.guided-help`, `store.sample-kits`, `store.companies`, `store.company-members`, `store.company-branches`, `store.company-assets`, `store.company-approvals` (plus `company` on `CheckoutPreviewDto`), `store.company-credit`, `store.company-spend`, `store.company-reorder`.

### Deliberately not done
- Shared *designs* between members: designs still live in the browser (F0/F4). Shared brand assets are done.
- A credit application is recorded against the company on the storefront side only; the admin desk's `credit_limit` approval is opened by Finance there (F2 2.7), not by the customer's request.
- Branch selection at checkout: the tax invoice comes from the chosen tax profile as before; tax profiles per branch are the company's to add.
- LIFF's LINE sign-in against a real LIFF id; the SDK path is wired (`lineIdentity` → `signInWithLine`) but not exercised by the e2e.

### Open questions
- **Backend**: the eleven requests, the `company` field on the checkout preview, and whether an approval should notify the requester over the realtime channel (`company.approval_decided`).
- **Business**: should an approver's own order over the threshold skip approval (the mock lets it), or need a second approver?

---

## F3 Phase 3.6 — 2026-09-27

Tracking, delivery, receipt, claims and reorder, on `feat/f3.6-tracking` (from `1ddcc98`, 3.5 merged). packio-api has published none of this, so it is all contract requests. The mocks work over the back office's own rows: orders from commerce, claims from the logistics desk (F2 2.8). A claim the customer files is on the desk's queue, and the e2e opens it there.

### What is now enforced rather than advised
| Rule | Mechanism |
|---|---|
| The public tracking page says nothing personal | `PublicTrackingDto` carries no name, street, phone, amount or delivery photo, only the province. The e2e reads the guest's page text for the recipient and the ฿ sign. The page is `noindex` |
| Stages are the API's, promised against actual | `stages` on the order (and on the tracking page) is rendered as returned; a done stage shows its date and the promised one beside it. `ProgressTracker` (`src/ui`) says each state in words and marks the current one `aria-current="step"` |
| What a short delivery means is the API's (D-021, D-080) | the tolerance outcome and the credit are shown as returned; the credit links to the wallet |
| Confirming receipt restates what it means (D-081, D-082) | an `AlertDialog` names the order and says the 7-day claim window starts now; one `Idempotency-Key` |
| A claim cannot go without both kinds of evidence (D-082) | product photos and carton photos are separate required groups (counts from the claim form). Errors are listed at the top and at each field; the API refuses it too (`claim.evidence_missing`), and refuses anything after the window (`claim.window_closed`) |
| Liability never reaches the customer (D-083) | the store claim is a view without liability, factory or internal messages; staff appear as "ทีม Packio" |
| A reorder is placed at the price shown (D-153) | the preview's `previewToken` goes with the reorder. A stale one is refused (`409 reorder.repriced`) and the preview reloads. Reusable plates and dies come back as waived lines with the reason; the proof is skipped when the approved artwork is reused |

### Decisions taken, with reasons
- **A reorder becomes a quotation in the cart**, and "reorder and check out" goes straight to `/checkout`. Checkout stays the only place an order is placed (schedules, promotions, payment), so a reorder is not a second checkout.
- **Stages live on the order detail** (`stages`), not in a separate request: the order page is one aggregate (3.4), and the tracking page uses the same list.
- **Six stages, receipt last**: ordered → paid → artwork & proof → production → shipping (done when every destination is delivered, with "x of y" while not) → received. "Delivered" and "received" are not two stages: D-081's auto-complete makes the second one a date, not a step.
- **A fifth mock persona, `receiver`** (0845678901, the eighth fake customer), owns order 32. That order is now delivered yesterday at 970 of 1,000 (3 % short, within the D-163 default). The logistics mock builds its POD from that quantity, so the desk and the storefront agree.
- **The store's claims list reads the desk's status** once the desk has the row, so a decision in the back office shows on the order page.

### Contract requests raised (docs/contract-requests.md)
`store.tracking` (plus `stages` on `StoreOrderDetailDto`), `store.receipt`, `store.claims`, `store.reorder`.

### Deliberately not done
- Photos in claim replies: the contract takes `fileIds`, but the UI sends text only.
- The reorder quotation does not yet carry its source order (`StoreQuoteDto` has no field for it), so a mock checkout of a reorder does not reuse the artwork. This is raised in `store.reorder`.
- Scanning the carton QR in-app: `/track` takes the code or a pasted link; the QR itself opens `/track/{token}`.

### Open questions
- **Backend**: the four requests; whether tracking should be pushed (`shipment.updated` on the realtime channel) rather than cached for a minute; carrier `trackingUrl` per carrier.

---

## F3 Phase 3.5 — 2026-09-27

Artwork, proofs and hired design from the customer's side, on `feat/f3.5-artwork` (from `31683f7`, 3.4 merged). packio-api has published nothing of this for the storefront, so it is all contract requests; the mock is a view over the back office's prepress rows (F2 2.4). A file the customer submits appears in the prepress desk, a proof prepress sends appears in the viewer, and a comment is one thread both sides answer. The e2e walks that loop across the two zones.

### What is now enforced rather than advised
| Rule | Mechanism |
|---|---|
| Preflight blocks what D-070 blocks and only warns about the rest | findings are rendered by severity as the API returns them. Blocking ones (size, bleed) keep the file out, and the API offers `artwork.upload` again. Warnings (resolution, RGB) explain the risk without stopping the job |
| The rules are the settings, in words | bleed, safe margin, dpi and colour mode come from `rules`; nothing is hard-coded |
| An upload survives a flaky connection | `putWithRetry` retries each part up to 3 times with backoff, with progress per file; submission waits until every file is uploaded |
| Approval is evidence and happens once | approve stays disabled until every checklist item (from settings) is ticked. An `AlertDialog` restates the order code and version, and one `Idempotency-Key` covers the approval. The API records who approved, when, the file hash and the checklist, and the viewer reads it back |
| Commenting never requires pointing (WCAG 2.5.7) | "comment on the whole page" is always available; every pin or box is a button in the tab order and a numbered item in the thread list |
| A charged design round is never a surprise (D-071) | the API's `nextRound` says whether the round is charged and what it costs. The customer ticks acceptance of that exact fee, which the request restates as `acceptedFee` (the API refuses a mismatch). The fee becomes an instalment that must be paid before work starts |

### Decisions taken, with reasons
- **The proof arrives as page images plus a separate dieline overlay** (the API rasterises the PDF). Zoom, pan, overlay toggle, compare (side by side or slider) and pinning are then plain HTML/CSS, with no PDF.js in the bundle. The 3D view reuses the designer's CSS `BoxPreview3D` when the order has a known `@packio/dieline` style.
- **The free-round counter follows the back office**: it counts every round the API did not charge, first design included, so "round 4 is charged" and the counter agree. D-071 says "3 free revision rounds; from round 4". The admin mock and screens read "round 4" as the fourth round overall, so the customer screen matches them. The API's `nextRound` decides either way; the question is raised below.
- **The upload step hides once the artwork is approved**; the file is fixed after approval (B4.1).
- **A fourth mock persona, `artist`** (0834567890, the fourth fake commerce customer), owns an unpaid order waiting for artwork. The artwork e2e has its own order, apart from the admin prepress spec's seeded ones. Every non-returning persona now gets its own token from the auth mock.
- **The returning customer's first order is now a hired-design order three rounds in** (prepress mock plan `0`). The account's "what needs doing" list therefore shows "send the brief" / "review the design" for it, mapped in `orders/actions.ts`.

### Contract requests raised (docs/contract-requests.md)
`store.artwork`, `store.proofs`, `store.design-service`.

### Deliberately not done
- Uploading a design round's reference files in the revision request; the contract accepts `fileIds`, but the UI sends the note only.
- Multi-page proofs: the viewer shows page 1 (every mock proof has one page); the contract carries `pages[]`.
- Submitting the online designer's document as artwork (`designDocumentId`): the link opens the designer seeded with the order's box, but the hand-back comes with the designer's save-to-order flow.

### Open questions
- **Business (D-071)**: are the three free rounds three *revisions* after the first design, or three rounds including it? Screens follow the back office (including it) until answered.
- **Backend**: the three requests. Also whether annotation threads should arrive over the realtime channel (`proof.annotation_added`) rather than on reload.

---

## F3 Phase 3.4 — 2026-09-27

The customer's account, on `feat/f3.4-account` (from `e877160`, 3.3 merged). packio-api has published notification preferences and consents (B1.3) and LINE linking (a LINE sign-in made with a customer's bearer token links the identity); everything about orders, loyalty and the wallet is contract requests, mocked over the back office's own rows.

### What is now enforced rather than advised
| Rule | Mechanism |
|---|---|
| The account never re-derives the workflow | every "what to do" button is an entry of the order's `nextActions`, mapped to a destination in `orders/actions.ts`; an unknown key still renders |
| Documents are never permanent links | `DocumentLink` asks for a signed URL on click and opens it on a second, explicit click (a tab opened after an await is a blocked pop-up) |
| Order e-mail cannot be switched off (D-144) | the switch is locked on in the matrix and the API refuses it (`notification.transactional_required`) |
| A required consent is not withdrawn from the account | required purposes show as such, not as a switch; the page points to deletion instead |
| A second click cannot file a second data request | one `Idempotency-Key` per request; the API refuses a duplicate open request (`privacy.request_open`) |
| A referral never shows who a friend is | the API masks names (`ส*** ต***`) |
| Links inside running text are underlined | axe's `link-in-text-block` failed on the privacy notice link; fixed there and in the wallet |

### Decisions taken, with reasons
- **One account frame, not a guard in the layout**: `/account/designs` keeps working for a guest (designs live in the browser), so the layout only shows the sections when the session cookie exists and every page keeps its own `requireCustomer`.
- **The instalments shown on an order are its share of the group's**, with a note when the group has several orders; paying pays the group instalment, as at checkout (3.3).
- **Seeded orders get a group schedule on first use** in the mock, keeping their instalment ids, so a CS-placed order is payable from the account too.
- **Saved quotations reopen in the configurator** (`/configure/[slug]?quote=`) and are priced again live; only the customer's own quotation seeds it.
- **LINE linking reuses the published LINE sign-in with the customer's token** (`linkLine` server action), back from LINE's redirect with `?link=line`; unlinking is a contract request, refused for the last sign-in method.
- **Artwork, proof, receipt, claim and reorder actions link to their routes now** (placeholders until 3.5/3.6), rather than hiding what the API offered.

### Contract requests raised (docs/contract-requests.md)
`store.orders`, `store.loyalty`, `store.wallet`, `store.privacy`, `store.identities`.

### Deliberately not done
- Artwork upload and proofs (3.5); confirm receipt, claims and reorder (3.6).
- Order groups as their own page — the order page names its group and the instalment centre lists by group.
- Exercising LINE linking end to end: the e2e has no LIFF id, so the button is shown disabled with the reason.

### Open questions
- **Backend**: the five requests; `trackingUrl` per carrier; whether `timeline` should page (a long order has many milestones).

---

## F3 Phase 3.3 — 2026-09-27

Cart, checkout, payment schedules, payments and the instalment centre, on `feat/f3.3-checkout` (from `1f3e09d`, 3.2 merged). packio-api has published nothing of carts, checkout or payments, so all of it is contract requests, mocked; the mock creates the back office's own order rows, so a web order appears in the CS queues and a slip that fails the automatic check appears in Finance's slip review. Six commits: contract requests and mocks → mock fixes → cart/checkout/payments UI → e2e → this log.

### What is now enforced rather than advised
| Rule | Mechanism |
|---|---|
| Every checkout figure is the API's | `CheckoutView` asks `store.checkout` preview again after each change (debounced); promotions, points, schedules, methods, withholding and "pay today" are rendered as returned |
| A price never changes silently | placement carries the `previewToken`; `409 checkout.repriced` / `preview_expired` re-previews and shows the old and new totals for the customer to confirm again (e2e: another tab removes a line) |
| An expired quotation is not checked out at its old price | the cart line says what changed and blocks checkout until "ยืนยันราคาใหม่" |
| A split delivery adds up | the destinations editor shows "รวม x จาก y" and saves only when it matches; the API checks again (`cart.split_mismatch`) |
| Placing and paying happen once per intent | one `Idempotency-Key` per placement (renewed after a refusal), a derived key for its first payment, one per slip |
| The placement restates what is agreed | an `AlertDialog` with the total, what is due today and the method |
| A tax id is plausible before it is sent | `isValidThaiTaxId` (13-digit checksum), unit-tested; the API validates again |
| The QR page cannot lie about a payment | it shows the payment's status from the API, polled every 3 s until final; what the gateway puts in the return URL is not trusted |

### Decisions taken, with reasons
- **The payment schedule belongs to the order group** (one checkout), each order carrying its share of each instalment; paying a group instalment pays that share on every order in it, so the admin order screen and the customer's instalment centre agree.
- **One page, not a wizard.** Contact → delivery → tax invoice → promotions → points → schedule → method → review is one scrolling page with the summary beside it: nothing is asked twice (WCAG 3.3.7) and the price stays in view while every choice is made.
- **The cart's split is the default delivery** when any line is split; otherwise one address for everything. New addresses and tax profiles are added in a sheet without leaving the page.
- **2C2P is left and come back to**; the return page reads the payment from the API. In the mock, the redirect passes through a mock-only gateway page that approves it and meta-refreshes back (the BFF would follow a real redirect itself).
- **The QR's settlement arrives by webhook**; the page polls the payment (the realtime channel should announce `payment.updated`, noted in the request). E2E settles it through a mock-only `POST /v1/store/mock-gateway/payments/{id}/settle`.
- **A slip whose amount does not match** waits for Finance with the D-061 deadline shown; in the mock it joins the CS slip queue, and Finance's approval in the back office flows back to the customer's payment (e2e walks it).
- **Tests that own a cart sign in as their own customer**: a third mock persona, `buyer` (the second fake commerce customer), because parallel specs share the mock process and one test's add-to-cart re-priced another's checkout.

### Contract requests raised (docs/contract-requests.md)
`store.address-book`, `store.checkout`, `store.payments`, `store.instalments`.

### Bugs found and fixed
- The offline file-upload mock answered the back office only; storefront slips and RFQ files went to the contract's example S3 URL. It now serves every surface.
- Cart images used the API's own image path, which a browser cannot reach; they go through the BFF like the catalogue's.
- The mock's returning customer had 0 points, so the points step never showed; the storefront persona now holds 1,250, spent at checkout.

### Deliberately not done
- `/account/orders` and order detail (3.4) — the payment success page links there.
- B2B credit-term checkout, PO numbers required per company, approver waits (3.7).
- Card instalments (R2, D-111).

### Open questions
- **Backend**: the four requests; `payment.updated` on the realtime channel; whether withholding applies per line type (the mock uses a flat 1 %, obviously fake); the receipt per instalment as a signed URL on the instalment.
- **Finance/legal**: the wording of the abbreviated tax invoice option at checkout.

---

## F3 Phase 3.2 — 2026-09-27

The configurator, its 3D/2D preview, the instant-quote dock and requests for quotation, in the `../packio-web-f3` worktree on `feat/f3.2-configurator` (from `362c903`, F3.1 merged). packio-api has since committed B2.3 (the folding calculator, `POST /v1/store/quotes/actions/calculate`) and B2.4 (shipping rate cards); both were adopted from its **committed HEAD** only — its working tree adds shipping fields to the quote step (`shippingNetAmount`, `earliestDeliveryDate`…) that are not in this contract. Eight commits: contract → contract requests and mocks → `src/ui` → designer previews → configurator → RFQ → e2e → performance/a11y.

### What is now enforced rather than advised
| Rule | Mechanism |
|---|---|
| The live price is the API's, for exactly the configuration shown | `useLivePrice` keys the query on the calculate body itself, debounced 400 ms; TanStack aborts a superseded request (its signal is passed to `fetch`); the previous price stays, dimmed, while the next arrives |
| A size outside the pattern's rules is explained, not priced | `sizeProblems` reads the API's `ConfiguratorSizeRulesDto`; `readyToPrice` gates the request; the API re-checks (the mock answers 422) |
| The unit switch cannot change the box | `DimensionInput` holds and reports whole millimetres; cm/inch are display only (unit-tested) |
| A quantity without an instant price stays visible and says why | the price-break row keeps its place with the API's `reason`; the dock's primary action becomes "ขอใบเสนอราคา" (D-043) |
| Nothing is summed in the browser | the dock shows `productAmount`, design fees, shipping, VAT and `grossAmount` as returned; the mockup add-on and a promotion are applied on the saved quotation, and the dock says so rather than adding them |
| An RFQ is filed once per intent | one `Idempotency-Key` per attempt, renewed only after a refusal |
| Accepting an RFQ quote restates what is accepted | `AlertDialog` with the RFQ code, quantity and gross amount; idempotent |
| Visible text is part of every button's name (WCAG 2.5.3) | price-break and accept buttons carry the quantity as visually hidden text after the visible word; Lighthouse found the aria-label version |

### Decisions taken, with reasons
- **Live price from the published `store.quotes.calculate`; a quotation is kept only when the customer acts** (add to cart, save, share, PDF). The backend made calculation stateless on purpose (B2.3) and left saving to B2.5, so a debounced save per keystroke would have fought it. The dock's actions create one quotation per configuration and reuse it.
- **The configurator needs its own read** (`store.configurator`): B2.1's store product has option *codes* and free-form constraints, the calculator takes *ids*. Print is offered as presets that map to the calculator's colour lists ("4 สี" = the process colour four times, as the DTO says); `difficultyLevelId` is a fixed input the customer never sees.
- **The other six calculators send one generic configuration** (selection by group kind) on the same published endpoint, cast in one place (`configurator/pricing.ts`) — the contract types `configuration` as folding only. Requested as a `oneOf` in `store.quote-configurations`.
- **Contract bug reported**: the backend has two classes named `AssemblyDto`, and the contract kept the catalogue one, so `FoldingPartDto.assemblies` is typed as catalogue rows. The storefront sends the quote-part shape the controller validates.
- **Saving, sharing and adding to the cart need a session**; the sign-in sheet opens over the configuration and the chosen action continues afterwards. A cart belongs to a customer (checkout needs one anyway), and a guest cart would be a second cart model to merge.
- **The 3D preview is CSS 3D, not WebGL**: six faces from the same L × W × H as the dieline, rotated by drag or buttons (2.5.7). It weighs nothing against the 150/200 KB budgets and runs on the reference phone; F4 brings the folded, artwork-accurate model. Labels, tags, sleeves and pouches get original 2D drawings to the typed proportions (D-152).
- **A share link reopens the configuration** (`/configure/[slug]?share=<token>`) and re-prices it live; the shared read carries no customer and no promotion.
- **Design option → calculator**: `hired_design` and `free_design` set `design.graphic`; the design fee is the API's. `free_design` is shown only where the configurator data offers it.
- **RFQ-only products' configure URL redirects to their RFQ form**, carrying the product; any category's RFQ page asks which type when it has several.
- **Storefront RFQs are the RFQ desk's rows in the mock**, so the e2e walks submit (storefront) → start review, compose and send (admin) → accept into the cart (storefront).
- **`StatusChip` moved to `features/shared`** so a customer and a CS agent read the same status label; the admin console re-exports it.

### Contract requests raised (docs/contract-requests.md)
`store.configurator`, `store.quote-configurations` (docs + the `AssemblyDto` bug + `earliestDeliveryDate`), `store.quotes`, `store.promo-check`, `store.support-channels`, `store.rfq-forms`, `store.rfqs`, `store.cart`.

### Performance (docs/performance-budgets.md)
The configurator measures 283 KB initial JS (292 before its later steps and the dock sheet were split out), the RFQ form 272 KB, the marketing set unchanged at 254–256 KB; accessibility 1 on all of them. Both new pages join `customer-app`, whose ratchet moves 280 → 290 KB.

### Deliberately not done
- The cart page and checkout (3.3) — "add to cart" works and says so; `/cart` is still the placeholder until 3.3 in this same run.
- `/account/quotes` (3.4), which the "saved" toast links to.
- An estimated receive date in the live dock: only a saved quotation has one until packio-api commits `earliestDeliveryDate`.
- Tier-B envelopes and the six calculators' own DTOs (backend).

### Open questions
- **Backend**: the eight requests above; the duplicate `AssemblyDto`; whether a saved quotation for a guest (by e-mail) is wanted — the storefront assumes sign-in.
- **Business**: the storefront's quantity presets and the maximum number of compared quantities are the API's (`quantity.presets`, `maxTiers`); the mock uses 500–10,000 and 6.

---

## F3 Phase 3.1 — 2026-09-26

The customer zone's information architecture, catalogue and content pages, global search and the complete sign-in, in the `../packio-web-f2` worktree on `feat/f3-storefront` (from `7dd1d0d`, F2 merged). packio-api has published B2.1's public catalogue (`/v1/store/catalog/*`) and B1.3's customer auth, and nothing of quotes, carts or orders — so everything that needs a price, a lead time or an order is a contract request, mocked. Ten commits, each with lint, typecheck, unit tests and build green: contract requests and mocks → IA and the cached read → `src/ui` → home, catalogue and product pages → articles and FAQ → search → auth → performance → e2e → this log.

### What is now enforced rather than advised
| Rule | Mechanism |
|---|---|
| A cached catalogue read is never one customer's data | `catalog/api.server.ts` builds its client with no token and `requestId: null`; signed-in reads (`/me`, order lookup) go through `serverApi("customer")` / `serverRequests` and are never cached |
| A price is never shown without what it assumes (design-system §1.3) | `priceHintText` renders `basis` (quantity, VAT, delivery) with every "เริ่มต้น" figure; `null` renders "ราคาตามสเปก" |
| Structured data claims only what the API said | `productSchema` adds an `AggregateOffer` only for an API price and has no rating field; unit-tested |
| Admin-typed text cannot close a JSON-LD block | `jsonLdText` escapes every `<`; unit-tested with `</script>` |
| Stored rich text cannot inject markup or a `javascript:` link | `RichTextView` renders nodes as React elements; `safeHref` allows http(s), mailto, tel and paths |
| Consent is opt-in and every shown purpose gets an answer | `ConsentStep` starts optional purposes unticked, gates on the required ones, and records all of them; unit- and e2e-tested |
| Analytics and RUM carry route patterns, never values | `routePattern(segments, params)` maps dynamic values back to `[name]`; used by `FunnelPageView` and `WebVitals` |
| A contract request may be public only as a store read | `define.ts` `public`, `registry.test.ts`, `security: [{}, {customer}]` in the handoff document |
| Private pages stay out of the index in both languages | `robots.ts` lists each private path with its `/en` twin |
| No client component on every route imports the `@/ui` barrel | all three zones' `error.tsx`/`not-found.tsx` import by path |

### Decisions taken, with reasons
- **Caching is at the data level, not ISR.** The nonce CSP makes every page dynamic (F1.1), and `cacheComponents` would change all three zones. Public reads use `fetch` with `revalidate` + tags: catalogue 5 min, articles/FAQs 15, price hints 1. Under the mock the data cache is bypassed — Next serves a cached `fetch` through the `fetch` it captured before MSW installed itself, which reached the (absent) backend. ISR/CDN for storefront HTML is deferred.
- **`/products/[key]` serves a category, a catalogue product or a stock product**, resolved in that order (`catalog/paths.ts`, `resolve.server.ts`), because Next cannot have `/products/[category]` and `/products/[slug]` side by side. Category codes are kebab-cased in URLs (`folding_carton` → `/products/folding-carton`).
- **A category page reads each of its product types and pages the merged list here** — correct against today's API; `store.catalog-category-filter` asks for one call.
- **FAQs are matched in the browser** from the list the API returned (a selection, not a computation) until `store.search-faq-hits`; order codes are looked up only for a query shaped like one, only when signed in, and the API's 404 means "not yours".
- **Consent is asked right after the session exists**, from `GET /v1/store/me/consents` — the purposes and their texts need a customer token, so they cannot be shown before sign-in. The sheet says what the number is for and links the privacy notice before it is collected. Cookie analytics starts from the banner's choice; nothing else is pre-ticked.
- **Progressive profiling asks only when there is no e-mail**, once, skippably: name, e-mail, customer type (D-020). `store.profile` also asks for `customerType` on `StoreMeDto`.
- **LINE Login uses the LIFF SDK on the web as well as inside LINE**; the redirect returns to `/sign-in?provider=line`, which finishes the flow. `link_phone` is not used: B1.3 creates a customer for a new LINE identity, and linking belongs to the account (3.4).
- **Google/Apple keep no Firebase session**: the ID token goes to the API and Firebase is signed out.
- **The header decides signed-in from the cookie's presence** (the proxy has already refreshed), not a `/me` call per page. The bell renders only with a session.
- **Banner links are not prefetched**: their targets are admin-typed paths; the mock's `/th/promotions` did not exist and its 404 prefetch held a socket open.
- **Stock products have no category in their DTO**, so their breadcrumb stops at "สินค้า".

### Contract requests raised (docs/contract-requests.md)
`store.price-hints`, `store.product-faqs`, `store.product-categories`, `store.order-by-code`, `store.profile` (code + mock); `store.catalog-category-filter`, `store.search-faq-hits` (docs-only, the UI works without them).

### Bugs found and fixed
- **RUM sent route values, not patterns.** `useSelectedLayoutSegments()` returns a dynamic segment's *value* (Next's `getSegmentValue`), so the F1.3 comment was wrong and `/track/[token]` would have sent the tracking token. Fixed with `routePattern`.
- **`/en/account/`, `/en/cart`… were crawlable**: `robots.ts` listed Thai paths only.
- **Every page of every zone carried the whole `@/ui` library** through `error.tsx`'s barrel import.
- **The deferred header menus closed on the click that opened them** (found by the full e2e run): mounting Radix on hover let the rest of the click read as a press outside. Hover/focus now only preload.
- The contract-request handoff rendered every path parameter as a uuid (`{slug}`, `{orderCode}`, `{period}`).

### Performance (docs/performance-budgets.md)
Storefront initial JS 341 → 255–256 KB on the marketing set (now `/`, `/products`, a product, an article, `/faq`) and 256–268 KB on account/checkout (374/381 at F1.3); LCP 0.73–0.90 s, CLS 0, accessibility 1, SEO 1. Ratchets 390 → 270 KB and 400 → 280 KB. Still over 150/200 KB; the next levers are named there.

### Deliberately not done
- The legal pages (terms, privacy, cookies) stay placeholders: their text is legal content this repo must not write. The sign-in sheet links the privacy notice anyway.
- The consent preferences centre, linked LINE and notification preferences are 3.4; the cookie banner's choice is not posted to the account (a guest has no account, and a signed-in check in the banner would cost every page a request).
- Visual snapshots for the new stories (the visual suite pins a fixed list).
- A showcase page: search hits of kind `showcase_product` are not shown, having nowhere to link.

### Open questions
- **Backend**: the seven requests above; a product ↔ FAQ link in the CMS for `store.product-faqs`; consent texts readable before sign-in if the privacy team wants them on the sheet.
- **This repo**: `pnpm dev:mock` does not intercept server-side fetches under `next dev` (the admin dashboard fails the same way — pre-existing); `pnpm build && pnpm start` with `API_MOCKS=1`, which e2e and Lighthouse use, works. Needs a look at how Turbopack dev loads `instrumentation.ts` versus the request workers.
- **Legal counsel**: first-party funnel events are still not gated on consent (F1.3 note stands), and the privacy-notice wording on the sheet.

---

## F2 Deliverable 2.8 — 2026-09-26

Logistics, claims, the demand dashboard, reports, and the hardening pass that closes F2. Same
worktree and branch. Nothing of B4.3, B4.5 or B6 is published, so all of it is contract requests
(`admin-logistics.ts`, `admin-analytics.ts`); the mocks build on the commerce mock's orders.

### What is now enforced rather than advised

| Rule | Mechanism |
|---|---|
| A delivery leaving while a before-shipping instalment is unpaid (B3.2) | the shipment says so, and the mock refuses the booking (`shipment.payment_required`) |
| The tolerance outcome computed in the browser (D-021, D-080, D-165) | the POD carries the API's `ToleranceResultDto` (ordered, delivered, band, outcome, the auto-claim) |
| A claim approved with nobody liable (D-083) | the API refuses (`claim.liability_undetermined`); an override needs `claims.override_liability` and a reason, and is shown as such next to the rule's answer |
| A resolution executed twice | one idempotency key per "resolve" intent; the resolution names the document it made (CN, refund, re-production job, deduction) |
| "Last 30 days" computed in the browser | analytics take a `range` preset the API resolves in Asia/Bangkok, and return the period |
| A small group identifying a customer or factory (D-044) | the API withholds groups under its minimum and says how many; the screen and the prospectus toast repeat it |
| A chart only sighted mouse users can read | `src/ui` `Chart`: the drawing is `aria-hidden` without focusable points, the same figures are a table screen readers read and anyone can show, colours are semantic tones, legend text is body colour |
| Recharts on every admin page | `Chart` is not in the barrel and the dashboard loads it with `next/dynamic`; the `admin-lists` Lighthouse set includes `/analytics` to prove it |
| A role's menu linking to a page that fails for that role | `e2e/admin-roles.spec.ts` signs in as each of the 14 roles, checks the sidebar is exactly its entitlement (from the same catalogue the mock serves), and opens every entry |
| Initial JavaScript growing unseen | admin Lighthouse split into `admin` (shell, 365 KB), `admin-lists` (392 KB), `admin-crud` (492 KB), each pinned just above the measured figure (`docs/performance-budgets.md`) |

### Decisions taken, with reasons

- **zod does not run in the browser.** It was ~89 KB gz of every admin page (see the budget doc
  for the three doors it came through). The server validates the public variables at boot with
  the same schema; the browser only normalises them, and a unit test checks they agree.
- **Reports are one typed table per report**, columns typed by the API (money, number, percent,
  date, code) with the API's totals row; nothing is summed in the browser. Exports go through the
  existing `admin.exports` with `resource: report:<key>`.
- **Referral and credit approvals, and now claims, use existing mechanisms** — the approvals engine
  and the finance documents — rather than new decision screens.
- **The prospectus minimum group**: D-044 says k ≥ 3 factories per price breakdown, B6.1 k ≥ 5 per
  group. The screen shows whatever `minGroupSize` the API returns; the mock uses 5. Flagged in the
  contract request.

### Proposed permission changes (for packio-api's rbac.md)

- `claims.override_liability` (CS Lead) — D-083's "override by permission".
- `analytics.prospectus` (Partner Manager, C-Level) — the prospectus is a recruiting document.
- `settings.read` for Marketing (from 2.7).

### Bugs found and fixed

- Recharts' keyboard layer made points focusable inside the hidden drawing (axe
  `aria-hidden-focus`); the small order link in a shipment row failed `target-size`.
- The dashboard, lists and details carried all of zod (above).

### Deliberately not done

- Carrier webhooks and polling, label rendering, and the partner-side POD capture (F5).
- Report scheduling by e-mail and the R2 reports (calculate/search/drawing logs, D-111).
- Loading `CrudList` forms on demand — the next bundle lever (`admin-crud` still carries zod).

### Open questions

- **Backend**: B4.3, B4.5 and B6 routes and permission names; the prospectus threshold (above).
- **This repo**: `docs/decisions.md` still stops at D-169; the customer Lighthouse sets should be
  re-measured and lowered now that zod left the browser (F3).

---

## F2 Deliverable 2.7 — 2026-09-26

Marketing, B2B companies and customers. Same worktree and branch. Nothing of B3.3–B3.5 is
published yet, so every call is a contract request (`admin-marketing.ts`, `admin-companies.ts`,
and the points and consents added to `admin-customers.ts`), shaped by schema-design's
promotions, loyalty, companies and discount-memo tables. `admin.orders` gains `customerId` and
`companyId` filters.

### What is now enforced rather than advised

| Rule | Mechanism |
|---|---|
| A campaign alert threshold hard-coded in the UI (D-154) | every campaign carries `alertThresholdPct` from the API (setting `campaigns.budget_alert_pct`); the meter marks it and says it in words |
| A promotion editor writing free JSON (D-053) | conditions and benefit are typed objects with `schemaVersion: 1`; only the fields of the benefit's type are sent |
| Changing what customers already redeemed | once a promotion has redemptions, the benefit fields are disabled, and the mock refuses the change (`promotion.benefit_locked`) |
| Generating a coupon batch twice | one idempotency key per "generate" intent |
| A referral reward decided outside the approvals engine (D-136) | a held referral carries its `referral_review` approval; Marketing decides it there, and the referral follows (the mock's new `onApprovalDecided`, standing in for `approval.decided`) |
| Credit terms and limits as constants (D-121) | terms come from the setting `b2b.credit_terms`; the limit is routed by the seeded `credit_limit` policy, and the copy does not repeat its THB boundary |
| An approval with every step regardless of amount | the approvals mock now evaluates step conditions: an ฿80,000 limit waits on Finance only |
| An edit of a campaign, promotion or company overwriting another's | `RequestClient.read` returns the ETag; every change goes under `If-Match` |
| A form showing the schema's code ("required") | `FormField` takes `formatError`; `FormFields` reads the codes from `console.validation` (this also fixes the 2.5/2.6 forms) |

### Decisions taken, with reasons

- **Loyalty and referral rules are settings, not a new API.** The backend seeds them
  (`loyalty.*`, `referral.rules`, `campaigns.budget_alert_pct`), so the page writes new versions
  through the published settings endpoint, field by field, keeping each field's type. Only the
  setting's owner (Superadmin, `settings.change`) sees "new version".
- **Customers are read-only here.** Profiles and consents belong to the customer; staff read them.
  Points adjustments are not offered (they would need a policy and an approval).
- **The company's own settings are shown, not edited**: the approval threshold (D-123) and PO
  policy (D-125) are set by the company admin.
- **The form dialog and section card moved to the console**, now that three features use them.
- **Discount memos**: the list from 2.2 is unchanged; a company's discount links to its memo.

### Proposed permission changes (for packio-api's rbac.md)

- `settings.read` for **Marketing**: the loyalty and referral rules are Marketing's to reason about,
  but the backend's matrix does not give Marketing `settings.read`, so the loyalty page is hidden
  from them. Followed as is; proposed.
- B3 has no permission keys yet; the mocks use `marketing.read|manage`, `customers.read`,
  `companies.read|manage` from the web's menu catalogue.

### Bugs found and fixed

- Zod messages were shown as their codes in every CRUD form (above).
- Rewriting the console messages "fresh" dropped keys added outside its source; restored from git
  and merged. Shared namespaces are now always merged.
- `PartnersNav` hid coverage behind `catalog.read` although the published endpoint needs
  `partners.read`.

### Deliberately not done

- Payment-method and province conditions have fields in the request but no editor controls yet
  (sent empty = any); the per-piece price override benefit (D-053) is not offered.
- Evidence files on a credit-limit request (`evidenceFileIds` is sent empty); coupon batch
  export (goes through `admin.exports` once that lands).
- Promotion usage logs and reports: 2.8 (promotion usage report).

### Open questions

- **Backend**: B3.3–B3.5 route and permission names; the requests follow schema-design and
  api-conventions and should adopt with renames at most.
- **This repo**: `docs/decisions.md` still stops at D-169.

---

## F2 Deliverable 2.6 — 2026-09-26

Partners and price governance, and the production floor (the board, QC, scorecards). Same
worktree and branch. The factory resources are on the **published** B2.2 contract; what B2.2 has
not published yet — suggestions, simulations, index series, coverage, the board, inspections,
scorecards — is written as contract requests that follow the backend's work-in-progress routes
(`src/lib/api/requests/admin-partners.ts`), so adopting them should rename nothing.

### What is now enforced rather than advised

| Rule | Mechanism |
|---|---|
| A factory edit or status change overwriting a colleague's | the workspace reads the factory's `ETag` right before `PATCH` and every status action, and sends `If-Match`; the mock answers `428`/`412` as the contract does |
| A factory-specific tolerance or payout policy applying before a Superadmin approves it (D-173) | those dialogs say "send for approval"; the version comes back `proposed` with its approval link, and stays in the version table as scheduled until approved |
| A bank account changed without the D-033 call-back | a proposed account is `pending approval` with its approval link; recording the call needs `vendor_bank_accounts.verify` (Finance), and the call-back form says to call a number on file |
| Activating a factory without a passed site visit (D-041) | the visits tab warns while none has passed; the API's `409` is shown if activation is still requested |
| Destructive status changes (suspend, offboard) | a reason plus the factory code retyped |
| Cost and suggestions shown to roles that may not see them (D-141, D-044) | price-list lines load only with `factory_cost.read`, suggestions and simulations only with `price_suggestions.read`; otherwise the page says the role does not see them |
| An inspection judged in the browser | the dialog sends the defects found; pass or fail is the API's answer (the mock applies the ISO 2859-1 accept numbers), recorded under an idempotency key |

### Decisions taken, with reasons

- **One workspace with tabs per factory**, not a page per sub-resource: onboarding, documents,
  terms and prices are read together when deciding on a factory. The tab is in `?tab=` so a link
  (a queue, the scorecard) opens the right one.
- **Versioned terms share one table** (`VersionTable`): the version in force and those scheduled,
  from when, why, and the approval a proposed one waits on (D-063, D-173).
- **Line values render as `column value` pairs.** The price-component registry names the columns
  but not their meaning; catalogue references show their last six characters, the full id on
  hover. Components themselves get th/en names (all 40 of the enum).
- **Product types render by name** everywhere in partners (`useProductTypes().labelOf`), falling
  back to the code for a role without `catalog.read`.
- **The production board's columns come from the API** (`step_1…6` with their names); the mock's
  follow the one route the commerce mock's jobs use.
- **Menu**: `partners` and `production` entries are gated on `partners.read` and
  `production.read`; `partners.read` is added for admin, Finance, the Finance manager and the
  auditor, as the backend's B2.2 role map has it.

### Bugs found and fixed

- A meter inside `PageHeader`'s description put a block inside a `<p>` → hydration error #418.
  The description is text only; the meter sits under the header. (A `PageHeader` description must
  never hold a block element.)
- The production-board mock crashed on a released job with no milestones yet (made by another
  test's manual production start); such a job now waits at the first step.
- The rich-text editor's toolbar took focus from the text on pointer press, so typing straight
  after choosing a heading could be lost (a flaky 2.5 test); the toolbar now keeps the caret.

### Deliberately not done

- Editing machines, capacity versions and agreements beyond what onboarding needs; the owner
  invitation creates the account only (no resend or reset), as B2.2 publishes.
- A proposal line editor that knows each column's reference table: values are typed as the
  registry's column types, as a pricing specialist would enter them.
- Charts on the index series (Recharts arrives with 2.8's analytics).

### Open questions

- **Backend**: publish the board, inspection and scorecard routes (B4.2), and give
  `PriceSimulationDto.result` a named schema (`admin.price-simulation-result`).
- **Adopted after the slice** (2880e4e): the backend published suggestions, simulations, index
  series and coverage the same day. The first three matched the requests; coverage came out as
  `GET /v1/admin/partners/coverage` with a `QuotePathReason` per type, and the page follows it.
  The simulation window is the setting `partners.impact_simulation_window_days`, so the card
  shows its dates instead of "90 days". The new public `POST /v1/store/catalog/quote-path` is
  for the F3 configurator.
- **This repo**: `docs/decisions.md` still stops at D-169; D-170–D-173 (from packio-api) are
  cited in 2.5 and 2.6 copy. Sync it.

---

## F2 Deliverable 2.5 — 2026-09-26

Catalogue and CMS. Same worktree and branch. Unlike 2.2–2.4 this deliverable runs on endpoints
packio-api has **published** (B2.1, adopted in 2.3), so there are no contract requests: every
call is the contract's, and the mocks stand in for it.

### What is now enforced rather than advised

| Rule | Mechanism |
|---|---|
| A catalogue screen inventing a field the API does not have | `define<RowDto, CreateDto, UpdateDto>()` in `catalogue/tables.ts` type-checks every column against the row DTO and every form field against the create DTO; fields missing from the update DTO are sent on create only |
| A label missing for a field, table or enum value (looked up by template key, which the keys gate checks by prefix only) | `catalogue/tables.test.ts` walks the registry against both locales' messages |
| An edit silently overwriting a colleague's | every update reads the row's `ETag` and `PATCH`es under `If-Match`; the mock answers `428` without it and `412` when stale, as the contract does |
| `""` sent where the contract means "none" | the form model sends `null` for cleared optional text, references and nullable enums, omits empty non-nullable enums and numbers, and sends date-times with the Bangkok offset (unit-tested) |
| Deleting catalogue rows | rows archive through `status`; only the tables the contract gives a `DELETE` (banners, sections, articles, FAQs, videos) show one |
| An import applied other than as previewed | confirm sends the preview's `previewSha256` with one idempotency key per preview; a workbook with invalid rows has no confirm button, and the mock refuses a mismatched hash (`409`) |
| Switching a type to instant before its calculator ships (D-100) | quote mode is its own action with a reason and the code retyped; the API's `409` is shown as is |
| Mock rows drifting from the contract | `pnpm gen:api` now also writes `mocks/generated/examples.ts` (each list endpoint's example rows), under the same drift gate; the table mocks seed from it |

### Decisions taken, with reasons

- **One table engine, not forty screens.** A.2.1 counts about sixty legacy CRUD screens; B2.1
  publishes ~40 tables with the same operations. The registry calls the contract client with
  the path as data (`catalogue/api.ts`), typed at the registry instead of at each call.
- **The editor is a `src/ui` primitive, loaded on demand.** `RichTextEditor` takes its labels as
  props and is not in the `src/ui` barrel, so TipTap never reaches the storefront's bundle; the
  article page imports it with `next/dynamic`.
- **Articles get a page, not a side sheet** — a long rich-text body does not fit one — and
  categories are saved as the contract's separate replaceable list, under the article's new ETag.
- **References render as names** (a material's family, a finish's group) from one page of up to
  100 rows per referenced table; a reference outside that page still renders, as its id.
- **Catalogue and CMS images upload with purpose `document`.** The contract's `FilePurpose` has
  no image/content purpose (see open questions).
- **The mock's seven calculator types remain `instant`** (2.3's assumption), so the quote-mode
  refusal is demonstrated on the RFQ-only categories.

### Deliberately not done

- Catalogue-product images and options (`…/catalog-products/{id}/images`, `…/options`,
  `…/patterns`), stock-product images and attributes, pattern flute types: sub-resources with
  their own shapes, left for the screen that needs them (the product detail in F3's preview work,
  or a 2.8 follow-up). The rows themselves are editable here.
- An imageset manager (A.2.4) and drag-to-sort; sort is a number, and home sections have
  move up/down, as A.2.4 asks.
- The 2.1 generic `ImportWizard` (`admin.imports` contract request) is now unused: the backend
  chose per-module import endpoints, starting with the catalogue's.

### Open questions

- **Backend**: `FilePurpose` needs a purpose for CMS and catalogue images and design fonts
  (`content`?); `document` is used meanwhile.
- **Backend**: retire or keep the generic `admin.imports` / `admin.exports` requests, now that
  the catalogue has its own import and export?
- **This repo**: `docs/decisions.md` stops at D-169; packio-api's copy has D-170–D-173 (geography
  entry, factory entry, suggestion band, override approvals), which 2.5 and 2.6 rely on. Sync it.

---

## F2 Deliverable 2.4 — 2026-09-25

Prepress and design services. Same worktree and branch. packio-api has not built B4.1, so the
endpoints are contract requests shaped by schema-design §3.7; the mock hangs prepress state off
the commerce mock's own orders, so `/orders/{id}` and `/prepress/{id}` describe one order.

### What is now enforced rather than advised

| Rule | Mechanism |
|---|---|
| A file with a blocking preflight finding going to proof (D-070) | the submission's own `nextActions` carry `submission.accept` with a `disabledReason`; the button is disabled with the reason shown, and the mock answers `409 preflight.blocking_findings` if forced |
| Warnings accepted silently | accepting a submission with warnings requires a note, kept with the review |
| A proof sent twice on a retry | proof upload is idempotent, one key per opening of the dialog; the files go through the published presign flow (purpose `proof`) first |
| The UI deciding what a paid design round costs (D-071) | rounds carry `chargeable` and `feeAmount`, and `nextRound` says what the next one would cost — the API's figures; the UI states them |
| A drawing engine that is not deployed looking like a bug | `POST …/drawing-jobs` answers `501 drawing.engine_unavailable` (as B4.1 specifies until `@packio/dieline` ships server-side) and the screen shows that message and offers sending a template file instead |
| Editing the customer's design from the back office | the design is shown read-only; prepress works on a copy (`admin.design-documents`), never the customer's document |

### Decisions taken, with reasons

- **A read-only viewer, not the editor.** The designer's `Editor` keeps designs in `localStorage`,
  uses the storefront's locale routing and loads the customer-zone `designer` messages; mounting
  it in the admin zone would mean rewiring all three, which is F4 Part B's job (designs move to
  the API). The new `DesignViewer` lives in `src/features/designer` (shared) and draws the same
  geometry from `@packio/dieline` in the same millimetre coordinates as the canvas, as SVG.
  **Deferred:** opening a working copy in the designer from the back office, until F4 Part B.
- **Annotations without a PDF renderer.** The page map places each thread's pin or area by its
  page-relative geometry over a blank page, beside the threads. Rendering the proof PDF itself is
  the customer proof viewer's job (F3), which this can adopt later.
- **The SLA per stage comes from the API.** Preflight, proof, template and design have their own
  deadlines; a proof with the customer is shown as "with the customer" and never tints the row,
  because it is not prepress's time.
- **Routine and exceptional actions never lead.** The mock orders the stage's own work first,
  then assign and draw, and re-quote (destructive) last; the UI keeps the API's order.
- **`AssignDialog` is shared** by the RFQ desk and prepress, offering only people who hold the
  permission (`staff-directory?permission=`).

### Deliberately not done

- Proof decisions recorded by CS on the customer's behalf (`decision_channel = cs_on_behalf`):
  the schema supports it, but it is a CS action on the order screen, not prepress's.
- Version compare between proof versions (D-110): listed per version; a side-by-side compare
  needs the PDF renderer above.

### Open questions

- **Backend**: `admin.prepress`, `admin.prepress-actions`, `admin.prepress-proofs`,
  `admin.prepress-template`, `admin.design-services`, `admin.design-documents`.
- **Backend**: which setting holds each prepress stage's SLA, and whether a proof with the
  customer has one (assumed not).
- **Backend**: does a design round wait for the customer's payment before `in_progress`
  automatically (assumed yes, D-071 "pays before the extra round starts")?

---

## F2 Deliverable 2.3 — 2026-09-25

The RFQ workspace (D-100). Same worktree and branch. The endpoints are packio-api's B2.5, not built
yet, so they are contract requests shaped by schema-design §3.5; the product types they refer to
come from B2.1's **published** catalogue, adopted at the start of this deliverable.

### What is now enforced rather than advised

| Rule | Mechanism |
|---|---|
| CS pricing an RFQ from the factory's cost (D-141) | a consultation response carries `suggestedUnitPrice` (sell, from the sell-margin table); `buyUnitPrice` is optional and the mock leaves it out unless the actor holds `factory_cost.read` — e2e checks both sides |
| The browser computing a quote's money | the composer copies the API's suggested price as text and checks only its shape (`^\d+(\.\d{1,6})?$`); net, VAT, total, margin and the margin-floor flag appear only after the API has priced the saved draft |
| A quote sent below the margin floor | the API blocks `rfq.send_quote` with a `disabledReason`; the header and the quotes tab say why |
| Asking a factory that cannot make the category | candidate factories carry `capable` and a reason from the API (D-043); an incapable one is shown disabled, and the mock answers `422 rfq.factory_not_capable` if forced |
| A decline that analytics cannot group | decline needs a code from `GET /v1/admin/unmet-demand-reasons` (D-102) and the RFQ code retyped |
| An accepted RFQ leaving the order pipeline | acceptance creates a quotation (`source = rfq`) and "create order" opens CS create-order on it — the same path as an instant quote |
| Two action bars drifting apart | `NextActionBar` in the console renders `nextActions` for orders and RFQs alike |

### Decisions taken, with reasons

- **Adopted packio-api's committed B2.1 contract, not its working tree.** The backend checkout
  holds uncommitted B2.2 factory endpoints that are still changing; adopting them would pin this
  app to a contract that may never be published. Adoption came first because the RFQ category
  filter and the RFQ's product type both come from `GET /v1/admin/catalog/product-types`.
- **The spec arrives rendered** (`spec: [{ label, value }]`), rendered by the API from the
  category's `rfqSpecSchema` at the RFQ's schema version. The UI does not interpret JSON Schema;
  an old RFQ keeps the labels it was submitted with.
- **SLA: the API computes the deadline, the UI shows the target.** Rows carry the category's
  target in business hours and `slaDueAt`; the timer stops at `firstResponseAt`, and a
  customer-visible message, a request for information or a sent quote all count as a first
  response — **assumed**, to confirm with B2.5.
- **One draft per RFQ.** Composing is disabled while a draft exists (`edit_quote` instead);
  sending supersedes the previously sent version. Simpler to reason about than parallel drafts,
  and it matches `rfq_quotes.version_no`.
- **CS records acceptance** by phone or LINE with a note, because legacy CS work happens there;
  the customer-side acceptance is F3's.
- **`catalog.read` follows the backend now that it is defined** (packio-api `docs/rbac.md`,
  B2.1): CS, CS Lead, Prepress, Marketing and Partner Manager gain it, executives lose it. The
  product-type filter is omitted for a role without it, rather than failing.
- **The staff directory takes `permission=`**, so "assign" offers only people who can take an
  RFQ instead of everyone and a 422.

### Deliberately not done

- Attaching files to thread messages (the request accepts `fileIds`; the upload control waits for
  2.4, which builds the proof-upload flow).
- Customer-facing RFQ screens and the customer's own acceptance: F3.
- The partner side of a consultation (answering with buy prices): F5.

### Open questions

- **Backend**: `admin.rfqs`, `admin.rfq-messages`, `admin.rfq-actions`, `admin.unmet-demand-reasons`,
  `admin.rfq-consultations`, `admin.rfq-quotes`, plus the `source`/`rfq` fields on
  `admin.quotations` and `permission=` on `admin.staff-directory`.
- **Backend**: what counts as the first response for the RFQ SLA (assumed above), and whether the
  SLA setting is per product type or per reporting category.
- **Backend**: should declining a quoted RFQ supersede its sent version (the mock does)?

---

## F2 Deliverable 2.2 — 2026-09-25

Orders and the CS desk. Same worktree and branch as 2.1. None of 2.2's endpoints exist in
packio-api yet (its B3 is next on its side), so every screen runs on contract requests shaped by
the approved schema design (§3.6 commerce, §3.7 fulfilment, §4 enums, §2.9 amounts as strings).

### What is now enforced rather than advised

| Rule | Mechanism |
|---|---|
| A message key that does not exist, rendered as its own path | `src/i18n/keys-used.test.ts` resolves every literal key and every template key's prefix used in `src/app` and `src/features` |
| A server page importing a constant or a resource definition from a `"use client"` module (compiles, fails at request time in production) | `src/app/server-imports.test.ts` — pages and layouts may import only components from client modules, following barrels one level |
| The UI hard-coding the direct-discount limit (D-052) | the calculator input data carries `discountPolicy.directLimitPct`; above it the only path is a discount memo |
| The UI comparing money to find the best price | calculation results come flagged `cheapest` / `fastest` by the API |
| Margin or the factory shown to a role not allowed to see it (D-141) | optional in the schema, absent from the mock unless the actor holds `margin.read`; the UI renders the field only when present |
| A slip action offered to CS | `nextActions` is per actor; slip review is Finance's (finance, finance_manager, superadmin) |

### Bugs this session found and fixed

1. **The settings editor's success toast rendered a raw key path** (`settings.saved` instead of
   `settings.change.saved`), found by the new keys gate's first run.
2. **Two server pages crashed in the production build only** ("includes is not a function"):
   `ORDER_TABS` and `CALCULATORS` were imported from client modules and arrived as client
   references. They now live in plain modules (`orders/tabs.ts`, `cs/calculators.ts`), and the
   imports gate above catches the next one.
3. **`text-warning` was used for text and icons** in six places; it is a fill colour and fails
   contrast on white. Warning text is `text-warning-subtle-fg`.
4. **A `1fr` column beside a fixed rail could not shrink below its table**, so the order screen's
   rail spilled past the viewport. Every such grid in admin code is `minmax(0,1fr)` now.

### Decisions taken, with reasons

- **One page-shaped order aggregate** (`GET /v1/admin/orders/{orderId}`) carrying every tab,
  rather than an endpoint per tab: the header restates statuses from all of them, and CS moves
  between tabs constantly. The timeline and notes are separate because they page and change.
- **One typed input per calculator** (a discriminated union on `calculator`, corrugate's combined
  parts included) rather than a bag of keys, so a missing field is a 422 with a path, not a price.
- **The calculator mock is illustrative, not the ported legacy maths.** The formulas belong to the
  backend (B2.3, with golden tests against legacy); the UI only renders what comes back.
- **The order tab lives in the URL without a server round trip** (local state plus
  `history.replaceState`): a server navigation would refetch the aggregate on every tab change.
- **Every irreversible order action needs the order code retyped**, restates the amount and sends
  one idempotency key per intent. Manual production start (D-073) and cancellation also need a
  reason.
- **Mentions are notified only while the name is still in the note**: deleting "@name" before
  sending un-mentions them.
- **CS create-order starts from a saved quotation**, so the price locked for 15 days (D-051) is the
  one ordered. The form keeps one idempotency key for its whole life.

### Deliberately not done

- Editing a placed order's lines or prices: not in 2.2's scope, and D-051's price lock makes it an
  approval flow of its own.
- The label calculator stays behind its feature flag, as legacy's `DISPLAY_MENU_LABEL` was.

### Open questions

- **Backend**: `admin.orders`, `admin.order-notes`, `admin.order-actions`, `admin.customers`,
  `admin.geo`, `admin.cs-calculators`, `admin.quotations`, `admin.discount-memos`,
  `admin.cs-create-order` (all in `docs/contract-requests.md` and the OpenAPI handoff document).
- **Backend**: is the queue's SLA deadline computed server-side on the business calendar
  (D-161), as assumed? The UI only renders `slaDueAt`.

---

## F2 Deliverable 2.1 — 2026-09-25

The back-office foundation. Worked in its own git worktree (`../packio-web-f2`, branch
`feat/f2-admin`), because two other sessions were editing the shared checkout — the master plan
says F2–F6 run in separate worktrees for exactly that reason.

### What is now enforced rather than advised

| Rule | Mechanism |
|---|---|
| A response type written by hand for an endpoint that does not exist | every contract request is a zod definition in `src/lib/api/requests`; `requests.call(key, …)` is typed by it |
| A mock that drifts from what the backend was asked for | `mockRequest` validates every response against the request's schema (`500 mock.drift`), and a test drives every requested GET through MSW |
| A contract request nobody retires after the backend ships it | `registry.test.ts` fails as soon as its method and path are in `contract/openapi.json` |
| A request the backend was never told about | the same test fails when an entry has no row in `docs/contract-requests.md`; `pnpm gen:api` renders the registry as `docs/contract-requests.openapi.json` under the drift gate |
| An irreversible request sent without the caller's idempotency key | `CallInit` makes `idempotencyKey` a required property for `idempotent: true` entries (asserted with `@ts-expect-error`) |
| A status the backend adds without presentation | seven maps typed on `Schemas[…]`; the other 37 copied verbatim from the approved schema design, one line to repoint each |
| A page's own URL parameters reaching the API as filters | lists declare `filterKeys`; `mergeIntoUrl` keeps everything that is not the list's |
| A grant certain to be refused | SoD role pairs (`admin.sod-rules`) and the anti-escalation rule (`RoleDto.permissions` vs the grantor's) are shown and block submit before the API's 409/403 |
| A consequential action with no restated target or a fresh key per retry | `ConfirmAction`: restatement, optional typed phrase and reason, one key per opening, dialog stays open on failure |
| An e2e click that lands before hydration | `<html data-hydrated>` from `HydrationMark`; `signInAsStaff` and `gotoHydrated` wait for it |

### Bugs this session found and fixed

1. **Every Web Vitals beacon and every funnel event was a 403** (F1 1.3). `sendBeacon` cannot set
   a header and the BFF required `x-packio-csrf` on every POST, so field RUM and the D-102 funnel
   never reached the API. The two beacon endpoints are exempt from the header only; the `Origin`
   check still applies.
2. **The realtime client could not have received anything.** The published stream sends named
   SSE events, which `EventSource`'s `message` listener never sees, and authorises with a
   60-second token `EventSource` would keep resending after it expired. Replaced with a `fetch`
   reader: every frame, a fresh token per connection, jittered backoff, a refetch after gaps.
3. **The command palette's listbox held a `<p>` and role-less `<li>`s** once it had grouped
   results (critical `aria-required-children`) — F1's palette was always empty, so nothing had
   tested it. Groups are `role="group"` now.
4. **`/approvals?tab=all` sent `tab=all` to the API**, and changing a filter would have dropped
   the tab. See `filterKeys` above.
5. **`text-subtle` was used for real text** in the sidebar, the palette and the bell (contrast).
6. **A wide or long table scrolled where no keyboard could reach** (`scrollable-region-focusable`).
7. **Avatar initials took a parenthetical for a name** ("ผ(" for "ผู้อำนวยการ ตัวอย่าง (ข้อมูลจำลอง)").

### Decisions taken, with reasons

- **Adopted packio-api's newer B1.3 contract** (`pnpm gen:api --adopt`, still versioned 0.1.0 on
  its `feat/b1.3-platform` branch). 2.1 is mostly screens for endpoints that contract publishes,
  and building them against mocks while the real shapes existed would have meant writing them
  twice. The lock's `source` still names the v0.1.0 release asset — **re-pin when packio-api tags
  a release with this document.**
- **The status vocabularies follow the backend's approved schema design (§4)**, replacing the
  seven F1 had to propose. The design was approved on 2026-09-23 and says each enum becomes a named
  OpenAPI component; copying it now means the day the components ship is a one-line change per
  map. Other branches that render statuses (F3–F6) will see the new values when they merge.
- **Contract requests are zod, not hand-written interfaces.** At F2's scale a per-call-site
  interface is a hundred and fifty places to drift. One definition typing the call, checking the
  mock and generating the handoff document is the same rule — nothing invented silently — made
  mechanical.
- **Mock reference data is the backend's own seed**, copied into `mocks/admin/fixtures` (settings,
  approval policies, SoD rules, roles, permissions) rather than imported: CI has no sibling
  checkout. The admin menu mirrors packio-api's `menu.catalog.ts` verbatim, which is how feature
  flags, notification templates/routes and the outbox entered 2.1's scope.
- **A staff directory is a contract request**, not a use of `GET /v1/admin/users`: that needs
  `users.read`, which a Director delegating an approval does not hold.
- **Money typed into a setting is normalised as text** (`"20000"` → `"20000.00"`) and never passes
  through a float; percentages stay decimal strings, as the contract sends them.
- **The SLA timer invents no "at risk" threshold.** It renders the distance to a deadline the API
  computed, and trusts an API-sent state when there is one; a threshold would be a business rule.
- **Verification runs on a production build.** In `pnpm dev:mock`, MSW intermittently stops
  intercepting — it looks like Next's own `fetch` patch capturing the unpatched `fetch` depending
  on start-up order. The e2e suite already builds for production, for its own reasons.

### Deliberately not done

- No bespoke DatePicker: date and time fields are native `date` / `datetime-local` inputs, labelled
  as Bangkok time. A Buddhist-era calendar picker waits for a screen whose users need one.
- Role grants pick a factory or company scope through `admin.search`; a dedicated picker comes
  with the partner and company screens (2.6, 2.7).
- Creating notification routes and templates from scratch: the backend seeds the D-143 matrix
  (B4.6), and 2.1 edits, previews, test-sends and publishes what exists.
- The sidebar lists every entry the API sends, so a persona sees F2.2–2.8 screens that answer 404
  until those deliverables land.

### Open questions

- **Backend**: `admin.saved-views`, `admin.search`, `admin.dashboard`, `admin.sod-rules`,
  `admin.staff-directory`, `admin.imports`, `admin.exports`, `admin.menu-entries`,
  `admin.permissions`, and `notifications.unread-and-link` (the rest of `notifications.feed`).
- **Backend**: re-publish the contract under a release tag so `contract.lock.json` can point at it.

---

## F1 Deliverable 1.3 — 2026-09-24

The last layer of the foundation. Nine commits, each with lint, typecheck, unit tests and
build green: status domain → i18n → shells → observability → SEO → realtime & push →
analytics → quality gates → docs.

### What is now enforced rather than advised

| Rule | Mechanism |
|---|---|
| A status rendered from colour alone | `StatusMeta` requires a tone, an icon *and* a label key; a test asserts all three on all 60 entries |
| A status label that drifts between zones | one `status` namespace, shared like `auth`; a test resolves every `labelKey` in both locales |
| Two statuses in one domain reading identically | a test comparing the Thai labels per map |
| A status the backend adds without presentation | `defineStatusMap<T>()` against the union in `status/contract.ts` — one file to repoint at `Schemas[...]` |
| UI copy hard-coded in JSX | `react/jsx-no-literals` on `src/app`, `src/features` and `src/ui`, plus `no-restricted-syntax` for `aria-label`, `alt`, `title`, `placeholder`; both proven by a fixture suite |
| A malformed ICU message, or a plural with no `other` branch | two new gates in `messages.test.ts`, both verified to fail on a broken message |
| The admin sidebar showing a screen this user may not open | it is built from `AdminMeDto.menu` and nothing else; an e2e test asserts exactly the two entries the mock returns |
| A storefront link that 404s | an e2e test fetches every `href` in the header, footer and nav |
| A canonical claiming every page is the home page | built from `x-packio-path`; an e2e test asserts each locale is canonical to itself |
| `robots.txt` or `sitemap.xml` answering on a `noindex` zone | matched in `src/proxy.ts` before next-intl, gated on `ZONE_CONFIG[zone].indexable`; unit and e2e |
| A sitemap entry that does not exist | an e2e test fetches every `<loc>` |
| Business data in a realtime payload | `parseEvent` keeps three known string fields and drops everything else |
| A notification permission prompt on page load | `usePushSubscription` exposes `enable` and no effect; `mayPrompt` refuses without a meaningful action; an e2e test patches `Notification.requestPermission` and asserts it is never called |
| A service worker quietly caching stale prices or job states | it has no `fetch` handler; an e2e test asserts the absence |
| A misspelt funnel step | `FunnelEvent` is a closed union |
| Personal data in an analytics property | `AnalyticsProperties` is a narrow interface, not `Record<string, unknown>` |
| A Google request before consent | GTM is not rendered at all until the cookie says yes; an e2e test watches the network, with a container id configured so it cannot pass vacuously |
| Initial JS growing further | a Lighthouse ratchet per URL set, pinned above today's figure |

### Bugs this session found and fixed

All eight came from running the thing, not from reading it.

1. **`TooltipProvider` was never in `ZoneProviders`.** Storybook had one in its own decorator,
   so every tooltip story worked — while the first tooltip rendered in the real app, in the
   collapsed admin sidebar, threw and took the whole sidebar down with it.
2. **The notification bell wrapped its trigger in a `<span>`**, so Radix put `aria-expanded` on
   a generic element: a critical `aria-allowed-attr` failure. The button is the trigger now and
   the badge is a sibling.
3. **`DropdownMenu` rendered mutually-exclusive choices as `menuitemcheckbox`** although its own
   doc comment said radio. Theme and language are single-select; a screen reader now hears
   "selected, 2 of 4".
4. **Links to pages F3 has not built did not merely 404.** Next's 404 response to an RSC
   *prefetch* carries no `content-length`, so the browser held each socket open until keep-alive
   expired — `networkidle` became unreachable and a real visitor would have paid for it. The 17
   destinations the shell links to now have real pages.
5. **`account/designs` rendered its own header, footer and `<main id="main">`**, which the new
   storefront layout also provides: two main landmarks and an ambiguous skip link.
6. **Every storefront page claimed the site root as its canonical.** Metadata set in a layout is
   inherited by every page under it, and a layout's `generateMetadata` is not given the
   pathname — so the first version told crawlers the whole site was one page, which is worse
   than no canonical. It reads `x-packio-path` now.
7. **Three of the four new browser→BFF calls were silently 404ing in admin and partner.**
   `ZONE_CONFIG[zone].bffPath` is the *internal* route segment (`/admin/bff`); a browser on the
   admin host asks for `/bff/...` and the proxy adds the prefix. They share `browserBffUrl` now,
   tested against `isUpstreamPathAllowed`.
8. **Consent looked like it worked and did not.** Accepting called `router.refresh()`, but React
   does not execute a `<script>` that arrives during a client-side update — only one present in
   the initial HTML. The DOM looked right and the container never ran. Caught by asserting on
   `dataLayer` rather than on the markup.

And three the *tests* had, each found by deliberately breaking something and watching the test
pass anyway: `http-server`'s default hour of `max-age` served the previous Storybook build; a
`fullPage` screenshot hid three avatars changing colour inside a 1% tolerance; and a Playwright
project registered conditionally exists in the main process but not in the worker.

### The performance budgets are breached, on every route type

Measured 2026-09-24 on a production build with **no** Sentry DSN and no GTM container — the
floor, not the ceiling:

| URL set | Target | Measured | Over |
|---|---|---|---|
| `customer-marketing` | 150 KB | 374 KB | 2.5× |
| `customer-app` | 200 KB | 381 KB | 1.9× |
| `admin` | 250 KB | 363 KB | 1.5× |
| `designer` | 350 KB | 518 KB | 1.5× |
| `partner` | 180 KB | 361 KB | 2.0× |

React 73 KB, Radix ~85 KB across six chunks, next-intl ~29, Lucide 19, app code ~52. Not
Sentry, and not the designer: `/` and a bare placeholder page load the same bundle, so it is
the shared shell. The single largest lever is the storefront header mounting `DropdownMenu`,
`Popover` and `Tooltip` on every page — deferring those three to interaction is worth roughly
half the gap and belongs to F3's storefront-performance work.

The Lighthouse assertions are **ratchets** pinned just above the current figures rather than at
the targets: a gate that is red forever is a gate people learn to ignore, and one that has been
quietly relaxed to green is worse. The documented budgets are unchanged.

### Decisions taken, with reasons

- **All eleven status maps ship now, with their provenance recorded per file.** The contract
  carries no domain enums (B1.3 is auth only) and the decision log has no status tables, so
  order, payment and artwork come from the legacy enumerations (§5.2, admitted by D-005) and
  `document` from `accounting-design.md`; the other seven are marked proposals assembled from
  the F2/F5/F6 vocabulary. They are a request to the backend, logged as `status.enums`, not a
  claim about the contract. Confirmed with the user, who chose this over deferring them.
- **Sentry's browser SDK is 152.7 KB gz, not the ~40 KB estimated when it was scoped.** That was
  measured and put back to the user with the option of restricting it to admin and partner,
  which the zone check makes a one-line change; they chose all three zones. It loads as a
  separate chunk after hydration and is absent entirely from builds with no
  `NEXT_PUBLIC_SENTRY_DSN` — a static import cost 133 KB whether or not a DSN was set, because
  skipping `init()` does not remove the module from the graph.
- **GTM is not loaded until consent, contrary to Google's own guidance.** Consent Mode is
  designed to let the container load and restrict the tags inside it, but fetching
  `googletagmanager.com` is itself a request to Google carrying the visitor's IP, before they
  have agreed to a third-party processor. The e2e test asserting otherwise failed, which is how
  this was decided rather than assumed.
- **First-party funnel events are not gated on cookie consent**, on the reading that they are
  necessary to operate the service, carry no advertising identifier and never leave Packio.
  **This needs legal counsel to confirm before launch** — recorded here rather than assumed
  silently.
- **SSE rather than a websocket or Pusher**, because traffic is one-way, it reconnects itself,
  and it rides the existing BFF — the same cookie and the same allow-list, with no second
  authorisation path to get right. The Pusher driver the env schema allows would sit beside it.
- **The calls whose endpoints are still contract requests use plain `fetch`, not `browserApi`.**
  The typed client only knows paths in `schema.d.ts`; forcing one through with `as never` would
  defeat the check that stops response types being invented (ADR-0006) and would keep compiling
  on the day the real shape lands.
- **`elementOverrides` is not used to exempt `<Kbd>` from the no-literals rule.** It crashes
  eslint-plugin-react 7.37.5 on any declarator with no initialiser. Keycaps are a `KEYCAP`
  constant instead, which is where the ⌘/Ctrl split belongs anyway.
- **The command palette is Radix plus our own ARIA, not `cmdk`.** ADR-0002 fixes the component
  base, and the hard parts — focus trap, scrim, Escape, scroll lock — are what `Dialog` already
  does. The active option is tracked by item **id**, so a changing result set cannot leave
  `aria-activedescendant` pointing at an element that no longer exists.
- **Three e2e helpers retry.** A shell control exists in the server HTML before the JavaScript
  that makes it work has hydrated, and a click in that window is simply dropped. Retrying is
  what a real person does; there is no DOM signal for "hydrated".

### Deliberately not done

- The admin command palette searches nothing and the mega-menu has no catalogue: both need
  endpoints F2 and F3 own. What ships is the shell, its keyboard behaviour and its a11y.
- The full PDPA preferences centre — per-purpose toggles, a record of when consent was given,
  withdrawal — is F3. Only the gate GTM legally needs is here.
- `IDEMPOTENT_PATHS` is still empty: 1.3 adds no irreversible operation.
- The 17 storefront destinations are placeholder pages, replaced by F3 rather than extended.
- Linux baselines for the visual snapshots; the CI job is `continue-on-error` until they exist.
- Firebase and LINE stay plumbed-but-not-wired, as 1.2 left them.

### Open questions

- **Legal**: whether first-party funnel events sit under legitimate interest, or need the same
  consent GA4 does.
- **Backend**: eight new contract requests — `status.enums`, `entity.next-actions`,
  `rum.web-vitals`, `store.sitemap`, `notifications.feed`, `push.subscriptions`,
  `realtime.auth` and `analytics.events`. The realtime one also needs the transport confirmed;
  the client assumes SSE.
- **Product**: the initial-JS gap above is not something F1 can close on its own.

---

## F1 Deliverable 1.2 — 2026-09-23

The app can now talk to `packio-api` — typed, mocked and authenticated. Six commits, each
with lint, typecheck, unit tests and build green: contract pipeline → clients → BFF → auth →
MSW and e2e → docs.

### What is now enforced rather than advised

| Rule | Mechanism |
|---|---|
| A hand-edited `schema.d.ts`, or a forgotten `pnpm gen:api` | `pnpm gen:api --check`, its own CI job; proven to fail on an edit |
| Moving to a newer backend contract without anyone noticing | the vendored `contract/openapi.json` is sha256-pinned in `contract.lock.json`; only `--adopt` rewrites both, and it shows up in the PR diff |
| A response type invented by hand | there is nowhere to put one: everything comes from `schema.d.ts` or the marked seed |
| A failed API call that returns rather than throws | `problemMiddleware` throws `ApiError`; a non-problem body still becomes one |
| Admin code calling `/v1/store/...` | `surfaceZone` on `serverApi` refuses it in-process, before the request leaves |
| The browser reaching a surface its zone has no business with | the BFF allow-list, built from `ZONE_CONFIG`, answering 404 |
| A cross-site form post riding the session cookie | `Origin` + `x-packio-csrf` on every non-GET through the BFF |
| A token in JS-readable storage | there is no code path that writes one; the e2e suite asserts `document.cookie` holds neither |
| A back-office screen added without a guard | it inherits `(console)/layout.tsx` by where it is placed |
| A staff password attempted from the browser | `/v1/auth/staff/login` is on no BFF allow-list; it is a Server Action only |
| An OTP a customer cannot paste | one input, `autocomplete="one-time-code"`, asserted in both unit and e2e tests (WCAG 2.2 §3.3.8) |
| A th/en drift in the new `auth` namespace | the existing `messages.test.ts` parity suite, which covers it automatically |

### Bugs this session found and fixed

1. **`maxLength` broke pasting a Thai OTP.** The OTP field stripped non-digits in its change
   handler, but the browser applies `maxLength` to the raw text *first* — so pasting the whole
   SMS, "รหัส OTP ของคุณคือ 123456", was cut to its first six characters and left a single
   digit behind. Exactly the failure WCAG 2.2 §3.3.8 exists to prevent, in the component
   written to satisfy it. The limit now applies after the non-digits are gone.
2. **A successful sign-in navigated to `about:blank`.** The sheet called `onOpenChange(false)`
   on success, and the page hosting it treats a close as a cancel and goes back — so signing
   in undid itself. Closing and signing in are separate events now, and "back" is only taken
   when there is history to go back to, which there is not when someone arrives from an SMS
   link.
3. **The zone catch-alls sat outside the guarded route group**, so an unknown admin path
   answered 404 to anyone and quietly confirmed which paths do not exist. They are inside
   `(console)` now.
4. **`pnpm build` started demanding production secrets.** `next build` imports every route
   module to collect its config, and the BFF chain reached `src/lib/env/server`, which
   validates at module load. `apiInternalUrl()` defers that read; the proxy still validates
   eagerly on every request, so a missing key still fails the deployment at boot with every
   absent key named at once.

### Decisions taken, with reasons

- **The contract is vendored at `contract/openapi.json`.** CI has no sibling checkout of
  `packio-api` and no credentials for a private release asset, so a drift gate that reached
  outside the repo could not be reproducible. `--adopt` is the only command that reaches out,
  and it rewrites the vendored copy and the lock together.
- **The seed contract was a separate document and a separate generated file**, which is what
  made retiring it a single day's work when B1.3 landed mid-deliverable (see below). Nothing in
  it was invented: every path and field came from api-conventions §4, the backend's ADR-0004 or
  its own B1-foundation prompt. Confirmed with the user before starting.
- **Staff sign in with an email.** api-conventions §4 and the master plan both say
  "username/password", but the backend's ADR-0004 said email + password, so the seed followed
  the ADR — and `StaffLoginDto` confirms it. Partner sign-in turned out to be an email too,
  which the seed had guessed as a username.
- **The idempotency key is minted per user intent, not per fetch.** A key generated inside the
  request would be new on every retry, which guarantees the double-submit the header exists to
  prevent. The middleware only fills one in when a flagged call arrives without one; no
  operation is flagged yet, because F1 has none.
- **`refreshSession` returns `null` for every failure, not only a 401.** Refresh tokens are
  single-use and replaying a spent one revokes the whole family, so a token this app is unsure
  about must never be sent twice. Signing someone out is recoverable; guessing is not.
- **`getActor` treats 403 as "not signed in", and re-throws 5xx.** A 403 is a token for the
  wrong audience — exactly what a customer cookie looks like on the admin host. A 500 is not a
  lost session, and calling it one would bounce a signed-in user to a login screen because a
  database was briefly slow.
- **COOP relaxes to `same-origin-allow-popups` on the storefront only.** Firebase's Google and
  Apple sign-in talks to its popup through `window.opener`, which `same-origin` severs: the
  popup completes and the opener never hears, so sign-in hangs with no error. Admin and partner
  have no third-party sign-in and keep full isolation.
- **Firebase and LINE are plumbed, not wired.** UI, server-side exchange endpoints, CSP origins
  and a configured/not-configured check are in place; the SDKs load on click in F3, which the
  master plan already assigns LIFF to. A button that looks live and then fails is worse than
  one that is visibly not on offer. Confirmed with the user.
- **`auth` is the second namespace shared by all three zones.** Every zone signs someone in,
  and "your session has ended" should not drift between them. The unused copy per zone is a
  handful of strings.
- **The OTP field is one input, not six boxes.** Expiry and the resend instant come from the
  challenge; the code length and the attempt count are not in the contract, so they are the two
  open rows in `docs/contract-requests.md` and the length is named once rather than assumed at
  each use.
- **`/account/designs` is deliberately left unguarded.** Designs live in localStorage until F4
  Part B gives them a server-side home, so a guard would remove working behaviour rather than
  protect anything.
- **`docs/contract/api-conventions.md` was re-synced from `packio-api`**, which had added §5
  (Swagger/Scalar documentation requirements) and renumbered Realtime to §6. CLAUDE.md requires
  the two copies to be identical. Confirmed with the user.

### Adopting packio-api B1.3, the same day

The backend published the real auth surface while this deliverable was finishing, so the seed
was retired immediately rather than left to rot: `pnpm gen:api --adopt` pinned contract
`54b2621b`, `mocks/seed-openapi.json` and `schema.seed.d.ts` were deleted, and the one
`SeedPaths` line came out of `src/lib/api/types.ts`. Everything still typed against the seed
then failed `pnpm typecheck`, which is precisely the mechanism ADR-0006 was written for — eight
errors, each a real difference:

| Seed assumed | The contract says | What changed |
|---|---|---|
| partner login `username` + `devicePin` | `PartnerLoginDto`: `email` required, `password` **or** `pin` (+ `deviceId`) | the partner form takes an email, and either credential signs in — a shared shop-floor device can be enrolled with a PIN and no password typed on a shared screen |
| OTP challenge `ref`, `codeLength`, `resendAfterSeconds`, `attemptsRemaining` | `OtpChallengeDto`: `challengeId`, `expiresAt`, `resendAvailableAt` | the resend countdown now reads an instant straight from the API instead of computing one; the reference and the attempt counter left the UI |
| OTP verify by `phone` + `ref` + `code` | `OtpVerifyDto`: `challengeId` + `code` | the number is not sent again, so a code issued for one number cannot be replayed against another |
| OTP request `{ phone }` | `OtpRequestDto`: `phone` + `purpose` | `login` here; the same endpoint serves `link_phone`, which F3 uses to attach a number to a LINE or Firebase account |
| `/me` with `type`, `scopes`, `userCode`, `lineLinked`, `companies` | `AdminMeDto` / `StoreMeDto` / `PartnerMeDto` | `featureFlags` is a string array, `menu` entries are `{ key, path }`, and a customer's linked providers arrive as `identities[]` |
| factories with `id`, `name`, `status` | `FactoryAccessDto`: `factoryId` + `roles` | the partner zone shows roles; a display name is now a contract request, and F5's shell will need it |

Two things the contract does **not** carry are now the only open requests: the OTP code length
and the attempts remaining. The UI names the length once as `OTP_CODE_LENGTH` (6, per
B1-foundation) rather than spelling it into the markup, and `docs/contract-requests.md` asks
for both on the challenge.

The build caught one more: a `"use server"` module may export only async functions, so
`OTP_CODE_LENGTH` could not live beside the actions and moved to its own module.

### Deliberately not done

- No shells: the admin sidebar built from the `/v1/admin/me` menu entitlements, the topbar,
  the command palette and the notification centre are all 1.3. The zone home pages show the
  signed-in actor's name and roles only because that is the smallest thing that proves the
  whole chain works end to end.
- No `src/domain/status` maps, no observability, SEO, web push, realtime or analytics — 1.3.
- No Storybook stories for `OTPInput`, `PhoneInput` or `FormField`; they are covered by unit
  tests with axe. 1.3 adds the visual snapshots.
- No Lighthouse URL set for the login pages: budgets arrive with the real shells in 1.3.
- `IDEMPOTENT_PATHS` is empty. The mechanism and its tests exist; F2–F6 add their own
  operations as they build them.

### Open questions for the backend

B1.3 settled most of what was open. Two rows remain in `docs/contract-requests.md`, both on
`OtpChallengeDto` — the code length and the attempts remaining — plus a display name on
`FactoryAccessDto`, which the partner shell needs in F5. Everything else the UI needs is now in
the contract and read from it: token lifetimes, OTP expiry, the resend instant, and the device
PIN policy, which `PartnerLoginDto` expresses by requiring only the email.

---

## F1 Deliverable 1.1 — 2026-09-23

Three hosts served from one build, each with its own `<html>`, providers, CSP and 404
behaviour. No business screens — the admin and partner pages are placeholders that prove the
rewrite, the layout, the theme and the per-zone messages work end to end.

### What is now enforced rather than advised

| Rule | Mechanism |
|---|---|
| An unknown or forged `Host` picks no zone | `resolveZone` returns `null` → bare 404; there is no default zone |
| `/admin/*` and `/partner/*` are unreachable from outside, on **every** host | `isInternalOnlyPath` in `src/proxy.ts`, before any app code runs |
| A forgotten host or API URL in production | `src/lib/env/server.ts` throws at boot, naming every missing key at once |
| `API_INTERNAL_URL` reaching a client bundle | `import "server-only"` in `src/lib/env/server.ts` |
| A customer screen importing `features/admin` | `no-restricted-imports` (alias form) **and** `import/no-restricted-paths` (resolved form, catches `../../admin/…`) |
| That those two rules are still wired to the right files | `src/lib/zones/eslint-boundaries.test.ts` lints fixture *strings* through the real config |
| `X-Robots-Tag: noindex` on admin and partner, absent on the storefront | `securityHeaders`, unit-tested per zone, asserted again in `e2e/zones.spec.ts` |
| Camera permission on the partner PWA only | `Permissions-Policy` per zone, same two layers |
| A CSP that blocks something the page needs | `e2e/zones.spec.ts` fails on any CSP console violation, on all three hosts |
| The nonce in the CSP is the nonce Next stamped | asserted against the served HTML, not the DOM (see below) |
| A fourth zone half-added | `ZONES` in `src/lib/zones/zones.ts` is the one list; `ZONE_CONFIG` and `ZONE_DEFAULT_THEME` are `satisfies Record<Zone, …>` |

### Bugs this session found and fixed

Both came out of the browser, not the unit tests:

1. **A nonced `style-src` broke every page's styling, silently.** `sonner` injects its 15 KB
   stylesheet from a `document.createElement("style")` at module evaluation (`__insertCSS` —
   no nonce option, no way to opt out), Turbopack does the same for CSS in development, and
   Radix and Konva set `style` attributes, which have nowhere to put a nonce. A nonce in
   `style-src` makes the browser **ignore** `'unsafe-inline'`, so all of it was refused and
   every page logged violations. Styles are now `'self' 'unsafe-inline'` with the reasoning
   written into `src/lib/security/csp.ts`; `script-src` keeps its nonce and
   `'strict-dynamic'`, which is the allowance that matters, and `img-src`/`font-src`/
   `connect-src` still bound where CSS-based exfiltration would have to send anything.
2. **`script[nonce="…"]` can never match.** The CSP spec has browsers blank the `nonce`
   content attribute once the document is parsed, so the obvious assertion — that Next
   stamped the nonce the CSP advertises — passed vacuously as "0 elements, no failure" only
   because it was written as `> 0`. It now reads the served HTML from the response.

### Decisions taken, with reasons

- **The nonce CSP makes every route dynamically rendered, and the F0.2 note about restoring
  static rendering is superseded.** Next cannot statically render a page whose nonce changes
  per request, so moving the `pk_theme` read from `cookies()` into a proxy request header
  would buy nothing — reading a request header is equally dynamic. Confirmed with the user.
  `readThemeChoice` stays as it is. Storefront caching becomes a CDN/ISR question for F3,
  when there are real catalogue pages to cache.
- **next-intl's middleware is kept, not replaced.** It builds its rewrite from
  `new Headers(request.headers)` and forwards them through
  `NextResponse.rewrite(url, { request: { headers } })`, so handing it a header-only clone of
  the request carries `x-nonce`, the CSP and `x-packio-zone` through to the render — and
  locale negotiation, the `Link` alternate-links header and trailing-slash normalisation stay
  its job rather than becoming ours.
- **Host matching ignores the port.** One set of `*_HOST` values therefore serves `pnpm dev`
  (:3000), Playwright (:3100) and Lighthouse CI (:3200) without a per-tool override. A
  trailing root dot and an IPv6 literal are normalised for the same reason a port is: they
  are all ways to present the same host differently to an allow-list.
- **A cross-zone probe gets a bare 404 from the proxy, not a styled page.** No app code runs
  and there is no body, so a probe learns nothing about whether the route exists. A real miss
  *inside* a zone still gets that zone's `not-found.tsx`; `src/app/{admin,partner}/[...rest]`
  exists so Next has a route to attach the miss to — with no `src/app/layout.tsx`, an
  unmatched path has no unambiguous root layout to render in.
- **Hosts and `API_INTERNAL_URL` default only outside production.** `pnpm dev` needs no
  `.env`; production requires them, because a host that silently fell back to `localhost`
  would 404 that whole zone with nothing in the logs. CI therefore sets them rather than
  skipping validation, so the schema is exercised on every build.
- **The access token's expiry is a third cookie (`__Host-pk_ate`), not the JWT's `exp`.** The
  proxy forwards a token it must not need to parse; the API owns the JWT format and is the
  only thing that verifies it.
- **The HTTP half of the refresh is a named seam for 1.2.** `refreshDecision` is pure and
  tested; `refreshSession` returns `null`, which is the real "refresh failed → render
  anonymous" answer rather than a placeholder. Writing the call now would mean hand-writing a
  response shape ahead of `src/lib/api/schema.d.ts`, which CLAUDE.md forbids. Confirmed with
  the user. Nothing sets a refresh cookie before 1.2, so the branch is unreachable today.
- **`global-error.tsx` is bilingual, not translated.** It replaces the whole document,
  including the next-intl provider, so there is no bundle to read and the locale is exactly
  what has just been lost. Two short lines in Thai and English.
- **The e2e suite now runs against a production build locally as well as in CI.** The dev
  CSP legitimately differs (Turbopack's injected styles), so testing `pnpm dev` would give
  false confidence in both directions.
- **`Zone` moved to `src/lib/zones`** and `src/ui/theme/themes.ts` imports it. Which zones
  exist is a platform fact, not a design-system one, and `ZONE_DEFAULT_THEME` now cannot
  drift from the list the proxy resolves against.
- **`@typescript-eslint/no-unused-vars` ignores `_`-prefixed arguments.** A seam like
  `refreshSession(_zone, _refreshToken)` keeps the signature 1.2 needs. Unused *variables*
  are still reported.
- **The ESLint `files` glob is `src/app/**` minus the other two zones, not
  `src/app/[locale]/**`.** A flat-config glob is minimatch, so `[locale]` reads as a
  character class and matches nothing that exists — the fixture test found this. The broader
  glob is also correct: the customer BFF at `src/app/bff` must not import admin features
  either.

### Deliberately not done

- No `pnpm gen:api`, `schema.d.ts`, MSW, `serverApi`/`browserApi`, `createBffHandler`, login
  screen or `getActor` — all F1 1.2. The BFF paths are routed by the proxy and allow-listed
  in `ZONE_CONFIG` (`bffPath`, `apiPrefix`), but no route handler exists yet.
- No real shells: the admin sidebar from `/v1/admin/me` entitlements, the topbar, the command
  palette, the customer header/footer/bottom-nav and the partner bottom nav are all 1.3, as
  are observability, SEO, web push, realtime and analytics.
- Messages stay in the flat `{th,en}/*.json` files, now loaded per zone
  (`ZONE_NAMESPACES`). The per-feature split and the lint rule against hard-coded strings are
  1.3's item 2.
- The Lighthouse URL sets for the admin and partner hosts wait for 1.3: the hosts exist, but
  a placeholder page has no budget worth asserting.
- `TanStack Query` defaults are plain (`staleTime: 30s`, no refetch on focus). 1.2 replaces
  them with retry rules by HTTP status and stale times per resource type, once `ApiError`
  exists to tell a 422 from a 503.

---

## F0 Session 0.2 — 2026-09-23

Eight commits, each with lint, typecheck, unit tests and build green:
tokens → fonts → primitives → forms/overlays → i18n & status → Storybook → designer
migration → CI gates.

### What is now enforced rather than advised

| Rule | Mechanism |
|---|---|
| Every semantic colour pair meets WCAG 2.2 AA in all three themes | `scripts/check-contrast.ts`, run as a Vitest suite (96 assertions) |
| A semantic colour no pair checks | fails the same gate — `uncheckedKeys()` |
| `src/ui/generated/tokens.css` matches the TypeScript tokens | `pnpm tokens:check` in CI |
| `bg-teal-600`, `text-slate-500` and friends | no longer resolve: the generated `@theme` emits `--color-*: initial` |
| Labels, hints and errors wired to their control | `<Field>` context; composite controls use `useFieldGroupProps()` |
| An icon-only button without an accessible name | will not compile — `IconButton`'s `label` is required |
| A status rendered from colour alone | impossible: `StatusBadge` takes a `StatusMeta` (tone **+** icon **+** label key) |
| A string that exists in one language only, or whose ICU placeholders differ | `src/i18n/messages.test.ts` |
| axe violations per component / per page | Vitest per component; `@axe-core/playwright` on 5 page states incl. dark and high contrast |
| Performance budgets | `lighthouserc.json`, `lighthouse` CI job |

### Bugs this session found and fixed

Four were only findable in a real browser, which is the argument for the e2e a11y job:

1. **`Button asChild` crashed the server render.** With `asChild`, Radix `Slot` received three
   children (icon, label, icon) and threw "Slot failed to slot onto its children" — so the home
   page 500'd. Fixed with `Slot.Slottable` around the label, which also keeps icons working
   with `asChild`. Pinned by a unit test.
2. **Closing any dialog dropped focus to `<body>`** (WCAG 2.4.3). Radix restores focus to
   `Dialog.Trigger`'s ref, and every dialog here is *controlled* — opened from a toolbar button,
   a menu item or a shortcut — so that ref is null. `src/ui/lib/useReturnFocus.ts` captures the
   element in `onOpenAutoFocus` (dispatched before FocusScope moves focus) and restores it in
   `onCloseAutoFocus`. Applied to Dialog, AlertDialog and Sheet.
3. **The ghost Button was illegible on the designer's dark header: 1.89:1.** It forced
   `text-fg`. Ghost now inherits its colour and tints its hover from `currentColor`, so it adapts
   to any surface instead of needing a local override at each call site. The token gate could not
   see this — the tokens were fine; the pairing was not.
4. **`<dl>` in the box-setup preview held a non-definition legend** (axe `definition-list`).
   The cut/fold legend moved out of the list.
5. **`opacity-80` on the designer header's summary turned a gated 7.25:1 pair into 4.46:1.**
   Opacity compounds onto the whole subtree, so the `opacity-100` on the `<b>` inside could not
   undo it. This is the one failure mode the token gate structurally cannot see: the tokens were
   correct and the pairing was correct, and a utility downstream quietly changed the pixels. No
   `opacity-*` is used for text anywhere now — hierarchy comes from size and weight — and the
   destructive button's `hover:opacity-90` (which dimmed its own label) became a real
   `danger-hover` token, gated like every other pair.

Two more came out of the migration itself:

5. **`SetupModal` was remounted by a `key` to reset its form**, which unmounted Radix's focus
   scope instead of closing it. The form state moved into a child Radix unmounts on close, so it
   resets with no key and no effect.
6. **The `useMemo` the React Compiler could not preserve** (F0.1 recorded it) was not "fixed" by
   restructuring its dependencies — it was deleted. It wrapped a lookup and three additions, and
   a memo the compiler cannot preserve makes it skip optimising the whole component.

The two React Compiler rules are back to `error`, and `reportUnusedDisableDirectives` is on, so
the three remaining `eslint-disable` lines cannot rot: two mount-time `localStorage` reads
(removed in F4 Part B with the designs API) and one fit-to-measured-viewport effect.

### Decisions taken, with reasons

- **Semantic keys are `fg` / `muted`, not `text` / `text-muted`** as ADR-0003 wrote them.
  `--color-text-muted` would generate the utility `text-text-muted`; the utilities
  `design-system.md` §2 actually names (`bg-primary`, `text-muted`, `border-border`) need these
  names. Same tier, renamed.
- **`subtle` is gated at 3:1, not 4.5:1.** It is only placeholders, disabled labels and
  decorative meta text, which WCAG 1.4.3 exempts; body and secondary text use `fg` and `muted`.
  Step 500 of the shared lightness ramp was tuned to 0.658 to clear 3:1 (3.13:1).
- **The theme cookie is read with `cookies()` in the customer root layout**, as the prompt asks,
  which opts customer routes out of static rendering. Accepted for F0.2 and confirmed with the
  user; F1 moves the read into `src/proxy.ts` as a request header so the pages can be cached
  again. The alternative — a pre-paint inline script — keeps them static but needs a CSP nonce
  and fails with JavaScript off.
- **axe runs in Vitest and Playwright, not the Storybook test runner** (confirmed with the user).
  One test runner, no second Vitest project in browser mode. Storybook is documentation and is
  built in CI; `color-contrast` and `region` are disabled in jsdom because it has no pixels and a
  component under test is a fragment — both are covered properly in the browser.
- **Fonts are one file per script, not per family.** `next/font/local` applies `declarations` to
  every `src` entry of a call, so it cannot give two files of one family different
  `unicode-range`s, and two `@font-face` rules for one family with no range means the second file
  is never used. Coverage order in the token stacks does the job. No declaration names a generic
  fallback: Next splices those into the family's own variable, ahead of the Thai family, and
  `system-ui` on a Thai system *does* have Thai glyphs — Thai text would never reach Noto Sans
  Thai.
- **`th-TH` already defaults to the Buddhist calendar in `Intl`**, so the naive +543 shifted
  2026 to 3112. The tag is pinned to `ca-gregory` and the offset is explicit, which is also what
  lets an accounting export ask for CE in Thai.
- **Lighthouse asserts resource sizes and accessibility as errors, field metrics as warnings.**
  A shared GitHub runner cannot stand in for a p75 measurement; Web Vitals RUM through the BFF is
  the real signal and arrives in F1.
- **Scripts run through `tsx`, not bare `node`.** Node 24 strips types but needs explicit `.ts`
  import extensions, which would force that style through all of `src/ui/tokens`.
- **Tailwind reaches Storybook through `@tailwindcss/vite`, not the shared PostCSS config.**
  Turbopack requires the plugin named as a string and Vite requires an instantiated plugin, so
  one file cannot serve both.
- **Board colours and the dieline SVG's cut/crease colours stay literal.** Paper colours describe
  real kraft and art card, and pure red/blue in the exported cut file is the die-maker's
  convention — neither may follow the brand. On-screen marks come from `PRINT` tokens through
  `src/features/designer/canvas-colors.ts`, because Konva and PDF cannot read CSS variables.
- **The brand hue is still a placeholder** (`docs/ui/brand.md`). Swapping it is one edit to
  `primitives.ts` plus `pnpm tokens`; the contrast gate then decides whether `primary` must move
  to a darker step.

### Deliberately not done

- `SiteHeader` moved out of `src/ui/brand` to `src/features/customer/shell` — it is a zone shell,
  not brand. F1 replaces it with the real one (mega-menu, cart, account, locale switcher).
- `BRAND_HEX` and `BRAND_TAGLINE_TH` are gone: the hue is a token and the Thai tagline is copy in
  `src/i18n`. `BRAND_NAME`, `BRAND_TAGLINE` and `BRAND_COMPANY` stay — legal identity, not
  translatable text.
- The ESLint rule that blocks hard-coded UI strings, the packaging glossary, and the admin and
  partner Lighthouse URL sets are all F1, with the zones they need.
- `src/domain/status` has the shape but no maps. They arrive in F1 keyed to the generated contract
  enums, so a new backend status fails the build until it has a tone, an icon and a label.

---

## F0 Session 0.1 — 2026-09-22

Branch `chore/packio-baseline`, tag `pre-packio` on the pre-F0 commit. Working tree was
clean at the start: nothing needed stashing.

### Things that turned out differently from `docs/prompts/F0-setup.md`

1. **The repo was on Next 15.5.25, not Next 16.** Worse, the designer route was broken on
   it: `react-konva` resolved to 19.3.0, which refuses to run against the React 19.1 copy
   Next 15 bundles for the client, so `/design/[id]` rendered an error page. Confirmed with
   the user, F0.1 upgrades to **Next 16.3.6 + React 19.3.0**. That is also why the test
   net had to be proven before the upgrade rather than after it, and why F1 can write
   `src/proxy.ts` directly instead of a `middleware.ts` it would later rename.
2. **`docs/` was in `.gitignore` from the first commit**, so the entire prompt pack —
   decisions, ADRs, F0–F6 prompts, PROGRESS — had never been committed, even though both
   existing commits are titled "docs: Packio prompt pack v3". Confirmed with the user;
   `docs/` is tracked now.
3. **Step 9's deletions did not apply.** `docs/frontend-00-master-plan.md` and
   `docs/README.md` do not exist. The **root** `README.md` was the v2 prompt-pack index,
   and step 7 replaced it with the packio-web README.
4. **Node on this machine defaults to v18.17.0**, which is below what Next supports.
   `.nvmrc` pins 24 and every command in this session ran on nvm's v24.21.0.
5. Next 16 **overwrites `CLAUDE.md`** with generated agent rules on `next dev`.
   `agentRules: false` in `next.config.ts` stops it; the file is hand-written documentation.
6. **Port 3000 was occupied by another project** on this machine, so the e2e suite runs on
   its own port (`E2E_PORT`, default 3100) and never depends on a dev server.

### Assumptions taken (most conservative option, per CLAUDE.md)

- **`patterns.ts` stays in the app.** Step 4 asks for "pattern tile maths without DOM" in
  the package; there is none — `buildPatternTile` is a canvas routine end to end and
  `PATTERN_OPTIONS` is Thai UI copy. The package holds geometry only.
- **Face names stay Thai** (`PANEL_NAMES`, "ปีกกาว", "ฝาบน" …) inside `@packio/dieline`, so
  the extraction changes no behaviour. F4 Part A turns them into i18n keys; ADR-0007 and
  the package README say so.
- **`noUncheckedIndexedAccess` is off.** The geometry code indexes arrays positionally
  throughout (`xs[5]`, `pts[(i + 1) % n]`); turning it on would mean rewriting the very
  code F0.1 must move unchanged. Worth revisiting in F1.
- **No ESLint zone boundaries yet.** There is no admin or partner code to keep apart until
  F1 creates the zones; the rule set belongs with them.
- **Four React Compiler lint rules are warnings, not errors.** `eslint-config-next` 16
  turns on `react-hooks/set-state-in-effect` and `react-hooks/preserve-manual-memoization`,
  which flag pre-existing designer patterns (setState inside the localStorage load effects
  in `Editor.tsx`, `DesignCanvas.tsx` and `MyDesigns.tsx`, and a `useMemo` in
  `SetupModal.tsx` the compiler cannot preserve). F0.1 must move that code unchanged, so
  they stay visible and get fixed in F0.2 when the designer UI is rebuilt on `src/ui`.
- **`localeDetection: false`.** With detection on, next-intl remembers a visitor's locale
  in a cookie and serves English from `/`, which breaks the indexed "th at `/`, en at
  `/en`" split in master-plan section 2 and makes the page uncacheable. A language switcher
  that navigates to `/en` comes with the shell in F1.
- **Changesets `baseBranch` is `master`**, the only branch this repo has; there is no
  `main` and no remote yet.
- **The brand hue is a placeholder** (`BRAND_HEX`, the teal the app already used) until the
  brand kit arrives and F0.2 puts colour behind generated tokens.
- **Prettier does not format `docs/` or `CLAUDE.md`.** `docs/contract/api-conventions.md`
  must stay byte-identical to its copy in `packio-api`, and the prompt pack is a delivered
  reference. `tsconfig.json` and `next-env.d.ts` are left to Next, which rewrites them.

### Known regression, deliberate

Removing the runtime Google Fonts `<link>` (ADR-0001) means the UI **and the designer's
artwork font list** (`FONT_FAMILIES`: Sarabun, Prompt, Kanit …) fall back to whatever the
device has. F0.2 self-hosts the UI faces with `next/font/local`; the artwork catalogue is
F4 Part C, which must also outline or embed them in print PDFs.

### Bug found and pinned, not fixed

`insetConvex` only detects a collapse at exactly half the smallest span. Past that the
offset lines cross and it returns a **mirrored** polygon whose signed area is still
positive, so the guard passes. Used for the 3 mm safe zone, where the inset is always
small, so it has never bitten. Pinned by a test in `packages/dieline/src/geometry.test.ts`
and recorded in ADR-0007 for F4 Part A to decide on.

### Not yet true of the target structure

`src/app/bff`, `src/lib/{auth,bff,observability}`, `mocks/`, `contract.lock.json`,
`Dockerfile`, `robots.ts`, `sitemap.ts` and `global-error.tsx` are all F1. `src/ui`,
`src/domain`, `src/i18n` and `src/lib/api` exist with a README each saying what goes in
them and when.
