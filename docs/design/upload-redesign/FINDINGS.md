# Upload redesign — Phase 0 findings (A5, web side)

Branch `fix/uat-phase0` · 2026-10-25 · internal document (not customer-facing; GLOBAL-RULES §1 allows factory terms here).

Sources, in order of weight: the API contract vendored in this repo (`src/lib/api/schema.d.ts`, generated from getpack-api), `docs/decisions.md`, this app's code, and **GET-only** reads of the shared UAT API (`https://uat-api.getpack.co`, 2026-10-25). The getpack-api source was **not** read (not in this workspace); server internals (bucket, scanner, preflight library) are stated as the contract describes them and marked *to confirm in getpack-api* where it is silent. Nothing was uploaded, submitted or ordered on UAT.

## 0. What Phase 0 changed in the web app

| Item | Change |
|---|---|
| `?design=own_file` preselect | `seedFromDesign` (`src/features/customer/configurator/state.ts`) set `own_file` from the query and then **overwrote it** with `online_designer` in the same function (the "keep the online designer" fallback ran whenever no Studio design id was given). Now the fallback runs only when no `design` was asked for. |
| Summary showing an option the step hides | The step hides "ออกแบบออนไลน์" when the designer cannot draw the pattern (no `dielineKey`), but state, collapsed summary and cart line still carried `online_designer`. New `designOptionsOf` / `designOptionOf` derive the option in force (chosen while offered, else the API default, else the first offered option); `Configurator.tsx` applies it to the derived state, so radio, summary and cart / guest-cart payload agree. |
| `/studio/upload` copy | No longer claims "ระบบเช็คความละเอียดและเขตปลอดภัยให้" nor names file types (accepted types come per order from `artwork-rules`). New copy per GLOBAL-RULES §6: upload after ordering, the team checks the file before production, proof approval before production. The `/studio` "มีไฟล์แบบแล้ว" card carried the same claim and was aligned. th + en. |
| `/studio` "แบบกล่อง" card | `studio.home.paths.box.body(NoCount)` said "แบบที่โรงงานในเครือข่ายผลิตได้จริง" / "partner factories" (GLOBAL-RULES §1) → "แบบที่ผลิตได้จริง" / "shapes we really produce". Fixed here because the same i18n file changed in this step. |
| Tests | Unit `configurator.test.ts` "opens on 'own file' from /studio/upload …"; E2E (mocks) `storefront-configurator-v2.spec.ts` "own file from /studio/upload". |

Why UAT showed it: all 5 instant products offer `["own_file","online_designer","hired_design"]`, default `own_file`, and their patterns (`DEV-RSC`, telescope, tray) have `dielineKey: null` — the seed forced `online_designer`, the step filtered it out (no radio checked), the summary printed "ออกแบบออนไลน์".

## 1. Where files are uploaded today, storage, access, retention

**When.** Only **after the order is placed**, on `/account/orders/<orderId>/artwork` (`ArtworkWorkspace.tsx`). Nothing is uploaded in configurator, cart or checkout; the cart line only carries `designOption: "own_file"`. Upload is offered when the order's `nextActions` has `order.upload_artwork` (API-decided). The contract example shows it on an order still `waiting_payment` → upload is possible **after ordering, before payment**; refused once artwork is approved or production started (D-073). To confirm on UAT with a real order by someone allowed to place one.

