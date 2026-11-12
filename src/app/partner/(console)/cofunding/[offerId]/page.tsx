import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AcceptOffer, DeclineOffer } from "@/features/partner/cofunding/actions";
import { capPct, OFFER_STATUS_TONE } from "@/features/partner/cofunding/offers";
import { attempt, canAt, factoryContext } from "@/features/partner/context/server";
import { ActionPanel, PageError, PartnerDetail, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { serverApi } from "@/lib/api/server";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { Meter } from "@/ui/components/Meter";
import { Icon } from "@/ui/icons";

type Props = { params: Promise<{ offerId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerBilling.cofunding"))("detailTitle") };
}

const CONTRIBUTION_TONE = { accrued: "info", netted: "success", reversed: "neutral", refunded: "neutral" } as const;

/**
 * One co-funding offer (loyalty P4, D-506; `partner.cofundingOffers.get`): the terms in one plain sentence, what it
 * is not ("ไม่ใช่ข้อบังคับ …"), the facts, the accrued / cap meter once accepted, and the orders counted by order and
 * job code with amounts — no customer, address or price. "ตอบรับ" / "ปฏิเสธ" only when the API offers them
 * (`nextActions`: the owner, before respond-by); otherwise the panel says why there is nothing to do.
 */
export default async function CofundingOfferPage({ params }: Props) {
  const { offerId } = await params;
  const [t, format, context] = await Promise.all([
    getTranslations("partnerBilling.cofunding"),
    getFormat(),
    factoryContext(),
  ]);
  const back = { href: "/cofunding", label: t("title") };
  const found = await attempt(
    async () =>
      (
        await (
          await serverApi("partner")
        ).GET("/v1/partner/cofunding-offers/{offerId}", { params: { path: { offerId } } })
      ).data!,
  );
  if (!found.data)
    return (
      <PartnerPage title={t("detailTitle")} back={back}>
        <PageError error={found.error} />
      </PartnerPage>
    );
  const offer = found.data;
  const window = t("window", { from: format.date(offer.validFrom), to: format.date(offer.validTo) });
  const share =
    offer.mode === "pct_of_discount"
      ? t("terms.pct", { pct: format.percent(offer.sharePct, 2) })
      : t("terms.fixed", { amount: format.thb(offer.fixedAmount) });
  const canAccept = offer.nextActions.includes("accept");
  const canDecline = offer.nextActions.includes("decline");
  const open = offer.status === "proposed";
  const pastRespondBy = open && !canAccept && canAt(context, "factory_cofunding.decide");
  const use = t("use", {
    accrued: format.thb(offer.accruedAmount),
    cap: format.thb(offer.capAmount),
    orders: offer.ordersCount,
  });

  const panel =
    canAccept || canDecline ? (
      <ActionPanel id="offer-answer" tone="primary" title={t("answerTitle")} description={t("answerBody")}>
        <div data-fill="row" className="flex flex-col gap-2">
          {canAccept ? <AcceptOffer offerId={offer.id} terms={offer.termsText} window={window} /> : null}
          {canDecline ? <DeclineOffer offerId={offer.id} /> : null}
        </div>
        <p className="text-muted flex items-center gap-1.5 text-sm tabular-nums">
          <Icon name="clock" size={16} aria-hidden="true" />
          {t("respondUntil", { date: format.dateTime(offer.respondBy) })}
        </p>
      </ActionPanel>
    ) : offer.status === "accepted" || offer.status === "ended" ? (
      <ActionPanel id="offer-use" tone="neutral" title={t("accruedTitle")}>
        <p className="text-2xl font-semibold tabular-nums">{format.thb(offer.accruedAmount)}</p>
        <Meter value={capPct(offer)} label={t("accruedTitle")} valueText={use} />
        <p className="text-muted text-sm tabular-nums">
          {use}
          {offer.answeredAt ? ` · ${t("acceptedOn", { date: format.dateTime(offer.answeredAt) })}` : ""}
        </p>
      </ActionPanel>
    ) : (
      <ActionPanel
        id="offer-closed"
        tone="neutral"
        title={open ? (pastRespondBy ? t("closedTitle") : t("ownerOnlyTitle")) : t(`status.${offer.status}`)}
        description={
          open
            ? pastRespondBy
              ? t("closedBody")
              : t("ownerOnlyBody", { date: format.dateTime(offer.respondBy) })
            : offer.status === "declined"
              ? (offer.declineReason ?? undefined)
              : offer.status === "withdrawn"
                ? (offer.withdrawReason ?? undefined)
                : t("getpackFunds")
        }
      />
    );

  return (
    <PartnerPage
      title={t("ticketTitle", {
        type: offer.deal.productTypeName,
        from: format.date(offer.validFrom),
        to: format.date(offer.validTo),
      })}
      back={back}
      status={
        <Badge tone={OFFER_STATUS_TONE[offer.status]} size="md">
          {t(`status.${offer.status}`)}
        </Badge>
      }
      description={t("dealLine", { name: offer.deal.name, date: format.date(offer.proposedAt) })}
      full
    >
      <PartnerDetail aside={panel}>
        <Card padding="none" className="overflow-hidden">
          <div className="p-4 sm:p-5">
            <p className="max-w-[46ch] text-[1.0625rem] leading-relaxed font-semibold sm:text-[1.1875rem]">
              {t("sentence", { share, cap: format.thb(offer.capAmount) })}
            </p>
            <p className="text-muted mt-3 flex items-start gap-2 text-sm">
              <Icon name="info" size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
              {t("notMandatory")}
            </p>
          </div>
          <dl className="border-border grid grid-cols-2 gap-x-6 gap-y-3.5 border-t p-4 text-sm sm:p-5">
            <div>
              <dt className="text-muted text-xs">{t("facts.dealDiscount")}</dt>
              <dd className="mt-0.5 font-medium tabular-nums">
                {t("facts.discountOf", { pct: format.percent(offer.deal.discountPct) })}
              </dd>
            </div>
            <div>
              <dt className="text-muted text-xs">{t("facts.window")}</dt>
              <dd className="mt-0.5 font-medium tabular-nums">{window}</dd>
            </div>
            <div>
              <dt className="text-muted text-xs">{t("facts.cap")}</dt>
              <dd className="mt-0.5 font-medium tabular-nums">{format.thb(offer.capAmount)}</dd>
            </div>
            <div>
              <dt className="text-muted text-xs">{t("facts.respondBy")}</dt>
              <dd className="mt-0.5 font-medium tabular-nums">{format.dateTime(offer.respondBy)}</dd>
            </div>
            {offer.note ? (
              <div className="col-span-2">
                <dt className="text-muted text-xs">{t("facts.note")}</dt>
                <dd className="mt-0.5">{offer.note}</dd>
              </div>
            ) : null}
          </dl>
        </Card>

        <PartnerSection title={t("ordersTitle")} description={t("ordersNote")}>
          <PartnerTable
            caption={t("ordersTitle")}
            rows={offer.orders}
            rowKey={(row) => `${row.orderCode}-${row.jobNumber}`}
            empty={
              <p className="text-muted border-border rounded-card border px-4 py-5 text-sm">
                {open ? t("ordersEmptyOpen") : t("ordersEmpty")}
              </p>
            }
            columns={[
              {
                key: "order",
                header: t("columns.order"),
                primary: true,
                cell: (row) => <span className="tabular-nums">{row.orderCode}</span>,
              },
              {
                key: "job",
                header: t("columns.job"),
                cell: (row) => <span className="tabular-nums">{row.jobNumber}</span>,
              },
              {
                key: "discount",
                header: t("columns.discount"),
                align: "end",
                cell: (row) => format.thb(row.discountAmount),
              },
              {
                key: "share",
                header: t("columns.share"),
                align: "end",
                cell: (row) => (
                  <span className={row.status === "reversed" ? "text-subtle line-through" : "font-semibold"}>
                    {format.thb(row.shareAmount)}
                  </span>
                ),
              },
              {
                key: "status",
                header: t("columns.status"),
                cell: (row) => (
                  <span className="flex flex-col items-start gap-0.5">
                    <Badge size="sm" tone={CONTRIBUTION_TONE[row.status]}>
                      {t(`contribution.${row.status}`)}
                    </Badge>
                    {row.billingStatementNumber ? (
                      <span className="text-muted text-xs tabular-nums">{row.billingStatementNumber}</span>
                    ) : null}
                    {row.capped ? <span className="text-muted text-xs">{t("capped")}</span> : null}
                  </span>
                ),
              },
            ]}
          />
        </PartnerSection>
        <Callout tone="neutral" icon="info">
          {t("netNote")}
        </Callout>
      </PartnerDetail>
    </PartnerPage>
  );
}
