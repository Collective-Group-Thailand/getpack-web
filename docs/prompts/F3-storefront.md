# F3 — Customer zone

> อ่าน `CLAUDE.md`, `00-master-plan.md`, `docs/decisions.md`, `docs/contract/api-conventions.md`, `design-system.md` ก่อน · ต้องทำ F1 เสร็จแล้ว
> ทำทีละ Phase (3.1 → 3.7) ต่อ 1 session · designer (`/design/[id]`) มาจาก F0/F4 — ห้ามทำให้เสีย

---

You are a senior product engineer and UX lead building the **customer zone** of `packio-web` (`src/app/[locale]/**`, `src/features/customer/**`) for **Packio — Your Packaging Production Partner**. The seller shown on every document is **Collective Group (Thailand)** under the Packio brand (D-010, D-092). Customers never see factory names (D-050).

## Ground rules
- All data and every calculation come from `/v1/store/*` (customer BFF / `serverApi('customer')`). **The client never computes money, VAT, discounts, points, lead times or dates.**
- Original Packio design (`design-system.md`); trust elements only from real data.
- `th` at `/`, `en` at `/en`; canonical + hreflang; ISR / `use cache` for catalogue & content, dynamic for account & checkout; analytics events for every funnel step (D-102) with consent mode.

## Page patterns (reference-informed, D-180, D-181)
The layout patterns below come from analysing a packaging e-commerce site the business likes. Reuse the **structure and interaction**; the visual language is Packio's own (`design-system.md` §Art direction). Never copy that site's design, imagery or copy.

### Header (all customer pages)
Sticky, condensing on scroll: logo left · centred primary nav (หน้าแรก · สินค้า&บริการ (mega menu) · ออกแบบออนไลน์ · ราคา&ตัวอย่าง · บทความ · ติดต่อ) · right cluster (search, account, cart with count). Mega menu: 4–5 columns of packaging categories, each item showing a chip **"ราคาทันที"** or **"ขอใบเสนอราคา"** (D-043), plus a visual panel with one promoted category and a link to the full catalogue. Mobile: bottom nav + full-screen menu with the same chips. Announcement bar only when a real campaign is running (D-181).

### Home (8 sections, in order — trim rather than add; below-fold sections lazy-load to hold the LCP budget)
1. **Hero** — value proposition (ออกแบบเอง ได้ราคาทันที ผลิตกับโรงงานพันธมิตร), two CTAs (คำนวณราคา / ออกแบบกล่องออนไลน์) and a **quick-start strip**: ประเภท → ขนาดโดยประมาณ → จำนวน → ปุ่มดูราคา, which deep-links into the configurator with those values pre-filled. One static image (no auto-rotating carousel as the LCP element).
2. **เลือกประเภทบรรจุภัณฑ์** — card grid (carousel on mobile) per product type: photo, name, "เริ่มต้น ฿x/ชิ้น" where available, MOQ, lead-time range, and the instant/RFQ chip.
3. **ขั้นตอนการสั่งผลิต** — 4 steps (ออกแบบหรืออัปโหลดไฟล์ → ได้ราคาและวันส่งทันที → อนุมัติไฟล์ปรู๊ฟ → ติดตามการผลิตจนส่งถึง) with one line each and an illustration; links to the help centre.
4. **สินค้าพร้อมส่ง** — real stock products (standard products) in an e-commerce card row: image on paper plate, name, price/unit, stock and delivery estimate, add-to-cart.
5. **ทำไมต้อง Packio** — 6 benefits in two columns around one photo: ราคาทันทีไม่ต้องรอ, ออกแบบออนไลน์ + ไดไลน์ให้ฟรี, MOQ ต่ำ, ติดตามการผลิตทุกขั้นตอน, เอกสารภาษีครบถ้วน, เคลมได้ภายใน 7 วัน. Content must be verifiable — no claim the business cannot back.
6. **ผลงานและเสียงจากลูกค้า** — case cards and testimonials **only from real, permitted customers** (name + business type + photo with consent); if none exist yet, render the section empty-state variant (portfolio of Packio's own sample work) instead of inventing quotes.
7. **บทความ** — 3 latest articles (packaging selection guides, print knowledge) for SEO.
8. **ปิดท้าย** — newsletter (PDPA consent checkbox, coupon only if a real campaign exists), contact strip (4 items: ฝ่ายบริการลูกค้า/เวลาทำการ · โทร · LINE · ที่อยู่), dark footer (about, customer service, policies, categories, payment badges, socials) with **Collective Group (Thailand)** as the operating company and tax id (D-092).

### Catalogue / category page
Left sidebar filters (desktop) / filter sheet (mobile): ประเภทบรรจุภัณฑ์ (accordion) · วัสดุและความหนา · การพิมพ์ (ไม่พิมพ์ / 1–4 สี / CMYK) · ช่วงขนาด · จำนวนขั้นต่ำ · ระยะเวลาผลิต · มีให้เลือก (instant / RFQ) · ราคาเริ่มต้น (range); "ล้างทั้งหมด" button; sticky applied-filter chips. Toolbar: result count, view toggle (grid / list / compact), sort (แนะนำ · ราคาเริ่มต้นต่ำ→สูง · ผลิตเร็วที่สุด · ใหม่ล่าสุด). Product/type cards as in home §2. URL-synced filters, server pagination, skeletons; one promotional card slot in the sidebar only when a real campaign is active.

### Product / type page
Gallery (imagesets that switch with material and print options) · key specs · "เริ่มต้น ฿x/ชิ้น" with the quantity band it assumes · MOQ · lead-time range · quantity tolerance note (D-021) · primary CTA **คำนวณราคาจริง** (→ configurator, values carried over) and secondary **ออกแบบออนไลน์** · standard sizes table · materials & finishes explainer · FAQs · related types · downloadable dieline template. For RFQ-only types the primary CTA is **ขอใบเสนอราคา** with the expected response SLA stated.

### Product-card content rule (D-181)
Made-to-order cards never show struck-through retail prices or countdowns. They show: starting price per piece, the quantity that price assumes, MOQ, lead-time range, and a campaign badge only when a real promotion applies (with its real end date).

## Phase 3.1 — Information architecture, content, auth, search
Build the header, home, catalogue and product pages to the patterns above.
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