**How.** `GET /v1/store/orders/{orderId}/artwork-rules` (accepted MIME types, `maxBytes` example 2 GiB, `maxFiles` 20, `maxLinks` 5, bleed / safe zone / min ppi / colour mode, block-vs-warn per check, the order's dieline and size) → `POST /v1/store/files/presign` purpose `artwork` → PUT to signed URL (multipart + `resume` for large files) → `POST /v1/store/files/{fileId}/actions/complete` (size verified, **malware scan queued**; downloadable only when `scanStatus = clean`, infected never served) → `POST /v1/store/orders/{orderId}/artwork-submissions` (files and/or https links; replaces the version waiting for review). CS / Prepress can upload for the customer (`POST /v1/admin/orders/{orderId}/artwork-submissions`, channel `cs`), same rules and preflight.

**Storage.** S3 ("PUT the bytes to S3"); private, served only via **signed URLs valid 5 minutes** after an access check (`GET /v1/store/files/{fileId}/download`). Bucket, region, encryption, versioning: *to confirm in getpack-api / infra*.

**Access.** Contract (`GET /v1/store/files/{fileId}`): the uploader, their company scope, staff with `files.read`, or anyone who can see a record the file is attached to (e.g. the order); else 404. Partner factories use `/v1/partner/files/*`; whether the assigned factory can download the customer's original artwork or only the approved print file is *not stated — to confirm in getpack-api*. Studio team members are not a file-access scope in the contract.

**Retention.** "The purpose decides retention, accepted types and size." Stated values: financial records ≥ 10 years (`document`, D-368, D-415), "standard retention" for `image` (D-415). Retention for `artwork` is **not stated** → open question. No NDA flow in the contract.

## 2. Which products accept own files, and why only 5

`/studio/upload` hard-codes nothing: it lists every product with `availability !== "rfq"`. On UAT that is 5 of 42, all corrugated (calculator `corrugate`), MOQ 100:

| Slug | Name | Listing start | UAT standard sizes |
|---|---|---|---|
| `uat-postal-box-b` | กล่องไปรษณีย์ ฝาชน 3 ชั้น (ลอน B) | ฿15.70 | 00, 0, 0+4, A, 2A, B, C, C+8, D, E, F |
| `uat-white-mailer-box` | กล่องลูกฟูกผิวขาว ฝาชน พิมพ์โลโก้ | ฿33.83 | S, M |
| `uat-moving-carton-bc` | ลังกระดาษขนย้าย 5 ชั้น (ลอน BC) | ฿198.92 | M, L |
| `uat-fruit-box-tele` | กล่องผลไม้ ฝาครอบ (ตัวกล่อง + ฝา) | ฿123.06 | 4KG, 10KG |
| `uat-produce-tray` | ถาดลูกฟูกเปิดฝาบน (ถาดผัก / ถาดไข่) | ฿136.65 | STD |

"Only these 5" follows from **which products have an instant price path** (D-043 / D-234 tier-A or covering tier-B price list; else RFQ, D-100), not from an own-file rule. Every configurator offers `own_file`, and RFQ orders accept files too (RFQ cart lines offer `own_file` only). The other 37 products accept files via RFQ but are not listed on `/studio/upload`.

## 3. Does prepress already use a preflight tool?

**In the system: yes, an automated server-side preflight already runs, but only after ordering** (D-070 / ADR-0009). Each artwork submission is preflighted in the background: **blocks** on size mismatch or missing bleed, **warns** on low resolution or RGB. `PreflightCheck` already has 9 checks: `size_mismatch`, `missing_bleed`, `low_resolution`, `rgb_colour`, `fonts_not_embedded`, `safe_zone`, `thin_lines`, `overprint`, `ink_coverage`. Each has severity `block|warn|info`, measurements, th/en messages and a page; per-file reports carry a thumbnail, a `run` number and the expected size from the dieline template sent to the customer. Prepress can re-run it (`POST /v1/admin/artwork-submissions/{id}/actions/rerun-preflight`) and accept or reject. Thresholds come from settings `artwork.preflight_rules` (D-302) and `studio.print_rules` (D-278 — rules stay off until Prepress sets them). The Studio print file goes through the same preflight (D-280); barcodes / QR use one shared validator (D-283).

This is the natural base for the Phase 2 12-point engine (GLOBAL-RULES §5). 6 of the 12 checks exist: dieline/size, bleed, safe zone, resolution, fonts, CMYK. Strokes ≈ `thin_lines`. Missing: ink count vs print method, text ≥ 6 pt, barcode/QR placement over folds, die-cut on a non-printing layer, small text in 100 % K. The PDF library used is *not in the contract — confirm in getpack-api*.

Customer-facing copy must still not claim an automatic check before ordering (GLOBAL-RULES §3, §6) — the existing preflight runs after the order, on the submission.

**Desktop tools (Acrobat Preflight, Esko, PitStop, callas):** nothing in repo, contract or decisions names one → question for the Prepress lead. Their profile's thresholds could seed `artwork.preflight_rules` instead of licensing a tool server-side.

## 4. Do dieline templates per product/size exist as files?

**Generated, not stored.** The drawing service (D-270, `@getpack/dieline`) builds any published style variant at any in-range size as **PDF, DXF or SVG** (`POST /v1/store/dielines/downloads`). Signed-in only, 5/min and 20/day (D-203 / D-271), logged, cached by sha256. The PDF (D-302) has layers and spot swatches `CutContour`, `Crease`, `Perf`, `Glue`, `Bleed`, `Safe` (+ `HalfCut`), bleed/safe from the preflight rules, and the style code in title and metadata. Web: `src/features/customer/styles/DielineDownload.tsx` on `/styles`. **No `.ai` output exists** (Phase 1 asks for .ai + PDF).

Per order, Prepress can upload a dieline for the customer (`POST /v1/admin/orders/{orderId}/templates`, purpose `dieline`; customer reads `GET /v1/store/orders/{orderId}/templates`). Its trim box becomes the preflight's expected size (ADR-0009). These are per order, not per catalogue product or size.

**Gap for the 5 own-file products:** their UAT patterns have `styleCode: null` and `dielineKey: null`, so the drawing service cannot draw them (and the online designer is hidden). The listing gives `templateAvailability: "drawing"` (enum `none|online_template|drawing`) for all 5, which suggests the team sends a drawing rather than an instant download. That is why "ดาวน์โหลดแผ่นคลี่จากแบบกล่อง" can only link to `/styles` today.

## 5. "เริ่ม ฿15.70" vs ฿17.26 (not fixed here — owned by PDP Phase 0 / A3)

UAT `GET /v1/store/catalog/products` for `uat-postal-box-b`: `startingPricePerPiece "15.70"`, `startingPriceAssumes` quantity **300**, กล่องฝาชน (RSC), "97.5 × 140 × 60 มม." labelled กว้าง × ยาว × ลึก, ลูกฟูก KA125 ลอน B, print_front **"พิมพ์ 4 สี (CMYK)"**. The configurator opens on size 00 · KA125 B · print **"ดำ"**, reported at ฿17.26 / 300 pcs. UAT `calculate` is a POST and was not re-run.

So listing and configurator price **different specs**: the CMYK reference configuration vs the black-print default. Yet the cheaper number is the 4-colour spec, which suggests different paths as well (the D-220 cached reference price vs the live calculator) or different tier logic (100 / 300 / 500 all at ฿17.26 is also reported). `/studio/upload` shows `startingPricePerPiece` unchanged and inherits A3's fix: one pricing service, one spec label, and an equality test for every instant product. The spec-label order mismatch (W × L × D vs L × W × H) has the same owner.

## Open questions

1. Retention period for `artwork` (and later derived print files); configurable setting?
2. NDA request flow: none exists; owner and form?
3. Can the assigned factory download the customer's **original** artwork, or only the approved print file / proof?
4. Should `/studio/upload` list RFQ-only products (37 on UAT) with a route to their RFQ form?
5. Prepress desktop preflight tool and profile in use today?
6. Dielines for the 5 own-file products: map their patterns to published styles, or deliver files per size? No `.ai` output exists.
7. ฿15.70 vs ฿17.26: A3.
8. Assumption: when the API default design option is itself hidden, the web falls back to the first offered option (never sends an option the customer could not see). Confirm, or have the API always send an offered default.

## Noted, not changed (other phases)

- `configurator.nextSteps.artwork` "ส่งไฟล์งานหรือออกแบบออนไลน์" shows even where the designer is hidden; belongs to C4.
- "โรงงาน" for our own production remains in other customer i18n files not touched by this step (e.g. `home.json` "ทรงที่โรงงานในเครือข่ายผลิตได้จริง", `pages.json`, `storefront.json`, `my-orders.json`, `configurator.json`). Listed in STAGE-A-REPORT-WEB.md for their owning phases.
