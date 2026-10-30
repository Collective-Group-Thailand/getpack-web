import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ERP_PURCHASE_ORDER_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatPlain, formatQty } from "@/features/partner/erp/format";
import { PoActions } from "@/features/partner/erp/PoActions";
import { ActionPanel, PageError, PartnerDetail, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { RelatedDocuments } from "@/features/partner/ops/RelatedDocuments";
import { Row, RowList } from "@/features/partner/rows";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";

type Props = { params: Promise<{ poId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerErp.purchasing"))("title") };
}

/** One purchase order (D-325): who, when, the lines with what has come, the totals the API worked out, its receipts. */
export default async function PurchaseOrderPage({ params }: Props) {
  const { poId } = await params;
  const [t, tCommon, tSourcing, tSales, tStatus, format, locale, context] = await Promise.all([
    getTranslations("partnerErp.purchasing"),
    getTranslations("partnerErp.common"),
    getTranslations("partnerOps.sourcing"),
    getTranslations("partnerSales.common"),
    getTranslations("status.action"),
    getFormat(),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(async () => {
    const { data, response } = await contract.GET("/v1/partner/factories/{factoryId}/erp/purchase-orders/{poId}", {
      params: { path: { factoryId: context.factoryId, poId } },
    });
    return { order: data!, etag: response.headers.get("etag") };
  });
  const back = { href: "/purchasing", label: t("title") };
  if (!read.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const { order, etag } = read.data;
  const unit = (code: string) => tCommon(`units.${code}` as never);
  const qty = (value: string, code: string) => tCommon("inUnit", { qty: formatQty(value, locale), unit: unit(code) });

  return (
    <PartnerPage
      full
      title={order.poNo ?? t("draftNo")}
      back={back}
      status={
        <>
          <StatusChip map={ERP_PURCHASE_ORDER_STATUS} value={order.status} />
          {order.late ? <Badge tone="danger">{t("late")}</Badge> : null}
        </>
      }
      description={`${order.supplier.name} · ${format.date(order.orderedOn)}`}
    >
      {/* The order on the left; its total and what to do next (receive, issue, print) in a panel that stays in view. */}
      <PartnerDetail
        aside={
          <ActionPanel id="po-next" tone="neutral" title={tSales("nextSteps")}>
            <dl className="border-border grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1 border-b pb-3">
              <dt className="text-muted text-sm">{t("detail.total")}</dt>
              <dd className="text-end text-xl font-semibold tabular-nums">{format.thb(order.total)}</dd>
              <dt className="text-muted text-sm">{t("detail.facts.expected")}</dt>
              <dd className="text-end tabular-nums">{format.date(order.expectedOn)}</dd>
            </dl>
            <PoActions order={order} etag={etag} />
          </ActionPanel>
        }
      >
        {order.warnings.length ? (
          <Callout tone="warning" title={tSourcing("warnings.title")}>
            <ul className="list-disc ps-5">
              {order.warnings.map((w) => (
                <li key={`${w.lineNo}-${w.code}`}>
                  {w.code === "price_rise"
                    ? tSourcing("warnings.price_rise", {
                        line: w.lineNo,
                        pct: w.changePct ? formatPlain(w.changePct, locale, 2) : "",
                      })
                    : tSourcing(
                        w.code === "supplier_suspended"
                          ? "warnings.supplier_suspended"
                          : "warnings.supplier_not_approved",
                        {
                          line: w.lineNo,
                        },
                      )}
                </li>
              ))}
            </ul>
          </Callout>
        ) : null}
        <Card padding="md">
          <DescriptionList
            columns={2}
            items={[
              { term: t("detail.facts.supplier"), description: `${order.supplier.name} (${order.supplier.code})` },
              { term: t("detail.facts.ordered"), description: format.date(order.orderedOn) },
              { term: t("detail.facts.expected"), description: format.date(order.expectedOn) },
              { term: t("detail.facts.vat"), description: tCommon(`vatModes.${order.vatMode}`) },
              ...(order.supplierRef ? [{ term: t("detail.facts.supplierRef"), description: order.supplierRef }] : []),
              ...(order.deliverTo ? [{ term: t("detail.facts.deliverTo"), description: order.deliverTo }] : []),
              ...(order.issuedAt
                ? [{ term: t("detail.facts.issued"), description: format.dateTime(order.issuedAt) }]
                : []),
              ...(order.note ? [{ term: t("detail.facts.note"), description: order.note }] : []),
              ...(order.cancelReason ? [{ term: t("detail.facts.reason"), description: order.cancelReason }] : []),
            ]}
          />
        </Card>
        <PartnerSection title={t("detail.linesTitle")}>
          <PartnerTable
            caption={t("detail.linesTitle")}
            rows={order.lines}
            rowKey={(line) => line.id}
            columns={[
              {
                key: "item",
                header: t("detail.lines.item"),
                primary: true,
                cell: (line) => (
                  <span className="flex flex-col">
                    <span>{line.item.name}</span>
                    <span className="text-muted text-sm">
                      {line.item.sku}
                      {line.description ? ` · ${line.description}` : ""}
                    </span>
                  </span>
                ),
              },
              {
                key: "qty",
                header: t("detail.lines.qty"),
                align: "end",
                cell: (line) => qty(line.quantity, line.unit),
              },
              {
                key: "price",
                header: t("detail.lines.price"),
                align: "end",
                cell: (line) => format.thb(line.unitPrice),
              },
              {
                key: "discount",
                header: t("detail.lines.discount"),
                align: "end",
                hideOnPhone: true,
                cell: (line) =>
                  /^0+(\.0+)?$/.test(line.discountPct) ? "—" : `${formatPlain(line.discountPct, locale)}%`,
              },
              {
                key: "amount",
                header: t("detail.lines.amount"),
                align: "end",
                cell: (line) => format.thb(line.amount),
              },
              {
                key: "received",
                header: t("detail.lines.received"),
                align: "end",
                cell: (line) => qty(line.receivedQty, line.unit),
              },
              {
                key: "remaining",
                header: t("detail.lines.remaining"),
                align: "end",
                cell: (line) =>
                  /^0+(\.0+)?$/.test(line.remainingQty) ? "—" : <strong>{qty(line.remainingQty, line.unit)}</strong>,
              },
            ]}
          />
          <dl className="ms-auto grid w-full max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 tabular-nums">
            <dt className="text-muted">{t("detail.subtotal")}</dt>
            <dd className="text-end">{format.thb(order.subtotal)}</dd>
            {order.vatMode !== "none" ? (
              <>
                <dt className="text-muted">{t("detail.vat", { rate: formatPlain(order.vatRatePct, locale) })}</dt>
                <dd className="text-end">{format.thb(order.vatAmount)}</dd>
              </>
            ) : null}
            <dt className="font-semibold">{t("detail.total")}</dt>
            <dd className="text-end text-lg font-semibold">{format.thb(order.total)}</dd>
          </dl>
        </PartnerSection>
        <PartnerSection title={t("detail.receiptsTitle")}>
          {order.receipts.length ? (
            <RowList label={t("detail.receiptsTitle")}>
              {order.receipts.map((gr) => (
                <Row
                  key={gr.id}
                  href={`/purchasing/receipts/${gr.id}`}
                  icon="package-check"
                  title={<span className="tabular-nums">{gr.grNo}</span>}
                  meta={format.date(gr.receivedOn)}
                  aside={format.thb(gr.total)}
                />
              ))}
            </RowList>
          ) : (
            <EmptyState
              icon="package"
              title={t("detail.noReceipts")}
              action={
                order.nextActions.some((a) => a.key === "erp_po.receive" && !a.disabledReason) ? (
                  <Button asChild variant="secondary" iconStart="package-check">
                    <Link href={`/stock/receive?po=${order.id}`}>{tStatus("receiveGoods")}</Link>
                  </Button>
                ) : undefined
              }
            />
          )}
        </PartnerSection>
        <RelatedDocuments type="purchase_order" id={order.id} label={order.poNo ?? t("draftNo")} />
      </PartnerDetail>
    </PartnerPage>
  );
}
