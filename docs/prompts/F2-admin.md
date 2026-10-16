# F2 — Admin zone (back-office)

> อ่าน `CLAUDE.md`, `00-master-plan.md`, `docs/decisions.md`, `docs/contract/api-conventions.md`, `design-system.md` ก่อน · ต้องทำ F1 เสร็จแล้ว
> ทำทีละ Deliverable (2.1 → 2.8) ต่อ 1 session · endpoint ที่ยังไม่มี → MSW mock + `docs/contract-requests.md`
> หน้าจอการเงิน/บัญชีอยู่ใน `F6-finance.md`

---

## 1. Scope
You are a senior frontend engineer and product designer building the **admin zone** of `getpack-web` (`src/app/admin/**`, `src/features/admin/**`) for every getpack staff role (D-140): Superadmin, C-Level, VP, Director, Admin, CS, CS Lead, Prepress, Finance, Finance Manager, Logistics, Marketing, Partner Manager, Auditor. The sidebar and actions come from `/v1/admin/me` entitlements; **cost and margin fields render only when the API returns them** (D-141).
Legacy Locopack screens (Appendix A, `legacy/locopack-web/resources/views/**`) are **functional inspiration**: reuse their fields, filters and actions where they fit getpack; `docs/decisions.md` wins wherever it differs. Visual design follows `design-system.md`, never AdminLTE.

## 2. Building blocks (Deliverable 2.1)
- `defineResource({ key, endpoint, columns, filters, schema, permissions })` → list / create / edit / show pages for simple resources; server tables (TanStack Table, URL-synced filters, saved views via `/v1/admin/saved-views`, xlsx export button); Excel import pattern **upload → preview → confirm**.
- Work-queue pattern (count badge, SLA timer, bulk actions), **approval inbox** (every approval type from the approvals engine: discount memos, credit limits, price proposals, payout runs, bank-account changes, settings — approve/reject with comment, maker-checker hints), command palette (jump to order/group/RFQ/customer/company/factory by code, phone, email), notification centre, **effective-dated settings editor** (current value, future scheduled values, history, reason, decision id) for Superadmin (D-063).

## 3. Deliverables (one per session)
**2.1 Foundation** — menu, dashboard shell, building blocks above, users & roles (assign roles with scopes; SoD conflicts shown), audit-log viewer.
**2.2 Orders & CS** — queues ("รอชำระ", "รอตรวจสลิป", "รอไฟล์", "รอเริ่มผลิต", "ใกล้ครบกำหนดส่ง", "ล่าช้า"), order group & order list/detail (tabs: summary, items & per-part prices, instalments & payments, artwork/proofs, production timeline, shipments & POD, documents, claims, activity, notes with @mentions), actions rendered from API `allowedActions` with typed confirmations; **CS create-order** on behalf of a customer; **CS calculators** for the 7 instant types (multi-step: input data → calculate → pick offer → discount (≤ 5 % direct, above → discount memo form D-052) → save quotation / create order); quotation list & PDF.
**2.3 RFQ workspace** (D-100) — RFQ queue with SLA per category, detail (spec, files, customer), request cost from factory, compose quote lines with validity, send, track acceptance; decline with reason code (feeds unmet demand).
**2.4 Prepress & design services** — queue with SLA, preflight report viewer, proof upload (versions), annotation thread replies, send template/dieline, hired-design brief & revision rounds counter (3 free, then paid add-on D-071), mockup add-on jobs, open designs read-only or as a copy via `src/features/designer`.
**2.5 Catalogue & CMS** — product types with `instant | rfq` mode, patterns, materials, standard sizes, stock products (Excel), semi-design templates, banners, home sections, articles (TipTap), FAQs, SEO meta.
**2.6 Partners** (D-011, D-040…D-044, D-101) — onboarding pipeline (applied → review → trial → active), KYC documents, capability matrix, capacity, tolerance, shipping buy rates, payout policy, **pricing arrangement** (ownership mode D-042, participation tier per product type D-043, acceptance status), agreement status, **site-visit record** (required before active), assisted onboarding (enter on behalf + factory sign-off status); **price governance**: rate-card editor (platform mode: draft version → send for factory acceptance → track acceptance/exceptions) and **proposal review** (factory mode: current vs proposed vs suggested with basis vs deviation %), **impact simulation** (90-day re-price: price, margin, selection-share deltas), approve / reject / counter-propose; material price index & cost-driver index maintenance; **coverage map** (which product types/specs have an instant price path vs RFQ only, D-043); production board (jobs by milestone, filters, at-risk), QC inspection tasks (sampling D-076), factory scorecard (D-155).
**2.7 Marketing, B2B, customers** — campaign badges and any countdown shown on the storefront must carry a real end date (D-181); — coupons (single / bulk unique codes), automatic promotions, **campaigns** with budget meter and 80 % alert (D-154), referral programme settings and fraud-review queue (D-136), loyalty settings (earn rate, point value, tiers, activity rewards — effective-dated), customers (profile, orders, points, referrals, consents); **B2B companies**: KYC review, members, branches, credit application & limit (approval), terms, statements, overdue status; discount memo list.
**2.8 Logistics, claims, analytics, hardening** — shipments (split, carrier fallback booking, labels, POD review, exceptions), claims queue & decision (liability rules D-083, resolution actions), **demand dashboard** (funnel, demand by type × spec × quantity × province, unmet demand, factory utilisation, campaign performance) and **partner prospectus** export (D-102), operational reports (sales, sales tax, payments, promotion usage, points liability, AR/AP aging links); Playwright e2e per role (allowed menu + key flow), axe on key screens, visual snapshots, Lighthouse admin budget.

