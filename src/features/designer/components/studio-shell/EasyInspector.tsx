"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { formatNumber } from "@/i18n/format";
import { Button } from "@/ui/components/Button";
import { Select } from "@/ui/components/Select";
import { Slider } from "@/ui/components/Slider";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { FONT_FAMILIES } from "../../catalog";
import { threshold, useStudioRules } from "../../data/rules";
import type { DesignIssue } from "../../lib/checks";
import { elementBox, localSize } from "../../lib/geometry";
import { measureText } from "../../lib/measure";
import { useFaceNames } from "../../lib/useFaceNames";
import { useEditor } from "../../store/editor";
import type { DesignElement } from "../../types";
import { useDesigner } from "../DesignerContext";
import { readBrandKit } from "../panels/brand-kit";
import type { RailId } from "../shell/panels";
import { effectivePpi, faceOfBox, mmOfPt, placeIn, ptOf, typeKey } from "./element-info";

const TYPE_ICON: Record<string, IconName> = {
  text: "text",
  image: "image",
  qr: "scan",
  barcode: "scan",
  shape: "rectangle",
  line: "line",
};

/** The easy inspector's 9-cell grid keeps this margin inside the panel (Phase 2 item 3). */
const POSITION_MARGIN_MM = 5;

const boxOf = (el: DesignElement) => elementBox(el, localSize(el, el.type === "text" ? measureText(el) : undefined));

export interface EasyActions {
  /** Opens a rail panel (templates, brand, text, background…). */
  rail: (id: RailId) => void;
  /** Opens the ตรวจงาน tab. */
  checks: () => void;
  /** Opens the Mockup (the box in 3D). */
  mockup: () => void;
}

/**
 * The easy inspector (Phase 2 items 2–3). Nothing selected: "ออกแบบเสร็จใน 4 ขั้น" — what is done, each step a
 * jump to its place — and four quick actions. Something selected: plain controls — its text, font, size in pt,
 * bold and alignment; a size in mm for the rest; colours from the brand kit plus black, white and any colour; the
 * picture's quality in words; a 9-cell grid inside its panel; and big buttons.
 */
export function EasyInspector({ issues, actions }: { issues: DesignIssue[]; actions: EasyActions }) {
  const selectedId = useEditor((s) => s.selectedId);
  const selectedIds = useEditor((s) => s.selectedIds);
  const el = useEditor((s) => s.content.elements.find((e) => e.id === s.selectedId));
  if (el && selectedId && selectedIds.length <= 1) return <EasySelected el={el} />;
  if (selectedIds.length > 1) return <EasyMany count={selectedIds.length} />;
  return <EasyGuide issues={issues} actions={actions} />;
}

