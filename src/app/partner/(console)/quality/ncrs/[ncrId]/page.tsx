import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_NCR_SEVERITY, ERP_NCR_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatQty } from "@/features/partner/erp/format";
import { ActionPanel, PageError, PartnerDetail, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { NcrActions, NcrWorkForm } from "@/features/partner/insight/QualityForms";
import { erpSalespeople } from "@/features/partner/sales/server";
import { StatusChip } from "@/features/partner/status";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerInsight.ncrs"))("title") };
}

/** One NCR (D-374): what went wrong, where, what happens to the goods, the cause and the correction. */
export default async function NcrPage({ params }: { params: Promise<{ ncrId: string }> }) {
  const [{ ncrId }, t, tSource, tDisposition, tSales, format, context] = await Promise.all([
    params,
    getTranslations("partnerInsight.ncrs"),
    getTranslations("partnerInsight.sources"),
    getTranslations("partnerInsight.dispositions"),
    getTranslations("partnerSales.common"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const [read, people] = await Promise.all([
    attempt(async () => {
      const { data, response } = await contract.GET("/v1/partner/factories/{factoryId}/erp/ncrs/{ncrId}", {
        params: { path: { factoryId: context.factoryId, ncrId } },
      });
      return { ncr: data!, etag: response.headers.get("etag") };
    }),
    attempt(async () => erpSalespeople(contract, context.factoryId)),
  ]);
  const back = { href: "/quality/ncrs", label: t("title") };
  if (!read.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const { ncr, etag } = read.data;
  const editable = ncr.nextActions.some((a) => a.key === "erp_ncr.edit");
  return (
    <PartnerPage
      full
      title={`${ncr.ncrNo} · ${ncr.title}`}
      back={back}
      status={
        <>
          <StatusChip map={ERP_NCR_STATUS} value={ncr.status} size="md" />
          <StatusChip map={ERP_NCR_SEVERITY} value={ncr.severity} size="md" />
          {ncr.overdue ? <Badge tone="danger">{t("overdue")}</Badge> : null}
        </>
      }
    >
      {/* The NCR on the left; who owns it, by when, and the next step in a panel that stays in view. */}
      <PartnerDetail
        aside={
          <ActionPanel
            id="ncr-next"
            tone={ncr.nextActions.some((a) => !a.disabledReason) ? "primary" : "neutral"}
            title={tSales("nextSteps")}
          >
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1.5 text-sm">
              <dt>{t("owner")}</dt>
              <dd className="text-end font-medium">{ncr.owner?.name ?? "—"}</dd>
              <dt>{t("dueOn", { date: "" }).trim()}</dt>
              <dd className={ncr.overdue ? "text-danger text-end font-semibold tabular-nums" : "text-end tabular-nums"}>
                {format.date(ncr.actionDueOn)}
              </dd>
            </dl>
            {editable ? (
              <div data-fill="row" className="flex flex-col gap-2">
                <Button asChild size="lg" variant="secondary" iconStart="edit">
                  <a href="#ncr-work">{t("workTitle")}</a>
                </Button>
              </div>
            ) : null}
            <NcrActions ncr={ncr} layout="panel" />
          </ActionPanel>
        }
      >
        <Card padding="md">
          <DescriptionList
            columns={2}
            items={[
              { term: t("source"), description: tSource(ncr.source) },
              { term: t("descriptionLabel"), description: ncr.description },
              ...(ncr.check
                ? [
                    {
                      term: t("check"),
                      description: (
                        <Link className="text-primary underline" href={`/quality/${ncr.check.id}`}>
                          {ncr.check.number}
                        </Link>
                      ),
                    },
                  ]
                : []),
              ...(ncr.item ? [{ term: t("item"), description: `${ncr.item.name} (${ncr.item.sku})` }] : []),
              ...(ncr.quantity ? [{ term: t("quantity"), description: formatQty(ncr.quantity, format.locale) }] : []),
              ...(ncr.warehouse ? [{ term: t("warehouse"), description: ncr.warehouse.name }] : []),
              ...(ncr.productionOrder
                ? [
                    {
                      term: t("order"),
                      description: (
                        <Link className="text-primary underline" href={`/planning/orders/${ncr.productionOrder.id}`}>
                          {ncr.productionOrder.number}
                        </Link>
                      ),
                    },
                  ]
                : []),
              ...(ncr.goodsReceipt ? [{ term: t("receipt"), description: ncr.goodsReceipt.number }] : []),
              ...(ncr.supplier ? [{ term: t("supplier"), description: ncr.supplier.name }] : []),
              ...(ncr.customer ? [{ term: t("customer"), description: ncr.customer.name }] : []),
              ...(ncr.machine ? [{ term: t("machine"), description: ncr.machine.name }] : []),
              ...(ncr.disposition
                ? [
                    {
                      term: t("disposition"),
                      description: `${tDisposition(ncr.disposition)}${ncr.dispositionNote ? ` — ${ncr.dispositionNote}` : ""}`,
                    },
                  ]
                : []),
              ...(ncr.rootCause ? [{ term: t("rootCause"), description: ncr.rootCause }] : []),
              ...(ncr.correctiveAction ? [{ term: t("corrective"), description: ncr.correctiveAction }] : []),
              ...(ncr.preventiveAction ? [{ term: t("preventive"), description: ncr.preventiveAction }] : []),
              {
                term: t("owner"),
                description: `${ncr.owner?.name ?? "—"} · ${t("dueOn", { date: format.date(ncr.actionDueOn) })}`,
              },
              ...(ncr.verifiedBy
                ? [
                    {
                      term: t("verified"),
                      description: `${ncr.verifiedBy.name} · ${format.dateTime(ncr.verifiedAt)}${ncr.verificationNote ? ` — ${ncr.verificationNote}` : ""}`,
                    },
                  ]
                : []),
              ...(ncr.closedAt ? [{ term: t("closedAt"), description: format.dateTime(ncr.closedAt) }] : []),
              ...(ncr.cancelReason ? [{ term: t("cancelReason"), description: ncr.cancelReason }] : []),
              { term: t("raised"), description: `${ncr.createdBy} · ${format.dateTime(ncr.createdAt)}` },
            ]}
          />
        </Card>
        {editable ? (
          <PartnerSection id="ncr-work" title={t("workTitle")} description={t("workBody")}>
            <NcrWorkForm ncr={ncr} etag={etag} people={(people.data ?? []).map((p) => ({ id: p.id, label: p.name }))} />
          </PartnerSection>
        ) : null}
      </PartnerDetail>
    </PartnerPage>
  );
}
