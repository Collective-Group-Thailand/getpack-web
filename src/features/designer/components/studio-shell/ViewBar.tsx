"use client";

import { useLocale, useTranslations } from "next-intl";

import { formatNumber } from "@/i18n/format";
import { Switch } from "@/ui/components/Switch";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { useEditor } from "../../store/editor";

export type StageView = "split" | "flat" | "3d";

/** A compact two- or three-way switch in the view bar (pressed = shown). */
function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="bg-surface-subtle inline-flex shrink-0 rounded-lg p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "focus-visible:ring-focus-ring rounded-md px-2.5 py-1 text-[12.5px] font-medium whitespace-nowrap outline-none focus-visible:ring-2",
            value === o.value ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function BarButton({
  icon,
  label,
  onClick,
  className,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "text-muted hover:bg-surface-subtle hover:text-fg focus-visible:ring-focus-ring grid size-8 shrink-0 place-items-center rounded-lg outline-none focus-visible:ring-2",
        className,
      )}
    >
      <Icon name={icon} size={17} aria-hidden="true" />
    </button>
  );
}

/**
 * The floating view bar under the stage (Phase 1 item 2): แผ่นคลี่ / แผ่นคลี่ + 3D / 3D, ด้านนอก / ด้านใน, and zoom
 * (− · % · + · พอดีจอ). Zoom steps of 25 % within 20–600 %; ⇧1 and ⌘/Ctrl + wheel do the same from the keyboard
 * and the pointer.
 */
export function ViewBar({
  view,
  onView,
  side,
  onSide,
  onFit,
  softProof = null,
  className,
}: {
  view: StageView;
  onView: (view: StageView) => void;
  side: "outside" | "inside";
  onSide: (side: "outside" | "inside") => void;
  onFit: () => void;
  /** The substrate soft proof (U4.5), when the material has a profile: the switch and, while on, what it is. */
  softProof?: { label: string; checked: boolean; onChange: (checked: boolean) => void; note: string | null } | null;
  className?: string;
}) {
  const t = useTranslations("designer.shell.view");
  const locale = useLocale() as "th" | "en";
  const zoom = useEditor((s) => s.zoom);
  const setZoom = useEditor((s) => s.setZoom);
  const step = (dir: 1 | -1) => setZoom(dir > 0 ? zoom * 1.25 : zoom / 1.25);
  return (
    <div
      role="toolbar"
      aria-label={t("label")}
      className={cn(
        "border-border bg-surface shadow-overlay flex max-w-[calc(100%-24px)] [scrollbar-width:none] items-center gap-1 overflow-x-auto rounded-xl border p-[5px]",
        className,
      )}
    >
      <Seg
        label={t("mode")}
        value={view}
        onChange={onView}
        options={[
          { value: "flat", label: t("flat") },
          { value: "split", label: t("split") },
          { value: "3d", label: t("3d") },
        ]}
      />
      <span aria-hidden="true" className="bg-border mx-1 h-5 w-px shrink-0" />
      <Seg
        label={t("side")}
        value={side}
        onChange={onSide}
        options={[
          { value: "outside", label: t("outside") },
          { value: "inside", label: t("inside") },
        ]}
      />
      {softProof ? (
        <>
          <span aria-hidden="true" className="bg-border mx-1 h-5 w-px shrink-0" />
          <Switch
            label={softProof.label}
            checked={softProof.checked}
            onCheckedChange={softProof.onChange}
            className="shrink-0 px-1 text-xs whitespace-nowrap"
          />
          {softProof.checked && softProof.note ? (
            <span role="status" className="text-muted max-w-56 shrink-0 truncate px-1 text-xs" title={softProof.note}>
              {softProof.note}
            </span>
          ) : null}
        </>
      ) : null}
      {view !== "3d" ? (
        <>
          <span aria-hidden="true" className="bg-border mx-1 h-5 w-px shrink-0 max-[600px]:hidden" />
          <BarButton icon="minus" label={t("zoomOut")} onClick={() => step(-1)} className="max-[600px]:hidden" />
          <output
            aria-label={t("zoom")}
            className="text-muted min-w-12 shrink-0 text-center text-xs font-medium tabular-nums max-[600px]:hidden"
          >
            {formatNumber(Math.round(zoom * 100), locale)}%
          </output>
          <BarButton icon="plus" label={t("zoomIn")} onClick={() => step(1)} className="max-[600px]:hidden" />
          <BarButton icon="fit" label={t("fit")} onClick={onFit} />
        </>
      ) : null}
    </div>
  );
}
