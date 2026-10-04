"use client";

import { useLocale, useTranslations } from "next-intl";
import { findFace, type Dieline } from "@packio/dieline";

import { formatNumber } from "@/i18n/format";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { NumberInput } from "@/ui/components/Input";
import { Slider } from "@/ui/components/Slider";
import { Icon } from "@/ui/icons";

import { CANVAS_COLORS } from "../../canvas-colors";
import type { DesignIssue } from "../../lib/checks";
import { useFaceNames } from "../../lib/useFaceNames";
import { useEditor, ZOOM_MAX, ZOOM_MIN } from "../../store/editor";
import { useCanvasStatus } from "../../store/status";

/**
 * The editor's footer: the flat sheet, the face under the pointer, the checks' count (a button
 * to them), and zoom.
 */
export function StatusBar({
  dieline,
  issues,
  onShowChecks,
  onFit,
  onShortcuts,
}: {
  dieline: Dieline | null;
  issues: DesignIssue[];
  onShowChecks: () => void;
  onFit: () => void;
  onShortcuts: () => void;
}) {
  const t = useTranslations("designer");
  const locale = useLocale() as "th" | "en";
  const zoom = useEditor((s) => s.zoom);
  const setZoom = useEditor((s) => s.setZoom);
  const materialName = useEditor((s) => s.spec?.materialName);
  const faceId = useCanvasStatus((s) => s.faceId);
  const names = useFaceNames(dieline);
  const face = dieline && faceId ? findFace(dieline, faceId) : undefined;
  const zoomPercent = Math.round(zoom * 100);
  const errors = issues.filter((i) => i.severity === "block").length;

  return (
    <footer className="border-border bg-surface flex h-11 shrink-0 items-center gap-3 border-t px-3 text-sm">
      <div className="text-muted me-auto flex min-w-0 items-center gap-3 text-xs">
        {dieline ? (
          <b className="text-fg font-semibold whitespace-nowrap">
            {t("flatSheet", { width: dieline.width.toFixed(0), height: dieline.height.toFixed(0) })}
          </b>
        ) : null}
        {materialName ? (
          <span className="hidden truncate md:inline">{t("material", { name: materialName })}</span>
        ) : null}
        {face ? (
          <span className="hidden whitespace-nowrap sm:inline">
            {t("status.face", { name: names.get(face.id) ?? face.label })}
          </span>
        ) : null}
        <span className="hidden items-center gap-1 xl:flex">
          <i className="inline-block h-0.5 w-4" style={{ backgroundColor: CANVAS_COLORS.cut }} />
          {t("legend.cut")}
        </span>
        <span className="hidden items-center gap-1 xl:flex">
          <i className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: CANVAS_COLORS.fold }} />
          {t("legend.fold")}
        </span>
      </div>

      {dieline ? (
        <button
          type="button"
          onClick={onShowChecks}
          className="hover:bg-surface-subtle focus-visible:ring-focus-ring flex items-center gap-1 rounded-md px-2 py-1 text-xs outline-none focus-visible:ring-2"
        >
          <Icon
            name={issues.length ? (errors ? "error" : "warning") : "check"}
            size={16}
            className={errors ? "text-danger" : issues.length ? "text-warning" : "text-success"}
            aria-hidden="true"
          />
          {issues.length ? t("status.issues", { count: issues.length }) : t("status.noIssues")}
        </button>
      ) : null}

      <Button size="sm" variant="ghost" iconStart="fit" onClick={onFit}>
        <span className="hidden sm:inline">{t("zoom.fit")}</span>
      </Button>
      <Slider
        aria-label={t("zoom.label")}
        className="hidden w-32 sm:block lg:w-40"
        min={ZOOM_MIN * 100}
        max={ZOOM_MAX * 100}
        value={[zoomPercent]}
        onValueChange={([percent]) => setZoom(percent / 100)}
        valueText={`${formatNumber(zoomPercent, locale)} %`}
      />
      <NumberInput
        aria-label={t("zoom.percentLabel")}
        unit="%"
        inputSize="sm"
        className="w-24"
        min={ZOOM_MIN * 100}
        max={ZOOM_MAX * 100}
        value={zoomPercent}
        onChange={(event) => setZoom(Number(event.target.value) / 100)}
      />
      <IconButton
        name="command"
        label={t("shortcuts.open")}
        size="sm"
        variant="ghost"
        className="hidden lg:inline-flex"
        onClick={onShortcuts}
      />
    </footer>
  );
}
