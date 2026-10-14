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
| 6 | Finance: invoices, receivables, tax, payables, Packio billing and payouts, prices, shipping rates | next |
| 7 | The books: ledger, journals, reports, accounts, assets, bank | |
| 8 | Insight: dashboard, costs, profit, OEE | |
| 9 | The factory: performance, style intakes, documents, requests, knowledge, settings, support access, onboarding | |

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
