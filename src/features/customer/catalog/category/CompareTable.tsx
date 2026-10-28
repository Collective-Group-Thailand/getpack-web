import { getLocale, getTranslations } from "next-intl/server";

import type { ProductDetail } from "@/features/customer/catalog/api.server";
import { storeImageSrc } from "@/features/customer/catalog/images";
import { pick } from "@/features/customer/catalog/localize";
import { itemHref, itemWords } from "@/features/customer/products/HubCard";
import type { HubItem } from "@/features/customer/products/hub";
import { Link } from "@/i18n/navigation";
import { kraftOf, ProductIllustration, productFamilyOf } from "@/ui/components/ProductIllustration";
import { cn } from "@/ui/lib/cn";

import type { CategoryContent } from "./content";
import { ItemAction, ItemPrice, shortOf } from "./ProductRows";
import { specsOf } from "./specs";
import { caseIdsOf } from "./useCases";

/**
 * The comparison table (category Phase 1 item 4, prototype `.cmpt`): one column per product, rows ราคาเริ่มต้น ·
 * เหมาะกับ · โครงสร้าง · ลอน/ชั้น · ผิว · ขนาด · ขั้นต่ำ · ระยะผลิต · action. A value the API does not have reads
 * "ดูในหน้าสินค้า"; a row nobody has a value for (no approved use cases, no surface data) is left out. Scrolls
 * sideways on its own on a phone, never the page.
 */
export async function CompareTable({
  items,
  details,
  content,
}: {
  items: readonly HubItem[];
  details: ReadonlyMap<string, ProductDetail>;
  content: CategoryContent;
}) {
  const [t, tRow, tContent, locale] = await Promise.all([
    getTranslations("catalog.categoryPage.compare"),
    getTranslations("catalog.categoryPage.row"),
    getTranslations("catalog.categoryContent"),
    getLocale(),
  ]);
  const columns = await Promise.all(
    items.map(async (item) => {
      const detail = details.get(item.key);
      const specs = specsOf(detail ?? null, item.mode === "instant");
      const { surface } = await shortOf(item, detail, content);
      const words = await itemWords(item);
      const uses = caseIdsOf(content.useCases?.items ?? [], item.key).map((id) =>
        tContent(`${content.categoryCode}.useCases.${id}`),
      );
      return { item, specs, surface, words, uses, name: pick(locale, item.nameTh, item.nameEn) };
    }),
  );
  const unknown = <span className="text-muted">{tRow("unknown")}</span>;
  type Column = (typeof columns)[number];
  const rows: { key: string; label: string; cell: (column: Column) => React.ReactNode; show: boolean }[] = [
    { key: "price", label: t("price"), cell: ({ item }) => <ItemPrice item={item} />, show: true },
    {
      key: "use",
      label: t("use"),
      cell: ({ uses }) => (uses.length ? uses.join(", ") : unknown),
      show: columns.some((column) => column.uses.length > 0),
    },
    {
      key: "structure",
      label: t("structure"),
      cell: ({ specs }) => (specs?.structures.length ? specs.structures.join(", ") : unknown),
      show: true,
    },
    {
      key: "flute",
      label: t("flute"),
      cell: ({ specs }) => (specs?.flutes.length ? tRow("flute", { flutes: specs.flutes.join(" · ") }) : unknown),
      show: columns.some((column) => (column.specs?.flutes.length ?? 0) > 0),
    },
    {
      key: "material",
      label: t("material"),
      cell: ({ specs }) =>
        specs?.materials.length ? specs.materials.map((m) => pick(locale, m.th, m.en)).join(", ") : unknown,
      show: !columns.some((column) => (column.specs?.flutes.length ?? 0) > 0),
    },
    {
      key: "surface",
      label: t("surface"),
      cell: ({ surface }) => surface ?? unknown,
      show: columns.some((column) => column.surface !== null),
    },
    {
      key: "size",
      label: t("size"),
      cell: ({ specs }) =>
        specs && specs.standardSizes > 0
          ? tRow(specs.customSize ? "sizesCustom" : "sizes", { count: specs.standardSizes })
          : specs?.customSize
            ? tRow("custom")
            : unknown,
      show: true,
    },
    { key: "moq", label: t("moq"), cell: ({ words }) => words.moq ?? unknown, show: true },
    {
      key: "lead",
      label: t("lead"),
      cell: ({ words }) => words.lead ?? unknown,
      show: columns.some((column) => column.words.lead !== null),
    },
  ];
  const head =
    "bg-bg-subtle border-border border-b px-3.5 py-3 text-start align-bottom text-[0.84375rem] font-semibold";
  const rowHead = "text-muted bg-surface w-32 px-3.5 py-3 text-start align-top text-[0.78125rem] font-medium";
  return (
    <div
      className="border-border bg-surface rounded-card relative overflow-x-auto border"
      tabIndex={0}
      role="region"
      aria-label={t("caption")}
    >
      <table className="w-full min-w-[47.5rem] border-collapse text-sm tabular-nums">
        <caption className="sr-only">{t("caption")}</caption>
        <thead>
          <tr>
            <th scope="col" className={head}>
              <span className="sr-only">{t("product")}</span>
            </th>
            {columns.map(({ item, name }) => {
              const src = storeImageSrc(item.imageUrl, "thumb");
              const family =
                item.kind === "stock" ? "stock" : productFamilyOf(`${item.productTypeCode ?? ""} ${item.key}`);
              return (
                <th key={item.key} scope="col" className={head}>
                  <span
                    className={cn(
                      "rounded-control mb-2 grid h-13 w-16 place-items-center overflow-hidden",
                      src ? "bg-bg-subtle" : kraftOf(family),
                    )}
                    aria-hidden="true"
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element -- the catalogue's own image route
                      <img
                        src={src}
                        alt=""
                        width={64}
                        height={52}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ProductIllustration family={family} className="w-[80%]" />
                    )}
                  </span>
                  <Link href={itemHref(item)} className="hover:underline">
                    {name}
                  </Link>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {rows
            .filter((row) => row.show)
            .map((row) => (
              <tr key={row.key}>
                <th scope="row" className={rowHead}>
                  {row.label}
                </th>
                {columns.map((column) => (
                  <td key={column.item.key} className="px-3.5 py-3 align-top">
                    {row.cell(column)}
                  </td>
                ))}
              </tr>
            ))}
          <tr>
            <th scope="row" className={rowHead}>
              <span className="sr-only">{t("action")}</span>
            </th>
            {columns.map((column) => (
              <td key={column.item.key} className="px-3.5 py-3 align-top">
                <ItemAction item={column.item} name={column.name} size="sm" />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
