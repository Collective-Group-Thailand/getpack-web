"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";

import { trackCatalog } from "@/lib/analytics/catalog";
import { useCompare } from "./compare-store";
import { compareHref, previewSrc } from "./paths";

/**
 * The styles chosen to compare, docked at the bottom of the screen once there is one (D-246,
 * styles redesign §4): a thumbnail per style — the engine's drawing of it, which every published
 * style has — and an empty slot for each one still allowed, "เลือกแล้ว n/limit", compare and clear.
 * The limit is staff's (`CompareLimitProvider`).
 */
export function CompareTray() {
  const t = useTranslations("styles.library");
  const compare = useCompare();
  if (compare.codes.length === 0) return null;
  const empty = Math.max(0, compare.limit - compare.codes.length);
  return (
    <section
      aria-label={t("compareTray")}
      data-compare-tray=""
      className="z-sticky fixed inset-x-3 bottom-[4.5rem] md:inset-x-auto md:bottom-4 md:left-1/2 md:-translate-x-1/2"
    >
      <div className="border-border bg-surface-raised shadow-overlay rounded-card flex items-center gap-3 border p-2 ps-3">
        <p className="text-sm font-medium whitespace-nowrap tabular-nums" aria-live="polite">
          {t("compareCount", { count: compare.codes.length, limit: compare.limit })}
        </p>
        <ul className="flex min-w-0 gap-1.5 overflow-x-auto">
          {compare.codes.map((code) => (
            <li key={code} className="border-border bg-surface relative size-11 shrink-0 rounded-md border">
              {/* eslint-disable-next-line @next/next/no-img-element -- an SVG this app draws (D-410) */}
              <img
                src={previewSrc(code, {})}
                alt={code}
                width={44}
                height={44}
                loading="lazy"
                className="size-full object-contain p-1"
              />
              <IconButton
                name="close"
                size="sm"
                variant="secondary"
                label={t("compareRemove", { code })}
                onClick={() => compare.remove(code)}
                className="absolute -end-2 -top-2 size-5 min-h-0 rounded-full p-0 [&_svg]:size-3"
              />
            </li>
          ))}
          {Array.from({ length: empty }, (_, i) => (
            <li
              key={`empty-${i}`}
              aria-hidden="true"
              className="border-border size-11 shrink-0 rounded-md border border-dashed"
            />
          ))}
        </ul>
        <div className="ms-auto flex shrink-0 gap-1">
          <Button size="sm" variant="ghost" onClick={compare.clear}>
            {t("compareClear")}
          </Button>
          <Button asChild size="sm">
            <Link
              href={compareHref(compare.codes)}
              onClick={() => trackCatalog("catalog_compare", { style_codes: compare.codes })}
            >
              {t("compareNow")}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
