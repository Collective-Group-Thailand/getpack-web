import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { RATE_LINE_ACCEPTANCE, SETTING_VERSION_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { ShippingCardReview } from "@/features/partner/prices/ShippingCardReview";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/partner/status";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerPrices.shipping"))("title") };
}

/**
 * What getpack pays the factory for delivering with its own fleet (D-013): the card in force,
 * the one scheduled, and one sent for the factory's answer (D-042). Drafts are never shown.
 */
export default async function ShippingRatesPage() {
  const t = await getTranslations("partnerPrices.shipping");
  const tPrices = await getTranslations("partnerPrices");
  const format = await getFormat();
  const locale = await getLocale();
  const context = await factoryContext();
  const { contract } = await partnerServerApis();
  const factoryId = context.factoryId;
  const card = await attempt(
    async () =>
      (await contract.GET("/v1/partner/factories/{factoryId}/shipping-rate-card", { params: { path: { factoryId } } }))
        .data!,
  );
  if (!card.data)
    return (
      <PartnerPage title={t("title")}>
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
  // The zone as the factory reads it (getpack-api v0.43.4); an API that predates the name sends only the code.
  const zoneOf = (rate: Schemas["FactoryRateDto"]) =>
    (locale === "en" ? rate.zoneNameEn : rate.zoneNameTh) || rate.zoneNameTh || rate.zoneCode;
  const zoneText = (rate: Schemas["FactoryRateDto"]) =>
    rate.postcode ? t("zonePostcode", { zone: zoneOf(rate), postcode: rate.postcode }) : zoneOf(rate);
  const band = (rate: Schemas["FactoryRateDto"]) =>
    [
      zoneText(rate),
      rate.weightMaxG === null
        ? t("weightFrom", { from: format.number(rate.weightMinG / 1000) })
        : t("weightRange", { from: format.number(rate.weightMinG / 1000), to: format.number(rate.weightMaxG / 1000) }),
    ].join(" · ");

  return (
    <PartnerPage wide title={t("title")} description={t("body")} back={{ href: "/prices", label: tPrices("title") }}>
      {open?.data ? (
        <PartnerSection
          id="rate-open"
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
            <PartnerTable
              caption={t("currentTitle")}
              rows={current.data.rates}
              rowKey={(rate) => rate.id}
              columns={[
                {
                  key: "zone",
                  header: t("table.zone"),
                  primary: true,
                  cell: (rate) => zoneText(rate),
                },
                {
                  key: "weight",
                  header: t("table.weight"),
                  className: "whitespace-nowrap",
                  cell: (rate) =>
                    rate.weightMaxG === null
                      ? t("weightFrom", { from: format.number(rate.weightMinG / 1000) })
                      : t("weightRange", {
                          from: format.number(rate.weightMinG / 1000),
                          to: format.number(rate.weightMaxG / 1000),
                        }),
                },
                {
                  key: "amount",
                  header: t("table.amount"),
                  align: "end",
                  cell: (rate) => <span className="font-semibold">{format.thb(rate.payoutAmount)}</span>,
                },
                {
                  key: "extra",
                  header: t("table.extra"),
                  align: "end",
                  cell: (rate) => (rate.perExtraKg ? format.thb(rate.perExtraKg) : "—"),
                },
                // Every line of a card in force is accepted: a chip on each row would only repeat it. The column
                // shows up only when a line says something else.
                ...(current.data.rates.some((rate) => rate.acceptance !== "accepted")
                  ? [
                      {
                        key: "status",
                        header: t("table.status"),
                        className: "whitespace-nowrap",
                        cell: (rate: Schemas["FactoryRateDto"]) =>
                          rate.acceptance === "accepted" ? null : (
                            <StatusChip map={RATE_LINE_ACCEPTANCE} value={rate.acceptance} />
                          ),
                      },
                    ]
                  : []),
              ]}
            />
          </>
        ) : (
          <EmptyState
            icon="truck"
            title={t("noCurrent")}
            action={
              open?.data ? (
                <Button asChild variant="secondary" iconStart="handshake">
                  <a href="#rate-open">{t("openTitle", { version: open.data.versionNo })}</a>
                </Button>
              ) : (
                <Button asChild variant="secondary" iconStart="arrow-left">
                  <Link href="/prices">{tPrices("title")}</Link>
                </Button>
              )
            }
          />
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
