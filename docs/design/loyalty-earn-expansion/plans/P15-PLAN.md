# P1.5 — Deals surface · plan

Branch `feat/loyalty-p15-deals-surface` (both repos). Source: PLAN §3.5, §7 Phase 1.5; contract `API-CHANGES-P15.md`.
Design input: `stitch/STITCH-NOTES.md` round 2 (tickets, primary green, D-486) and round 1 sections c (PDP) and
d (cart).

| # | Item | Repo |
|---|---|---|
| 1 | Schema + migration: visibility, display, attribution, quote-recovery state; settings `promotions.quote_recovery` | api |
| 2 | Store endpoints: public list/detail, save, applicable-codes, ladder | api |
| 3 | Admin: visibility + display + hero image, publish guard, audit, report columns | api + web |
| 4 | Quote recovery worker + 2 notification rows | api |
| 5 | Prototypes: /deals, DealCard (ticket), PDP badge + ladder, cart coupon picker, /liff/deals | web |
| 6 | Web: /deals + /deals/[slug] (JSON-LD Offer, FAQ, indexable), home strip, PDP badge + VolumeLadder, CouponPicker (manual entry kept, max 3), /liff/deals, ?ref cookie, wallet empty state → /deals | web |
| 7 | Tests: deals.e2e-spec.ts, quote-recovery.e2e-spec.ts, confidentiality, applicable-codes = checkCode, hidden never served; Storybook DealCard / CouponPicker / VolumeLadder; vitest | both |
| 8 | Docs: decisions, PROGRESS, REPORT section | both |

Ticket design rules (D-486):
- Stub `primary-subtle`, value in `primary-subtle-fg`; the featured stub is `primary` with white text and a stamp edge.
- Amber is used only on one "ดีลเด่น" badge per surface.
- Notches and the stamp edge are `mask-image` on one `Ticket` primitive.
- "เหลือ n วัน" is `warning` text (no countdown).
