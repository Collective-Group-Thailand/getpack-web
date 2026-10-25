# Cart & Checkout redesign — PLAN (Phase 0, web)

Step A8 · branch `fix/uat-phase0` · contract getpack-api 0.75.0 (`src/lib/api/schema.d.ts`) · 2026-10-25
Scope: discovery only — no code changed. GLOBAL-RULES.md wins over the pack.

## 1. Current state

### 1.1 Routes
| Route | File | What it does |
|---|---|---|
| `/cart` (guest) | `src/app/[locale]/(storefront)/cart/page.tsx` → `features/customer/cart/GuestCartView.tsx` | Lines kept in this browser (`guest-cart.ts`); sign in to continue; merged into the account cart after sign-in (`useGuestCartMerge`) |
| `/cart` (signed in) | same → `CartView.tsx` | Line cards, design option, per-line destinations (D-110), re-price, promo codes, summary, blockers, "ดำเนินการชำระเงิน" |
| `/checkout` | `checkout/page.tsx` → `features/customer/checkout/CheckoutView.tsx` | `requireCustomer()`; empty cart → `/cart`; one page: delivery → tax invoice → codes → points → company → schedule → method → summary + confirm dialog |
| `/checkout/pay/[paymentId]` | `checkout/pay/[paymentId]/page.tsx` → `PaymentPanel.tsx` | QR with countdown, 2C2P redirect, transfer + slip; side card "paying for" from `listMyOrderGroups` |
| `/checkout/return?payment=` | `checkout/return/page.tsx` | 2C2P return; status read from the API (webhook settles it) |
| `/payments/[paymentId]/return` | `payments/[paymentId]/return/page.tsx` | Redirect to `/checkout/return` |
| `/liff/pay/[paymentId]` | `app/[locale]/liff/pay/[paymentId]/page.tsx` | LINE LIFF payment |
| Instalments later | `InstalmentList.tsx`, `PayInstalmentButton.tsx` | Pay a later instalment from the account |

### 1.2 State
- Cart = one aggregate. `cart-client.ts` `editCart()` serialises edits under the cart `ETag` (`If-Match`); 412 → re-read. React Query keys `resource(customer, cart)` / `addresses`.
- Checkout: local state (mode shared/per-item, addressId, taxProfileId, points, method, poNumber); preview re-queried 400 ms after any change (`useDebounced`), keyed by body + `cart.updatedAt` + codes + destinations.
- Place: `POST /v1/store/checkout` with `Idempotency-Key` and `expectedGrossAmount`; `checkout.total_changed` / `checkout.price_expired` → show old vs new total, new key, confirm again. Then `POST /order-groups/{id}/payments {method}` → `/checkout/pay/{id}`; failure → order page with `payment=not_started`; `pending_company_approval` → `/business/approvals`.

