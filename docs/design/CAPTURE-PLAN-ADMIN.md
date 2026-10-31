# Admin console redesign — capture and plan (before state)

> **Source:** 198 `page.tsx` under `src/app/admin`: 195 console routes, plus `/login`, `[...rest]` (404) and `l/[token]` (deep link, not captured).
> **Captures:** `getpack/_shots/admin-v1/` — `<name>-1440.png`, `<name>-390.png`, `<name>.txt` (line 1 `# <path>`), `overflow.log`, `queue.json`.
> Account `superadmin@example.invalid`, GET only (no clicks, no form submits). Crawler: VM `$HOME/pw/crawladm.js` + `admroutes.json` (route templates; dedupe = one capture per template).
> **Result:** 186 of 195 templates captured. 0 failures. 0 pages wider than 390 or 1440. The 9 not captured have no UAT record (see "Data gaps").
> **Capture caveat:** `DataTable` scrolls inside `max-h-[72dvh]`, so a full-page shot of a list shows about 10 rows and the page has two scrollbars. Detail and form pages are full height.
> Audience: getpack staff at a desk (1280–1920 px). Phones are secondary: check, approve, reply. The bar is the same as the partner portal: a senior product studio, never template-like.

---

## 1. Inventory (195 console routes)

`*` = not captured (no data).

### G1 Sales & service — 33
`/` (overview), `/advisor`, `/advisor/[recommendationId]*`, `/approvals`, `/approvals/[requestId]`, `/assistant`, `/assistant/runs/[runId]`, `/claims`, `/claims/[claimId]`, `/companies`, `/companies/[companyId]`, `/cs`, `/cs/[type]`, `/customers`, `/customers/[customerId]`, `/inbox`, `/inbox/[conversationId]`, `/inbox/canned`, `/notifications/routes`, `/notifications/templates`, `/orders`, `/orders/[orderId]`, `/orders/call-offs`, `/orders/groups/[groupId]`, `/orders/new`, `/orders/reorders`, `/quotations`, `/quotations/[quoteId]`, `/reviews`, `/rfq`, `/rfq/[rfqId]`, `/samples`, `/samples/[sampleId]`

### G2 Production & logistics — 28
`/production`, `/production/inspections`, `/production/routes`, `/production/scorecards`, `/production/tooling`, `/prepress`, `/prepress/[orderId]*`, `/shipping`, `/shipping/calendar`, `/shipping/carriers`, `/shipping/zones`, `/shipments`, `/shipments/[shipmentId]`, `/partners`, `/partners/[factoryId]`, `/partners/boards`, `/partners/coverage`, `/partners/indices`, `/partners/proposals`, `/partners/proposals/[proposalId]`, `/partners/requests`, `/style-intakes`, `/style-intakes/[intakeId]*`, `/structural-requests`, `/structural-requests/[requestId]`, `/ops`, `/outbox`, `/designs/[documentId]*` (the artwork viewer, outside `(console)`)

### G3 Catalogue & content — 50
- **catalogue (5):** `/catalogue`, `/catalogue/[table]`, `/catalogue/import`, `/catalogue/product-types`, `/catalogue/readiness`
- **style-library (9):** `/style-library`, `/style-library/[styleId]`, `/style-library/content`, `/style-library/coverage`, `/style-library/fit-ranges`, `/style-library/imports`, `/style-library/next-styles`, `/style-library/rules`, `/style-library/studio-featured`
- **studio-catalog (2):** `/studio-catalog`, `/studio-catalog/elements`
- **pricing (5):** `/pricing`, `/pricing/guarantee`, `/pricing/margins`, `/pricing/margins/[tableId]`, `/pricing/payment-schedules`
- **discount-memos (1):** `/discount-memos`
- **cms (7):** `/cms`, `/cms/[table]`, `/cms/articles`, `/cms/articles/[articleId]`, `/cms/articles/new`, `/cms/home-cases`, `/cms/home-sections`
- **marketing (7):** `/marketing`, `/marketing/campaigns/[campaignId]`, `/marketing/loyalty`, `/marketing/promotions`, `/marketing/promotions/[promotionId]`, `/marketing/promotions/new`, `/marketing/referrals`
- **line (1):** `/line`
- **document-branding (1):** `/document-branding`
- **agents (12):** `/agents`, `/agents/[agentId]`, `/agents/applications`, `/agents/applications/[applicationId]`, `/agents/commissions`, `/agents/factories`, `/agents/leads`, `/agents/links`, `/agents/plans`, `/agents/plans/[planId]`, `/agents/statements`, `/agents/statements/[statementId]`