## 4. UX rules
Keyboard-first (shortcuts, ⌘K), dense but readable tables, right-rail context on detail pages, optimistic updates only for reversible actions, every irreversible action restates order/group code and amount and sends `Idempotency-Key`, SLA timers visible in queues, empty/error states with request id, th/en.

---

## Appendix A — Legacy Locopack back-office (functional inspiration only)
### A.1 Legacy role-based navigation (reference)

Legacy menu per legacy role (`resources/views/layouts/menu.blade.php`). getpack roles differ (D-140); use this only to discover screens worth having.


| Menu group (screens) | Admin | CS | Factory | SEO |
|---|:-:|:-:|:-:|:-:|
| Factory Service calculators: `calculate/folding_box`, `calculate/label`, `calculate/corrugated_box` (factory-side price check) | ✓ | | ✓ | |
| Order Management: Quotations, Orders, Invoices | ✓ | ✓ | ✓ (own factory only) | |
| CS calculators: Folding, Label (v2), Corrugated, Tag & Sleeve, Standard products, Pouch, Service | ✓ | ✓ | | |
| Promotion: Promotions, Priority, Logs, Usage report | ✓ | | ✓ (view) | |
| Report → Orders, Download drawing | ✓ | | ✓ | |
| Banner: Homepage, Homepage Feature; Page Management: Home Section | ✓ | | | |
| Article: Articles, Categories; Sitemaps (SEO settings) | ✓ | | | ✓ |
| Sample / Product Group: Sample products, Categories, Product groups | ✓ | | | |
| Customers (ลูกค้า); User Management; Designer Management | ✓ | | | |
| Standard master data: Sub types, Materials, Shapes, Shoulders, Necks, Colors, Cap types, Types | ✓ | | | |
| Products/Mapping: List of products (mapping inputs), Rigids, Standard sizes, Standard products, Standard product prices; User designs | ✓ | | | |
| FAQ, FAQ categories | ✓ | | | |
| Factory management: Lists, Margin (manage-factories), Spec titles, Spec details | ✓ | | | |
| Shipping calculator tools (by gsm: folding/label/corrugate) | ✓ | | | |
| Tools: S3 upload test, Product tracking logs, Search logs | ✓ | | | |
| Reports: Non-payment orders, New orders, Quotations, Sales (ฝั่งขาย), Sales tax (ภาษีขาย), Payments | ✓ | | | |
| Drawing: Download drawing, Download logs | ✓ | | | |
| Points: Rewards, Campaigns, Users points, Redemptions, Report | ✓ | | | |
| Paper grade: list, Update prices (Excel) | ✓ | | | |
| Slips; Semi designs + Fonts; Event logs (+report), Calculate logs | ✓ | | | |
| Stocks (standard product stock history), Rigid prices, Rigid sub types, Spec titles/details, Step prices, Paper types, Provinces, Mapping input types, Order products, Order activities, Designs, Designs assets, Google merchants, Redemptions, PH6 | ✓ | | | |

Legacy extra: `DISPLAY_MENU_LABEL` env toggles the Label calculator entry; now a feature flag returned by `/v1/admin/me`.

### A.2 Legacy screen specifications (reference)

#### A.2.1 Generic CRUD screens (≈60 resources)
For each `Route::resource(...)` in `routes/web.php` build: list page (server table with the legacy DataTable columns, search, status filter, create button, row actions view/edit/delete with confirm), create/edit form (fields from `resources/views/<resource>/fields.blade.php`, validation from `app/Http/Requests/*` or model `$rules`), show page when legacy had one. Image fields upload to S3 and store via the images API. Status fields render as toggles/badges. Soft-deleted rows never appear.

