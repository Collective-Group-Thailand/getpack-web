"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";

import { useCompare } from "./compare-store";
import { compareHref } from "./paths";

/** The styles chosen to compare, docked at the bottom of the screen once there is one (D-246). */
export function CompareTray() {
  const t = useTranslations("styles.compare");
  const compare = useCompare();
  if (compare.codes.length === 0) return null;
  return (
    <section
      aria-label={t("tray")}
      className="border-border bg-surface shadow-card z-sticky fixed inset-x-0 bottom-16 border-t md:bottom-0"
    >
      <div className="max-w-content mx-auto flex flex-wrap items-center gap-2 px-4 py-3">
        <h2 className="text-sm font-medium">{t("tray")}</h2>
        <ul className="flex flex-wrap gap-1">
          {compare.codes.map((code) => (
            <li key={code} className="bg-bg-subtle flex items-center gap-1 rounded-control ps-3 font-mono text-sm">
              {code}
              <IconButton
                name="close"
                size="sm"
                variant="ghost"
                label={`${t("remove")}: ${code}`}
                onClick={() => compare.toggle(code)}
              />
            </li>
          ))}
        </ul>
        <span className="text-muted text-xs">{t("limit")}</span>
        <div className="ms-auto flex gap-2">
          <Button size="sm" variant="ghost" onClick={compare.clear}>
            {t("clear")}
          </Button>
          <Button asChild size="sm">
            <Link href={compareHref(compare.codes)}>{t("now", { count: compare.codes.length })}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
