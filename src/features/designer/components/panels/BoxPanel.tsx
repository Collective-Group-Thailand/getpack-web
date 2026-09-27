"use client";

import { useLocale, useTranslations } from "next-intl";
import { allFaces, faceLabel, getStyle } from "@packio/dieline";
import { useShallow } from "zustand/react/shallow";

import { formatNumber } from "@/i18n/format";
import { Button } from "@/ui/components/Button";
import { Switch } from "@/ui/components/Switch";
import { cn } from "@/ui/lib/cn";

import { insideSize, sizeOf } from "../../document";
import { useEditor } from "../../store/editor";
import { useDesigner } from "../DesignerContext";

/**
 * The box: what it is, a way to change it, its faces (focusing one turns it upright and zooms to
 * it — the button alternative to double-clicking a face), and what the canvas shows.
 */
export function BoxPanel({ onOpenSetup, onOpenRules }: { onOpenSetup: () => void; onOpenRules: () => void }) {
  const t = useTranslations("designer.box");
  const tView = useTranslations("designer.view");
  const tRoot = useTranslations("designer");
  const locale = useLocale() as "th" | "en";
  const { dieline } = useDesigner();
  const spec = useEditor((s) => s.spec);
  const focusedFaceId = useEditor((s) => s.focusedFaceId);
  const view = useEditor(
    useShallow((s) => ({
      showLabels: s.showLabels,
      showSafeZone: s.showSafeZone,
      showGrid: s.showGrid,
      showRulers: s.showRulers,
      snapping: s.snapping,
    })),
  );
  const { toggle, focusFace } = useEditor.getState();
  if (!spec || !dieline) return null;

  const size = sizeOf(spec);
  const faces = allFaces(dieline).filter((f) => f.kind !== "glue_flap");

  return (
    <div className="space-y-5">
      <section className="space-y-1 text-sm">
        <h3 className="font-semibold">{getStyle(spec.styleId).name[locale]}</h3>
        <p>{size.box ? tRoot("summary", { ...insideSize(spec) }) : tRoot("summaryOther", { size: size.text })}</p>
        {spec.materialName ? <p className="text-muted">{tRoot("material", { name: spec.materialName })}</p> : null}
        <p className="text-muted">
          {tRoot("flatSheet", {
            width: formatNumber(Math.round(dieline.width), locale),
            height: formatNumber(Math.round(dieline.height), locale),
          })}
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" variant="secondary" iconStart="box" onClick={onOpenSetup}>
            {t("change")}
          </Button>
          <Button size="sm" variant="ghost" iconStart="help" onClick={onOpenRules}>
            {t("printRules")}
          </Button>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">{t("faces")}</h3>
        <p className="text-muted mb-2 text-xs">{t("facesHint")}</p>
        <div className="flex flex-wrap gap-1">
          {faces.map((face) => (
            <button
              key={face.id}
              type="button"
              aria-pressed={focusedFaceId === face.id}
              onClick={() => focusFace(focusedFaceId === face.id ? null : face.id)}
              className={cn(
                "focus-visible:ring-focus-ring rounded-full border px-2.5 py-1 text-xs outline-none focus-visible:ring-2",
                focusedFaceId === face.id
                  ? "border-primary bg-primary-subtle text-primary-subtle-fg"
                  : "border-border hover:bg-surface-subtle",
              )}
            >
              {faceLabel(face.label)[locale]}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 text-sm">
        <h3 className="font-semibold">{tView("heading")}</h3>
        <Switch label={tView("showLabels")} checked={view.showLabels} onCheckedChange={() => toggle("showLabels")} />
        <Switch
          label={tView("showSafeZone")}
          checked={view.showSafeZone}
          onCheckedChange={() => toggle("showSafeZone")}
        />
        <Switch label={t("grid")} checked={view.showGrid} onCheckedChange={() => toggle("showGrid")} />
        <Switch label={t("rulers")} checked={view.showRulers} onCheckedChange={() => toggle("showRulers")} />
        <Switch label={t("snapping")} checked={view.snapping} onCheckedChange={() => toggle("snapping")} />
      </section>
    </div>
  );
}
