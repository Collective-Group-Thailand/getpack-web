import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { cn } from "@/ui/lib/cn";

import type { CatalogueCategory } from "./api.server";
import { pick } from "./localize";

/**
 * The packaging-type filter (F3 page patterns §Catalogue): types grouped by category as links, each
 * with how it is priced, the chosen one `aria-current` — server-rendered, so it works without
 * JavaScript and a crawler can follow it. On a phone it folds into a disclosure.
 */
export async function TypeFilter({
  tree,
  current,
  hrefFor,
}: {
  tree: readonly CatalogueCategory[];
  current?: string;
  hrefFor: (code: string) => string;
}) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("catalog")]);
  return (
    <details className="border-border rounded-xl border p-3 md:border-0 md:p-0" open>
      <summary className="cursor-pointer text-sm font-semibold md:cursor-default">{t("filters.type")}</summary>
      <nav aria-label={t("filters.type")} className="mt-2 flex flex-col gap-3">
        {tree.map((category) => (
          <div key={category.code}>
            <p className="text-muted px-3 text-xs">{pick(locale, category.nameTh, category.nameEn)}</p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {category.types.map((type) => {
                const active = current === type.code;
                return (
                  <li key={type.code}>
                    <Link
                      href={hrefFor(type.code)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "focus-visible:ring-focus-ring flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm outline-none focus-visible:ring-2",
                        active ? "bg-primary-subtle text-primary-subtle-fg font-medium" : "hover:bg-bg-subtle",
                      )}
                    >
                      <span>{pick(locale, type.nameTh, type.nameEn)}</span>
                      <Badge
                        size="sm"
                        tone={
                          type.availability === "instant"
                            ? "success"
                            : type.availability === "partial"
                              ? "warning"
                              : "info"
                        }
                      >
                        {t(`card.availability.${type.availability}`)}
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </details>
  );
}
