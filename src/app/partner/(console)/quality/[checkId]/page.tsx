import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_CHECK_RESULT, ERP_NCR_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatQty, trimZeros } from "@/features/partner/erp/format";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { CheckActions, CheckRecordForm } from "@/features/partner/insight/QualityForms";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerInsight.checks"))("title") };
}

/** One quality check (D-372): what was checked, each point's reading and outcome, the result and its NCRs. */
export default async function CheckPage({ params }: { params: Promise<{ checkId: string }> }) {
  const [{ checkId }, t, tKind, tOutcome, format, context] = await Promise.all([
    params,
    getTranslations("partnerInsight.checks"),
    getTranslations("partnerInsight.kinds"),
    getTranslations("partnerInsight.outcomes"),
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
      meta={
        <>
          <StatusChip map={ERP_CHECK_RESULT} value={check.result} />
          {check.resultOverridden ? <Badge tone="warning">{t("overridden")}</Badge> : null}
        </>
      }
    >
      <CheckActions check={check} />
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
                      <Link className="text-link underline" href={`/planning/orders/${check.productionOrder.id}`}>
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
      {check.ncrs.length ? (
        <PartnerSection title={t("ncrs")}>
          <ul className="flex flex-wrap gap-2">
            {check.ncrs.map((n) => (
              <li key={n.id}>
                <Link
                  className="border-border hover:bg-surface-subtle inline-flex min-h-11 items-center gap-2 rounded-lg border px-3"
                  href={`/quality/ncrs/${n.id}`}
                >
                  <span className="font-mono">{n.ncrNo}</span>
                  <StatusChip map={ERP_NCR_STATUS} value={n.status} />
                </Link>
              </li>
            ))}
          </ul>
        </PartnerSection>
      ) : null}
      <PartnerSection title={t("points")}>
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
    </PartnerPage>
  );
}