#### A.2.2 Orders (the most important screen — port `resources/views/orders/**` + `OrderController`)
- **List** (`orders`, `datatable-orders`): columns order code (link), customer, product/packaging type, factory, amount, total, order status badge (colors per status), payment status/type, graphic status text (port `graphicStatusCheck` logic → readable Thai text), notify level highlighting (port `getNotifyLevel`: row colour by urgency), created/expired/paid dates, actions. Filters: date range, status, payment status, packaging type, factory, contact channel, search (code/name/phone/email). Row badge for `new_alert_status`. Export Excel.
- **Detail/Edit** (`orders/{id}/edit`) as tabs: **Order** (customer info edit, product list with per-part prices, delivery/tax invoice addresses, optional info, discounts, mockup, product unit, lead time, status change panel with allowed transitions only: 1→2→3→7→4→5, cancel 6 with reason/credit note, `ปรับเป็น เริ่มต้นผลิต` requires lead time and designer when hired design; change factory; change customer; re-production; SCGP "ส่ง consent"), **Payment** (slips gallery approve/reject/delete, upload slip on behalf, 2C2P/SCB status inquiry buttons, QR modal, refund + refund status, receipt/tax-invoice numbers, generate PDF full/normal tax invoice, credit note form + PDF, replacement invoice, vendor billing no/date, withholding tax), **Graphic Status** (state machine UI for graphic_status/template_status with upload template/graphic/SVG, approve/reject with reason, reconfirm, designer select, design-online toggle, drawing download, brief-design files), **Files** (all images by type), **Mail สำหรับโรงงาน** (compose/send factory mail + history), **Mail form**, **Activity** (timeline from `orders_activity` with readable names).
- **Create order (CS)**: `orders/create` modal flow used from each CS calculator (`create_order_modal.blade.php`, `plugin-boxes/create-order.vue`): pick/create customer (search by phone/email, create with generated `user_code`), address, tax info, design options (`is_brief_design`, `design_by_yourself`), promotion/admin discount, then the CS create-order endpoint.
- **Approve slip** page (`orders/{id}/approve-slip`).

#### A.2.3 CS calculators (`cs/*`) — port the Vue components `folding/cs-v2.vue`, `label/cs-v2.vue`, `corrugated/cs.vue` + `cs-combine.vue`, `tag_and_sleeve/cs-v2.vue`, `pouch/cs.vue`, `standard-products/cs.vue`, `service-orders/cs.vue`, `Mockup/*`, `form-edit-input/*`, `plugin-boxes/*`
Each is a multi-step form: load input data (`GET /v1/admin/cs/{type}/input-data` → factories, patterns + sub-patterns + standard sizes, paper types + gsm, difficult levels, colour groups, finishes (type 1 coating / type 2 foil-emboss with w×l×amount), diecut groups, assemblies, print types, flutes/paper grades for corrugate, microns for pouch), size inputs with pattern constraints (min/max, `l_must_more_than_w` …), per-part print front/back (n colours with percent), quantity tiers (multiple `arrayBoxAmount`), zipcode → province autocomplete, promotion code / admin discount / fixed margin / fixed delivery / custom cost (admin), then `POST /v1/admin/cs/{type}/calculate` → results table per factory × print type × quantity: per-pcs, with delivery, plate, diecut block, delivery, design fee, VAT, total, lead time & receiving date, rating, specs; actions **Export quotation PDF**, **Generate image** (html2canvas equivalent: `html-to-image`), **Create order**, **Save calculation**. Corrugate has a "combine" mode (multiple parts). Standard products CS: pick product, quantity tiers, zipcode → prices + stock. Service CS: choose services (design/plate/diecut/delivery/seal mold/mockup) and amounts → hierarchy preview.
- **Change factory** (`cs/change-factory/{type}/{order}`): reload the order's CS input, choose another factory/print type, re-calculate, show cost diff, confirm.
- Factory-side calculators (`calculate/folding_box`, `label`, `corrugated_box`, `calculate-folding-box-ajax`, `factory/folding-box`): same inputs but factory-scoped, show cost breakdown (waste, paper sheets, layout).

