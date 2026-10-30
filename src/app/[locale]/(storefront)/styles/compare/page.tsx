import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { compareStyles, getStyleLibrarySettings } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { getFormat } from "@/features/shared/format/server";
import { axisLabel, facetLabel, type StylesT } from "@/features/customer/styles/labels";
import { COMPARE_LIMIT } from "@/features/customer/styles/compare-limit";
import { illustrationOf } from "@/features/customer/styles/illustration";
import { styleHref, STYLES_HREF } from "@/features/customer/styles/paths";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { LINE_PLATE, ProductIllustration, ProductPlate } from "@/ui/components/ProductIllustration";

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
  // How many compare is staff's setting (D-246's three without it).
  const limit = (await getStyleLibrarySettings())?.compareLimit ?? COMPARE_LIMIT;
  const codes = [
    ...new Set(
      (Array.isArray(raw) ? raw.join(",") : (raw ?? ""))
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean),
    ),
  ].slice(0, limit);
  const [t, styles, format] = await Promise.all([getTranslations("styles"), compareStyles(codes), getFormat()]);
  const words = t as unknown as StylesT;
  const list = styles ?? [];
  const range = (min: number | null, max: number | null) =>
    min !== null && max !== null ? `${format.number(min)}–${format.number(max)}` : "—";

  const rows: { key: string; label: string; cell: (s: (typeof list)[number]) => React.ReactNode }[] = [
    { key: "code", label: t("compare.rows.code"), cell: (s) => <span className="tabular-nums">{s.code}</span> },
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

  // The empty state's picture: as many dashed slots as can be compared, each with a thin-line box — "up to N side
  // by side" without a word of new copy (Project A). Decorative.
  const slots = (
    <span aria-hidden="true" className="mb-2 flex gap-3">
      {Array.from({ length: Math.min(limit, 4) }, (_, index) => (
        <span
          key={index}
          className={`${LINE_PLATE} rounded-control grid h-20 w-16 place-items-center border border-dashed border-current md:h-24 md:w-20`}
        >
          <ProductIllustration family={(["tuck", "shipping", "rigid", "food"] as const)[index]!} className="max-w-11" />
        </span>
      ))}
    </span>
  );

  return (
    <div className="max-w-nav mx-auto px-5 pt-6 pb-16 md:px-8 md:pt-8 md:pb-20 xl:px-12">
      <Breadcrumbs
        label={t("breadcrumbs.library")}
        items={[{ label: t("breadcrumbs.library"), href: STYLES_HREF }, { label: t("compare.heading") }]}
      />
      <h1 className="mt-3 text-[1.75rem] leading-[1.15] font-semibold tracking-tight md:text-[2.25rem]">
        {t("compare.heading")}
      </h1>
      {list.length === 0 ? (
        <EmptyState
          className="mx-auto mt-8 max-w-xl py-14"
          illustration={slots}
          titleAs="h2"
          title={t("compare.emptyTitle")}
          description={t("compare.emptyBody", { limit })}
          action={
            <Button asChild size="lg">
              <Link href={STYLES_HREF}>{t("compare.back")}</Link>
            </Button>
          }
        />
      ) : (
        // One card: a picture and the name over each column, the attribute column pinned while a phone scrolls the
        // table sideways, a hairline between rows.
        <div
          className="border-border bg-surface rounded-panel mt-6 overflow-x-auto border"
          tabIndex={0}
          role="region"
          aria-label={t("compare.heading")}
        >
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <caption className="sr-only">{t("compare.heading")}</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="bg-surface text-muted sticky start-0 z-[1] w-40 p-4 text-start align-bottom font-medium"
                >
                  {t("compare.attribute")}
                </th>
                {list.map((s) => {
                  const name = pick(locale, s.nameTh, s.nameEn);
                  return (
                    <th key={s.code} scope="col" className="min-w-52 p-4 text-start align-top font-semibold">
                      <span className="rounded-control border-border mb-3 block overflow-hidden border">
                        <ProductPlate family={illustrationOf(s)} className="p-4" />
                      </span>
                      <span className="text-muted block text-xs font-normal tabular-nums">{s.code}</span>
                      <Link
                        href={styleHref(s.code, name)}
                        className="text-fg hover:text-primary mt-0.5 block leading-snug underline-offset-2 hover:underline"
                      >
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
                  <th
                    scope="row"
                    className="bg-surface text-muted sticky start-0 z-[1] p-4 text-start align-top font-normal"
                  >
                    {row.label}
                  </th>
                  {list.map((s) => (
                    <td key={s.code} className="p-4 align-top">
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
