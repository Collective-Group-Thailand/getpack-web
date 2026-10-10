import { getLocale, getTranslations } from "next-intl/server";

import { formatPlain, formatQty } from "@/features/partner/erp/format";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import type { Schemas } from "@/lib/api/types";

/**
 * Server pieces every E4 document page shows the same way: its lines (an item or free text, quantity in its
 * unit, price, discount, amount) and the totals the API worked out — never added up here.
 */

type LineLike = Pick<Schemas["ErpSalesLineDto"], "id" | "description" | "quantity" | "unit" | "unitPrice" | "discountPct" | "amount"> & {
  item: { name: string; sku: string } | null;
};

export async function SalesLinesTable<L extends LineLike>({
  caption,
  lines,
  extra = [],
}: {
  caption: string;
  lines: L[];
  extra?: { key: string; header: string; cell: (line: L) => React.ReactNode }[];
}) {
  const [t, tUnits, format, locale] = await Promise.all([
    getTranslations("partnerSales.lines"),
    getTranslations("partnerErp.common.units"),
    getFormat(),
    getLocale(),
  ]);
  return (
    <PartnerTable
      caption={caption}
      rows={lines}
      rowKey={(line) => line.id}
      columns={[
        {
          key: "item",
          header: t("item"),
          primary: true,
          cell: (line) => (
            <span className="flex flex-col">
              <span>{line.description || line.item?.name}</span>
              {line.item ? <span className="text-muted text-sm">{line.item.sku}</span> : null}
            </span>
          ),
        },
        {
          key: "qty",
          header: t("quantity"),
          align: "end",
          cell: (line) => `${formatQty(line.quantity, locale)} ${tUnits(line.unit as never)}`,
        },
        { key: "price", header: t("price"), align: "end", cell: (line) => format.thb(line.unitPrice) },
        {
          key: "discount",
          header: t("discount"),
          align: "end",
          hideOnPhone: true,
          cell: (line) => (/^0+(\.0+)?$/.test(line.discountPct) ? "—" : `${formatPlain(line.discountPct, locale)}%`),
        },
        { key: "amount", header: t("amount"), align: "end", cell: (line) => format.thb(line.amount) },
        ...extra.map((column) => ({ ...column, align: "end" as const })),
      ]}
    />
  );
}

export async function SalesTotals({
  doc,
  extra = [],
}: {
  doc: { subtotal: string; vatAmount: string; total: string; vatMode: string; vatRatePct: string };
  extra?: { label: string; value: string; strong?: boolean }[];
}) {
  const [t, format, locale] = await Promise.all([getTranslations("partnerSales.common"), getFormat(), getLocale()]);
  return (
    <dl className="ms-auto grid w-full max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 tabular-nums">
      <dt className="text-muted">{t("subtotal")}</dt>
      <dd className="text-end">{format.thb(doc.subtotal)}</dd>
      {doc.vatMode !== "none" ? (
        <>
          <dt className="text-muted">{t("vat", { rate: formatPlain(doc.vatRatePct, locale) })}</dt>
          <dd className="text-end">{format.thb(doc.vatAmount)}</dd>
        </>
      ) : null}
      <dt className="font-semibold">{t("total")}</dt>
      <dd className="text-end text-lg font-semibold">{format.thb(doc.total)}</dd>
      {extra.map((row) => (
        <div key={row.label} className="contents">
          <dt className={row.strong ? "font-semibold" : "text-muted"}>{row.label}</dt>
          <dd className={row.strong ? "text-end text-lg font-semibold" : "text-end"}>{format.thb(row.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** List-screen page links' labels. */
export async function pagerLabels() {
  const t = await getTranslations("partnerSales.common");
  return {
    nav: t("pagination.nav"),
    previous: t("pagination.previous"),
    next: t("pagination.next"),
    page: (n: number) => t("pagination.page", { n }),
  };
}
