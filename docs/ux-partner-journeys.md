# Partner zone — UX & journey programme

Asked for by the product owner on 2026-10-14: improve the UX/UI and the journeys of **every partner menu** (Packio
and the factory ERP), menu by menu, walking each as its real user, until the system is complete. Decisions are
delegated; API-side decisions are recorded in packio-api `docs/decisions.md` (D-399 onwards).

How a menu is walked: sign in as the role that lives in it (UAT users `factory-<role>@uat.example.invalid`), on a
1280 px office screen and a 390 px phone, with rehearsal data from `pnpm uat:populate`; do the job end to end; note
what blocks, confuses, is missing or is out of place; fix it (web, and API when a feature needs it); walk it again.

| Round | Menus | Status |
|---|---|---|
| 1 | The day's work: Today, alerts, jobs, floor, kiosk, QC, samples, shipping, claims, the shell | **done** (web `feat/ux-round1-daily`, API v0.51.0) |
| 2 | Stock and buying: stock, purchasing, RFQs, trading partners | **done** (web `feat/ux-round2-supply`) |
| 3 | Planning and the floor: planning, schedule, maintenance, machines, people, capacity, hours | **done** (web `feat/ux-round3-plan`) |
| 4 | Quality: checks, NCRs, templates | **done** (web `feat/ux-round4-quality`) |
| 5 | Sales: CRM, quotations, sales orders, deliveries | **done** (web `feat/ux-round5-sales`) |
| 6 | Finance: invoices, receivables, tax, payables, Packio billing and payouts, prices, shipping rates | **done** (web `feat/ux-round6-finance`, API v0.52.0) |
| 7 | The books: ledger, journals, reports, accounts, assets, bank | **done** (web `feat/ux-round7-books`) |
| 8 | Insight: dashboard, costs, profit, OEE | **done** (web `feat/ux-round8-insight`, API v0.53.0) |
| 9 | The factory: performance, style intakes, documents, requests, knowledge, settings, support access, onboarding | **done** (web `feat/ux-round9-factory`) |

## Round 1 — the day's work

**Walked as** the owner (everything), an operator (floor, kiosk), QC (queue) and shipping.

| # | Finding (as the user) | Fix |
|---|---|---|
| 1.1 | Today showed only Packio work; the ERP's approvals and deadlines were nowhere — the owner had to open every menu to find what waited for him. | ERP inbox (API D-399) merged with the Packio tasks in four sections — *waiting for your approval*, *overdue*, *today*, *coming up* — with a summary strip that jumps to each; each row opens the document or its list. |
| 1.2 | A Packio job offer with a 24-hour clock was only a row in the queue at the bottom. | Each offer is a task at the top ("รับงาน Packio … ตอบรับหรือปฏิเสธภายใน …"); the Packio counters and queue sit under their own heading. |
| 1.3 | The owner's sidebar had ~50 items in nine groups — a long scroll to find anything. | Groups fold (the day's work and the current group stay open; choices remembered on the device), and a menu search (press `/`, Enter opens the first match). |
| 1.4 | View tabs (alerts' kinds, jobs' views) ran off the right edge on a desktop. | Tabs wrap on wider screens; a phone still scrolls them sideways. |
| 1.5 | A mock-up job read "กล่อง 1 ชิ้น" with a 500-piece delivery under it — nothing said it was a mock-up. | Job kind badge (mock-up / re-production) in the job list and on the job, and a note explaining the quantity. |
| 1.6 | A Packio job and the production order made from it were two worlds: the job did not say whether materials were ready or where to plan it. | "ในระบบโรงงาน" card on the job: its MO, status, materials ready / missing, progress, due day, link. |
| 1.7 | The floor offered *start* on every step of every order at once (step 100 "ready to ship" before step 30). | One card per order with the step to do now (running or paused first); later steps folded under it in order. Zero planned minutes are no longer shown. |
| 1.8 | Production orders from Packio jobs showed `partnerErp.common.units.piece` (unit `piece` unknown to the ERP). | API maps Packio's `piece` to `pcs` (D-400) and migrates old rows; screens fall back to the raw unit rather than a key. |
| 1.9 | Countdowns ("รับงานภายใน 23 ชม. 34 นาที") broke hydration when the minute turned between server and browser. | The timer text is allowed to differ at hydration. |
| 1.10 | The kiosk lived inside the office shell — a tablet by the machine showed the sidebar and dimmed after a minute. | A full-screen switch next to the kiosk's actions, and the screen is kept awake while the kiosk is open (Wake Lock). |
| 1.11 | A claim said "Packio wants an answer" with no deadline; its references were plain text. | The answer-by time (and an overdue warning) from the claim's SLA; the job reference opens the job; the claimed amount is shown. |

