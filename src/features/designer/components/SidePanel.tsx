"use client";

import { useLocale, useTranslations } from "next-intl";

import { FONT_FAMILIES } from "@/features/designer/catalog";
import { PATTERN_OPTIONS } from "@/features/designer/patterns";
import { useEditor } from "@/features/designer/store/editor";
import type { DesignElement } from "@/features/designer/types";
import { formatNumber } from "@/i18n/format";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { ColorField } from "@/ui/components/ColorField";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { NumberInput, Textarea } from "@/ui/components/Input";
import { Kbd } from "@/ui/components/Kbd";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Select } from "@/ui/components/Select";
import { Slider } from "@/ui/components/Slider";
import { cn } from "@/ui/lib/cn";

/** Below this printed height (mm) a glyph stops holding an edge on board — roughly 6 pt. */
const MIN_LEGIBLE_TEXT_MM = 2.1;

export function PatternPanel() {
  const t = useTranslations("designer.pattern");
  const { content, setPattern } = useEditor();
  const pattern = content.pattern;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{t("heading")}</h3>

      <div className="grid grid-cols-3 gap-2">
        {PATTERN_OPTIONS.map((option) => (
          <button
            key={option.kind}
            type="button"
            onClick={() => setPattern({ kind: option.kind })}
            aria-pressed={pattern.kind === option.kind}
            className={cn(
              "duration-fast ease-standard rounded-lg border px-2 py-2 text-xs transition-colors",
              pattern.kind === option.kind
                ? "border-primary bg-primary-subtle text-primary-subtle-fg"
                : "border-border hover:bg-surface-subtle",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {pattern.kind !== "none" && (
        <>
          <Field label={t("color")}>
            <ColorField
              value={pattern.color}
              onValueChange={(color) => setPattern({ color })}
              hexLabel={t("hexLabel")}
            />
          </Field>
          {pattern.kind !== "solid" && (
            <>
              <Field label={t("background")}>
                <ColorField
                  value={pattern.background}
                  onValueChange={(background) => setPattern({ background })}
                  hexLabel={t("hexLabel")}
                />
              </Field>
              <Field label={t("size", { size: pattern.size })}>
                <Slider
                  value={[pattern.size]}
                  min={4}
                  max={60}
                  onValueChange={([size]) => setPattern({ size })}
                  valueText={`${pattern.size} mm`}
                />
              </Field>
            </>
          )}
        </>
      )}
    </div>
  );
}

export function PropertiesPanel({ el }: { el: DesignElement }) {
  const t = useTranslations("designer.properties");
  const locale = useLocale() as "th" | "en";
  const { updateElement, removeElement, duplicateElement, reorder } = useEditor();

  const set = (patch: Partial<DesignElement>) => updateElement(el.id, patch);
  const titles = { text: t("text"), image: t("image"), rect: t("rect"), circle: t("circle") };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{titles[el.type]}</h3>
        <div className="flex gap-1">
          <IconButton name="copy" label={t("duplicate")} size="sm" onClick={() => duplicateElement(el.id)} />
          <IconButton
            name="trash"
            label={t("remove")}
            size="sm"
            className="text-danger"
            onClick={() => removeElement(el.id)}
          />
        </div>
      </div>

      {el.type === "text" && (
        <>
          <Field label={t("textContent")}>
            <Textarea rows={3} value={el.text} onChange={(event) => set({ text: event.target.value })} />
          </Field>

          <Field label={t("font")}>
            <Select
              value={el.fontFamily}
              onValueChange={(fontFamily) => set({ fontFamily })}
              options={FONT_FAMILIES.map((family) => ({
                value: family,
                label: <span style={{ fontFamily: family }}>{family}</span>,
              }))}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label={t("fontSize")}>
              <NumberInput
                min={1}
                step={0.5}
                inputSize="sm"
                unit="มม."
                value={el.fontSize}
                onChange={(event) => set({ fontSize: Math.max(1, Number(event.target.value) || 0) })}
              />
            </Field>
            <Field label={t("fontStyle")}>
              <Select
                value={el.fontStyle}
                onValueChange={(fontStyle) => set({ fontStyle: fontStyle as typeof el.fontStyle })}
                options={[
                  { value: "normal", label: t("styleNormal") },
                  { value: "bold", label: t("styleBold") },
                  { value: "italic", label: t("styleItalic") },
                  { value: "italic bold", label: t("styleBoldItalic") },
                ]}
              />
            </Field>
          </div>

          {el.fontSize * el.scaleY < MIN_LEGIBLE_TEXT_MM && <Callout tone="warning" title={t("tooSmall")} />}

          <Field label={t("align")}>
            <SegmentedControl
              label={t("align")}
              size="sm"
              value={el.align}
              onValueChange={(align) => set({ align: align as typeof el.align })}
              options={[
                { value: "left", label: t("alignLeft"), icon: "align-left" },
                { value: "center", label: t("alignCenter"), icon: "align-center" },
                { value: "right", label: t("alignRight"), icon: "align-right" },
              ]}
            />
          </Field>

          <Field label={t("color")}>
            <ColorField value={el.fill} onValueChange={(fill) => set({ fill })} hexLabel={t("color")} />
          </Field>
        </>
      )}

      {(el.type === "rect" || el.type === "circle") && (
        <>
          <Field label={t("fill")}>
            <ColorField value={el.fill} onValueChange={(fill) => set({ fill })} hexLabel={t("fill")} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("strokeWidth")}>
              <NumberInput
                min={0}
                step={0.25}
                inputSize="sm"
                value={el.strokeWidth}
                onChange={(event) => set({ strokeWidth: Math.max(0, Number(event.target.value) || 0) })}
              />
            </Field>
            {el.type === "rect" && (
              <Field label={t("cornerRadius")}>
                <NumberInput
                  min={0}
                  inputSize="sm"
                  value={el.cornerRadius}
                  onChange={(event) => set({ cornerRadius: Math.max(0, Number(event.target.value) || 0) })}
                />
              </Field>
            )}
          </div>
          {el.strokeWidth > 0 && (
            <Field label={t("stroke")}>
              <ColorField value={el.stroke} onValueChange={(stroke) => set({ stroke })} hexLabel={t("stroke")} />
            </Field>
          )}
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label={t("x")}>
          <NumberInput
            inputSize="sm"
            value={Math.round(el.x * 10) / 10}
            onChange={(event) => set({ x: Number(event.target.value) || 0 })}
          />
        </Field>
        <Field label={t("y")}>
          <NumberInput
            inputSize="sm"
            value={Math.round(el.y * 10) / 10}
            onChange={(event) => set({ y: Number(event.target.value) || 0 })}
          />
        </Field>
        <Field label={t("rotation")}>
          <NumberInput
            inputSize="sm"
            value={Math.round(el.rotation)}
            onChange={(event) => set({ rotation: Number(event.target.value) || 0 })}
          />
        </Field>
        <Field label={t("opacity", { percent: Math.round(el.opacity * 100) })}>
          <Slider
            value={[el.opacity]}
            min={0.05}
            max={1}
            step={0.05}
            onValueChange={([opacity]) => set({ opacity })}
            valueText={`${formatNumber(Math.round(el.opacity * 100), locale)} %`}
          />
        </Field>
      </div>

      <Field label={t("layer")}>
        <div className="grid grid-cols-4 gap-1">
          {(
            [
              ["top", t("layerTop"), "layer-top"],
              ["up", t("layerUp"), "layer-up"],
              ["down", t("layerDown"), "layer-down"],
              ["bottom", t("layerBottom"), "layer-bottom"],
            ] as const
          ).map(([direction, label]) => (
            <button
              key={direction}
              type="button"
              onClick={() => reorder(el.id, direction)}
              className="border-border hover:bg-surface-subtle rounded-md border py-1 text-xs"
            >
              {label}
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

export function ViewPanel() {
  const t = useTranslations("designer.view");
  const { showLabels, showSafeZone, toggle } = useEditor();

  return (
    <div className="space-y-4 text-sm">
      <h3 className="font-semibold">{t("heading")}</h3>
      <Checkbox label={t("showLabels")} checked={showLabels} onCheckedChange={() => toggle("showLabels")} />
      <Checkbox label={t("showSafeZone")} checked={showSafeZone} onCheckedChange={() => toggle("showSafeZone")} />

      <div className="bg-surface-subtle text-muted rounded-lg p-3 text-xs leading-relaxed">
        <p className="text-fg mb-1 font-medium">{t("shortcutsHeading")}</p>
        <p>{t("shortcutPan")}</p>
        <p className="mt-1 flex flex-wrap items-center gap-1">
          <Kbd>Delete</Kbd>
          <Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd>
          <Kbd>Ctrl</Kbd>+<Kbd>D</Kbd>
          <span className="ms-1">{t("shortcutKeys")}</span>
        </p>
      </div>
    </div>
  );
}