#### A.2.4 Catalogue & master data
- Mapping inputs (products): CRUD + **imageset manager** (combinations of paper/colour/area → open/close/dimension images), standard sizes per product, semi-designs link, `get_template_type`, video link, sort order (drag).
- Patterns: CRUD + set default per type; Paper grades: CRUD + **update prices** page (grid by flute/size) + Excel preview/update/export; Rigids/Standard products: CRUD, image gallery upload, Excel template/export/preview/upload for products and prices, min-price recompute button, stock history + adjust stock; Sample products & categories & product groups (set price per mapping input); Factories: CRUD, packaging toggles, shipping provider toggles, **manage-factories** margin matrix (factory × print type); Spec titles/details; Step prices; Master price tables (papers, print prices, finishes, diecuts, assemblies … — simple CRUD via `/v1/admin/master-prices/{table}`); Folding colour/DC legacy pages (`getFoldingColor`, `getFoldingDC`) → merge into master price tables.
- CMS: banners (upload/sort/delete, homepage feature), home sections (ordered list with move up/down), articles (TipTap, SEO fields, categories), FAQs, sitemaps (SEO meta per slug), google merchants, semi designs (+ templates per standard size, colours, font SVGs), designers.
- Customers: list, detail with orders, verify phone, generate `user_code`, send term. Users (staff): CRUD, roles, factory binding, status. Company/factory legacy pages (`company`, `create-company`, `manageUserData`) → fold into Users/Factories.

#### A.2.5 Promotions & points
Promotions CRUD (types fixed/percent/step, limits, dates, show flag), **priority** drag-sort, logs, usage report. Points: rewards + reward configs, campaign points, users points table (+ expire), redemptions, refund points per order, report with preview/export.

#### A.2.6 Reports & logs
Every report in domain context §11: filter bar (date range, factory, status, packaging type, payment channel…), server table, totals row, export xlsx, and for Payments also "send email". Logs: event logs (+report chart), calculate logs (view input/output JSON), search logs, download-drawing logs, tracking product logs, promotion logs, user designs (thumbnails).

#### A.2.7 Tools
Shipping cost by gsm (3 forms), S3 upload test, download drawing (pattern + size → file), quotations list/detail/PDF.

#### A.2.8 Dashboard (`/dashboard`, replaces `admin/dashboard` + home)
Cards: orders waiting approval, waiting artwork, in production, shipping today, unpaid expiring; recent activities; realtime alerts.

### A.3 Legacy-era UX rules (still valid)
- **App shell**: collapsible sidebar grouped by the role menu (§3), global search + **command palette (⌘K / Ctrl+K)** to jump to any order by code/phone/email, any screen, or any action; breadcrumb; notification centre (realtime) with unread count; environment badge (UAT/PROD).
- **Work queues first**: the dashboard and the Orders screen open on actionable queues ("รออนุมัติสลิป", "รอตรวจไฟล์", "รอเริ่มผลิต", "ใกล้ครบกำหนดส่ง", "ล่าช้า") with counts, SLA colour, and one-click bulk actions where safe (assign CS, send reminder, export).
- **Saved views**: every list lets users save filter/column/sort presets (per user, stored server-side) and share a view link.
- **Order detail** is a split layout: sticky summary header (code, customer, amount, status chips for order/payment/graphic/production, next best action button) + tabs; a right rail shows the unified timeline (legacy activity + v2 events) and internal notes with @mentions.
- **Inline editing** for simple fields with optimistic update and undo toast; complex changes in side sheets, not full page reloads.
- **CS calculators**: two-pane layout — inputs on the left in collapsible steps with live validation, results on the right as a comparison table (factory × print type × quantity) with the cheapest/fastest highlighted, sticky action bar (Export PDF, Create order, Save).

- Thai-first labels exactly as legacy (e.g. รอการชำระเงิน, รออนุมัติการชำระเงิน, ชำระเงินแล้ว, กำลังผลิต, กำลังขนส่ง, สำเร็จ, ยกเลิกการสั่งซื้อ); status badge colours consistent app-wide (defined once in `src/domain/status/*`).
- All destructive/irreversible actions (approve slip, manual start production, cancel, refund, credit note, delete) need a confirm dialog that repeats the order code and amount.
- Tables: sticky header, column visibility, saved filters in URL query, 25/50/100 page size, keyboard-friendly.
- Forms: inline zod errors in Thai, dirty-state guard on navigation, optimistic toasts (sonner) with server error message surfaced.
- Responsive down to tablet; desktop-first.
- Accessibility: focus rings, labelled inputs, aria on dialogs.
- Performance: RSC for list shells, client tables hydrate with initial data, `next/image` for S3/CDN images via `NEXT_PUBLIC_ASSET_BASE_URL`, code-split calculators.