function EasyGuide({ issues, actions }: { issues: DesignIssue[]; actions: EasyActions }) {
  const t = useTranslations("designer.shell.easy");
  const elements = useEditor((s) => s.content.elements);
  const blocking = issues.filter((i) => i.severity === "block").length;
  const tpl = elements.some((e) => e.templateRole);
  const logo = elements.some((e) => e.type === "image");
  const text = elements.some((e) => e.type === "text");
  const steps = [
    { id: "template", done: tpl, go: () => actions.rail("templates") },
    { id: "logo", done: logo, go: () => actions.rail("brand") },
    { id: "text", done: text, go: () => editFirstText(actions) },
    { id: "check", done: tpl && logo && text && blocking === 0, go: actions.checks },
  ] as const;
  const done = steps.filter((s) => s.done).length;
  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby="easy-guide"
        className="border-border from-primary-subtle flex flex-col gap-2.5 rounded-2xl border bg-linear-to-b to-transparent to-80% p-3.5"
      >
        <h3 id="easy-guide" className="text-[15px] font-semibold">
          {t("guide.title")}
        </h3>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={done}
          aria-label={t("guide.progress")}
          className="bg-border h-1.5 overflow-hidden rounded-full"
        >
          <i
            className="bg-primary block h-full rounded-full transition-[width] motion-reduce:transition-none"
            style={{ width: `${done * 25}%` }}
          />
        </div>
        <ol className="flex flex-col gap-1">
          {steps.map((step, i) => (
            <li key={step.id}>
              <button
                type="button"
                onClick={step.go}
                className="hover:bg-surface focus-visible:ring-focus-ring grid w-full grid-cols-[24px_1fr_auto] items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-start outline-none focus-visible:ring-2"
              >
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full border-[1.5px] text-[11px] font-semibold tabular-nums",
                    step.done ? "bg-primary border-primary text-primary-fg" : "border-border-strong text-muted",
                  )}
                >
                  {step.done ? <Icon name="check" size={13} aria-hidden="true" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <b
                    className={cn(
                      "block text-[13px]",
                      step.done ? "text-muted font-medium line-through" : "font-semibold",
                    )}
                  >
                    {t(`guide.${step.id}.title`)}
                    {step.done ? <span className="sr-only"> · {t("guide.done")}</span> : null}
                  </b>
                  <small className="text-muted block text-[11.5px]">
                    {step.id === "check"
                      ? blocking
                        ? t("guide.check.left", { count: blocking })
                        : t("guide.check.ready")
                      : t(`guide.${step.id}.body`)}
                  </small>
                </span>
                <Icon name="chevron-right" size={14} aria-hidden="true" className="text-muted rtl:rotate-180" />
              </button>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="easy-quick" className="flex flex-col gap-2">
        <h3 id="easy-quick" className="text-muted text-xs font-semibold">
          {t("quick.title")}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["text", "text", () => editFirstText(actions)],
              ["logo", "palette", () => actions.rail("brand")],
              ["colour", "pattern", () => actions.rail("background")],
              ["mockup", "box", actions.mockup],
            ] as const
          ).map(([id, icon, go]) => (
            <button
              key={id}
              type="button"
              onClick={go}
              className="border-border bg-surface-subtle hover:border-primary focus-visible:ring-focus-ring flex flex-col items-start gap-1.5 rounded-xl border p-3 text-start text-[12.5px] font-semibold outline-none focus-visible:ring-2"
            >
              <Icon name={icon} size={20} aria-hidden="true" className="text-primary" />
              {t(`quick.${id}`)}
            </button>
          ))}
        </div>
      </section>
      <p className="bg-surface-subtle text-muted flex items-start gap-2 rounded-xl p-2.5 text-xs">
        <Icon name="check" size={16} aria-hidden="true" className="text-primary mt-px shrink-0" />
        {t("hint")}
      </p>
    </div>
  );
}

/** "แก้ข้อความ": the first text on the side shown, selected; with none, the text panel. */
function editFirstText(actions: EasyActions) {
  const s = useEditor.getState();
  const first = s.content.elements.find(
    (e) => e.type === "text" && (e.side ?? "outside") === s.side && !e.locked && !e.hidden,
  );
  if (first) s.select(first.id);
  else actions.rail("text");
}

function EasyMany({ count }: { count: number }) {
  const t = useTranslations("designer.shell.easy");
  const { duplicateSelected, removeSelected } = useEditor.getState();
  return (
    <div className="flex flex-col gap-3">
      <p className="bg-primary-subtle text-primary-subtle-fg flex items-center gap-2 rounded-xl p-3 font-semibold">
        <Icon name="layers" size={18} aria-hidden="true" />
        {t("many", { count })}
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        <Button variant="secondary" iconStart="copy" onClick={duplicateSelected}>
          {t("actions.duplicate")}
        </Button>
        <Button variant="secondary" iconStart="trash" className="text-danger" onClick={removeSelected}>
          {t("actions.remove")}
        </Button>
      </div>
    </div>
  );
}