### G4 Finance — 69
- **Home and daily work (7):** `/finance`, `/finance/slips`, `/finance/payments`, `/finance/payments/[paymentId]`, `/finance/refunds`, `/finance/corrections`, `/finance/corrections/[requestId]*`
- **Receivables (10):** `/finance/documents`, `/finance/documents/[documentId]`, `/finance/credit-notes`, `/finance/credit-notes/new`, `/finance/receivables`, `/finance/receivables/aging`, `/finance/receivables/customers/[customerId]`, `/finance/receivables/dunning`, `/finance/receivables/statements`, `/finance/receivables/wht`
- **Payables and payouts (13):** `/finance/payables`, `/finance/payables/goods-receipts`, `/finance/payables/invoices`, `/finance/payables/invoices/[invoiceId]*`, `/finance/payables/purchase-orders`, `/finance/payables/purchase-orders/[poId]`, `/finance/payables/statements`, `/finance/payables/statements/[statementId]`, `/finance/payables/vendors`, `/finance/payables/vendors/[vendorId]`, `/finance/payouts`, `/finance/payouts/[runId]`, `/finance/payouts/exceptions`
- **Banking (5):** `/finance/banking`, `/finance/banking/accounts`, `/finance/banking/import`, `/finance/banking/lines`, `/finance/banking/unidentified`
- **Ledger (11):** `/finance/ledger`, `/finance/ledger/accounts`, `/finance/ledger/dimensions`, `/finance/ledger/journals`, `/finance/ledger/journals/new`, `/finance/ledger/journals/[journalId]`, `/finance/ledger/journals/[journalId]/edit*`, `/finance/ledger/periods`, `/finance/ledger/recurring`, `/finance/ledger/rules`, `/finance/ledger/rules/[key]`
- **Tax (5):** `/finance/tax`, `/finance/tax/[reportId]*`, `/finance/tax/calendar`, `/finance/tax/series`, `/finance/tax/settings`
- **Fixed assets (5):** `/finance/assets`, `/finance/assets/[assetId]*`, `/finance/assets/categories`, `/finance/assets/depreciation`, `/finance/assets/roll-forward`
- **Close, reports, audit (13):** `/finance/close`, `/finance/close/[period]`, `/finance/reports`, `/finance/reports/balance-sheet`, `/finance/reports/cash-flow`, `/finance/reports/gl-detail`, `/finance/reports/profit-and-loss`, `/finance/reports/reconciliation`, `/finance/reports/roll-forwards`, `/finance/audit`, `/finance/audit/exceptions`, `/finance/audit/pbc`, `/finance/audit/samples`

### G5 Platform — 15
`/users`, `/users/[userId]`, `/users/roles`, `/settings`, `/settings/[settingId]`, `/feature-flags`, `/privacy`, `/audit-logs`, `/customer-file-access-logs`, `/analytics`, `/reports`, `/reports/[reportKey]`, `/reports/files`, `/reports/schedules`, `/my-signature`

Total: 33 + 28 + 50 + 69 + 15 = **195**. Suggested run order: frame first, then G1 → G2 → G4 → G3 → G5 (by daily use and by how much each group gains from the frame).

---

## 2. Cross-cutting problems (with examples)

1. **Two or three layers of navigation above the content.**
   - Sidebar + area `SectionNav` + `QueueTabs`: `/orders` (orders · reorders · call-offs, then 6 queue tabs); `/style-library` (8 section tabs + 3 queue tabs); `/style-library/[styleId]` (8 section tabs + 5 record tabs); `/partners/[factoryId]` (11 tabs).
   - Finance adds a second sidebar (`features/admin/finance/nav.tsx`) beside the main one, plus a tab row. On `/finance/ledger/journals` at 1440 the content column is about 700 px, and the table cuts the "amount" column at the right.
   - On phones the finance nav becomes a sideways tab row that cuts its labels ("การรับชำระ").
   - `SectionNav` is used in 20 files and `QueueTabs` in 25. Both are underline tabs, so two stacked rows look the same and the hierarchy is lost.
