"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Dieline } from "@getpack/dieline";

import { formatNumber } from "@/i18n/format";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import type { DesignIssue } from "../../lib/checks";
import { useEditor } from "../../store/editor";
import type { EditorMode } from "../../store/mode";

/**
 * The status bar (Phase 1 items 1 and 4): the box and its material, the sheet in pro, and the print state —
 * "พร้อมพิมพ์" when nothing must be fixed (with advice noted), else how many must be fixed. Easy says the mode can
 * change any time; pro offers the shortcut sheet.
 */
export function StudioStatusBar({
  mode,
  boxLabel,
  dieline,
  issues,
  onChecks,
  onShortcuts,
}: {
  mode: EditorMode;
  /** The box and its inside size, e.g. "กล่องลูกฟูกฝาชน (RSC) · ภายใน 150 × 100 × 80 มม.". */
  boxLabel: string | null;
  dieline: Dieline | null;
  issues: DesignIssue[];
  onChecks: () => void;
  onShortcuts: () => void;
}) {
  const t = useTranslations("designer.shell.status");
  const locale = useLocale() as "th" | "en";
  const material = useEditor((s) => s.spec?.materialName);
  const side = useEditor((s) => s.side);
  const hasContent = useEditor((s) => s.content.elements.length > 0);
  const blocking = issues.filter((i) => i.severity === "block").length;
  const advice = issues.filter((i) => i.severity === "warn").length;
  return (
    <footer className="border-border bg-surface text-muted flex h-[30px] items-center gap-3.5 overflow-hidden border-t px-3 text-[11.5px] whitespace-nowrap">
      {mode === "pro" && dieline ? (
        <span>
          {t("sheet")}{" "}
          <b className="text-fg font-medium tabular-nums">
            {t("mm", {
              w: formatNumber(Math.round(dieline.width), locale),
              h: formatNumber(Math.round(dieline.height), locale),
            })}
          </b>
        </span>
      ) : null}
      {boxLabel ? <span className="truncate">{boxLabel}</span> : null}
      {material ? (
        <span className="max-[1180px]:hidden">
          {t("material")} <b className="text-fg font-medium">{material}</b>
        </span>
      ) : null}
      {mode === "pro" ? <span>{t(`side.${side}`)}</span> : null}
      {hasContent ? (
        <button
          type="button"
          onClick={onChecks}
          className={cn(
            "focus-visible:ring-focus-ring inline-flex items-center gap-1 rounded font-semibold outline-none focus-visible:ring-2",
            blocking ? "text-danger" : "text-success",
          )}
        >
          <Icon name={blocking ? "error" : "check"} size={13} aria-hidden="true" />
          {blocking ? t("mustFix", { count: blocking }) : advice ? t("readyWithAdvice") : t("ready")}
        </button>
      ) : null}
      <span className="ms-auto">
        {mode === "easy" ? (
          t("easyNote")
        ) : (
          <button
            type="button"
            aria-label={t("shortcuts")}
            title={t("shortcuts")}
            onClick={onShortcuts}
            className="hover:text-fg focus-visible:ring-focus-ring grid place-items-center rounded outline-none focus-visible:ring-2"
          >
            <Icon name="keyboard" size={16} aria-hidden="true" />
          </button>
        )}
      </span>
    </footer>
  );
}
