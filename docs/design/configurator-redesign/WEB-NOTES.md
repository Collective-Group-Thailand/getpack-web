# A4 configurator — web notes (Phase 0, branch fix/uat-phase0)

Contract used as-is (API-CHANGES.md: no API changes). Nothing priced, rounded or computed in the web.

## What changed
1. Raw key `configurator.quantity.target`: the key existed, but its message had a `{unit}` argument the call did not pass, so next-intl printed the key. Label is now "งบต่อชิ้นในใจ (ไม่บังคับ)" / "Budget per piece in mind (optional)". Test `i18n-keys.test.ts` fails on any missing key or any message with arguments called without them, in the configurator folder, th and en.
2. Ink bug (the ฿17.26 on size 00). Cause: `model.ts` made the print groups `multiple` while the API's `ink_colour` group sends `selection: null` (ดำ default, CMYK not), so ดำ + CMYK could be sent together, and CMYK is laid 4× by `build.ts`. Fix in one place, `model.ts`: `toggleChoice` (CMYK replaces other inks, another ink removes CMYK, spot inks still combine) and `normaliseInks` (a seed, draft or default holding both ids keeps CMYK only). `ChoicesStep` uses the toggle; `initialState` normalises. `build.ts` is untouched (CMYK is still 4 passes of one id). Tests in `ink-choice.test.ts`.
3. Report only: the flat 100/300/500 price for sizes 00 and 0 is intended (digital print is flat per piece; see FINDINGS.md). Not changed.
4. Steps 2–4 (material, printing, finishing, assembly) show "ค่าเริ่มต้น" until the customer changes the step or presses "ถัดไป". A draft, shared or saved configuration counts as confirmed. UI only: `Stepper` has a `defaulted` flag, and `step-defaults.ts` holds the rule. Tests in `step-defaults.test.ts` and `quote.test.tsx`.
5. Report only: the VAT difference (฿338.58 vs ฿338.75) comes from the API taking VAT on the exact price before rounding the per-piece price up. The fix is Stage B (DECISIONS §7) and was not touched.
6. Size F at 100 pcs (`instant:false`): the price area now reads "ขอใบเสนอราคา {qty} {unit}" with the reason and the spec label. The primary button is "ขอใบเสนอราคา" and links to the existing RFQ path (`?from=<slug>&calc=<calculationId>`). No new endpoints. Test `dock-rfq.test.tsx` uses a mocked non-instant response.

## Verify locally (both branches running)
- UAT size 00 with CMYK only is priced once (one ink id ×4 passes), and ดำ alone gives ฿15.70.
- ดำ ↔ CMYK toggles, and a draft holding both inks collapses to CMYK.
- Steps 2–4 show ค่าเริ่มต้น, then the done tick after confirming.
- Size F at 100 pcs shows the request message and the RFQ link carries the calculation.

## Open questions
- Should the RFQ page also read the quantity from the link (it takes only `from` and `calc` today)? Not invented here.
- The API's `ink_colour` group still says `selection: null`. Marking ดำ/CMYK as "choose one" in the API (STAGE-A-REPORT open question 2) would make the web rule redundant. The web rule stays as the safeguard.
- Should the Summary step list defaulted steps as "ค่าเริ่มต้น" too? It still shows them as complete.
- Unused string `configurator.dock.noInstantPrice` could be removed.

## UAT check of the ink fix (2 `calculate` calls, 2026-10-26)
Product `uat-postal-box-b`, size 00 (140 × 97.5 × 60 internal), default material (KA125 B), quantities 100/300/500/1000,
web built from this branch, UAT API (old contract, may predate the API's pricing fix):
| Print front sent | Unit price at 100 / 300 / 500 / 1000 |
|---|---|
| ดำ (exactly one ink entry; the default) | ฿17.26 / ฿17.26 / ฿17.26 / ฿14.96 |
| พิมพ์ 4 สี (CMYK) only (exactly one ink entry) | ฿17.26 / ฿17.26 / ฿17.26 / ฿14.96 |
**With exactly one ink the price is still ฿17.26 on UAT, and ดำ = CMYK.** So "two inks" does not explain the UAT
number: the web bug (ดำ + CMYK sendable together) was real and is fixed, but the listing ฿15.70 vs configurator ฿17.26
gap on UAT has another cause (the API's A3 report suspects a stale cached starting price / UAT price data ~9.9 % above a
fresh seed). Re-check with the new API running (default spec = reference spec, D-441).

---

# C4 web-2 — C4-API-2/3 fields (branch design/configurator-redesign)

Contract re-vendored from getpack-api `design/configurator-redesign` (C4-API-3; unreleased pin as before) and
`pnpm gen:api` run. Everything is shown as the API sends it; nothing is computed.

| Field | Where | Copy |
|---|---|---|
| `design.freeRevisions` | Design step, hired-designer card | "แก้ไขฟรี {n} ครั้ง" (hidden when null) |
| `steps[].savingPercent` | Quantity cards | "ประหยัด {n}%" (hidden when null) |
| `steps[].zoneName` + `arrival` | Delivery step (under the postcode area) and the summary's truck line | "{zone} · ถึงประมาณ {from}–{to}", one date when equal |
| `steps[].vatRate` | Summary VAT line | "VAT {rate×100}% (รวมในยอดแล้ว)"; the rate is shifted as text (`store-fields.ts`); old label when null |

Mocks: `stepOf` fills the new fields; `withSavings` mirrors the engine's saving rule for mocked tiers.
Gates run in the cloud: typecheck · eslint (changed files) · `gen:api --check` · vitest 1,519/1,519 · e2e
`storefront-configurator-v2` 7/7 (mock backend on a dev server, 90 s timeout). `next build` was killed for memory in
the cloud container — run `pnpm build` and `pnpm e2e` locally. Checked at 1440 and 390 px against the prototype
(quantity savings, designer card, VAT line, zone + arrival line).
