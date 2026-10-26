# business-redesign PLAN (web, A1 Phase 0 + Phase 3b)

## 1. Map (customer zone)
- **/business** and **/business/apply** (KYC form, files up to 20 MB). Business-account rules (roles, approval threshold, PO, branches, credit, CSV reorder) are API-owned and not changed here (hard rule 2).
- **/contact**: one form posting to `store.support.contact`, which creates a support ticket. The reference is `CS-YYMM-NNNNN`, with the topic as its own field (D-440).
- **/partner-with-us**: copy in `pages.partner`. It is the only customer page allowed to talk to factories.
- **/network**: URL kept. It is now static "มาตรฐานการผลิตของ getpack" copy in `storefront.trust.network`, with no API call.
- **Footer** (`SiteFooter`): "มาตรฐานการผลิต" (/network) and a neutral partner link (/partner-with-us).

## 2. Confidentiality audit (web)
Fixed in A1:
- /network used to list product-type coverage and a "3 factories / 30 jobs" threshold. Removed, along with the stats call and its i18n keys.
- Footer, home quality block, about page, how-it-works, the legal terms and privacy copy, and the quote-request intro named factories or a "network". Reworded.
- Order tracking, fulfilment and samples copy said "ขั้นตอนที่โรงงาน", "ส่งออกจากโรงงาน" and "หลักฐานจากโรงงาน". Reworded.
- Configurator hints said the target price is hidden "from the factory". Reworded.
- Call-off copy said "โรงงานล็อกราคา" and "โรงงานไม่รับ". Reworded.
- Styles RFQ and studio-library copy implied coverage ("เมื่อมีโรงงานรับผลิต"). Reworded.
- Agent area wording is now "พาร์ทเนอร์ผลิต" (the programme itself is unchanged).
- Guard: `src/i18n/customer-wording.test.ts` fails on "โรงงาน"/"factory" in any customer message file. The allow-list is `pages.json` `partner.*` only.

Still open (API-side or other phases):
- Staff-only copy is still shared in `common/status.json` and `common/problems.json`. Check no customer page renders `*LabelAdminTh` (A2 made it equal to `*LabelTh`).
- Proof file names keep the original name. EXIF/GPS is not stripped from customer-visible photos. PDF Producer/Creator metadata is not cleaned (the A5b API work addresses these; verify on the web once both run).
- Carrier bookings sent the factory as sender (A5b: getpack is now the sender; carriers stay off).
- The partner portal shows recipient name and phone before dispatch. The claim description reaches the factory verbatim.
- OG images and JSON-LD were not found to contain factory data. Re-check when the contact JSON-LD is added.

## 3. Gaps (not built in A1)
- **Company catalogue, budgets per branch/cost centre:** no API or UI found. They need a contract request.
- **Ticket status lookup:** the ticket reference exists, but there is no public lookup endpoint.
- **Callback scheduling:** none.
- **Partner applications:** /partner-with-us links to contact only. There is no FP- reference or application endpoint.
- **Factory-ERP module status flags ("เร็ว ๆ นี้"):** not config-driven yet. The hard rule requires config.
- **Contact info config:** `public-config.contact` exists (phone, lineOaId, email, all null today). Footer, /contact and JSON-LD should read it, and show nothing when null.

## 4. Schema/API changes needed
- Contact-info source of truth (settings) plus hours (`supportHours`, currently null).
- Application endpoint for partners (`FP-` prefix is declined, so it needs the `CS-` scheme and a topic).
- Ticket status lookup by reference plus a verifier (e-mail or phone).
- Module-status flags endpoint (public, cached).
- The seeded `trust.*` setting rows in UAT can be removed in business Phase 4.

## 5. Risks
- Legal wording for producers in terms and privacy (PDPA recipient disclosure).
- Hard-coded tolerances on /network may drift from API rules.
- Confidentiality and file-deletion claims on /network are unverified against shipped behaviour.
- Agent factory-referral wording might still hint at a factory network.
- Renamed status codes (A2) mean `StoreCallOffStatus.pending_confirmation` and `StoreClaimStatus.under_review` must be the only ones the store renders.