2. **Tab counts are missing or disagree with the rows.**
   - `QueueTabs` takes counts from the dashboard's queue summary (`countKey`), so only some tabs have a count, and no tab says how many rows it shows.
   - The sidebar badge on `/orders` says 18, while its default queue ("รอชำระ") lists 4 rows.
   - The overview says "รอโรงงานรับงาน 2 · เกินกำหนด 2", but `/production` shows 0 jobs in every column.
   - Partner rule to apply: count = the rows of that tab, from `meta.total` with the same query.
3. **No figure strip on list pages.** Admin has 0 uses of `SummaryCards`, `StatStrip` or `PartnerStats`.
   - The overview (`dashboard/Dashboard.tsx`) uses cards with red, amber or green `border-s-4` stripes. This is a template look and the stripe is decoration, not data.
   - `/finance` is a 3-column wall of 10 equal cards, 8 of them showing 0 (on a phone, 10 full-width cards).
4. **Raw keys, developer copy and decision numbers shown to staff.**
   - `/ops`: four rows show `platform.ops.signals.*` keys, because the th messages are missing. The server log shows `MISSING_MESSAGE` for `claim_response_overdue`, `claim_decision_overdue`, `conversation_first_response_overdue` and `journey_conversion_drops`.
   - `/` "อัปเดตถึงฉันล่าสุด": "แจ้งเตือนระบบ: acceptance_overdue" with an English body that contains "(D-074)".
   - `/approvals/[requestId]`: the payload is printed as-is ("Origin factory_proposal", "Product type label_sticker", "2026-10-12T14:56:37.276Z").
   - `/settings`: raw keys, JSON blobs as values, English descriptions with D-numbers; the page is 13,600 px tall.
   - `/users/[userId]`: the role appears as `sales_manager`.
   - `/finance/ledger/journals`: the source document is a truncated uuid ("01a1309b").
5. **Pagination per-page select renders blank.**
   - `Pagination` offers [25, 50, 100]. Lists that default to 10 or 20 (`/orders`, `/finance/ledger/journals`, …) show an empty select.
   - Fix it once in `ui/components/Pagination.tsx`: include the current `perPage` in the options, or align the defaults.
6. **Lists scroll inside a box.**
   - `DataTable` has `max-h-[72dvh] overflow-auto`, which gives two scrollbars and a pager pinned mid-page.
   - Decision for the frame: let the page scroll, keep the header row sticky under the topbar, and keep the pager at the end of the list.
7. **Toolbars are tall and split.**
   - Filters are label-above selects (`ListSearch` + `FilterControl`), so the toolbar is about 2 rows high. "มุมมองที่บันทึก", columns and export float to the right.
   - `/finance/ledger/journals` wraps its filters to two lines. On phones, the toolbar buttons wrap onto two rows and the primary ("สร้างคำสั่งซื้อแทนลูกค้า") sits on a third.
   - Partner pattern to apply: `ListToolbar` (ViewTabs left + search right, one row), then a lighter `FilterLinks` / filter-chip line.
8. **Too many filled or repeated actions.**
   - `/approvals`: each pending card has its own filled "อนุมัติ" (3 filled primaries in one region).
   - `/quotations`: every row has "สร้างคำสั่งซื้อ" + "เปิด", including expired quotes.
   - `/partners/[factoryId]` onboarding: "ปรับ …" 13 times in bold.
   - `/production`: the "ทั้งหมด" filter is a filled button.
   - `/shipments/[shipmentId]`: a filled "รับหลักฐาน" in the POD card plus a filled header primary.
   - Rule: one filled primary per region. Row actions = row click + one "⋯" `DropdownMenu`.
9. **Detail pages lack the sticky next-steps panel, or put it in the wrong place.**
   - `/quotations/[quoteId]`, `/customers/[customerId]`, `/users/[userId]` and `/approvals/[requestId]` have their actions only in the header, and a half-empty right side or none.
   - `/orders/[orderId]` and `/rfq/[rfqId]` have a stage rail on the right (good), but the actions are top-right in the header. On a phone the rail falls below three long cards.
   - The order timeline repeats "อัปเดตคำสั่งซื้อ" 12 times with no detail.
   - `NextActionBar` (11 files) should gain `layout="panel"` as partner `ActionBar` did.
