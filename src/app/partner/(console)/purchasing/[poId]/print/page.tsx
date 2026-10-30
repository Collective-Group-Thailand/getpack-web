import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatPlain, formatQty } from "@/features/partner/erp/format";
import { PrintButton } from "@/features/partner/erp/PoActions";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { getFormat } from "@/features/shared/format/server";
import { Icon } from "@/ui/icons";

type Props = { params: Promise<{ poId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerErp.purchasing.print"))("title") };
}

/**
 * The purchase order as a document to send to the supplier (D-325): the factory as buyer (its legal name,
 * tax id, branch, registered address), the supplier, the lines and the API's totals, and places to sign.
 * Printed by the browser ("Save as PDF" makes the file); a draft carries a watermark.
 */
export default async function PrintPurchaseOrderPage({ params }: Props) {
  const { poId } = await params;
  const [t, tPo, tCommon, format, locale, context] = await Promise.all([
    getTranslations("partnerErp.purchasing.print"),
    getTranslations("partnerErp.purchasing"),
    getTranslations("partnerErp.common"),
    getFormat(),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const order = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/purchase-orders/{poId}", {
          params: { path: { ...path, poId } },
        })
      ).data!,
  );
  const back = { href: `/purchasing/${poId}`, label: tPo("title") };
  if (!order.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={order.error} />
      </PartnerPage>
    );
  const po = order.data;
  const [supplier, addresses] = await Promise.all([
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/partners/{partnerId}", {
            params: { path: { ...path, partnerId: po.supplier.id } },
          })
        ).data!,
    ),
    attempt(
      async () => (await contract.GET("/v1/partner/factories/{factoryId}/addresses", { params: { path } })).data ?? [],
    ),
  ]);
  const factory = context.factory;
  const address = (addresses.data ?? []).find((a) => a.kind === "registered") ?? addresses.data?.[0];
  const unit = (code: string) => tCommon(`units.${code}` as never);
  const s = supplier.data;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-5 md:px-6 md:py-8 print:max-w-none print:p-0">
      {/* The page's own bar: the way back on the left, the one action (print / save as PDF) on the right. */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={back.href}
          className="text-muted hover:text-fg focus-visible:ring-focus-ring -ms-1.5 inline-flex min-h-11 items-center gap-1 rounded-md px-1.5 text-sm outline-none focus-visible:ring-2 md:min-h-8"
        >
          <Icon name="chevron-left" size={16} aria-hidden="true" />
          {po.poNo ?? tPo("draftNo")}
        </Link>
        <PrintButton label={t("printButton")} />
      </div>
      {/* The sheet as it prints: A4-like paper on a desk, edge to edge on a phone. */}
      <article className="bg-surface border-border relative rounded-xl border p-4 text-sm sm:p-6 md:p-10 print:rounded-none print:border-0 print:p-0">
        {po.status === "draft" ? (
          <p className="border-warning text-warning-subtle-fg mb-4 rounded-lg border-2 border-dashed p-2 text-center font-semibold">
            {t("draftWatermark")}
          </p>
        ) : null}
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-base font-semibold">{factory?.legalName ?? ""}</p>
            {address ? <p>{[address.line1, address.line2, address.postcode].filter(Boolean).join(" ")}</p> : null}
            {factory ? (
              <p>
                {t("taxId", { id: factory.taxId })} · {t("branch", { code: factory.branchCode })}
              </p>
            ) : null}
          </div>
          <div className="sm:text-end">
            <h1 className="text-xl font-semibold">{t("title")}</h1>
            <p className="text-muted text-xs tracking-wide">{t("titleEn")}</p>
            <dl className="mt-2 grid grid-cols-[auto_auto] justify-start gap-x-3 gap-y-0.5 sm:justify-end">
              <dt className="text-muted">{t("no")}</dt>
              <dd className="tabular-nums">{po.poNo ?? "—"}</dd>
              <dt className="text-muted">{t("date")}</dt>
              <dd>{format.date(po.orderedOn)}</dd>
              {po.expectedOn ? (
                <>
                  <dt className="text-muted">{t("expected")}</dt>
                  <dd>{format.date(po.expectedOn)}</dd>
                </>
              ) : null}
              {po.supplierRef ? (
                <>
                  <dt className="text-muted">{t("ref")}</dt>
                  <dd>{po.supplierRef}</dd>
                </>
              ) : null}
            </dl>
          </div>
        </header>

        <section className="border-border mt-6 rounded-lg border p-3">
          <p className="text-muted text-xs">{t("seller")}</p>
          <p className="font-semibold">{po.supplier.name}</p>
          {s?.address ? <p>{s.address}</p> : null}
          <p>
            {[
              s?.taxId ? t("taxId", { id: s.taxId }) : null,
              s?.branchCode ? t("branch", { code: s.branchCode }) : null,
              s?.phone,
              s?.contactName,
              s && s.paymentTermDays > 0 ? t("terms", { n: s.paymentTermDays }) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </section>

        <table className="mt-6 w-full border-collapse tabular-nums">
          <thead>
            <tr className="border-fg border-y text-start">
              <th scope="col" className="py-2 pe-2 text-start max-sm:hidden print:table-cell">
                {t("seq")}
              </th>
              <th scope="col" className="py-2 pe-2 text-start">
                {t("description")}
              </th>
              <th scope="col" className="py-2 pe-2 text-end">
                {t("qty")}
              </th>
              <th scope="col" className="py-2 pe-2 text-end">
                {t("price")}
              </th>
              <th scope="col" className="py-2 pe-2 text-end max-sm:hidden print:table-cell">
                {t("discount")}
              </th>
              <th scope="col" className="py-2 text-end">
                {t("amount")}
              </th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((line) => (
              <tr key={line.id} className="border-border border-b align-top">
                <td className="py-2 pe-2 max-sm:hidden print:table-cell">{line.lineNo}</td>
                <td className="min-w-32 py-2 pe-2 [overflow-wrap:anywhere] break-keep">
                  {line.item.name}
                  <span className="text-muted block text-xs">
                    {line.item.sku}
                    {line.description ? ` · ${line.description}` : ""}
                  </span>
                </td>
                <td className="py-2 pe-2 text-end whitespace-nowrap">
                  {formatQty(line.quantity, locale)} {unit(line.unit)}
                </td>
                <td className="py-2 pe-2 text-end">{format.thb(line.unitPrice)}</td>
                <td className="py-2 pe-2 text-end max-sm:hidden print:table-cell">
                  {/^0+(\.0+)?$/.test(line.discountPct) ? "—" : `${formatPlain(line.discountPct, locale)}%`}
                </td>
                <td className="py-2 text-end">{format.thb(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ms-auto mt-4 grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 tabular-nums">
          <dt className="text-muted">{tPo("detail.subtotal")}</dt>
          <dd className="text-end">{format.thb(po.subtotal)}</dd>
          {po.vatMode !== "none" ? (
            <>
              <dt className="text-muted">{tPo("detail.vat", { rate: formatPlain(po.vatRatePct, locale) })}</dt>
              <dd className="text-end">{format.thb(po.vatAmount)}</dd>
            </>
          ) : null}
          <dt className="border-fg border-t pt-1 font-semibold">{tPo("detail.total")}</dt>
          <dd className="border-fg border-t pt-1 text-end font-semibold">{format.thb(po.total)}</dd>
        </dl>
        {po.deliverTo || po.note ? (
          <p className="mt-6 whitespace-pre-line">{[po.deliverTo, po.note].filter(Boolean).join("\n")}</p>
        ) : null}
        <footer className="mt-16 grid grid-cols-3 gap-3 text-center sm:gap-6">
          {[t("orderedBy"), t("approvedBy"), t("supplierSign")].map((label) => (
            <div key={label}>
              <div className="border-fg mb-1 border-b pb-8" />
              <p className="text-muted text-xs">{label}</p>
            </div>
          ))}
        </footer>
      </article>
    </div>
  );
}
