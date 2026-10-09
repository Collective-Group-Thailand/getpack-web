import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { RATE_LINE_ACCEPTANCE, SETTING_VERSION_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { ShippingCardReview } from "@/features/partner/prices/ShippingCardReview";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/partner/status";
import type { Schemas } from "@/lib/api/types";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerPrices.shipping"))("title") };
}

/**
 * What Packio pays the factory for delivering with its own fleet (D-013): the card in force,
 * the one scheduled, and one sent for the factory's answer (D-042). Drafts are never shown.
 */
export default async function ShippingRatesPage() {
  const t = await getTranslations("partnerPrices.shipping");
  const format = await getFormat();
  const context = await factoryContext();
  const { contract } = await partnerServerApis();
  const factoryId = context.factoryId;
  const card = await attempt(
    async () =>
      (await contract.GET("/v1/partner/factories/{factoryId}/shipping-rate-card", { params: { path: { factoryId } } }))
        .data!,
  );
  const back = { href: "/prices", label: t("back") };
  if (!card.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={card.error} />
      </PartnerPage>
    );
  const versionOf = (versionId: string) =>
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/shipping-rate-card/versions/{versionId}", {
            params: { path: { factoryId, versionId } },
          })
        ).data!,
    );
  const [open, current] = await Promise.all([
    card.data.open ? versionOf(card.data.open.id) : null,
    card.data.current ? versionOf(card.data.current.id) : null,
  ]);
  const band = (rate: Schemas["FactoryRateDto"]) =>
    [
      rate.postcode ? t("zonePostcode", { zone: rate.zoneCode, postcode: rate.postcode }) : rate.zoneCode,
      rate.weightMaxG === null
        ? t("weightFrom", { from: format.number(rate.weightMinG / 1000) })
        : t("weightRange", { from: format.number(rate.weightMinG / 1000), to: format.number(rate.weightMaxG / 1000) }),
    ].join(" · ");

  return (
    <PartnerPage title={t("title")} back={back} description={t("body")}>
      {open?.data ? (
        <PartnerSection
          title={t("openTitle", { version: open.data.versionNo })}
          description={t("openBody", { date: format.date(open.data.effectiveFrom), count: open.data.openLines })}
        >
          {open.data.reason ? <p>{open.data.reason}</p> : null}
          <ShippingCardReview
            versionId={open.data.id}
            rates={open.data.rates}
            bandLabels={Object.fromEntries(open.data.rates.map((rate) => [rate.id, band(rate)]))}
          />
        </PartnerSection>
      ) : null}

      <PartnerSection title={t("currentTitle")}>
        {current?.data ? (
          <>
            <p className="text-muted text-sm">
              {t("currentMeta", {
                version: current.data.versionNo,
                date: format.date(current.data.effectiveFrom),
                accepted: format.date(current.data.factoryAcceptedAt),
              })}
            </p>
            <ul className="flex flex-col gap-2">
              {current.data.rates.map((rate) => (
                <li key={rate.id}>
                  <Card padding="md" className="flex flex-wrap items-center gap-2">
                    <span className="flex-1">{band(rate)}</span>
                    <span className="font-medium tabular-nums">{format.thb(rate.payoutAmount)}</span>
                    {rate.perExtraKg ? (
                      <span className="text-muted text-sm">{t("perKg", { amount: format.thb(rate.perExtraKg) })}</span>
                    ) : null}
                    <StatusChip map={RATE_LINE_ACCEPTANCE} value={rate.acceptance} />
                  </Card>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyState icon="truck" title={t("noCurrent")} />
        )}
      </PartnerSection>

      {card.data.scheduled ? (
        <PartnerSection title={t("scheduledTitle")}>
          <Card padding="md" className="flex flex-wrap items-center gap-2">
            <span className="flex-1">
              {t("scheduledBody", {
                version: card.data.scheduled.versionNo,
                date: format.date(card.data.scheduled.effectiveFrom),
              })}
            </span>
            <StatusChip map={SETTING_VERSION_STATUS} value={card.data.scheduled.status} />
          </Card>
        </PartnerSection>
      ) : null}
    </PartnerPage>
  );
}
