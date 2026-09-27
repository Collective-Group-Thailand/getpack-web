"use client";

import { useTranslations } from "next-intl";

import { PATTERN_OPTIONS } from "../../patterns";
import { useEditor } from "../../store/editor";
import { ColorField } from "@/ui/components/ColorField";
import { Field } from "@/ui/components/Field";
import { Slider } from "@/ui/components/Slider";
import { cn } from "@/ui/lib/cn";

import { useSwatches } from "./swatches";

/** The sheet's background: a solid colour or a repeating pattern under all artwork. */
export function BackgroundPanel() {
  const t = useTranslations("designer.pattern");
  const pattern = useEditor((s) => s.content.pattern);
  const setPattern = useEditor((s) => s.setPattern);
  const swatches = useSwatches();

  return (
    <div className="space-y-4">
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
              swatches={swatches}
            />
          </Field>
          {pattern.kind !== "solid" && (
            <>
              <Field label={t("background")}>
                <ColorField
                  value={pattern.background}
                  onValueChange={(background) => setPattern({ background })}
                  hexLabel={t("hexLabel")}
                  swatches={swatches}
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