Already good and kept: the job page (accept with the countdown, spec and approved artwork before saying yes, steps
with one next action), the shipment page (labels → dispatch → proof of delivery), the samples evidence form, the QC
queue.

## Round 2 — stock and buying

**Walked as** the storekeeper (receive, issue, count, transfer) and the purchaser (requests, orders, RFQs, suppliers).

| # | Finding (as the user) | Fix |
|---|---|---|
| 2.1 | The storekeeper and the purchaser had no Today — the goods due today, late orders and items below reorder (now in the inbox) had no home for them. | Today joins both roles' menus (first on the phone's bar). |
| 2.2 | A month-end count meant adding items one by one into a form, without seeing what the system holds. | A **count sheet** for the whole warehouse: every item with the system quantity (or hidden for a blind count), the count typed beside it, the difference live, "only differences" filter, search, print; only lines counted are posted as one count with its reason; items kept by lot go to the single-item form. |
| 2.3 | "เบิกของ" asked for a free-text job reference, while the production orders waiting for material were elsewhere. | The issue page lists the orders on the floor first (material ready / not enough in stock) and opens the order, where issuing follows its recipe; the free form stays for other issues and returns. |
| 2.4 | A supplier's or customer's page did not say what is open with them. | "ยอดค้าง": what we owe the supplier and what the customer owes, with the overdue part, each opening the filtered list. |
| 2.5 | A purchase order showed no money until it was saved. | A live estimate (before VAT, VAT, total — inclusive / exclusive / none) while typing, replaced by the saved figures. |
| 2.6 | On a phone, three-way switches (supplier / customer / both) pushed the page sideways. | Segmented controls wrap their labels on small screens (every form). |
| 2.7 | Sweep: every partner page at 390 px. | No page scrolls sideways now; no page or console errors (two attribute warnings were the test browser's own caret style). |

Already good and kept: receiving from the open purchase orders (lines prefilled, partial receipts), the stock overview's
tiles and low-stock view, purchase requests → orders, RFQ comparison, the supplier scorecard and prices per item.

## Round 3 — planning and the floor

**Walked as** the planner (orders, recipes, the machine schedule, maintenance, machines, shifts and skills, weekly capacity, hours).

| # | Finding (as the user) | Fix |
|---|---|---|
| 3.1 | A production order could not be changed at all from the screens — the API allowed it (`erp_mo.edit`) but there was no page: a wrong due date, priority or material meant cancelling and starting again. | **Edit production order**: title, start, due, priority (0–9, the floor sorts by it) and note while open; quantity, materials and steps while still planned (a Packio job's steps follow the job). Opened from the order's actions. |
| 3.2 | The order page offered start / finish on every step at once. | Buttons on the step to do now (and running, paused, done ones); later steps fold "บันทึกขั้นนี้ก่อนลำดับ"; zero planned minutes are not shown. |
| 3.3 | Weekly capacity was read-only for the factory, though its planner may change a week (API `factory_capacity.manage`) — an overhaul or a holiday could not be entered. | "ปรับสัปดาห์นี้" in each week's cell: capacity and reason; Packio books new jobs against it. |

Already good and kept: the planning overview and MRP shortages, the machine schedule with auto-plan, drag and lock, the
maintenance orders and plans, machine pages with their kiosk and breakdown buttons, shifts / skills / work log, hours
and closures.

## Round 4 — quality

**Walked as** QC (record a check on a tablet, a failed final check, its NCR to closure, templates).

| # | Finding (as the user) | Fix |
|---|---|---|
| 4.1 | Adding photos to a check showed the browser's own English "Choose Files / No file chosen". Same on the document logo and the bank-statement import. | A picker button in the app's words ("ถ่ายรูป / เลือกรูป" opens the camera on a tablet), in every one of the three places (`FilePickButton`). |
| 4.2 | In a check's results, a failed point looked like a passed one. | Failed points in red, passed in green. |

Already good and kept: the check form from its template (limits, pass / fail / n.a., counts, conditional result), the
automatic NCR from a failed check with its link both ways, the NCR's cause → correction → prevention → disposition →
verification, the COA, templates with checkpoints.

## Round 5 — sales

**Walked as** the sales desk (pipeline, a quotation to an order to a delivery) and the maintenance crew (its morning).

| # | Finding (as the user) | Fix |
|---|---|---|
| 5.1 | The sales desk and the maintenance crew were sent past Today (to the pipeline, to the orders), so their inbox — quotations expiring, follow-ups due and late, drafts not confirmed; machines down — never showed. | Both open on Today like everyone else; the pipeline and the orders stay one tap away. |
| 5.2 | Quotations and sales orders showed no total until saved. | The live estimate (before VAT, VAT, total) — the same component as purchase orders. |
| 5.3 | "ใบส่งของ" opened on an empty list; the orders waiting to be delivered were on another screen. | Orders confirmed but not fully delivered are listed on top (delivered %, due day, late in red), each starting its delivery note. |

Already good and kept: the CRM overview by stage and salesperson, leads → opportunities → quotations, the quotation and
sales-order pages (credit limit, reservations, delivered / invoiced per line, PDFs), delivery notes.

## Round 6 — finance

**Walked as** the accountant (month end: invoices, receipts, payables, Packio statements and payouts, tax) and the owner
(confirming a Packio statement, prices and shipping rates).

| # | Finding (as the user) | Fix |
|---|---|---|
| 6.1 | A document said nothing about what it put in the books — to see the entry of an invoice, a receipt, a goods receipt or a Packio payout the accountant searched the journals by number. | "บันทึกบัญชีแล้ว": every posted document (Packio statement and payout, sales invoice and note, receipt, supplier invoice and payment, goods receipt, delivery note, production order) lists its journal entries — number, rule, debit / credit lines — each opening the entry (`PostedEntries`, ledger readers only). |
| 6.2 | The sales VAT register left out the factory's sale to Packio: its VAT was in the ledger and in the PP30 check, but not in the report the accountant files from. | API D-401: Packio statements the factory confirmed in the month are rows of the sales register ("ใบกำกับภาษีถึง Packio"), numbered by the factory's tax invoice once recorded; the PP30 summary and the export include them; the note says so. |
| 6.3 | Register lines were text — checking one meant finding the document elsewhere. | Each line opens its document (invoice, note, supplier invoice, Packio statement); document numbers do not break. |
| 6.4 | The tax month had only a month picker; PP30 is filed for last month. | "‹ เดือนก่อน / เดือนถัดไป ›" beside the picker on every tax view. |
| 6.5 | Negative amounts read "฿-100.00". | "-฿100.00" everywhere (the sign before the symbol, as Intl writes it). |
| 6.6 | A confirmed Packio statement without the factory's tax invoice looked done, though Packio pays only once it is attached. | Billing summary (to check and confirm / confirmed, tax invoice to attach / disputed, with amounts); such rows are marked "ต้องแนบใบกำกับภาษี". |
| 6.7 | Payouts and shipping rates are menus of their own but opened with a "back to billing / prices" link. | The back links are gone on top-level menus. |

Already good and kept: invoices from deliveries or orders with the tax-invoice switch, receivables aging and receipts
with allocation, payables with the 3-way match and WHT at payment, 50 ทวิ, the payout schedule per order (advance,
balance, retention) and the statement of account, factory prices with proposals, the shipping rate card with its
pending version.

## Round 7 — the books

**Walked as** the accountant closing October (periods, journals, a manual entry, reports, chart, assets, bank).

| # | Finding (as the user) | Fix |
|---|---|---|
| 7.1 | The periods list started with November and December (opened ahead, empty) and named months "2026-10"; nothing said which month to close next. | Months up to this one only, named "ต.ค. 2569", with "เดือนนี้" and "ถึงเวลาปิดงวด" on the oldest open month before it. |
| 7.2 | The monthly returns table was a dead end. | Each return opens its tax report for the month (PP30 summary, PND.3 / 53). |
| 7.3 | The close checklist said "ยังไม่ผ่าน" without saying how to put it right, in a narrow column. | A full-width checklist; each failing check says what usually causes it (e.g. stock held before the ledger start needs an opening journal) and links to where it is fixed (stock value, payables aging, receivables, tax, bank, assets, production orders). |
| 7.4 | Journals could be filtered by month and account only by editing the address. | A month and account-code filter with "clear"; entry numbers, dates and kinds no longer break over two lines. |
| 7.5 | An entry's rule and accounts were plain text. | The rule opens its versions; each account opens its general ledger for the entry's month. |
| 7.6 | An unbalanced manual journal meant working out the difference by hand. | "ใส่ยอดที่ขาดให้สมดุล" puts the difference on the lighter side (a blank line there, else a new line). |
| 7.7 | Cash in hand below zero showed as an ordinary figure. | Shown in red with "ติดลบ — มีรายการขาดหรือผิด", opening the cash account's ledger. |
| 7.8 | Fixed-asset numbers broke over lines; depreciation runs showed "2026-10" and a column of counts headed "asset name". | Month names, "รายการบัญชี" and "จำนวนสินทรัพย์" columns. |

Already good and kept: the overview strip, maker-checker journals with reversal and auto-reversal, recurring journals,
the trial balance → general ledger → entry → document drill-down, P&L / balance sheet / cash flow in the DBD layout,
stock value vs. ledger, the chart with rule editor, bank import with auto-match and fees.

## Round 8 — insight

**Walked as** the owner (how is the month going, what does a Packio job earn, how are the machines doing).

| # | Finding (as the user) | Fix |
|---|---|---|
| 8.1 | The dashboard's "sales this month" counted only the factory's own invoices (฿8,350) while Packio — most of the work — had paid ฿239,951 that month; the owner could not see his main income. | "งานจาก Packio" first on the dashboard (API D-402): revenue from statements confirmed this month, statements to confirm (with the amount), confirmed ones still needing the tax invoice; the own-sales tile is named as such. |
| 8.2 | Gross profit was by customer, item and sales order only — a Packio job's margin could not be seen. | "งาน Packio" view (the default): each job finished in the month, the purchase order's net over the production order's cost, opening the job's cost sheet. |
| 8.3 | A job with nothing issued and no machine time showed a 100 % margin. | Marked "ยังไม่มีต้นทุน" (no %), and the total warns how many jobs have no cost yet. |
| 8.4 | OEE showed 0 % on a day a machine ran without a shift (1,440 / 0 minutes), dragging the week down. | API D-403: time run beyond the planned time extends it — availability 100 %, not 0 %; the factory OEE weighs machines by that time. |
| 8.5 | Production order numbers broke over two lines on the cost report. | Kept on one line. |

Already good and kept: the cost sheet per order (material, machine minutes at the machine's rate, labour, overhead,
per unit), machine rates, OEE per machine and day with pause reasons.

## Round 9 — the factory

**Walked as** the owner after go-live (settings and people, what the factory agreed with Packio, requests, documents,
the handbook, support access, the phone's full menu).

| # | Finding (as the user) | Fix |
|---|---|---|
| 9.1 | After go-live the company details, payout account, capabilities, zones and agreements were only reachable through the onboarding address — the menu no longer shows onboarding. | Settings opens with "ข้อมูลโรงงานกับ Packio": eight cards (company, documents, payout account, capabilities, weekly capacity, delivery zones, payout terms, agreements) to read them and ask for a change. |
| 9.2 | The External auditor / CPA role showed as `factory_auditor` in the users list. | Named like every other role. |
| 9.3 | A request about anything ("เรื่องอื่น") still asked for a product type and prefixed it to the message. | The product type is asked only for topics about one (capability, capacity, tolerance, tier, pricing). |
| 9.4 | On a phone, "เพิ่มเติม" listed ~50 menus with no way to find one. | A search box on top filters by name, description and group. |
| 9.5 | Style intakes said "not open" with nowhere to go. | A link to tell Packio the factory has designs to offer (requests). |
| 9.6 | Support access, a menu of its own, opened with a "back to settings" link. | Removed. |

Already good and kept: users and roles with deactivate, working hours and closures, ERP settings, notification
channels per topic, the label printer per device, performance against Packio's KPIs, documents with folders, versions
and expiry, the handbook with categories, the support grant with its log, the alerts list.

## Summary

Nine rounds, every partner menu walked as its user at 1280 px and 390 px: no page scrolls sideways, no page or console
errors beyond the test browser's caret style. API releases v0.51.0 (inbox, units), v0.52.0 (Packio statements in the
VAT register), v0.53.0 (Packio work in the owner's numbers, OEE overtime).

## Owner decisions (2026-10-14)

- Tax point of Packio revenue: the day the factory confirms the billing statement (D-397 / D-401 confirmed).
- Dieline intake: opened with the standard terms v1 (API D-404); "เสนอแบบไดคัท" now accepts offers. Legal may publish
  a revised version in Admin → Settings (`styles.intake_terms`).
- UAT rehearsal: the books open with the opening stock and catch up the documents already there (API D-405), so the
  October close checklist passes every check.

## Factory prices, walked again (2026-10-15)

Asked for by the product owner after trying the screens himself ("ดูแล้วงงๆ"). **Walked as** the owner reading his label
and carton prices, with a draft and a sent proposal open.

| # | Finding (as the user) | Fix |
|---|---|---|
| P.1 | An open proposal was announced three times — a header button, a box, and a greyed "แก้ราคา" section at the bottom. | One box says what is happening and what customers get meanwhile, with its button (continue editing / view what was sent); the header offers "เสนอราคาใหม่" only when nothing is open, and the edit section hides while a proposal is open. |
| P.2 | "ฉบับที่ 2 · 42 บรรทัด" did not say these are the prices customers get now. | "ราคาที่ใช้อยู่ตอนนี้ — ฉบับที่ 2" (or "ราคาฉบับถัดไป"), and how many parts hold prices. |
| P.3 | Fifteen parts in one sideways-scrolling strip, cut off at the right; the page opened on a part with no prices. | The parts wrap in their groups with the number of lines on each (API D-406); empty parts are dimmed; the page opens on the first part that has prices. |
| P.4 | A part's name ("ขอบตัดกระดาษ", "สูตร B") did not say what it is for. | One line under every part's name explaining what it holds and how the price uses it. |
| P.5 | The prices were off the right edge behind 10 condition columns — "ตั้งแต่ / ถึง" pairs and "ไม่จำกัด ไม่จำกัด". | Each from/to pair is one range ("0–20", "≥ 2,000"); a range open on every line is dropped and named once below; past three conditions they stack in one column — the prices stay on screen, in bold; "—" is explained. |
| P.6 | A proposal's lines read "จำนวนแผ่น — · 499" and a removal showed bare numbers. | Lines say what they apply to with ranges; a removal says "ขอยกเลิกบรรทัดนี้ — ตัวเลขคือราคาที่ใช้อยู่"; a change shows the old price struck through → the new one. |
| P.7 | After sending, nothing said what happens next; "back" went to the overview. | A box per stage (sent, under review, countered) with what customers get meanwhile and when the new prices start; back returns to that product's prices. |
| P.8 | The editor's table had the same split ranges and did not mark rows already in the draft. | Ranges in the editor too; rows in the draft are tinted. |
