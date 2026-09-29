# RUN ORDER — U1 → U5 (packio-web)

> Pack รวม U1 (v3) + U2–U5 · decision ใหม่ต่อจาก D-181 (เริ่ม D-182) · `decisions.md`, `accounting-design.md`, `api-conventions.md` ต้องเหมือนกันทั้งสอง repo
> ไฟล์นี้คือลำดับเดียวที่ต้องใช้ · อ่านก่อนเริ่มทุก session · ถ้ามีหัวข้อซ้ำกันระหว่าง prompt ให้ยึดตาราง "Precedence" ด้านล่าง
> ทุก session: เปิด Plan Mode → gap analysis → ทำเฉพาะที่ขาด → test → PROGRESS → (backend) tag contract

## 1. Order
| # | Session | Prompt | Depends on | Parallel with |
|---|---|---|---|---|
| 0 | U-F2 art direction tokens (no backend needed) | `U1-update-2026-09-29.md` | — | everything |
| 0 | U5.0 baseline & instrumentation (run the competitor baseline **now**) | `U5-ux-excellence.md` | — | everything |
| 1 | U-F0.1 → U-F0.5 integration with the real contract | `U1-update-2026-09-29.md` | packio-api tag | — |
| 2 | U3.1 → U3.3 module system, solver, auto-3D (engine only) | `U3-style-library.md` | U-F0.1 | U-F0.2–0.5 |
| 3 | U2.F1 configurator v2 | `U2-benchmark-2026-09-29.md` | API U2.1–U2.3 | U3.4 wave 1 |
| 4 | U3.4 wave 1 → U3.5 library UX | `U3-style-library.md` | API U3.B1–U3.B3 | U2.F1 |
| 5 | U4.1 → U4.8 studio (each after its API session) | `U4-3d-studio.md` | U3.3, API U4.B* | U3.4 waves 2–3 |
| 6 | U2.F3 samples · U2.F4 trust · U2.F5 repeat business · U2.F7 partner parity | `U2-benchmark-2026-09-29.md` | API U2.4, U2.5, U2.7, U2.9 | U4 |
| 7 | U3.4 waves 2–3 · U3.6 intake & design requests | `U3-style-library.md` | API U3.B6 | U4.7+ |
| 7b | U5.1 step budgets · U5.2 first-run · U5.3 messaging · U5.4 parity fixes · U5.6 content · U5.7 polish | `U5-ux-excellence.md` | API U5.B* | U4, U2.F* |
| 7c | U5.5 assistant (flagged) | `U5-ux-excellence.md` | API U5.B5 eval pass | — |
| 8 | U-F3 storefront patterns · U-F4 pricing gap check | `U1-update-2026-09-29.md` | U-F0, API U-B4 | any |
| 9 | U5.8 release gate → UAT with the backend | `U5-ux-excellence.md` | everything pre-launch (U2.0 decision) | — |

## 2. Precedence (overlaps between packs)
| Topic | Build it in | Do **not** build again in |
|---|---|---|
| Style catalogue, library UI, search, drawing service | U3 | U2.6 (catalogue parts), U2.F2 (library page) |
| Free dieline download, packaging spec sheet | U2.6 / U2.F2 (if U3 has not) | — |
| 3D preview, AR, presentation | U4 (U4.3, U4.7) | U2.F6 |
| Configurator (basis, units, advisor, target price) | U2.1–U2.3 / U2.F1 | U4.2 reuses these components, does not rebuild them |
| Designer editing | U4 builds on the existing F4 designer | never a second editor |
| Messaging, RFQ basket, designer PDF, onboarding, assistant | U5 | — |
| UX quality proof | U5.0 baseline + U5.8 gate (`docs/ux/competitive-scorecard.md`) | — |

## 3. Business decisions to collect in U2.0 (one intake for all packs)
U2.0 must ask the user for **all** of these at once and write them into `docs/decisions.md`:
- Samples: credit against bulk order, freight, quote validity (U2.4)
- Guarantee remedies matrix, claim SLA, published tolerances (U2.5)
- Public network statistics allowed (U2.5)
- Call-off orders: deposit, expiry, minimum release, storage responsibility (U2.7)
- Free dieline download policy and rate limits (U2.6 / U3.B5)
- Style library: reference codes verified, Thai names approved, wave order vs partner machines (U3)
- UX: scorecard participants and moderator, assistant enabled or not, model/vendor and data terms (U5)
- Studio: print-licensed fonts, background-removal provider and data terms, substrate soft-proof profiles, first template set and author (U4)
- Samples vs the existing mockup / physical-proof add-on (D-072, built in B4.1): replace or extend
- **Launch gating (D-113 single launch):** which U2–U5 deliverables must be done before go-live and which ship after — record as a decision; everything not marked pre-launch must not block `docs/LAUNCH-CHECKLIST.md`

## 4. Kickoff message (same shape for every session)
`Read CLAUDE.md, docs/prompts/00-master-plan.md, docs/decisions.md, docs/prompts/RUN-ORDER-U1-U5.md and <prompt file>. Do <session> only, starting with the gap analysis. Plan first.`

## 5. Done means
All sessions in §1 have PROGRESS entries; no `CONTRACT-REQUEST` mock left in any R1 flow; studio release checklist (`studio-spec.md` §7) ticked with evidence; library counts in PROGRESS ≥ wave-2 target (≈ 910 publishable variants).