10. **Forms are flat.**
    - `/marketing/promotions/new` is about 1,220 px tall. Its save button is only in the header, and its sections are unnumbered with no summary. "ประเภทสินค้า" is a label with no control.
    - There are 82 native `type=date|month|datetime-local` inputs. In the Thai UI they render as "mm/dd/yyyy" and "January 2026" (`/finance/reports/profit-and-loss`).
    - Apply: `FormColumns` + `FormSection card step={n}` + `FormSummary` / `StickySave`, and a Thai date field.
11. **Empty states without a next step.**
    - About 115 of 119 `<EmptyState>` in admin have no `action` (regex scan).
    - `/orders/new` is a dead end ("ต้องเริ่มจากใบเสนอราคา") with no link to `/cs` or `/quotations`.
    - `/cs/[type]` shows only an info callout.
    - `/production` repeats "ไม่มีงาน" in 4 dashed boxes.
12. **Data and state bugs seen in the captures** (fix while touching):
    - `/inbox/[conversationId]` SLA reads "เลยมา -2261 นาที" (negative).
    - `/analytics` journey funnel shows "166.6%" and "300%" step conversion; the funnel bar chart loses some x labels; the trend uses an off-palette blue series.
    - `/approvals` history table is still a skeleton after 2.5 s.
    - The `/production` kanban cuts its 4th column at the right edge at 1440.
    - The sidebar's account block is cut at a 900 px viewport when "ระบบ" is open, because it scrolls with the menu.
13. **Build flake (environment, for the coordinator).**
    - The first rebuild on 2026-10-31 produced `InvariantError: client reference manifest … does not exist` for 13 admin routes, and the client error boundary on about 100 admin pages.
    - An identical second rebuild fixed it.
    - If a capture shows "เกิดข้อผิดพลาด · Something went wrong" on many pages, rebuild before you debug.

---

## 3. Frame-level fixes first (one pass that lifts all 195 pages)

Promote partner pieces to shared code. Keep the partner files as thin re-exports, as was done for `SummaryCards` and `Panel` (files cannot be deleted on the mount). None of them depend on partner code except `ActionBar`.

| Partner piece | Move to | Shared name | Admin use |
|---|---|---|---|
| `frame.tsx` `PartnerPage` | `src/ui/components/DeskPage.tsx` | `DeskPage` (title, back, meta/status slot, lede, actions, width) | Replaces `ConsolePage` + `PageHeader` pairs (193 + 183 imports). `ConsolePage` becomes a wrapper over it so pages move gradually. |
| `frame.tsx` `PartnerSection` | same file | `DeskSection` | Titled blocks on detail and settings pages |
| `frame.tsx` `PartnerStats` (+ `fit()`) | `src/ui/components/SummaryCards.tsx` | `StatsRow` (`columns` 3–6) | A figure strip on every queue/list (API figures only) and on `/`, `/finance`, `/analytics` |
| `frame.tsx` `PartnerDetail` + `ActionPanel` | `src/ui/components/DetailLayout.tsx` | `DetailLayout`, `ActionPanel` | Every `[id]` page: main column + sticky right panel (status, amount, next steps); on a phone the panel goes first, compact |
| `frame.tsx` `PageError` | `src/features/shared/errors/PageError.tsx` | `PageError` | Uses `common.errors` + `isApiError`, so it belongs in features/shared, not ui |
| `rows.tsx` `ViewTabs`, `ListToolbar`, `FilterLinks` | `src/ui/components/ViewTabs.tsx` | same | Replaces `QueueTabs` visuals (keep its URL logic) and the second `SectionNav` row |
| `rows.tsx` `RowList`, `Row`, `Code`, `StatStrip` | `src/ui/components/RowList.tsx` | same | Overview queues, "คิวงานอื่น", settings index, phone lists |
| `form-layout.tsx` (`FormColumns`, `FormSummary`, `SummaryRows`, `StickySave`) | `src/ui/components/FormLayout.tsx` | same | All `/new`, `/edit` and settings forms. `MobileActionBar` offset: admin has no tab bar, so pass `className="bottom-0 pb-[calc(0.625rem+env(safe-area-inset-bottom))]"` (as on the driver page) or add a `zoneTabBar={false}` prop. |
| `period.tsx` `PeriodPicker` + `bangkokMonth/shiftMonth/shiftDay/stepLabel` | `src/ui/components/PeriodPicker.tsx` + `src/lib/period.ts` | same | Finance reports, close, tax, aging, roll-forward (replaces native month inputs) |
| `statement.tsx` `Statement` | `src/ui/components/Statement.tsx` | same | `/finance/reports/*` (P&L, balance sheet, cash flow), `/finance/tax/[reportId]` |
| `charts.tsx` `BarValue`, `Composition`, `TrendChart` | `src/ui/components/charts/` | same | `/analytics` and finance (replace Recharts `ui/components/Chart` where it only draws a line or a funnel). Keep Recharts only where interaction is needed. |
| `erp/ActionBar.tsx` panel stacking | `src/features/shared/actions/ActionStack.tsx` (`refresh` injected) | `ActionStack` | `NextActionBar layout="panel"`: first unblocked = filled, other constructive = outlined, destructive last, `data-fill="row"` |
| `erp/server.ts` `viewTotals` | new `features/admin/console/view-totals.server.ts` (same contract) | `viewTotals` | Tab counts = rows. `ResourceList` gets `views` + counts from `meta.total`. |

