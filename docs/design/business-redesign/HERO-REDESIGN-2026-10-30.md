# Hero redesign — /business and /partner-with-us (2026-10-30)

Record of the strategy/marketing review of the two B2B landing pages and the hero rebuild that followed. Source
of the layout: the product owner's own mock (`getpack_Hero.html`, 8 variants); this file keeps the decisions so the
next round does not re-argue them.

## Review verdict

Structure of both pages is sound and stays (before → after table, approval simulator on real prices, the
Excel / ERP / getpack Factory comparison, the transparent partner-agreement summary). What was weak was the
message, not the layout: feature-led headlines, hero figures that were system details rather than benefits, a
promise on /partner-with-us we cannot yet keep, and dark hero bands against the light-theme rule.

## Decisions

| # | Decision | Why |
|---|---|---|
| H-1 | Both heroes are **light** — no `data-theme="dark"` band. | Light theme must have no large dark surface (product owner rule, Oct 2026). Small dark chips (credit-term badge, shop-floor tile) stay as accents. |
| H-2 | Hero layout = the mock's **static** variant: claim on the left, a layered "screen" figure on the right with one before → now pill and two floating notes. The **slider** and **dark (B)** variants are dropped. | Visitors do not wait for slides; variant B breaks H-1. |
| H-3 | /business headline leads with the differentiator: **"สั่งบรรจุภัณฑ์ให้ทั้งบริษัท ได้ราคาจริงทันที"** (en: "Order packaging for your whole company, priced instantly"). | "จัดการในที่เดียว" is generic SaaS wording; instant real prices without a quotation is what competitors lack. |
| H-4 | /business hero figures are outcomes: **ราคาคงที่ {priceLockDays} วัน** (API, D-309 — omitted without a value) · **เครดิตเทอม 15–60 วัน** · **฿0 ค่าเปิดบัญชี**. "4 บทบาท" and "1–2 วันทำการ" are gone from the hero. | Figures a buyer feels, not system facts. |
| H-5 | /business figure = a company purchase order whose lines are **real catalogue products at real quantities and prices** from `pricedSamples` (the store pricing path, GLOBAL-RULES §5). No company, branch, PO number or **total** (a total would be arithmetic on money). Without priced products: neutral placeholder bars. | GLOBAL-RULES §3 (no sample data) — the mock's "สาขาสีลม / PO-2026-0418 / ฿34,350" could not ship. |
| H-6 | /partner-with-us headline: **"รับงานจาก getpack ใช้ ERP ทั้งโรงงานฟรี"**. "พร้อมงานใหม่ทุกวัน" is removed. | Factories want jobs before a free system; "every day" is a promise the network cannot guarantee yet. |
| H-7 | Three trust lines under the offer: jobs arrive checked/spec'd/priced · getpack is the customer's counterparty, the factory is paid by getpack (no chasing) · factory details stay confidential. **No payment timing** on the page. | Money is the factory's first question; timing stays in the partner agreement (page docstring, D-458). |
| H-8 | /partner-with-us figure = today's jobs with a getpack job ready to take (job names = real product-type names from the catalogue, spec chips ลอน · วัสดุ · ไดคัท · ค่าสี ΔE, no quantities/dates/machines), the automatic journal entry (account names, no amounts) and the operator's three buttons. | Same §3 constraint as H-5. |
| H-9 | **No status chips anywhere**: "เร็ว ๆ นี้" (business features, ControlDemo catalogue/budget) and "ใช้ได้แล้ว / กำลังพัฒนา" (factory modules) and the compare-table note are removed. `storefront.roadmap` now only orders the cards. | Every module is fully developed (product owner, Oct 2026). |
| H-10 | **Navbar unchanged.** /partner-with-us is not added to the primary navigation; the footer keeps its existing "สำหรับผู้ผลิต / ร่วมเป็นพาร์ทเนอร์ผลิต" link. A more prominent "getpack Factory" footer block was tried and reverted. | The primary nav is the buyer's; a factory link beside "สำหรับธุรกิจ" confuses buyers and points at the supply side. The footer block failed `customer-wording.test.ts` (GLOBAL-RULES §1: no "โรงงาน / Factory" on customer surfaces) — the rule is right, the block was wrong. |
| H-11 | Mobile (≤ xl): claim → CTAs → figures → the main card only; floating notes are hidden, caption moves below. No horizontal scroll at 390. | Most Thai traffic is mobile; three overlapping cards do not fit a phone. |
| H-13 | **Story hero (variant A)** replaces the static figure on both pages: five scenes, 6 s each, dots with a fill timer, pause on hover, ← → and swipe, plays only on screen, reduced motion = static first scene. CSS-only sequences (`pk-story-*` in `base.css`), one small client component (`HeroStory`). Scenes use real catalogue products/prices and product-type names; generic branch labels; no PO number, company or total. | Product owner's ref `getpack-hero-A.html`. |
| H-14 | **Colours as the ref, from existing tokens only**: panel `sage-subtle`, paper layers `primary-subtle` / `bg-subtle`, everything green (`primary`). /partner-with-us uses the same green as /business — the amber (`instant`) accents, CTA and compare column are gone. | Product owner: both pages must match. No new token, dark mode follows. |
| H-15 | The free offer reads **"ฟรี" / "Free"**, not "฿0" (hero figure, story scene, factory offer). | Product owner: a word sells better than a zero. |
| H-12 | Font: Anuphan only (already the app's single face). The mock's Noto Sans Thai / IBM Plex is not carried over. | Font rule (2026-10-28). |

## Files

- `src/features/customer/business/BusinessLanding.tsx` — light hero, outcome figures, no "soon" badge
- `src/features/customer/business/landing/OrderIllustration.tsx` — new hero figure (replaces `DashboardIllustration.tsx`)
- `src/features/customer/business/landing/ControlDemo.tsx` — no "soon" chips
- `src/app/[locale]/(storefront)/partner-with-us/page.tsx` — light hero, trust lines, no module status chips / compare note
- `src/features/customer/factory-programme/Illustrations.tsx` — `FactoryHero` (replaces `ProductionBoard`)
- `src/i18n/messages/{th,en}/customer/business.json` — `landing.titleStart/titleEm/intro/metaTitle`, `landing.facts.{lock,credit,free}`, `landing.order.*`; `landing.screen` and `features.soon` removed
- `src/i18n/messages/{th,en}/customer/pages.json` — `partner.title/titleStart/titleEm/lede`, `partner.trust.*`, `partner.hero.*`; `partner.titleEnd`, `partner.board`, `modules.live/in_development`, `compare.note` removed
- `e2e/storefront-business.spec.ts`, `e2e/storefront-business-pages.spec.ts` — headline and status-chip expectations

## Open / next

- /partner-with-us "งานจาก getpack + ลูกค้าของคุณเอง" section still has a dark "getpack Factory" card (`sources.hub`) — pre-existing; review against H-1 in the next round.
- Social-proof slot on /business stays empty until there are real customers (GLOBAL-RULES §3: nothing fabricated).
- Marketing copy pack (ads, posts, e-mails) to be written from the H-3 / H-6 messages.
