import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/lib/cn";

import { STYLES_HREF } from "./paths";
import { variantsHref } from "./variant-query";

/**
 * The library's two views (D-410): the base styles, each card with its variant count, and every
 * variant as a card. Two links, so either is a plain URL to share.
 */
export async function LibraryViews({
  current,
  totals,
}: {
  current: "styles" | "variants";
  totals: { styles: number; variants: number };
}) {
  const t = await getTranslations("styles.list");
  const views = [
    { id: "styles", href: STYLES_HREF, label: t("viewStyles"), count: totals.styles },
    { id: "variants", href: variantsHref({ option: [] }), label: t("viewVariants"), count: totals.variants },
  ] as const;
  return (
    <nav aria-label={t("viewLabel")} className="mt-5">
      <ul className="bg-bg-subtle rounded-control inline-flex gap-1 p-1">
        {views.map((view) => {
          const on = view.id === current;
          return (
            <li key={view.id}>
              <Link
                href={view.href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-focus-ring rounded-control inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium outline-none focus-visible:ring-2",
                  on ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
                )}
              >
                {view.label}
                <span className="tabular-nums opacity-80">{t("count", { count: view.count })}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
