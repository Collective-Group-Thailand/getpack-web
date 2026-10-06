import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/lib/cn";

import type { CatalogueCategory } from "./api.server";
import { pick } from "./localize";
import { categoryGroup, orderCategories, type CategoryGroup } from "./ordering";
import { categoryHref } from "./paths";

/**
 * The catalogue's categories as links — a filter a crawler can follow and a person can open in a
 * new tab, which a client-side filter is neither. Grouped the way a buyer decides (UX audit):
 * instant price, then by quotation, then services. The current one is `aria-current`.
 */
export async function CatalogueNav({ tree, current }: { tree: readonly CatalogueCategory[]; current?: string }) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("catalog")]);
  const item = (active: boolean) =>
    cn(
      "flex items-center justify-between gap-2 rounded-control px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
      active ? "bg-primary-subtle text-primary-subtle-fg font-medium" : "hover:bg-bg-subtle",
    );
  const ordered = orderCategories(tree);
  const groups = (["instant", "rfq", "service"] as CategoryGroup[])
    .map((group) => ({ group, categories: ordered.filter((category) => categoryGroup(category) === group) }))
    .filter((entry) => entry.categories.length > 0);

  return (
    <nav aria-label={t("list.categories")}>
      {/* A phone scrolls one row of every category; a wider screen lists them by group. */}
      <ul className="flex gap-1 overflow-x-auto pb-1 md:hidden">
        <li className="shrink-0">
          <Link href="/products" aria-current={!current ? "page" : undefined} className={item(!current)}>
            {t("list.allCategories")}
          </Link>
        </li>
        {ordered.map((category) => (
          <li key={category.code} className="shrink-0">
            <Link
              href={categoryHref(category.code)}
              aria-current={current === category.code ? "page" : undefined}
              className={item(current === category.code)}
            >
              {pick(locale, category.nameTh, category.nameEn)}
            </Link>
          </li>
        ))}
      </ul>
      <div className="hidden flex-col gap-4 md:flex">
        {groups.map(({ group, categories }) => (
          <div key={group}>
            <p className="text-muted mb-1.5 px-3.5 text-xs font-medium tracking-wide">{t(`groups.${group}`)}</p>
            <ul className="flex flex-col gap-0.5">
              {categories.map((category) => (
                <li key={category.code}>
                  <Link
                    href={categoryHref(category.code)}
                    aria-current={current === category.code ? "page" : undefined}
                    className={item(current === category.code)}
                  >
                    {pick(locale, category.nameTh, category.nameEn)}
                    <span className="text-muted text-xs tabular-nums">
                      {category.types.length}
                      <span className="sr-only"> {t("groups.types")}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