New or changed admin frame pieces:
- **Navigation:**
  - Merge `SectionNav` into the sidebar as nested items for areas with ≤ 6 pages (orders, partners, production, shipping, pricing, cms).
  - Keep one `ViewTabs` row for the list's views.
  - Finance: drop the second sidebar. Use a section switcher in the page header (`finance/nav.tsx` → `DeskPage` back + `ViewTabs` for the area) and nest finance areas in the main sidebar under "การเงิน".
- **`ResourceList`:**
  - One-row toolbar: views left, search + filter button + "⋯" (saved views, columns, export) right; active filters as removable chips under it.
  - The page scrolls (drop `max-h-[72dvh]`).
  - Sticky header row; row click + "⋯" row menu.
  - Fix the pager per-page select.
- **Empty states:** every `EmptyState` in admin gets `action=`. Extend the dead-ends test (`customer/shell/dead-ends.test.ts`) to `src/features/admin`, with an honest allow-list.
- **Copy:**
  - Add the 4 missing `platform.ops.signals.*` th keys (+ en).
  - Map approval payload fields and role keys through i18n (`admin.approvals.fields.*`, `iam.roles.*`).
  - Settings: show the label + human description from i18n; raw key and D-refs in a muted "technical" disclosure.
- **Dates:** a shared `DateField` (Thai display, Buddhist year, ISO value) to replace the 82 native date/month inputs in admin.
- **Overview cards:** flat `StatsRow` figures with an "overdue" `Badge`, and no coloured side stripes.
- **Design-language test:** add `border-s-4` side stripes to the banned list for admin, or prove they carry data.

---

## 4. Per group: key patterns and specific problems

### G1 Sales & service (33)
- **Patterns:**
  - queue list (orders, quotations, rfq, claims, samples, inbox);
  - record detail with a stage rail (order, rfq, claim, sample);
  - conversation (inbox);
  - calculator (cs);
  - approval queue + detail.
- `/`: a greeting + 4 striped cards + "คิวงานอื่น" + system signals. Instead: `StatsRow` (late, waiting payment, waiting factory, slips), "my queues" `RowList` with counts that equal their lists, signals in plain Thai with a link to `/ops`, and the approvals list.
- **`/orders`:**
  - 3 section tabs + 6 queue tabs without counts; badge 18 ≠ 4 rows; blank per-page select.
  - On a phone the toolbar takes 3 rows and the card list has a checkbox on top of each card.
- **`/orders/[orderId]`:**
  - Move the actions into the sticky panel above the stage rail (start production, ⋯).
  - Collapse the repeated timeline entries ("อัปเดตคำสั่งซื้อ" ×12) into one per day with a field diff.
  - The address card shows a bare "1".
  - The internal note box sits in the side column: move it to its own tab or the bottom.
- **`/quotations`:**
  - Most rows show "ยังไม่ออกเลขที่" as the identifier, so the customer + spec should lead the row.
  - Every row has 2 actions.
  - Expired quotes still offer "สร้างคำสั่งซื้อ".
