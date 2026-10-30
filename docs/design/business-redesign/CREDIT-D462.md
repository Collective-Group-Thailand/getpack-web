# Flexible company credit (D-462, 2026-10-31)

Owner agreed (2026-10-30 23:33) to three proposals; built in getpack-api `87d2802` and here.

| # | What | Where |
|---|---|---|
| 1 | Every company member who may order sees the **available credit, term and end date** (`store.companyCredit.summary`); limit, exposure and statements stay with Admin / Accountant | `/business` overview card, `/business/credit` (nav item now open to `order`), `/account` company shortcut "เครดิตคงเหลือ ฿…" |
| 2 | A customer without a company sees a quiet invitation on `/account` ("สั่งในนามบริษัท และจ่ายแบบเครดิตเทอม") — no figures, since terms are settings | `/account` |
| 3 | Back office: **temporary limit** (switch + end date, falls back to the latest permanent version) and **custom term** ("กำหนดเอง", within `b2b.credit_custom_terms`, staff only) | admin → บริษัทคู่ค้า → แท็บเครดิต: callout of the temporary limit and its fall-back, history column "ใช้ได้ถึง", badge "กำหนดเอง" |

Design: UI UX Pro Max (`B2B procurement account credit terms`, Minimalism & Swiss, density 6) used for the UX rules —
visible labels, inline validation, progressive disclosure (the end-date and custom-days fields appear only when chosen),
helpful empty state; its navy palette and Plus Jakarta Sans were **not** applied (getpack tokens and Anuphan win).

## Test accounts

| Where | Account | What it shows |
|---|---|---|
| Mock (`pnpm dev:mock`, OTP `000000`) | `0891112222` creditadmin — Admin of B2606 | temporary ฿150,000 / 90 days (custom) → ฿30,000 / 30 days |
| | `0892223333` creditbuyer — buyer of B2606 | summary only |
| | `0867890123` companyadmin / `0878901234` companybuyer — B2601 | permanent ฿200,000 / 30 days |
| | `0812345678` returning — no company | the `/account` invitation |
| | `finance.manager.staff@getpack.invalid` / `mock-password` | back office, B2606 → เครดิต |
| UAT (`pnpm uat:populate`, phone OTP) | C09 `0800000109` Admin, C14 `0800000114` Accountant, C10 `0800000110` buyer — UAT-CO-001 | ฿50,000 / 30 days |
| | C15 `0800000115` Admin, C16 `0800000116` buyer — UAT-CO-002 | temporary ฿150,000 / 90 days for 60 days → ฿30,000 / 30 |

e2e: `e2e/storefront-company-credit.spec.ts` (4 tests).