function EasySelected({ el }: { el: DesignElement }) {
  const t = useTranslations("designer.shell.easy");
  const tType = useTranslations("designer.shell.type");
  const locale = useLocale() as "th" | "en";
  const { dieline, catalog, mode } = useDesigner();
  const names = useFaceNames(dieline);
  const rules = useStudioRules(mode !== "admin");
  const { updateElement, removeElement, duplicateElement, reorder } = useEditor.getState();
  const [brand, setBrand] = useState<string[]>([]);
  useEffect(() => {
    // Browser storage is read after mount; the server render has no brand kit.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBrand(readBrandKit().colours);
  }, []);
  const set = (patch: Partial<DesignElement>) => updateElement(el.id, patch);
  const box = boxOf(el);
  const face = faceOfBox(dieline, box);
  const faceName = face ? names.get(face.id) : undefined;
  const kind = typeKey(el);
  const locked = el.locked === true;

  const fonts = [...new Set([...(catalog?.fonts.map((f) => f.family) ?? []), ...FONT_FAMILIES])];
  const studioFonts = new Set(catalog?.fonts.map((f) => f.family) ?? []);
  const fill = "fill" in el ? el.fill : null;
  const swatches = [
    ...brand.map((hex) => ({ hex, label: t("swatch.brand", { hex }) })),
    { hex: "#111111", label: t("swatch.black") },
    { hex: "#ffffff", label: t("swatch.white") },
  ].filter((s, i, all) => all.findIndex((o) => o.hex.toLowerCase() === s.hex.toLowerCase()) === i);

  const ppi = el.type === "image" ? effectivePpi(el) : null;
  const warnPpi = threshold(rules.data, "image_resolution", "warnBelowPpi") ?? catalog?.rules.minDpi ?? null;
  const blockPpi = threshold(rules.data, "image_resolution", "blockBelowPpi");
  const quality =
    ppi === null
      ? null
      : blockPpi !== null && ppi < blockPpi
        ? "low"
        : warnPpi !== null && ppi < warnPpi
          ? "soft"
          : "sharp";

  const sizeMm = el.type === "text" ? null : Math.round(el.width * Math.abs(el.scaleX));
  const maxMm = Math.max(Math.ceil((face?.bounds.width ?? 150) * 1.1), sizeMm ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <i className="bg-primary-subtle text-primary grid size-9 shrink-0 place-items-center rounded-[10px]">
          <Icon name={TYPE_ICON[kind] ?? "star"} size={18} aria-hidden="true" />
        </i>
        <div className="min-w-0">
          <b className="block truncate text-[15px] font-semibold">
            {el.name ?? (el.type === "text" ? el.text.split("\n")[0]!.slice(0, 28) : tType(kind))}
          </b>
          <small className="text-muted text-xs">
            {tType(kind)}
            {faceName ? ` · ${t("onFace", { face: faceName })}` : null}
          </small>
        </div>
      </div>

      {locked ? (
        <p className="bg-warning-subtle text-warning-subtle-fg rounded-xl p-2.5 text-xs">{t("locked")}</p>
      ) : null}

      {el.type === "text" ? (
        <section className="flex flex-col gap-2" aria-label={t("text.label")}>
          <h3 className="text-muted text-xs font-semibold">{t("text.label")}</h3>
          <textarea
            aria-label={t("text.content")}
            value={el.text}
            disabled={locked}
            rows={2}
            onChange={(e) => set({ text: e.target.value })}
            className="border-border bg-surface-subtle focus:border-focus-ring min-h-15 w-full resize-y rounded-lg border p-2 text-sm outline-none"
          />
          <Select
            aria-label={t("text.font")}
            value={el.fontFamily}
            disabled={locked}
            onValueChange={(fontFamily) => set({ fontFamily })}
            options={fonts.map((family) => ({
              value: family,
              label: (
                <span style={{ fontFamily: family }}>
                  {family}
                  {studioFonts.has(family) ? (
                    <span className="text-muted ms-2 text-xs">{t("text.studioFont")}</span>
                  ) : null}
                </span>
              ),
            }))}
          />
          <RangeRow
            label={t("text.size")}
            value={Math.round(ptOf(el.fontSize * Math.abs(el.scaleY)))}
            unit={t("pt")}
            min={6}
            max={60}
            disabled={locked}
            locale={locale}
            onChange={(pt) => set({ fontSize: mmOfPt(pt) / Math.abs(el.scaleY || 1) })}
          />
          <div className="flex flex-wrap items-center gap-1">
            <ToggleIcon
              label={t("text.bold")}
              pressed={el.fontStyle.includes("bold")}
              disabled={locked}
              onClick={() =>
                set({
                  fontStyle: el.fontStyle.includes("bold")
                    ? el.fontStyle.includes("italic")
                      ? "italic"
                      : "normal"
                    : el.fontStyle.includes("italic")
                      ? "italic bold"
                      : "bold",
                })
              }
            >
              <Icon name="bold" size={16} aria-hidden="true" />
            </ToggleIcon>
            <span aria-hidden="true" className="bg-border mx-1 h-6 w-px" />
            {(
              [
                ["left", "align-left"],
                ["center", "align-center"],
                ["right", "align-right"],
              ] as const
            ).map(([align, icon]) => (
              <ToggleIcon
                key={align}
                label={t(`text.align.${align}`)}
                pressed={el.align === align}
                disabled={locked}
                onClick={() => set({ align })}
              >
                <Icon name={icon} size={16} aria-hidden="true" />
              </ToggleIcon>
            ))}
          </div>
        </section>
      ) : (
        <RangeRow
          label={t("size")}
          value={sizeMm ?? 0}
          unit={t("mm")}
          prefix={t("width")}
          min={6}
          max={maxMm}
          disabled={locked}
          locale={locale}
          onChange={(mm) => {
            // The size keeps the element's proportions; its centre stays where it is.
            const k = mm / Math.max(0.1, el.width * Math.abs(el.scaleX));
            const w = el.width * k;
            const h = el.height * k;
            set({
              width: w,
              height: h,
              x: el.x - (w - el.width) / 2,
              y: el.y - (h - el.height) / 2,
            } as Partial<DesignElement>);
          }}
        />
      )}

      {fill !== null && el.type !== "image" ? (
        <section className="flex flex-col gap-2" aria-label={t("colour")}>
          <h3 className="text-muted text-xs font-semibold">{t("colour")}</h3>
          <div className="flex flex-wrap gap-2">
            {swatches.map((s) => (
              <button
                key={s.hex}
                type="button"
                aria-label={s.label}
                title={s.label}
                aria-pressed={fill.toLowerCase() === s.hex.toLowerCase()}
                disabled={locked}
                onClick={() => set({ fill: s.hex } as Partial<DesignElement>)}
                className="aria-pressed:ring-focus-ring aria-pressed:ring-offset-surface size-9 rounded-[10px] border border-black/15 aria-pressed:ring-2 aria-pressed:ring-offset-2"
                style={{ backgroundColor: s.hex }}
              />
            ))}
            <label
              title={t("swatch.custom")}
              className="relative grid size-9 cursor-pointer place-items-center rounded-[10px] border border-black/15 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]"
            >
              <span className="sr-only">{t("swatch.custom")}</span>
              <input
                type="color"
                value={/^#[0-9a-f]{6}$/i.test(fill) ? fill : "#000000"}
                disabled={locked}
                onChange={(e) => set({ fill: e.target.value } as Partial<DesignElement>)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </div>
        </section>
      ) : null}

      {quality ? (
        <p
          role="status"
          className={cn(
            "flex items-start gap-2 rounded-xl p-2.5 text-xs",
            quality === "sharp"
              ? "bg-surface-subtle text-fg"
              : quality === "soft"
                ? "bg-warning-subtle text-warning-subtle-fg"
                : "bg-danger-subtle text-danger-subtle-fg",
          )}
        >
          <Icon
            name={quality === "sharp" ? "check" : "warning"}
            size={16}
            aria-hidden="true"
            className={cn("mt-px shrink-0", quality === "sharp" ? "text-success" : undefined)}
          />
          <span>
            {t(`quality.${quality}`)}
            <span className="text-muted block tabular-nums">
              {t("quality.ppi", { ppi: formatNumber(ppi!, locale) })}
            </span>
          </span>
        </p>
      ) : null}

      {face ? (
        <section className="flex flex-col gap-2" aria-label={t("position.label", { face: faceName ?? "" })}>
          <h3 className="text-muted text-xs font-semibold">{t("position.label", { face: faceName ?? "" })}</h3>
          <div className="flex items-center gap-3">
            <div
              role="group"
              aria-label={t("position.grid")}
              className="border-border bg-surface-subtle grid w-max grid-cols-[repeat(3,38px)] grid-rows-[repeat(3,30px)] gap-1 rounded-[10px] border p-1.5"
            >
              {Array.from({ length: 9 }, (_, cell) => (
                <button
                  key={cell}
                  type="button"
                  aria-label={t(`position.cells.${cell}`)}
                  title={t(`position.cells.${cell}`)}
                  disabled={locked}
                  onClick={() => {
                    const move = placeIn(box, face.bounds, cell, POSITION_MARGIN_MM);
                    useEditor.getState().moveElements([{ id: el.id, ...move }]);
                  }}
                  className="group border-border bg-surface hover:border-primary focus-visible:ring-focus-ring grid place-items-center rounded-md border outline-none focus-visible:ring-2"
                >
                  <i aria-hidden="true" className="bg-muted group-hover:bg-primary size-2 rounded-[2px]" />
                </button>
              ))}
            </div>
            <p className="text-muted text-xs">{t("position.hint")}</p>
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-2 gap-1.5">
        <Button variant="secondary" iconStart="copy" onClick={() => duplicateElement(el.id)}>
          {t("actions.duplicate")}
        </Button>
        <Button
          variant="secondary"
          iconStart="trash"
          className="text-danger"
          disabled={locked}
          onClick={() => removeElement(el.id)}
        >
          {t("actions.remove")}
        </Button>
        <Button variant="secondary" iconStart="layer-top" onClick={() => reorder(el.id, "top")}>
          {t("actions.front")}
        </Button>
        <Button variant="secondary" iconStart="layer-bottom" onClick={() => reorder(el.id, "bottom")}>
          {t("actions.back")}
        </Button>
      </div>
    </div>
  );
}

function RangeRow({
  label,
  value,
  unit,
  prefix,
  min,
  max,
  disabled,
  locale,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  prefix?: string;
  min: number;
  max: number;
  disabled?: boolean;
  locale: "th" | "en";
  onChange: (value: number) => void;
}) {
  const shown = `${prefix ? `${prefix} ` : ""}${formatNumber(value, locale)} ${unit}`;
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-2.5 gap-y-1">
      <span className="text-muted text-[12.5px]">{label}</span>
      <output className="text-muted text-right text-xs font-medium tabular-nums">{shown}</output>
      <Slider
        aria-label={label}
        className="col-span-2"
        value={[Math.min(max, Math.max(min, value))]}
        min={min}
        max={max}
        step={1}
        disabled={disabled}
        valueText={shown}
        onValueChange={([v]) => onChange(v!)}
      />
    </div>
  );
}

function ToggleIcon({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "focus-visible:ring-focus-ring grid h-[30px] w-8 place-items-center rounded-md border outline-none focus-visible:ring-2 disabled:opacity-50",
        pressed
          ? "bg-primary-subtle text-primary border-primary/40"
          : "border-border bg-surface-subtle text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
