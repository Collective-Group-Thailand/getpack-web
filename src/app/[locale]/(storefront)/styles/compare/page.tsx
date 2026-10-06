import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { compareStyles } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { getFormat } from "@/features/shared/format/server";
import { axisLabel, facetLabel, type StylesT } from "@/features/customer/styles/labels";
import { styleHref, STYLES_HREF } from "@/features/customer/styles/paths";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

type SearchParams = Promise<{ codes?: string | string[] }>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("styles");
  // A comparison is a view of styles that have pages of their own.
  return { title: t("meta.compareTitle"), robots: { index: false, follow: true } };
}

/** Up to three styles side by side (U3.5 §1, D-246): sizes, materials, lead time and price, all the API's. */
export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const raw = (await searchParams).codes;
  const codes = [
    ...new Set(
      (Array.isArray(raw) ? raw.join(",") : (raw ?? ""))
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean),
    ),
  ].slice(0, 3);
  const [t, styles, format] = await Promise.all([getTranslations("styles"), compareStyles(codes), getFormat()]);
  const words = t as unknown as StylesT;
  const list = styles ?? [];
  const range = (min: number | null, max: number | null) =>
    min !== null && max !== null ? `${format.number(min)}–${format.number(max)}` : "—";

  const rows: { key: string; label: string; cell: (s: (typeof list)[number]) => React.ReactNode }[] = [
    { key: "code", label: t("compare.rows.code"), cell: (s) => <span className="font-mono">{s.code}</span> },
    { key: "category", label: t("compare.rows.category"), cell: (s) => facetLabel(words, "category", s.category) },
    {
      key: "material",
      label: t("compare.rows.material"),
      cell: (s) =>
        s.sizeRanges.map((r) => facetLabel(words, "materialClass", r.materialClass)).join(", ") ||
        facetLabel(words, "materialClass", s.materialClass),
    },
    {
      key: "size",
      label: t("compare.rows.size"),
      cell: (s) => (
        <ul>
          {s.sizeRanges.map((r) => (
            <li key={r.materialClass} className="tabular-nums">
              {range(r.minLMm, r.maxLMm)} × {range(r.minWMm, r.maxWMm)}
              {r.minHMm !== null ? ` × ${range(r.minHMm, r.maxHMm)}` : ""}
            </li>
          ))}
        </ul>
      ),
    },
    { key: "variants", label: t("compare.rows.variants"), cell: (s) => t("card.variants", { count: s.variantCount }) },
    {
      key: "price",
      label: t("compare.rows.price"),
      cell: (s) =>
        s.startingPrice
          ? `${t("card.from", { price: format.thb(s.startingPrice.unitPrice) })} ${t("card.fromQuantity", { quantity: format.number(s.startingPrice.quantity) })}`
          : t(`pricePaths.${s.pricePath}`),
    },
    {
      key: "leadTime",
      label: t("compare.rows.leadTime"),
      cell: (s) => (s.leadTime ? t("detail.leadTime", { min: s.leadTime.minDays, max: s.leadTime.maxDays }) : "—"),
    },
    {
      key: "options",
      label: t("compare.rows.options"),
      cell: (s) => s.axes.map((a) => axisLabel(words, a.axis)).join(", ") || "—",
    },
  ];

  return (
    <div className="max-w-content mx-auto px-5 py-8 md:px-8 md:py-12">
      <Breadcrumbs
        label={t("breadcrumbs.library")}
        items={[{ label: t("breadcrumbs.library"), href: STYLES_HREF }, { label: t("compare.heading") }]}
      />
      <h1 className="mt-4 text-3xl font-bold">{t("compare.heading")}</h1>
      {list.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon="columns"
          title={t("compare.emptyTitle")}
          description={t("compare.emptyBody")}
          action={
            <Button asChild variant="secondary">
              <Link href={STYLES_HREF}>{t("compare.back")}</Link>
            </Button>
          }
        />
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <caption className="sr-only">{t("compare.heading")}</caption>
            <thead>
              <tr>
                <th scope="col" className="text-muted w-40 p-3 text-start font-medium">
                  {t("compare.attribute")}
                </th>
                {list.map((s) => {
                  const name = pick(locale, s.nameTh, s.nameEn);
                  return (
                    <th key={s.code} scope="col" className="p-3 text-start align-top font-semibold">
                      <Link href={styleHref(s.code, name)} className="text-primary underline-offset-2 hover:underline">
                        {name}
                      </Link>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-border border-t">
                  <th scope="row" className="text-muted p-3 text-start align-top font-normal">
                    {row.label}
                  </th>
                  {list.map((s) => (
                    <td key={s.code} className="p-3 align-top">
                      {row.cell(s)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
