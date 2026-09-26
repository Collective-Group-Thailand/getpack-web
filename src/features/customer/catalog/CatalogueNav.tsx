import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/lib/cn";

import type { CatalogueCategory } from "./api.server";
import { pick } from "./localize";
import { categoryHref } from "./paths";

/**
 * The catalogue's categories as links — a filter a crawler can follow and a person can open in
 * a new tab, which a client-side filter is neither. The current one is `aria-current`.
 */
export async function CatalogueNav({ tree, current }: { tree: readonly CatalogueCategory[]; current?: string }) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("catalog")]);
  const item = (active: boolean) =>
    cn(
      "block rounded-lg px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
      active ? "bg-primary-subtle text-primary-subtle-fg font-medium" : "hover:bg-bg-subtle",
    );

  return (
    <nav aria-label={t("list.categories")}>
      <ul className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible">
        <li className="shrink-0">
          <Link href="/products" aria-current={!current ? "page" : undefined} className={item(!current)}>
            {t("list.allCategories")}
          </Link>
        </li>
        {tree.map((category) => (
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
    </nav>
  );
}
