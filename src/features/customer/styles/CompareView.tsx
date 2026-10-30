import { getTranslations } from "next-intl/server";

import { storeImageSrc } from "@/features/customer/catalog/images";
import { compareStyles, getStyleLibrarySettings } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { CardImage } from "@/ui/components/CardImage";
import { EmptyState } from "@/ui/components/EmptyState";
import { LINE_PLATE, ProductIllustration, ProductPlate } from "@/ui/components/ProductIllustration";

import { CompareAddSlot, CompareRemove } from "./CompareActions";
import { COMPARE_LIMIT } from "./compare-limit";
import { illustrationOf } from "./illustration";
import { axisLabel, facetLabel, type StylesT } from "./labels";
import { styleHref, STYLES_HREF } from "./paths";

/** The codes a compare address names: upper case, each once, at most the limit. */
export async function compareCodes(raw: string | string[] | undefined) {
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
  return { codes, limit };
}

/**
 * Up to three styles side by side (U3.5 §1, D-246; owner redesign 2026-10-30): a column per style — its product
 * photo (the drawing only without one), code and name, "ดูแบบนี้" and remove — then the attribute rows, all the
 * API's; while there is room, a dashed column to add one more. The same view on the compare page (a shared link)
 * and in the dialog over the library (`inDialog`), where adding closes the dialog back to the grid.
 */
export async function CompareView({
  codes,
  limit,
  locale,
  inDialog = false,
}: {
  codes: string[];
  limit: number;
  locale: string;
  inDialog?: boolean;
}) {
  const [t, styles, format] = await Promise.all([getTranslations("styles"), compareStyles(codes), getFormat()]);
  const words = t as unknown as StylesT;
  const list = styles ?? [];
  const range = (min: number | null, max: number | null) =>
    min !== null && max !== null ? `${format.number(min)}–${format.number(max)}` : "—";

  const rows: { key: string; label: string; cell: (s: (typeof list)[number]) => React.ReactNode }[] = [
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
        s.startingPrice ? (
          <span className="text-instant-subtle-fg font-semibold">
            {t("card.from", { price: format.thb(s.startingPrice.unitPrice) })}{" "}
            {t("card.fromQuantity", { quantity: format.number(s.startingPrice.quantity) })}
          </span>
        ) : (
          t(`pricePaths.${s.pricePath}`)
        ),
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

  if (list.length === 0) {
    // The empty state's picture: as many dashed slots as can be compared, each with a thin-line box (decorative).
    const slots = (
      <span aria-hidden="true" className="mb-2 flex gap-3">
        {Array.from({ length: Math.min(limit, 4) }, (_, index) => (
          <span
            key={index}
            className={`${LINE_PLATE} rounded-control grid h-20 w-16 place-items-center border border-dashed border-current md:h-24 md:w-20`}
          >
            <ProductIllustration
              family={(["tuck", "shipping", "rigid", "food"] as const)[index]!}
              className="max-w-11"
            />
          </span>
        ))}
      </span>
    );
    return (
      <EmptyState
        className="mx-auto max-w-xl py-14"
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
    );
  }

  const room = list.length < limit;
  const remaining = (code: string) => list.map((s) => s.code).filter((c) => c !== code);
  return (
    // A column per style and one for the attribute names, pinned while a phone scrolls the table sideways.
    <div
      className="border-border bg-surface rounded-panel overflow-x-auto border"
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
              className="bg-surface text-muted sticky start-0 z-[1] w-36 p-4 text-start align-top font-medium"
            >
              {/* Top-aligned with the photos: how many are compared, not the rows' heading. */}
              <span className="sr-only">{t("compare.attribute")}</span>
              <span aria-hidden="true" className="text-xs">
                {t("compare.now", { count: list.length })}
              </span>
            </th>
            {list.map((s) => {
              const name = pick(locale, s.nameTh, s.nameEn);
              const photo = storeImageSrc(s.thumbnailUrl, "thumb");
              const plate = <ProductPlate family={illustrationOf(s)} className="p-6" />;
              return (
                <th key={s.code} scope="col" className="min-w-52 p-4 text-start align-top font-semibold">
                  <span className="border-border bg-surface-subtle relative mb-3 block aspect-square overflow-hidden rounded-lg border">
                    {photo ? (
                      <CardImage
                        src={photo}
                        alt={name}
                        className="size-full object-contain p-3"
                        loading="lazy"
                        fallback={plate}
                      />
                    ) : (
                      plate
                    )}
                    <CompareRemove code={s.code} name={name} remaining={remaining(s.code)} />
                  </span>
                  <span className="text-muted block text-xs font-normal tabular-nums">{s.code}</span>
                  <span className="mt-0.5 line-clamp-2 block leading-snug">{name}</span>
                  <Link
                    href={styleHref(s.code, name)}
                    className="text-primary mt-2 inline-flex min-h-8 items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {t("compare.viewStyle")}
                  </Link>
                </th>
              );
            })}
            {room ? (
              <th scope="col" className="min-w-44 p-4 align-top font-normal">
                <CompareAddSlot inDialog={inDialog} label={t("compare.addMore")} />
              </th>
            ) : null}
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
              {room ? <td className="p-4" /> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
