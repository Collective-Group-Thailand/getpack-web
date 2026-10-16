import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { productFamilyOf, ProductThumb } from "@/ui/components/ProductIllustration";

import type { CatalogueCategory } from "./api.server";
import { pick } from "./localize";
import { categoryGroup, orderCategories } from "./ordering";
import { categoryHref } from "./paths";

/**
 * The catalogue's front: one tile per category with its drawing, in the order a buyer decides —
 * instant price, then by quotation, then services (UX audit, `/products`: tiles in place of the
 * long sidebar list). The sidebar stays on a category's own page.
 */
export async function CategoryTiles({ tree }: { tree: readonly CatalogueCategory[] }) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("catalog")]);
  const ordered = orderCategories(tree);
  if (ordered.length === 0) return null;

  return (
    <section aria-labelledby="catalogue-categories" className="mt-8">
      <h2 id="catalogue-categories" className="sr-only">
        {t("list.categories")}
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {ordered.map((category) => {
          const group = categoryGroup(category);
          return (
            <li key={category.code}>
              <Link
                href={categoryHref(category.code)}
                className="group border-border bg-surface rounded-card hover:shadow-lift focus-visible:ring-focus-ring duration-base ease-standard flex h-full items-center gap-4 border p-4 transition-[box-shadow,translate] outline-none focus-visible:ring-2 motion-safe:hover:-translate-y-0.5"
              >
                <ProductThumb family={productFamilyOf(category.code)} className="rounded-xl" />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="leading-snug font-semibold">{pick(locale, category.nameTh, category.nameEn)}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge size="sm" tone={group === "instant" ? "success" : group === "rfq" ? "info" : "neutral"}>
                      {t(`groups.${group}`)}
                    </Badge>
                    {category.types.length > 1 ? (
                      <span className="text-muted text-xs">{t("tiles.types", { count: category.types.length })}</span>
                    ) : null}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