### 1.3 APIs in use
| Concern | Endpoint (operation) | Notes |
|---|---|---|
| Cart | `GET /v1/store/cart` (`store.cart.get`) | `CartDto`: items, codes, `productGrossAmount` (incl. VAT, excl. shipping) |
| Line edit | `PATCH /cart/items/{id}` (`updateItem`) | Design option, design doc/version, mockup, note only — **no quantity / quoteOptionId** |
| Remove | `DELETE /cart/items/{id}` | No ETag returned → re-read |
| Re-price | `POST /cart/items/{id}/actions/reprice`, `…/confirm-reprice` | D-051 |
| Destinations | `PUT /cart/items/{id}/destinations` (`setDestinations`) | Snapshots of saved addresses; must total the quantity |
| Codes | `POST /cart/codes`, `DELETE /cart/codes/{code}` | Attempts rate-limited (D-053); problem `promotions.code_invalid`, `promotions.too_many_attempts` |
| Addresses | `GET/POST /v1/store/addresses`, `GET/PATCH …/{id}` | `AddressDto` has no delivery-note field |
| Postcode autofill | `GET /v1/store/catalog/geo/postcodes/{postcode}` (+ provinces/districts/subdistricts) | Already used by `PostcodeAreaField` in `AddressForm` |
| Tax invoice | `GET/POST /v1/store/tax-profiles` | `TaxProfileDto`: taxType, taxId, branch, address, withholdsTax |
| Points | `GET /v1/store/loyalty`; preview `points` | D-133 bounds from the preview |
| Company | `store.companies.listMine`; preview `company` | PO policy, credit, approval threshold (D-123/D-125) |
| Shipping | Preview only: `orders[].destinations[].shippingNetAmount`, `totals.shippingNetAmount` | `CartItemDto.quoteShippingAmount` = indicative for the quote's postcode |
| Totals | `POST /v1/store/checkout/actions/preview` → `CheckoutPreviewDto` | `MoneyTotalsDto`: discount, shippingNet, net, VAT, WHT, gross, cash |
| Schedule (deposit/instalments) | Preview `paymentSchedule` (`PreviewInstalmentDto`: pct, dueTrigger, cash) | Chosen by rules (D-020); customer cannot pick (`scheduleKey` proposed rejection; e2e `fixme`) |
| Payment methods | Preview `paymentMethods[].available` ∩ `ONLINE_PAYMENT_METHODS` | `scb_qr`, `card_2c2p`, `online_banking_2c2p`, `bank_transfer_slip`; `card_instalment_2c2p` is R2 (D-111) |
| Payment provider | `POST /order-groups/{id}/payments`, `GET /payments/{id}`, `POST /payments/{id}/slips` | SCB QR (15 min, D-312), 2C2P redirect, slip via Slip2Go (D-176) or Finance |
| Place | `POST /v1/store/checkout` (`store.checkout.place`) | `CheckoutDto`: taxProfileId, redeemPoints, companyId, companyBranchId, poNumber, ccEmails, utm, expectedGrossAmount |
| Settings | `GET /v1/store/public-config` | priceLockDays 15, minOrderQty, claimWindowDays; no code limit, no production days, no tolerances |

### 1.4 Every validation that blocks checkout
| Where | Rule | Source |
|---|---|---|
| Cart | `!priceLocked || pendingReprice` → "ต้องคำนวณและยืนยันราคาใหม่", button disabled | `cart.ts lineBlockers` |
| Cart | `!destinationsComplete` → "ระบุที่อยู่จัดส่งให้ครบตามจำนวน", button disabled | same |
| Cart destinations editor | Rows must total the line quantity and each row needs an address | `Destinations` |
| Checkout page | Line waiting on a re-price → warning callout | `checkout/page.tsx` |
| Checkout | Place disabled until a preview exists and nothing is pending; PO number when `poNumberPolicy = required` | `canPlace` |
| Preview/place 422 | `checkout.cart_empty`, `checkout.destinations_incomplete`, `checkout.rfq_destination_fixed`, `checkout.shipping_unavailable`, `companies.po_required`, `discounts.cs_limit_exceeded`, `validation.failed` | contract |
| Preview/place 409 | `checkout.price_expired`, `checkout.total_changed` (place), `companies.invalid_status`, `discount_memos.not_usable`, `loyalty.insufficient_points`, `promotions.budget_exhausted`, `promotions.limit_reached` (+ `numbering.series_missing`, `idempotency.in_progress` on place) | contract |
| Preview/place 5xx config | `checkout.wht_rate_missing`, `payments.no_schedule_template`, `pricing.vat_rate_missing` | contract |
| Forms | Address: label, recipient, phone, 5-digit postcode + sub-district, line1. Tax profile: 13-digit checksum | `AddressForm`, `TaxProfileForm` |
| Codes | Max 3 in the UI (`PromoCodeBox maxCodes = 3`, hard-coded) | UI only |
| Sign-in | `/checkout` requires a customer session (no guest checkout) | `requireCustomer` |

## 2. Inconsistencies found
1. **Spec label**: the size line comes from the API (`SpecLineDto.labelTh`), example `ขนาด (กว้าง × ยาว × ลึก)`, rendered as-is by `specLinesOf`; other pages use `ยาว × กว้าง × สูง`. Owner: PDP Phase 0 spec-label helper (GLOBAL-RULES §5). Cart/checkout only adopt it. Possibly an API-side label fix too.
2. **Cart summary**: no shipping line and no VAT amount; note says discounts are calculated at checkout while the code box is in the cart. `CartDto` has no VAT/shipping fields. The VAT line must use the styles Phase 1 price-display helper (no local VAT math) or a new API field.
3. **Address gating**: the cart blocks on destinations although checkout can set "one address for everything" itself.
4. **Payment methods**: prototype = PromptPay · auto-confirmed transfer · card · ผ่อนชำระ; system = PromptPay QR · card · online banking · transfer + slip; instalments are R2 (D-111).
5. **Payment plan**: prototype lets the customer choose full/deposit/milestone ("เงื่อนไขตัวอย่าง"); D-020 rules choose the schedule.
6. **Tax ID** shown unmasked in checkout cards and summary (hard rule 5: mask after entry).
7. **Code limit** hard-coded to 3 in the UI; `promotions.max_codes_per_cart` not exposed; no server-side problem code is documented for exceeding it.
8. **Confirm dialog** names `method` instead of `chosenMethod`.
9. **Shipping `0.00`** hides the row, so free and not-yet-priced look the same.

