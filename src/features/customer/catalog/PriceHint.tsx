import { getTranslations } from "next-intl/server";

import { displayPrice, figuresOf } from "@/features/shared/format/price";
import { getFormat } from "@/features/shared/format/server";
import { specLabelText } from "@/features/shared/spec-label";

import type { PriceHint } from "./api.server";

/**
 * "เริ่มต้น ฿3.50 / ชิ้น" and "ผลิต 7–10 วันทำการ" from a price hint, with the basis the figure
 * was computed at — never a number without what it assumes (design-system.md §1.3 "honest
 * pricing"). Every value is the API's; this only formats.
 */
export async function priceHintText(hint: PriceHint | undefined) {
  const [t, format] = await Promise.all([getTranslations("catalog"), getFormat()]);
  if (!hint) return { price: null, vatLabel: null, basis: null, leadTime: null, specs: null };

  // The hint's own basis says what the amount is; the shared helper labels it, never converts it.
  const shown = displayPrice(figuresOf(hint.startingFromPerPiece, hint.basis?.includesVat ?? true), "incl", format.thb, {
    incl: t("price.vatIncluded"),
    excl: t("price.vatExcluded"),
  });
  const price = shown ? t("price.from", { price: shown.amount }) : t("price.onRequest");
  const vatLabel = shown?.vatLabel ?? null;

  const basis = hint.basis
    ? [
        t("price.basisQuantity", { quantity: format.number(hint.basis.quantity) }),
        vatLabel ?? (hint.basis.includesVat ? t("price.vatIncluded") : t("price.vatExcluded")),
        hint.basis.includesDelivery ? t("price.deliveryIncluded") : t("price.deliveryExcluded"),
      ].join(" · ")
    : null;

  const range = hint.leadTimeBusinessDays;
  const leadTime = range
    ? range.min === range.max
      ? t("price.leadTimeExact", { days: range.min })
      : t("price.leadTime", { min: range.min, max: range.max })
    : null;

  // The reference specification the figure was priced at: the API's one string (D-441), never composed here.
  const specs = specLabelText(hint.basis?.label, format.locale);

  return { price, vatLabel, basis, leadTime, specs };
}