- `/quotations/[quoteId]`: two header buttons (requote filled, PDF outlined) and no right panel. Use `DetailLayout` + `ActionPanel` (total, validity, convert to order, requote, PDF).
- `/customers/[customerId]`: 5 tabs, a facts card, no figures. Add `StatsRow` (orders, 12-month spend, points) and actions (start a quote for the customer, message).
- `/approvals` + `[requestId]`: 3 filled "อนุมัติ" in one list; history stuck loading; the payload is raw. Decision panel = `ActionPanel` (approve filled, reject outlined, reason field).
- `/inbox/[conversationId]`: negative SLA minutes. The composer floats mid-page; the thread should fill the height with the composer sticky at the bottom, and "รับเรื่องนี้" and "ปิดบทสนทนา" as one primary + ⋯.
- `/orders/new`, `/cs/[type]`: dead ends. Give them an action (to `/cs`, to `/rfq`).
- `/notifications/*`, `/reviews`, `/assistant`, `/advisor`: plain lists. They need the frame only.

### G2 Production & logistics (28)
- **Patterns:**
  - kanban board (production, prepress);
  - queue lists (inspections, proposals, requests, style-intakes, structural-requests);
  - shipment detail with POD;
  - partner record with 11 tabs;
  - settings tables (shipping zones, carriers, calendar);
  - system tables (ops, outbox).
- `/production`: 5 section tabs; a filled "ทั้งหมด" filter; the 4th column is cut at 1440; "ไม่มีงาน" ×4. Use the `ScheduleBoard`-style horizontal board with a sticky stage header, `StatsRow`, and one board empty state with an action.
- **`/shipments/[shipmentId]`:**
  - Good bones: POD card, destination, items, handover link.
  - Move "รับหลักฐาน / ไม่รับหลักฐาน" into the sticky panel as the one primary.
  - The header has 3 buttons (packing list, labels, check POD filled).
  - The carton list should be the chip grid used on the driver page.
- **`/partners/[factoryId]`:**
  - 11 tabs: group them into Profile / Capability / Commercial / Performance.
  - The onboarding table repeats "ปรับ …" ×13: use a row "⋯".
  - The progress bar is heavy: use a "13/13" `Badge` in the header.
- `/ops`: 4 untranslated rows; numbers without units ("1,698" minutes). Show figure + unit + threshold, and tone from `Badge` + an icon, not colour only.
- `/outbox`, `/partners/coverage`, `/style-intakes`, `/prepress`: empty in UAT. They need empty states with actions.

### G3 Catalogue & content (50)
- **Patterns:**
  - card index of tables (`/catalogue` 30 cards, `/cms` 10 cards);
  - generic CRUD table (`/catalogue/[table]`, `/cms/[table]`);
  - style library workspace (8 tabs);
  - form pages (promotions/new, articles/new);
  - agent programme lists.
- `/catalogue`, `/cms`: a wall of identical icon cards with "0 รายการ". Replace with a grouped `RowList` index (name, count, last change) with zero-count rows muted, and a search box.
- `/style-library` and `[styleId]`: 8 + 3 / 8 + 5 tab rows. Merge sections into the sidebar, keep one `ViewTabs`, and put the readiness checklist in the side panel with "ดูหน้าร้าน" there. The "การแสดง" column is empty.
- `/marketing/promotions/new`: numbered `FormSection`s (1 basics, 2 conditions, 3 benefit, 4 limits), `FormSummary` (what the customer gets, period, budget) with save, a Thai `DateField`, and fix the empty "ประเภทสินค้า" control.
- `/pricing/*`, `/discount-memos`: money tables. Use `BarValue` for margins and tabular numerals, with the figures from the API only.
- `/agents/*` (12): lists + statements. Use `Statement`-like layouts for commission statements and `StatsRow` on `/agents`.
- `/line`, `/document-branding`: settings-like pages. Use `SettingsFrame` (partner `settings/SettingsFrame.tsx` → promote to `src/features/shared/settings/`).

### G4 Finance (69)
- **Patterns:**
  - work home (`/finance`);
  - document lists with status views;
  - document detail (invoice, payment, PO, vendor, statement);
  - ledger tables (journals, accounts, rules);
  - period pages (close, tax, aging, roll-forward);
  - statements (P&L, BS, CF, GL detail);
  - audit workpapers.
