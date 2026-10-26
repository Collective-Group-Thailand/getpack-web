import { getTranslations } from "next-intl/server";

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
  if (!hint) return { price: null, basis: null, leadTime: null, specs: null };

  const price = hint.startingFromPerPiece
    ? t("price.from", { price: format.thb(hint.startingFromPerPiece) })
    : t("price.onRequest");

  const basis = hint.basis
    ? [
        t("price.basisQuantity", { quantity: format.number(hint.basis.quantity) }),
        hint.basis.includesVat ? t("price.vatIncluded") : t("price.vatExcluded"),
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

  return { price, basis, leadTime, specs };
}
