"use client";

import { useTranslations } from "next-intl";

import { Popover } from "@/ui/components/Popover";
import { Switch } from "@/ui/components/Switch";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { useEditorMode } from "../../store/mode";

const GUIDES = ["cut", "fold", "bleed", "safe", "labels", "grid"] as const;

/** The guide toggles shared by the print view menu and the pro inspector's "เส้นช่วย" section. */
export function GuideToggles({ bleedMm, safeMm }: { bleedMm: number; safeMm: number }) {
  const t = useTranslations("designer.shell.printView");
  const overlays = useEditorMode((s) => s.overlays);
  const setOverlay = useEditorMode((s) => s.setOverlay);
  return (
    <div className="flex flex-col gap-1.5">
      {GUIDES.map((key) => (
        <Switch
          key={key}
          label={t(`guides.${key}`, { bleed: bleedMm, safe: safeMm })}
          checked={overlays[key]}
          onCheckedChange={(on) => setOverlay(key, on)}
          labelPosition="start"
          className="justify-between text-[12.5px]"
        />
      ))}
    </div>
  );
}

/**
 * "เส้นช่วยและระยะ" (Phase 3 item 6), top-right of the pro canvas: the guide toggles, "จำลองหมึกบนผิวกล่อง" (the
 * artwork multiplied onto the board colour) and "แยกหมึก" (all / black only / colours only). A view only — the print
 * files are never changed by it.
 */
export function PrintViewMenu({ bleedMm, safeMm, className }: { bleedMm: number; safeMm: number; className?: string }) {
  const t = useTranslations("designer.shell.printView");
  const inkOnBoard = useEditorMode((s) => s.inkOnBoard);
  const setInkOnBoard = useEditorMode((s) => s.setInkOnBoard);
  const separation = useEditorMode((s) => s.separation);
  const setSeparation = useEditorMode((s) => s.setSeparation);
  return (
    <Popover
      align="end"
      trigger={
        <button
          type="button"
          aria-label={t("label")}
          title={t("label")}
          className={cn(
            "border-border bg-surface text-muted hover:text-fg shadow-overlay focus-visible:ring-focus-ring grid size-8 place-items-center rounded-lg border outline-none focus-visible:ring-2",
            className,
          )}
        >
          <Icon name="ruler" size={17} aria-hidden="true" />
        </button>
      }
      className="w-64"
    >
      <div className="flex flex-col gap-3 p-1">
        <p className="text-sm font-semibold">{t("label")}</p>
        <GuideToggles bleedMm={bleedMm} safeMm={safeMm} />
        <div className="border-border border-t pt-3">
          <Switch
            label={t("inkOnBoard")}
            checked={inkOnBoard}
            onCheckedChange={setInkOnBoard}
            labelPosition="start"
            className="justify-between text-[12.5px]"
          />
        </div>
        <div role="group" aria-label={t("separation")} className="flex flex-col gap-1.5">
          <span className="text-muted text-xs">{t("separation")}</span>
          <div className="bg-surface-subtle inline-flex rounded-lg p-0.5">
            {(["all", "black", "colours"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={separation === value}
                onClick={() => setSeparation(value)}
                className={cn(
                  "focus-visible:ring-focus-ring flex-1 rounded-md px-2 py-1 text-xs font-medium outline-none focus-visible:ring-2",
                  separation === value ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg",
                )}
              >
                {t(`sep.${value}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Popover>
  );
}