## 3. Prototype's 4 steps → existing APIs

Stepper: ตะกร้า → ที่อยู่และการจัดส่ง → ใบกำกับภาษีและชำระเงิน → ทบทวนและยืนยัน. Steps 2–4 stay one route (`/checkout`) with client-side steps (or `?step=`) so the preview, the idempotency key and the ETag queue stay intact. Back navigation is free; forward only when the step is valid.

### Step 1 — ตะกร้า (`/cart`)
| Prototype element | Existing source | Status |
|---|---|---|
| Thumbnail, name | `summary.product.imageUrl` / `ProductThumb`, `productNameOf` | ✓ |
| Spec chips (size code, inside dims ยาว × กว้าง × สูง, material, print outside/inside) | `summary.specs[]` by `key` (`size`, `material`, `print_front`, `print_back`, …) + PDP Phase 0 spec-label helper | Depends on A3 helper |
| Price-lock badge "ราคาคงที่ถึง …" | `priceLockedUntil`, `quoteCode` | ✓ |
| Quantity stepper (step 50, min MOQ) | None: a line = one `quoteOptionId`; PATCH has no quantity | **GAP-1** |
| Tier hint "สั่ง x ชิ้น ราคาต่อชิ้นเหลือ ฿y" | `GET /store/quotes/{quoteId}` → `options[]` (quantity, productAmount) gives only the quote's own options | **GAP-1** (switch option) |
| Design option select | `PATCH designOption` (instant lines) | ✓ (options list = CONTRACT-GAP, all values shown) |
| Line total + unit price | `productGrossAmount`, `unitPrice` | ✓ |
| แก้ไขสเปก | `/configure/{slug}?quote={quoteId}` (exists, seeds from the saved quote) | ✓ catalogue products; RFQ lines → none |
| บันทึกไว้ทีหลัง | Remove line; quote stays in `/account/quotes` | Assumption — OPEN Q-4 |
| นำออก with undo | `DELETE` + undo = `POST /cart/items {quoteId, quoteOptionId, designOption, …}` while the quote is live | Feasible; destinations lost → re-set |
| "ที่อยู่จัดส่งเลือกในขั้นถัดไป" + optional postcode estimate | Shipping estimate by postcode is owned by **configurator Phase 1 step 8** (GLOBAL-RULES §5); `quoteShippingAmount` is per-quote postcode only | **GAP-3** (cart-level) |
| Re-price callouts | reprice / confirm-reprice | ✓ |
| Price-lock reminder toggle | — | Phase 3 (feature flag) |

### Step 2 — ที่อยู่และการจัดส่ง
| Element | Source | Status |
|---|---|---|
| Saved addresses as cards | `GET /store/addresses` | ✓ |
| New address form (name, phone, address, postcode → province/district) | `AddressForm` + `GET /catalog/geo/postcodes/{postcode}` | ✓ (reuse inline, not only in a sheet) |
| Note to courier | — (`AddressDto` has no note; checkout has no note/contact block) | **GAP-5** |
| Default single destination | `PUT …/destinations` per line with the whole quantity (`shipAllTo`) | ✓ |
| "แบ่งส่งหลายที่อยู่" + "รวม x จาก y ชิ้น" | Existing `Destinations` allocation per line | ✓ (move from cart) |
| Shipping line + arrival estimate live | Preview `totals.shippingNetAmount`, per-destination amounts; arrival date: none on the cart/preview | Shipping ✓ · **GAP-4** date |
| "ค่าส่งคิดตามจำนวนที่อยู่" | Preview per destination | ✓ (copy must not state rates) |

