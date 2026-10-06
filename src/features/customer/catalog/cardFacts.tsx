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
  // UX audit, product card: the price bold in brand colour with the reference price struck through
  // on the same line, then one caption line — the quantity it assumes, the MOQ, the lead time.
  const amount = card.startingPricePerPiece ? format.thb(card.startingPricePerPiece) : null;
  return {
    price: amount ? (
      <span className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-muted text-sm">{t("price.fromLabel")}</span>
        <span className="text-primary text-lg font-bold tabular-nums">{amount}</span>
        <span className="text-muted text-sm">{t("price.perPiece")}</span>
        {campaign && card.referencePrice ? (
          <s
            className="text-muted ms-1 text-sm"
            aria-label={t("card.referencePrice", { price: format.thb(card.referencePrice) })}
          >
            {format.thb(card.referencePrice)}
          </s>
        ) : null}
      </span>
    ) : (
      <span className="text-muted text-sm">{t("price.onRequest")}</span>
    ),
    meta: [assumes, moq, leadTime].filter(Boolean).join(" · ") || null,
    badges: (
      <Badge
        tone={card.availability === "instant" ? "success" : card.availability === "partial" ? "warning" : "info"}
        className="bg-surface/95"
      >
        {t(`card.availability.${card.availability}`)}
      </Badge>
    ),
    promoBadge: campaign ? (
      <Badge tone="accent" appearance="solid" icon="tag">
        {t("card.campaign", { label: campaign.label, date: format.date(campaign.endsAt) })}
      </Badge>
    ) : null,
  };
}
