import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/lib/cn";

import { STYLES_HREF } from "./paths";
import { variantsHref } from "./variant-query";

/**
 * The library's two views (D-410), a toggle in the toolbar rather than a filter (styles redesign
 * §3): the base styles, each card with its option count, and every option as a card. Two links,
 * so either is a plain URL to share.
 */
export async function LibraryViews({
  current,
  totals,
  className,
}: {
  current: "styles" | "variants";
  totals: { styles: number; variants: number };
  className?: string;
}) {
  const t = await getTranslations("styles.library");
  const views = [
    { id: "styles", href: STYLES_HREF, label: t("viewStyles"), count: totals.styles },
    { id: "variants", href: variantsHref({ option: [] }), label: t("viewVariants"), count: totals.variants },
  ] as const;
  return (
    <nav aria-label={t("view")} className={className}>
      <ul className="bg-bg-subtle border-border rounded-control inline-flex gap-0.5 border p-0.5">
        {views.map((view) => {
          const on = view.id === current;
          return (
            <li key={view.id}>
              <Link
                href={view.href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2",
                  on ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
                )}
              >
                {view.label}
                <span className="text-muted text-xs tabular-nums">{view.count.toLocaleString("en-US")}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