### Step 3 — ใบกำกับภาษีและชำระเงิน
| Element | Source | Status |
|---|---|---|
| Toggle "ขอใบกำกับภาษีเต็มรูปแบบ" | `taxProfileId` null vs profile | ✓ |
| นิติบุคคล/บุคคลธรรมดา, name, 13-digit ID, branch | `POST /store/tax-profiles` (`TaxProfileForm`) | ✓ (inline form) |
| "ใช้ที่อยู่เดียวกับที่อยู่จัดส่ง" | Copy the chosen address into the profile form client-side, saved only on the customer's action | ✓ (UI only) |
| Tax ID masked after entry | `formatTaxId` shows it in full | Fix in Phase 1 (`src/domain/tax-id.ts` add a mask) |
| Issuer line "Collective Group (Thailand) under getpack" | i18n `checkout.terms` | ✓ |
| Payment method cards | Preview `paymentMethods[].available` ∩ `ONLINE_PAYMENT_METHODS` | ✓ — card set differs from prototype (OPEN Q-2) |
| Payment plan full/deposit/milestone | Preview `paymentSchedule` (read-only, D-020) | Show read-only — OPEN Q-1 |
| Points redemption | `redeemPoints` + preview `points` bounds | ✓ |
| Company: PO number, credit, approval | `companyId`, `poNumber`, preview `company` | ✓ |

### Step 4 — ทบทวนและยืนยัน
| Element | Source | Status |
|---|---|---|
| Read-only summary with edit links | Cart + preview `orders[]` | ✓ (edit = go to step) |
| Design next step | `designOption`; own-file copy per GLOBAL-RULES §6 ("อัปโหลดไฟล์หลังสั่งซื้อ ทีมงานตรวจไฟล์ให้ก่อนผลิต") | ✓ |
| Tolerances ±5 % / ±3 mm / ΔE2000 ≤ 3 | GLOBAL-RULES §6 (decided copy) | ✓ |
| "ผลิต 5 วันทำการหลังอนุมัติแบบ" | Must come from data; not in `public-config` or the cart | **GAP-4** |
| Terms checkbox → `/legal/terms`, `/guarantee` | Routes exist | ✓ (checkbox is UI only) |
| "ยืนยันคำสั่งซื้อและชำระเงิน" | `POST /store/checkout` → `POST /order-groups/{id}/payments` | ✓ (keep idempotency + total-changed flow) |

### Summary (all steps)
| Line | Source | Status |
|---|---|---|
| Goods (VAT incl.) | Step 1: `cart.productGrossAmount`; steps 2–4: preview | ✓ |
| Discount codes (max 3, chips, automatic promotions) | `cart.codes`, preview notices `promotion.applied` / `discount.applied` | ✓ — limit hard-coded (GAP-7) |
| Shipping | Step 1 estimate (GAP-3) or "คิดในขั้นที่อยู่"; steps 2–4 preview | Partial |
| VAT included | Steps 2–4 `totals.vatAmount`; step 1: none | **GAP-6** |
| Total / "ยังไม่รวมค่าจัดส่ง" | Preview `grossAmount`; pay now = first `at_checkout` instalment `cashAmount` | ✓ |
| Blockers list | `lineBlockers` + preview problems | ✓ |
| "ใบเสนอราคา PDF" (cart) | Only per quote: `POST /quotes/{id}/actions/request-pdf`, `GET …/pdf` | **GAP-2** |
| "ส่งให้ผู้อนุมัติ" (cart) | Only per quote: `POST /quotes/{id}/actions/share` / `GET /quotes/shared/{token}`; D-123 approvals only after placing | **GAP-2** (Phase 2) |
| Trust lines (ready date, warranty, methods) | `/guarantee`; methods from the preview; ready date GAP-4 | Partial |

