import { Link } from "@/i18n/navigation";
import { ProductThumb, productFamilyOf } from "@/ui/components/ProductIllustration";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

export interface RailItem {
  /** The category code, or `null` for "ทั้งหมด". */
  category: string | null;
  label: string;
  /** Its count from the API's facet; `undefined` hides the line (never a guess). */
  countLabel?: string;
  href: string;
  current: boolean;
}

/**
 * The category rail (styles redesign §3), replacing the chips: an icon, the name and the count of
 * each category, one row that scrolls sideways on a phone and shares the width on a desktop. The
 * selected one carries `aria-current`. Plain links — a category is its own page, not a filter.
 */
export function CategoryRail({ items, label }: { items: RailItem[]; label: string }) {
  return (
    <nav aria-label={label} className="-mx-5 mt-6 overflow-x-auto px-5 md:-mx-8 md:px-8 xl:-mx-12 xl:px-12">
      <ul className="flex gap-2 pb-1">
        {items.map((item) => (
          <li key={item.category ?? "all"} className="shrink-0 lg:min-w-0 lg:flex-1">
            <Link
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className={cn(
                "rounded-card focus-visible:ring-focus-ring flex h-full min-w-36 items-center gap-2.5 border p-2.5 outline-none focus-visible:ring-2 lg:min-w-0 lg:flex-col lg:items-start lg:p-3",
                item.current
                  ? "border-primary bg-primary-subtle text-primary-subtle-fg ring-primary ring-1"
                  : "border-border bg-surface hover:border-border-strong",
              )}
            >
              {item.category ? (
                <ProductThumb family={productFamilyOf(item.category)} className="size-9 [&_svg]:max-w-6" />
              ) : (
                <span className="bg-bg-subtle rounded-thumb grid size-9 place-items-center" aria-hidden="true">
                  <Icon name="dashboard" size={18} />
                </span>
              )}
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-semibold">{item.label}</span>
                {item.countLabel ? (
                  <span className="text-muted block text-xs tabular-nums">{item.countLabel}</span>
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
