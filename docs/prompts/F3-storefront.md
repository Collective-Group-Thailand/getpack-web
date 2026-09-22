# F3 — Customer zone

> อ่าน `CLAUDE.md`, `00-master-plan.md`, `docs/decisions.md`, `docs/contract/api-conventions.md`, `design-system.md` ก่อน · ต้องทำ F1 เสร็จแล้ว
> ทำทีละ Phase (3.1 → 3.7) ต่อ 1 session · designer (`/design/[id]`) มาจาก F0/F4 — ห้ามทำให้เสีย

---

You are a senior product engineer and UX lead building the **customer zone** of `packio-web` (`src/app/[locale]/**`, `src/features/customer/**`) for **Packio — Your Packaging Production Partner**. The seller shown on every document is **Collective Group (Thailand)** under the Packio brand (D-010, D-092). Customers never see factory names (D-050).

## Ground rules
- All data and every calculation come from `/v1/store/*` (customer BFF / `serverApi('customer')`). **The client never computes money, VAT, discounts, points, lead times or dates.**
- Original Packio design (`design-system.md`); trust elements only from real data.
- `th` at `/`, `en` at `/en`; canonical + hreflang; ISR / `use cache` for catalogue & content, dynamic for account & checkout; analytics events for every funnel step (D-102) with consent mode.

## Phase 3.1 — Information architecture, content, auth, search
Routes: `/` · `/products`, `/products/[category]`, `/products/[slug]` · `/configure/[slug]` · `/rfq/[category]` · `/design/[id]` · `/templates` · `/cart` · `/checkout/*` · `/account/*` · `/business/*` · `/track/[token]` · `/liff/*` · `/articles/*`, `/faq`, `/help/*`, `/contact`, `/samples`, `/referral/[code]`.
Home, catalogue with filters, product pages (imagesets, specs, standard sizes, "starting from" price from the API, lead-time range, FAQs), articles, global search (products, articles, FAQs; order code when signed in), structured data (Organization, Product, BreadcrumbList, FAQPage). Sign-in sheet: phone OTP, Google/Apple, LINE Login; PDPA consent capture; progressive profiling.

## Phase 3.2 — Configurator, 3D/2D preview, instant quote, RFQ
- **Configurator** for the 7 instant types (D-100): adaptive stepper — size (standard or custom with pattern constraints and helpful errors; unit toggle display-only), material (swatches, explainers), printing, finishing, assembly, quantity tiers, delivery zipcode, promo code, design option (own file / online designer / hired design / free design where offered), mockup add-on (D-072).
- **Preview** (D-152): 3D for box styles (folding, corrugated) using `@packio/dieline` + the F4 3D viewer, updating live; 2D product mockups for labels, pouches, tags and sleeves.
- **Instant quote dock** (sticky / bottom sheet): debounced `POST /v1/store/quotes` with cancellation; per piece, delivery, total, VAT, one-off costs, lead time and estimated receive date (capacity-aware, from the API), quantity price breaks, **quantity tolerance ±% shown** (D-021), quote validity 15 days (D-051). Actions: add to cart, design now, download quotation PDF, save, share, ask CS (LINE deep link with summary).
- **RFQ** for all other types (D-100): category-specific form (dimensions/spec fields, quantity tiers, target date, zipcode, files, notes), status page, receive and accept the quote → cart.

## Phase 3.3 — Cart, checkout, instalments, payments, promotions, points
- **Cart** (multi-item): items from instant quotes or accepted RFQs; expired quotes re-priced with a diff to confirm; per-item design option; **multiple delivery addresses / split quantities per item**.
- **Checkout**: contact → delivery (per item or shared, saved addresses) → tax invoice (individual / juristic / government; head office/branch; customer WHT) → promotions (coupon codes, automatic promotions shown with their effect, margin-capped notices) → **points redemption** (min/max rules shown, D-133) → **payment schedule** shown before paying (100 % below THB 20,000; 50/50 or template instalments above; B2B credit term) → payment method → review; server re-pricing diffs must be confirmed; `Idempotency-Key` on submit/pay.
- Payments: PromptPay/SCB QR with countdown and live status, 2C2P card & online banking (redirect + return page), bank transfer with **slip upload** (instant verification result or "under review ≤ 4 business hours"). Instalment centre in the account: due dates, pay next instalment, receipts.

## Phase 3.4 — Account
Orders & order groups (status chips, API next actions: pay instalment, upload file, approve proof, confirm receipt), order detail (timeline, instalments, documents: quotation / tax invoice-receipt per instalment / final tax invoice / credit notes — signed downloads; shipments with tracking; claims), saved designs & configurations, addresses, tax profiles (branches), notification preferences & channels (D-143/D-144), linked LINE, PDPA consent view/withdraw, data export/delete request, **points** (balance, history, expiring soon, tier progress), **referral** (code/link, invited friends, rewards status), promo wallet, store credit.

## Phase 3.5 — Artwork, proofs, design services
Upload per item (drag & drop, multipart resumable), preflight result (blocking vs warnings in Thai, D-070), open in designer, **hired design** brief + revision rounds counter (3 free; round ≥ 4 purchase flow with fee from the API, D-071), **proof viewer**: zoom/pan, dieline overlay toggle, 3D preview, **version compare** (side-by-side / slider), **pin / box annotations** with threads, checklist before approval, approve for production (evidence recorded by the API) or request changes.

## Phase 3.6 — Tracking, delivery, claims, reorder
Visual timeline (ordered → instalments → artwork/proof → customer-visible milestones with photos → shipments per destination → POD → completed; promised vs actual), public tracking page `/track/[token]` (no PII), confirm receipt (auto-complete after 7 days otherwise, D-081), tolerance outcome shown (shortage credit), **claims** within 7 days (type, items, quantity, product photos **and** carton photos required, requested resolution; messages; outcome), **one-click reorder** (same spec & artwork, re-priced, waived one-off costs shown, quantity editable, D-153).

## Phase 3.7 — B2B, LIFF, help
- **Business** (`/business`): landing, company sign-up with KYC documents (D-120), members & roles (Company Admin, Buyer, Approver, Accountant), branches, shared brand assets / addresses / designs, PO number, **approval workflow** (orders over the company threshold wait for approver, D-123), credit application, credit-term checkout, available credit, statements & aging, overdue notices (D-122), spend dashboard, bulk reorder via CSV.
- **LINE LIFF** (D-151): LIFF layout reusing the same pages — order status, slip upload, artwork approval, reorder, points, chat with CS.
- Help centre, contact, sample kit request, guided help widget that recommends styles and hands off to CS with context.

## Quality gates
Playwright desktop + mobile: browse → configure (3D) → quote → cart with 2 items to 2 addresses → coupon + points → 50/50 → QR deposit (mocked webhook) → upload artwork → proof annotation → approve → balance before shipping → timeline → POD → claim with photos → reorder; RFQ → quote → accept → checkout; B2B buyer order waits for approver; LIFF flows. IDOR tests via BFF, upload limits, OTP/tracking rate-limit UX, CSP, axe, Lighthouse budgets, SEO checks. `docs/PROGRESS.md` entries.
