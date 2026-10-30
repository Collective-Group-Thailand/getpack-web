import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_CHECK_RESULT, ERP_NCR_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatQty, trimZeros } from "@/features/partner/erp/format";
import { ActionPanel, PageError, PartnerDetail, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { Row, RowList } from "@/features/partner/rows";
import { CheckActions, CheckRecordForm } from "@/features/partner/insight/QualityForms";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerInsight.checks"))("title") };
}

/** One quality check (D-372): what was checked, each point's reading and outcome, the result and its NCRs. */
export default async function CheckPage({ params }: { params: Promise<{ checkId: string }> }) {
  const [{ checkId }, t, tKind, tOutcome, tSales, format, context] = await Promise.all([
    params,
    getTranslations("partnerInsight.checks"),
    getTranslations("partnerInsight.kinds"),
    getTranslations("partnerInsight.outcomes"),
    getTranslations("partnerSales.common"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(async () => {
    const { data, response } = await contract.GET("/v1/partner/factories/{factoryId}/erp/quality-checks/{checkId}", {
      params: { path: { factoryId: context.factoryId, checkId } },
    });
    return { check: data!, etag: response.headers.get("etag") };
  });
  const back = { href: "/quality", label: t("title") };
  if (!read.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const { check, etag } = read.data;
  const recordable = check.nextActions.some((a) => a.key === "erp_qc.record");
  const managing = check.nextActions.some((a) => a.key === "erp_qc.override");
  const canEdit = recordable || (managing && canAt(context, "factory_quality.record"));
  return (
    <PartnerPage
      full
      title={`${check.qcNo} · ${tKind(check.kind)}`}
      back={back}
      status={
        <>
          <StatusChip map={ERP_CHECK_RESULT} value={check.result} size="md" />
          {check.resultOverridden ? <Badge tone="warning">{t("overridden")}</Badge> : null}
        </>
      }
    >
      {/* The check on the left; its result, what to do next and the NCRs it raised in a panel that stays in view. */}
      <PartnerDetail
        aside={
          <>
            <ActionPanel id="qc-next" tone={canEdit ? "primary" : "neutral"} title={tSales("nextSteps")}>
              <dl className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 text-sm">
                <dt>{t("result")}</dt>
                <dd className="text-end">
                  <StatusChip map={ERP_CHECK_RESULT} value={check.result} />
                </dd>
                <dt>{t("inspector")}</dt>
                <dd className="text-end">{check.inspector.name}</dd>
              </dl>
              {canEdit ? (
                <div data-fill="row" className="flex flex-col gap-2">
                  <Button asChild size="lg" iconStart="clipboard-check">
                    <a href="#qc-points">{t("points")}</a>
                  </Button>
                </div>
              ) : null}
              <CheckActions check={check} layout="panel" />
            </ActionPanel>
            {check.ncrs.length ? (
              <section aria-labelledby="qc-ncrs" className="flex flex-col gap-2">
                <h2 id="qc-ncrs" className="text-base font-semibold">
                  {t("ncrs")}
                </h2>
                <RowList label={t("ncrs")}>
                  {check.ncrs.map((n) => (
                    <Row
                      key={n.id}
                      href={`/quality/ncrs/${n.id}`}
                      icon="flag"
                      title={<span className="tabular-nums">{n.ncrNo}</span>}
                      aside={<StatusChip map={ERP_NCR_STATUS} value={n.status} />}
                    />
                  ))}
                </RowList>
              </section>
            ) : null}
          </>
        }
      >
        <Card padding="md">
          <DescriptionList
            columns={2}
            items={[
              ...(check.item ? [{ term: t("item"), description: `${check.item.name} (${check.item.sku})` }] : []),
              ...(check.productionOrder
                ? [
                    {
                      term: t("order"),
                      description: (
                        <Link className="text-primary underline" href={`/planning/orders/${check.productionOrder.id}`}>
                          {check.productionOrder.number}
                        </Link>
                      ),
                    },
                  ]
                : []),
              ...(check.operation ? [{ term: t("operation"), description: check.operation }] : []),
              ...(check.goodsReceipt
                ? [
                    {
                      term: t("receipt"),
                      description: `${check.goodsReceipt.number}${check.lineNo ? ` · ${t("line", { n: check.lineNo })}` : ""}`,
                    },
                  ]
                : []),
              ...(check.supplier ? [{ term: t("supplier"), description: check.supplier.name }] : []),
              ...(check.template ? [{ term: t("template"), description: check.template.name }] : []),
              ...(check.lotNo ? [{ term: t("lotNo"), description: check.lotNo }] : []),
              { term: t("inspector"), description: `${check.inspector.name} · ${format.dateTime(check.inspectedAt)}` },
              {
                term: t("quantities"),
                description: t("quantitiesValue", {
                  sample: check.sampleSize ? formatQty(check.sampleSize, format.locale) : "—",
                  inspected: check.inspectedQty ? formatQty(check.inspectedQty, format.locale) : "—",
                  accepted: check.acceptedQty ? formatQty(check.acceptedQty, format.locale) : "—",
                  rejected: formatQty(check.rejectedQty, format.locale),
                }),
              },
              ...(check.remarks ? [{ term: t("remarks"), description: check.remarks }] : []),
              ...(check.photos.length
                ? [{ term: t("photos"), description: check.photos.map((p) => p.name).join(", ") }]
                : []),
            ]}
          />
        </Card>
        <PartnerSection id="qc-points" title={t("points")}>
          {canEdit ? (
            <CheckRecordForm check={check} etag={etag} canEdit />
          ) : (
            <PartnerTable
              caption={t("points")}
              rows={check.checkpoints}
              rowKey={(row) => String(row.seq)}
              columns={[
                { key: "n", header: t("pointName"), primary: true, cell: (row) => `${row.seq}. ${row.name}` },
                {
                  key: "spec",
                  header: t("spec"),
                  cell: (row) =>
                    row.type === "measurement"
                      ? `${row.minValue === null ? "–" : trimZeros(row.minValue)} – ${row.maxValue === null ? "–" : trimZeros(row.maxValue)} ${row.unit ?? ""}`
                      : row.type === "pass_fail"
                        ? t("passFail")
                        : t("noteOnly"),
                },
                {
                  key: "m",
                  header: t("reading"),
                  align: "end",
                  cell: (row) => (row.measured ? `${trimZeros(row.measured)} ${row.unit ?? ""}` : "—"),
                },
                {
                  key: "o",
                  header: t("outcome"),
                  cell: (row) =>
                    row.outcome ? (
                      <span
                        className={
                          row.outcome === "fail"
                            ? "text-danger font-semibold"
                            : row.outcome === "pass"
                              ? "text-success"
                              : undefined
                        }
                      >
                        {tOutcome(row.outcome)}
                      </span>
                    ) : (
                      "—"
                    ),
                },
                { key: "note", header: t("note"), hideOnPhone: true, cell: (row) => row.note ?? "" },
              ]}
            />
          )}
        </PartnerSection>
      </PartnerDetail>
    </PartnerPage>
  );
}
