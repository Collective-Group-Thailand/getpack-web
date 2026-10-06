import { getTranslations } from "next-intl/server";

import { getFormat } from "@/features/shared/format/server";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";

type Facts = Pick<
  Schemas["StoreProductCardDto"],
  | "availability"
  | "startingPricePerPiece"
  | "startingPriceAssumes"
  | "moq"
  | "leadTimeDays"
  | "campaignBadge"
  | "referencePrice"
>;

/**
 * What a made-to-order card says (D-181, D-307): the starting price per piece with the quantity it
 * assumes, the MOQ, the lead time, how the type is priced (ราคาทันที / บางสเปก / ขอใบเสนอราคา), and a
 * campaign badge only for a live automatic promotion, with its real end date — the struck-through
 * reference price appears only beside that badge. Every value is the API's; nothing is computed.
 */
export async function cardFacts(card: Facts) {
  const [t, format] = await Promise.all([getTranslations("catalog"), getFormat()]);
  const price = card.startingPricePerPiece ? t("price.from", { price: format.thb(card.startingPricePerPiece) }) : null;
  const assumes = card.startingPriceAssumes
    ? t("price.basisQuantity", { quantity: format.number(card.startingPriceAssumes.quantity) })
    : null;
  const range = card.leadTimeDays;
  const leadTime = range
    ? range.min === range.max
      ? t("price.leadTimeExact", { days: range.min })
      : t("price.leadTime", { min: range.min, max: range.max })
    : null;
  const moq = card.moq !== null ? t("card.moq", { quantity: format.number(card.moq) }) : null;
  const campaign = card.campaignBadge;
  return {
    price: price ? (
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span>{price}</span>
        {campaign && card.referencePrice ? (
          <s
            className="text-muted text-xs"
            aria-label={t("card.referencePrice", { price: format.thb(card.referencePrice) })}
          >
            {format.thb(card.referencePrice)}
          </s>
        ) : null}
        {assumes ? <span className="text-muted text-xs font-normal">{assumes}</span> : null}
      </span>
    ) : (
      t("price.onRequest")
    ),
    meta: [moq, leadTime].filter(Boolean).join(" · ") || null,
    badges: (
      <>
        <Badge
          tone={card.availability === "instant" ? "success" : card.availability === "partial" ? "warning" : "info"}
        >
          {t(`card.availability.${card.availability}`)}
        </Badge>
        {campaign ? (
          <Badge tone="accent" icon="tag">
            {t("card.campaign", { label: campaign.label, date: format.date(campaign.endsAt) })}
          </Badge>
        ) : null}
      </>
    ),
  };
}