## 4. Gaps (→ `docs/contract-requests.md` in Phase 1; MSW mocks marked `// CONTRACT-REQUEST`)
| # | Gap | Proposed contract | Phase |
|---|---|---|---|
| GAP-1 | Change a line's quantity / tier in the cart | `PATCH /store/cart/items/{id}` accepts `quoteOptionId` (another option of the same quote), or `POST …/actions/requantify {quantity}` that re-quotes and returns the line; plus tier options (`quantity`, `unitPrice`) per line | 1 |
| GAP-2 | Multi-item quote PDF and approver share link from the cart | `POST /store/cart/actions/quote` → one QT (same template + 15-day lock, configurator owns the template) with `pdf` and `share` like `store.quotes`; approver roles from business accounts | 2 |
| GAP-3 | Cart shipping estimate by postcode | Reuse configurator Phase 1 step 8 service; `POST /store/cart/actions/estimate-shipping {postcode}` → amount (VAT incl.) + transit days | 1 |
| GAP-4 | Ready / arrival date in cart and review | `CartItemDto.leadTimeDays` / `earliestShipDate` / `earliestDeliveryDate` (exist on `SavedQuoteOptionDto`), and per-destination transit in the preview; production days from settings | 1 |
| GAP-5 | Delivery note / contact block | `note` on `DestinationInputDto` or `CheckoutDto.deliveryNote`, `contact` (CONTRACT-GAP already noted in `CheckoutView`) | 1 (if approved, PDPA) |
| GAP-6 | VAT amount on the cart summary | `CartDto.vatAmount` (or the styles Phase 1 helper if it can derive it) | 1 |
| GAP-7 | Code limit from settings and enforced server-side | `public-config.maxCodesPerCart` + 422 `promotions.too_many_codes` on `applyCode` | 1 (API C5) |
| GAP-8 | Step analytics | Add `checkout_step_view`, `checkout_qty_change`, `checkout_tier_hint_accept`, `checkout_save_for_later`, `checkout_split_toggle`, `checkout_tax_invoice_toggle`, `checkout_payment_select`, `checkout_code_apply`, `checkout_blocked`, `checkout_confirm` to `src/lib/analytics/events.ts`; map in `ingest.ts` to `checkout_step` (properties) or extend `AnalyticsEventName` | 1 |
| GAP-9 | Save for later as a distinct state | None needed if "remove; quote stays saved" is accepted (OPEN Q-4); otherwise `POST /cart/items/{id}/actions/save-for-later` | 1 |
| GAP-10 | Guest checkout | `/checkout` requires sign-in | 3 (report only) |
| Not a gap | Postcode → province/district/sub-district | `GET /store/catalog/geo/postcodes/{postcode}` (`PostcodeAreaField`) | — |

## 5. Phase 1 build notes (no logic change)
- Keep `editCart` / ETag queue, preview re-query, idempotency key and `checkout.total_changed` handling unchanged.
- Move the destinations editor from the cart to step 2; the cart no longer blocks on `destinations`.
- Step validity: step 1 = no `reprice` blockers; step 2 = every `destinationsComplete` and the preview has no 422; step 3 = PO rule and a method when one is due now; step 4 = terms checked.
- Mask the tax ID after entry; fix the confirm dialog to use `chosenMethod`; show a shipping row also when it is `0.00` (label per OPEN Q-9).
- Accessibility: labels, `aria-describedby` errors, focus to the first invalid field, stepper as `nav` with `aria-current="step"`.
- No sample data: shipping zones/amounts, the 5 % code discount, the province table and the deposit/milestone terms in the prototype are fake and are not shipped.

## 6. Open questions (business decisions)
1. May the customer choose deposit / milestone (D-020 says the rules choose)? Until decided: show the rules' schedule read-only.
2. Payment cards: show the four existing methods (QR, card, online banking, transfer + slip) and drop ผ่อนชำระ until R2 (D-111)? Copy for "auto-confirmed transfer" only after Phase 3.
3. Should `poNumber` (and cost centre, Phase 2) be offered without a company account?
4. "บันทึกไว้ทีหลัง" = remove from the cart while the saved quote stays in `/account/quotes` — acceptable?
5. Delivery note per address: wanted? (PDPA: free text, retention)
6. Approver link: new pre-order share, or reuse D-123 company approvals (after placing)?
7. Which date shows as "ได้รับประมาณ" before the address is known (earliest ship date vs delivery date)?
8. Quantity stepper step 50 and MOQ: where do step and MOQ come from per product (`public-config.minOrderQty.custom` = 100 is global)?
9. Shipping ฿0: show "ฟรี" or "฿0.00"?

## 7. Dependencies
- A3 PDP Phase 0: spec-label helper and price reconciliation (not on this branch yet).
- B1 styles Phase 1: VAT display helper, tokens, LINE button, analytics wrapper.
- C4 configurator Phase 1: shipping estimate by postcode, quote PDF template.
- API C5: totals equal the order at creation; max-3 codes enforced server-side.
