"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { trackCatalog } from "@/lib/analytics/catalog";
import { Button } from "@/ui/components/Button";
import { CardImage } from "@/ui/components/CardImage";
import { LINE_PLATE, ProductIllustration, type ProductFamily } from "@/ui/components/ProductIllustration";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { useCompare } from "./compare-store";
import { compareHref } from "./paths";

const FAMILIES: readonly ProductFamily[] = [
  "shipping",
  "tuck",
  "rigid",
  "bag",
  "pouch",
  "label",
  "tag",
  "tube",
  "food",
  "display",
  "tape",
  "stock",
  "service",
];

/**
 * The styles chosen to compare (owner redesign 2026-10-30), a floating bar once there is one: centred on a wide
 * screen, the full width above the tab bar on a phone. One slot per style allowed — the product's photo (the
 * thin-line drawing only when it has none), its name on hover, and its remove button inside the slot's corner so
 * nothing is clipped; a dashed "+" for each slot still free — then "ล้าง" and "เปรียบเทียบ n แบบ", which opens
 * the comparison over the library (the compare route, intercepted as a dialog).
 */
export function CompareTray() {
  const t = useTranslations("styles.library");
  const tCompare = useTranslations("styles.compare");
  const compare = useCompare();
  if (compare.codes.length === 0) return null;
  const empty = Math.max(0, compare.limit - compare.codes.length);
  return (
    <section
      aria-label={t("compareTray")}
      data-compare-tray=""
      className="z-sticky fixed inset-x-3 bottom-[calc(var(--mobile-tab-h)+0.5rem)] md:inset-x-auto md:bottom-5 md:left-1/2 md:-translate-x-1/2"
    >
      <div className="border-border bg-surface-raised shadow-overlay rounded-card flex items-center gap-3 border p-2.5 md:gap-4 md:p-3">
        <p className="text-muted hidden text-sm whitespace-nowrap tabular-nums sm:block" aria-live="polite">
          {t("compareCount", { count: compare.codes.length, limit: compare.limit })}
        </p>
        <ul className="flex min-w-0 gap-2">
          {compare.codes.map((code) => {
            const meta = compare.metaOf(code);
            const family = FAMILIES.find((value) => value === meta?.family) ?? "tuck";
            const drawing = (
              <span className={cn(LINE_PLATE, "grid size-full place-items-center")}>
                <ProductIllustration family={family} className="max-w-9" />
              </span>
            );
            return (
              <li
                key={code}
                title={meta?.name ?? code}
                className="border-border bg-surface-subtle relative size-14 shrink-0 overflow-hidden rounded-lg border"
              >
                {meta?.image ? (
                  <CardImage
                    src={meta.image}
                    alt={meta.name}
                    className="size-full object-contain p-1"
                    loading="lazy"
                    fallback={drawing}
                  />
                ) : (
                  <>
                    {drawing}
                    <span className="sr-only">{meta?.name ?? code}</span>
                  </>
                )}
                <button
                  type="button"
                  aria-label={t("compareRemove", { code: meta?.name ?? code })}
                  onClick={() => compare.remove(code)}
                  className="bg-surface/95 text-fg border-border hover:bg-surface focus-visible:ring-focus-ring absolute end-0.5 top-0.5 grid size-6 place-items-center rounded-full border outline-none focus-visible:ring-2"
                >
                  <Icon name="close" size={12} aria-hidden="true" />
                </button>
              </li>
            );
          })}
          {Array.from({ length: empty }, (_, i) => (
            <li
              key={`empty-${i}`}
              aria-hidden="true"
              className="border-border-strong text-muted grid size-14 shrink-0 place-items-center rounded-lg border border-dashed"
            >
              <Icon name="plus" size={18} />
            </li>
          ))}
        </ul>
        <div className="ms-auto flex shrink-0 items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={compare.clear}>
            {t("compareClear")}
          </Button>
          <Button asChild>
            <Link
              href={compareHref(compare.codes)}
              scroll={false}
              onClick={() => trackCatalog("catalog_compare", { style_codes: compare.codes })}
            >
              {tCompare("now", { count: compare.codes.length })}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
