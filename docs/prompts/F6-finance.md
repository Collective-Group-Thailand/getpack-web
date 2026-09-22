# F6 — Finance & accounting workspace (admin zone)

> อ่าน `CLAUDE.md`, `00-master-plan.md`, **`docs/accounting-design.md`**, `docs/decisions.md` (D-020, D-022, D-030…D-033, D-090…D-093, D-150), `design-system.md` ก่อน · ต้องทำ F1 และ F2.1 (building blocks, approval inbox) แล้ว
> ทำทีละ Deliverable (6.1 → 6.4) · ทุกการเงินที่ย้อนกลับไม่ได้ต้องมี typed confirmation + `Idempotency-Key` และแสดงผู้อนุมัติตาม SoD

---

You are building the **finance workspace** inside the admin zone (`src/app/admin/(console)/finance/**`, `src/features/admin/finance/**`) for Finance, Finance Manager, C-Level approvers and Auditors. Every number drills down: report → journal → document → event → user.

## 6.1 Queues & documents
- **Finance home**: queues with counts and SLA — slips needing review (4-business-hour SLA, D-061), unmatched bank/gateway lines, unidentified receipts, payout proposals awaiting approval, deliveries without GR, factory bills missing tax invoice, customer WHT certificates missing, overdue B2B invoices, period-close tasks.
- **Customer documents** (issuer Collective Group (Thailand)): QT, IV, TR (instalment/full), RC, CN, DN registers with gapless numbering, void with reason, PDF preview/download, resend; credit-note wizard with statutory reasons and store-credit/refund choice; refunds with approval.
- **AR**: customer & company balances, aging, statements (monthly for B2B), dunning log, WHT certificate tracking (mark received, upload 50 ทวิ), allowance for doubtful accounts entries.

## 6.2 Payables, payouts, banking
- **AP**: factory POs, GRs, generated billing statements and their confirmation status, factory tax invoices (validate fields), other vendors (carriers, freelancers, services) and bills; vendor master with **bank-account change requests (dual approval, verification log)**.
- **Payout runs** (D-022, D-093): build run (eligible items: advances on acceptance, balances after POD + claim window, retention releases; deductions), choose company bank account/format, propose → approve (proposer ≠ approver, 2 levels) → download bank bulk file → import confirmation → posted; exceptions; factory remittance advice; 50 ทวิ generation.
- **Banking**: bank accounts, statement import, gateway settlement import, matching workbench (suggested matches, manual match/split), daily cash position.

## 6.3 Ledger, tax, fixed assets
- **GL**: chart of accounts (edit with approval), journals list (auto / manual / reversing / recurring), manual journal entry with maker-checker, journal detail with source links, posting-rule viewer (read-only for Finance; editable only via approval), dimensions.
- **Tax**: sales tax report, purchase tax report, ภ.พ.30 working paper, ภ.ง.ด.3 / ภ.ง.ด.53 working papers + attachment export, 50 ทวิ register (issued), customer WHT register (received), tax calendar, reconciliation to GL (difference must be 0), tax settings (VAT rate table, WHT rates, nature per product type — ⚖ items editable with approval).
- **Fixed assets** (D-150): categories, register, monthly depreciation run preview → post, disposal/write-off, reports.
- e-Tax invoice settings (disabled until R2, D-091).

## 6.4 Close, reports, audit
- **Period close** checklist (`accounting-design.md` §7) with owners, evidence uploads, blocking checks and status per period (open → soft closed → closed → locked).
- **Reports**: trial balance, GL detail, balance sheet, P&L with dimension pivots (factory, product type, channel, campaign), cash-flow (indirect), points liability & retention roll-forwards, sub-ledger ↔ GL reconciliation.
- **Auditor view**: time-boxed read-only access, document registers, audit-trail export, sample selection helper, PBC pack download, exception reports (series gaps, back-dated documents, manual journals by user, reversals, duplicate vendor bank accounts, duplicate slip references, credit notes after period end, payouts without valid tax invoice).

## Quality gates
Playwright: slip review → approve; month simulation on mocks (instalment invoices, credit-term invoice & collection with WHT, shortage credit note, payout run with retention through 2-level approval, bank file download, confirmation import) → trial balance and VAT/WHT papers show zero reconciliation difference; SoD UI tests (same user cannot approve own run); period lock blocks posting UI; axe; export correctness snapshots. `docs/PROGRESS.md` entries.
