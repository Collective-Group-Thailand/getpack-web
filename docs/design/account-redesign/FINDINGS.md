# A2 — account Phase 0, web side — FINDINGS
Branch `fix/uat-phase0`. Contract: `API-CHANGES.md` (D-436..D-440), client already regenerated. Status: implemented; lint, typecheck, tests and build pass. Not verified against the real API (see end).

## Done
1. **Status (D-437):** every surface (overview, list, detail, LINE) reads `customerStatus` through `CUSTOMER_ORDER_STATUS`; the web derives nothing. Delivered + open claim = "ได้รับแล้ว · เคลมกำลังตรวจ"; no "ยืนยันรับของ", no claim-window or auto-confirm message; open claims are linked. Tests per transition (`order-state.test.ts`).
2. **Overdue payment (D-436):** "เลยกำหนดชำระ" + "ตรวจราคาใหม่และชำระ" → `requoteGroup` (preview with difference per order and group) → `confirmRequote` (`Idempotency-Key`, preview quote ids, `expectedGrossAmount`) → existing payment. `order.requote_changed` re-previews; `order.requote_unavailable` says the team will re-quote (no flow of our own); `order.requote_required` on a payment refreshes the page. All "ยกเลิกอัตโนมัติ" copy removed (orders, payment, Terms §4).
3. **Artwork split (D-438):** "รอทีมส่งแบบไดคัทให้" (team) / "รอไฟล์จากคุณ" (customer) with the next-step sentence; the upload action is drawn only when `artworkOwner = customer` (also guarded on the web against a stale list).
4. **Delivery date (D-439):** unpaid orders show "คำนวณหลังชำระเงิน" (`deliveryDateBasis = after_payment`).
5. **Group payments:** "ยอดของคำสั่งซื้อนี้" and "ยอดชำระรวมทั้งกลุ่ม" shown separately; the instalment note no longer claims the instalment is this order's share.
6. **Overview:** tier progress shows `spendBasisTh` and `spendNotYetCounted`; thumbnail uses `thumbnailUrl` (placeholder text if it fails to load); overdue pay step shows the badge and re-quote action.
7. **Error state:** 429/502/503/504/network → "ระบบขัดข้องชั่วคราว", 3 automatic retries (3/6/12 s, counted per path), reference code, manual retry.
8. **Wording:** "ขั้นตอนการผลิต" (key `productionSteps`), no factory wording; `customer-wording.test.ts` green. Decision §1 is untouched (this phase adds no customer-visible file copy).

## Assumptions
- A production build hides the message of server-render errors, so the boundary cannot tell 500 from 503; every such error is treated as temporary and retried 3 times before a manual retry.
- The mock keeps a preflight-refused file at "uploaded"; mock owner = customer in that case so the upload stays available. The API is assumed to leave refused files with the customer too.
- The Terms §4 sentence on cancellation was reworded to match the decided rule ("ไม่ถูกยกเลิกอัตโนมัติ; ตรวจราคาใหม่ก่อนชำระ"); it is legal text and needs sign-off.

## Open questions (the API's, no new behaviour added)
1. Own-file customers wait for a dieline with no upload button. Allow upload straight away for a print-ready file?
2. Hired design reads "รอทีมส่งแบบไดคัทให้": new status/word?
3. Discounted orders → `requote_unavailable`: accept, or carry discounts over?
4. No overdue notice e-mail now that the cancellation e-mail is gone: add a one-time notice?
5. Tier wording is the API's "นับเมื่อคำสั่งซื้อเสร็จสิ้นหลังได้รับของ", not the pack's "นับยอดเมื่อได้รับของแล้ว": confirm.
6. Confirm-receipt with an open claim is hidden but the endpoint still accepts it: refuse server-side?
7. Terms §4 wording (above): legal sign-off.

## Not verified (needs both branches running)
Full re-quote on group UATOG-2610-00016 (difference, confirm, new deadline, payment); 409 `order.requote_required` on pay; `requote_unavailable` and `requote_changed` in the UI; 00008 header/list/detail; dates on 00016/00017; tier basis text; thumbnail; the error state with the API stopped; wording scan on customer pages.
