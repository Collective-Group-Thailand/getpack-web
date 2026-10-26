import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { AddChargeForm } from "@/features/partner/erp/ChargesEditor";
import { formatQty } from "@/features/partner/erp/format";
import { erpSuppliers } from "@/features/partner/erp/server";
import { PostedEntries } from "@/features/partner/ledger/PostedEntries";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";

type Props = { params: Promise<{ grId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerErp.purchasing"))("views.receipts") };
}

/** One goods receipt (D-321, D-325): what came, into which store, at what cost. Final once posted. */
export default async function GoodsReceiptPage({ params }: Props) {
  const { grId } = await params;
  const [t, tCommon, tRecv, format, locale, context] = await Promise.all([
    getTranslations("partnerErp.purchasing"),
    getTranslations("partnerErp.common"),
    getTranslations("partnerOps.receiving"),
    getFormat(),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const gr = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/goods-receipts/{grId}", {
          params: { path: { factoryId: context.factoryId, grId } },
        })
      ).data!,
  );
  const back = { href: "/purchasing?view=receipts", label: t("views.receipts") };
  if (!gr.data)
    return (
      <PartnerPage title={t("views.receipts")} back={back}>
        <PageError error={gr.error} />
      </PartnerPage>
    );
  const r = gr.data;
  const canCharge = r.nextActions.some((a) => a.key === "erp_gr.add_charge" && !a.disabledReason);
  const partners = canCharge ? await attempt(() => erpSuppliers(contract, context.factoryId)) : null;
  const rejected = r.lines.some((line) => Number(line.rejectedQuantity) > 0);
  const unit = (code: string) => tCommon(`units.${code}` as never);
  const qty = (value: string, code: string) => tCommon("inUnit", { qty: formatQty(value, locale), unit: unit(code) });
  return (
    <PartnerPage wide title={t("receipt.title", { no: r.grNo })} back={back}>
      <Card padding="md">
        <DescriptionList
          columns={2}
          items={[
            {
              term: t("receipt.facts.po"),
              description: r.purchaseOrder ? (
                <Link
                  href={`/purchasing/${r.purchaseOrder.id}`}
                  className="text-primary tabular-nums underline-offset-4 hover:underline"
                >
                  {r.purchaseOrder.code}
                </Link>
              ) : (
                "—"
              ),
            },
            { term: t("receipt.facts.supplier"), description: r.supplier.name },
            { term: t("receipt.facts.warehouse"), description: r.warehouse.name },
            { term: t("receipt.facts.receivedOn"), description: format.date(r.receivedOn) },
            { term: t("receipt.facts.deliveryNote"), description: r.deliveryNoteNo ?? "—" },
            { term: t("receipt.facts.by"), description: `${r.by} · ${format.dateTime(r.createdAt)}` },
            ...(r.note ? [{ term: t("receipt.facts.note"), description: r.note }] : []),
          ]}
        />
      </Card>
      <PartnerSection title={t("detail.linesTitle")}>
        <PartnerTable
          caption={t("detail.linesTitle")}
          rows={r.lines}
          rowKey={(line) => String(line.lineNo)}
          columns={[
            {
              key: "item",
              header: t("receipt.lines.item"),
              primary: true,
              cell: (line) => (
                <span className="flex flex-col">
                  <span>{line.item.name}</span>
                  <span className="text-muted text-sm">{line.item.sku}</span>
                </span>
              ),
            },
            { key: "qty", header: t("receipt.lines.qty"), align: "end", cell: (line) => qty(line.quantity, line.unit) },
            {
              key: "base",
              header: t("receipt.lines.base"),
              align: "end",
              cell: (line) => qty(line.baseQuantity, line.item.baseUnit),
            },
            {
              key: "cost",
              header: t("receipt.lines.cost"),
              align: "end",
              hideOnPhone: true,
              cell: (line) => format.thb(line.unitCost),
            },
            { key: "amount", header: t("receipt.lines.amount"), align: "end", cell: (line) => format.thb(line.amount) },
            ...(r.charges.length
              ? [
                  {
                    key: "landed",
                    header: tRecv("landedCost"),
                    align: "end" as const,
                    hideOnPhone: true,
                    cell: (line: (typeof r.lines)[number]) => (
                      <span className="flex flex-col">
                        <span>{format.thb(line.landedUnitCost)}</span>
                        <span className="text-muted text-sm">
                          {tRecv("landed")} {format.thb(line.landedAmount)}
                        </span>
                      </span>
                    ),
                  },
                ]
              : []),
            ...(rejected
              ? [
                  {
                    key: "rejected",
                    header: tRecv("rejected"),
                    cell: (line: (typeof r.lines)[number]) =>
                      Number(line.rejectedQuantity) > 0 ? (
                        <span className="flex flex-col">
                          <Badge tone="danger">{qty(line.rejectedQuantity, line.unit)}</Badge>
                          <span className="text-muted text-sm">{line.rejectReason}</span>
                        </span>
                      ) : (
                        "—"
                      ),
                  },
                ]
              : []),
            { key: "lot", header: t("receipt.lines.lot"), hideOnPhone: true, cell: (line) => line.lotNo ?? "—" },
          ]}
        />
        <p className="ms-auto text-lg font-semibold tabular-nums">
          {t("detail.total")} {format.thb(r.total)}
        </p>
      </PartnerSection>
      <PartnerSection title={tRecv("chargesTitle")} description={tRecv("chargesBody")}>
        {r.charges.length ? (
          <ul className="flex flex-col gap-2">
            {r.charges.map((c) => (
              <li key={c.id} className="border-border bg-surface flex flex-col gap-1 rounded-xl border p-3">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <span>{tRecv(`kinds.${c.kind}` as never)}</span>
                  <span className="tabular-nums">{format.thb(c.amount)}</span>
                  <Badge tone={c.atReceipt ? "neutral" : "info"}>
                    {c.atReceipt ? tRecv("atReceipt") : tRecv("later")}
                  </Badge>
                </p>
                <p className="text-muted text-sm">
                  {[
                    tRecv(`allocations.${c.allocation}` as never),
                    c.partner?.name,
                    c.reference,
                    c.description,
                    `${c.by} · ${format.dateTime(c.createdAt)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="text-sm">
                  {tRecv("absorbed", { amount: format.thb(c.absorbed) })}
                  {Number(c.notAbsorbed) > 0 ? ` · ${tRecv("notAbsorbed", { amount: format.thb(c.notAbsorbed) })}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">{tRecv("noCharges")}</p>
        )}
        {canCharge && canAt(context, "factory_procurement.manage") ? (
          <AddChargeForm receiptId={r.id} partners={(partners?.data ?? []).filter((p) => p.status === "active")} />
        ) : null}
      </PartnerSection>
      <PostedEntries sourceId={r.id} />
    </PartnerPage>
  );
}
