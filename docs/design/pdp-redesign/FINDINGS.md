# PDP Phase 0 (A3), web side: findings

Branch fix/uat-phase0. API contract: API-CHANGES.md (D-441). No network or API calls were made by the web agent.

## What the web changed
- One shared helper `src/features/shared/spec-label` (`specLabelText`, `SpecLabelLine`). It shows the API's label string and
  never builds a size, option or VAT string in the web.
- Spec label under every price:
  - listing card (`startingPriceAssumes.label`)
  - product page (`basis.label`)
  - configurator price panel, mobile bar and sheet (`calculation.specLabel`)
- The old "ราคาอ้างอิง: …" footnote, which was built from spec lines, is removed.
- Prices: the card, the product page and JSON-LD use `startingPricePerPiece` / `startingFromPerPiece` unchanged. No VAT or
  rounding change (Stage B owns it, DECISIONS §7).
- Configurator opens on the default spec: the pattern named in `defaultSpec.configuration.patternId`, the `isDefault`
  standard size, the `isDefault` options and `quantity.default`. No price is re-derived. The print-ink logic is untouched (A4).
- Tier table: consecutive instant tiers with an equal per-piece string are one row ("100–500 ชิ้น ฿x"). The comparison is on
  strings, there is no arithmetic, and the merged row's total column reads "ตามจำนวน" unless the chosen quantity is inside it.
- "ดาวน์โหลดแบบกล่อง" now links to `/styles/<styleCode>?v=<dielineVariantCodes[0]>&l=&w=&h=#dieline`. The style page
  prefills the dieline form with the default size. `/templates` is still ComingSoon and cannot take `?product=&size=`, so the
  API's suggested URL was not used. With no variant the old fallback stays.
- Mocks now price the reference configuration once; card, hint and `defaultSpec` agree.
- Tests: `catalog/price-consistency.test.ts` (card = product page = configurator default: same price string, quantity and spec
  label, for every priced mock product, and the configurator's opening state), `configurator/default-spec.test.ts`,
  `configurator/tiers.test.ts`, `shared/spec-label/spec-label.test.tsx`.

## Copy items 3-4 (report only, nothing changed)
3. "เลือกพิมพ์โลโก้ 1–2 สีได้" is the product description. It is admin catalogue text (`descriptionTh` of the catalogue
   product, shown on the product page and in the meta description). It is not in the web repo; the content team edits it in
   the back office. Print options come from the `ink_colour` group ("ดำ", "พิมพ์ 4 สี (CMYK)").
4. Size wording still in web strings:
   - `th/customer/catalog.json` `customSizeBody`: "กำหนดกว้าง × ยาว × สูงได้เอง …" (order กว้าง × ยาว × สูง; the rule is ยาว × กว้าง × สูง)
   - `th/customer/designer.json` line 808: "ขนาดกล่องเมื่อปิด {size} มม. (กว้าง × สูง × ลึก)" (a third order, and "ลึก")
   - `th/customer/catalog.json` `sizeDimensions` is already "ยาว × กว้าง × สูง (มม.)".
   - The "กว้าง × ยาว × ลึก 97.5 × 140 × 60" line came from the API's spec lines; the API now writes ยาว × กว้าง × สูง (API-CHANGES §2.5).
   Owner decision needed on whether to align the two web strings.

## Open questions
1. Is the style-page route acceptable instead of making `/templates` real (needs a design)?
2. Is "ตามจำนวน" acceptable for the total of a merged tier row?
3. If a style has several published dieline variants, which one does the link use? It takes the first today.
4. Mock products without a standard size (label, tag, pouch) show "on request" in `pnpm dev:mock` because they have no reference
   configuration. This is mock-only.
5. Not covered: cart and quote lines already show API spec lines; the studio dock and the cart surfaces were left to A6/A7/A8.

## To verify locally (both branches running)
- On `uat-postal-box-b`, `/products`, the product page and `/configure` show the same ฿ and the same label at 300 pcs.
- The configurator opens on size 00 and on the print option the default spec names.
- The merged tier row, and the download link opening the style page with the variant and the size prefilled.