- **Navigation:** the second sidebar takes about 150 px at every width. Fold it into the main sidebar and use `ViewTabs` for the area's pages.
- `/finance`: 10 equal cards, mostly 0. Show `StatsRow` for the 4–6 that have work, and a "nothing waiting" `RowList` line for the rest; approvals below.
- `/finance/ledger/journals`: filters on 2 lines (search, account, type, status, from/to native dates); a blank per-page select; uuid source refs. Use `ListToolbar` + `PeriodPicker`, a document number + link for the source, and make the journal number a link styled with `text-primary`.
- `/finance/reports/profit-and-loss` (and BS, CF): a one-row table + 5 figure cards with native month inputs in English. Use `Statement` (headings, indented lines, subtotal rules, comparative column) + `PeriodPicker` + export in the header.
- Document details (`documents/[id]`, `payments/[id]`, `payables/*/[id]`, `payouts/[runId]`): `DetailLayout` + `ActionPanel` (amount, status, next steps), with the document shown as a clean document view.
- `/finance/tax`: a good month table. Add `PeriodPicker` and one "create all drafts" primary (now a filled button + 7 "สร้าง" links).
- `/finance/close/[period]`: a checklist with a sticky progress panel (partner `/settings` scroll-spy pattern).

### G5 Platform (15)
- **Patterns:** user and role admin, settings registry, logs (audit, file access), privacy requests, analytics dashboard, reports catalogue.
- `/settings` (13.6k px): group by area with `SettingsFrame` + scroll-spy nav. Each setting is a row (human label, current value formatted, status `Badge`, "แก้ไข" → `/settings/[settingId]`). JSON goes behind a "ดูค่าแบบเทคนิค" disclosure, and D-refs are muted.
- `/users/[userId]`: role `sales_manager` → an i18n label. The header has an outlined destructive "ปิดใช้งานบัญชี" next to "ออกจากระบบทุกอุปกรณ์"; move both to the panel, destructive last.
- `/analytics`: 8 KPI cards + Recharts bars and lines. Use `StatsRow` + `TrendChart` (green first, greys after; no blue), funnel as `Composition`/`BarValue` rows, and cap conversion at the data's meaning (fix the 166.6%).
- `/audit-logs`, `/customer-file-access-logs`: dense log tables with the frame toolbar + `PeriodPicker`.

---

## 5. Data gaps (no UAT data to view)

- **Detail templates not reached (no row in UAT):**
  - `/advisor/[recommendationId]`, `/designs/[documentId]`, `/prepress/[orderId]`, `/style-intakes/[intakeId]`;
  - finance: `/finance/assets/[assetId]`, `/finance/corrections/[requestId]`, `/finance/ledger/journals/[journalId]/edit` (only drafts), `/finance/payables/invoices/[invoiceId]`, `/finance/tax/[reportId]` (no report generated).
- **Lists captured empty (an empty state only):**
  - G1: advisor; `/orders/call-offs`, `/orders/reorders`.
  - G2: prepress, production board, outbox; shipping (calendar, carriers, pending versions); `/partners/coverage`, style-intakes.
  - G3: discount-memos, document-branding (signatories), line (rich menu), studio-catalog (+ elements); style-library content, next-styles and rules; cms home-cases; `/agents/factories`.
  - G4 finance: assets (+ roll-forward), audit pbc/samples, banking lines, credit-notes, ledger/recurring, payables/invoices, payouts/exceptions, receivables aging/dunning/statements, refunds, reports/cash-flow sections.
  - G5: privacy; reports files and schedules.
- **Seed needed before the "after" captures (coordinator / API):**
  - a prepress job;
  - a style intake;
  - a fixed asset;
  - a correction request;
  - a vendor bill;
  - a generated tax report;
  - a draft journal;
  - an advisor recommendation;
  - a promotion;
  - a dunning run;
  - a shipping holiday.
- **Without seed data:** use the render harness (`$HOME/work/render`) with literal props, as for the partner `ScheduleBoard`.

---

## 6. How to re-capture

```
cd $HOME/pw; O=$HOME/mnt/Collective/getpack/_shots/<outdir>; mkdir -p $O
GP_PW="$(cat $HOME/.gp_pw)" LD_LIBRARY_PATH=$HOME/pw/libx/usr/lib/aarch64-linux-gnu \
  timeout 172 node crawladm.js admin.localhost:3001 superadmin@example.invalid $O 168   # repeat until "left in queue 0"
```

- With no `queue.json`, the run seeds every static route from `admroutes.json` and follows links, one capture per route template.
- It skips logout, `/l/`, `/bff`, delete/actions/export/download URLs.
- To re-capture a subset, write `queue.json` as `{queue:[paths], seen:{}, done:[]}`.
- Regenerate `admroutes.json` from `src/app/admin/(console)/**/page.tsx` when routes change.
