"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";

import { newImage } from "../../lib/create";
import { PATTERN_OPTIONS } from "../../patterns";
import { useEditor } from "../../store/editor";
import type { ImageElement } from "../../types";
import { Button } from "@/ui/components/Button";
import { ColorField } from "@/ui/components/ColorField";
import { Field } from "@/ui/components/Field";
import { Slider } from "@/ui/components/Slider";
import { toast } from "@/ui/components/Toast";
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

      {pattern.kind === "image" ? <WrapImageField /> : null}

      {pattern.kind !== "none" && pattern.kind !== "image" && (
        <>
          <Field label={t("color")}>
            <ColorField
              value={pattern.color}
              onValueChange={(color) => setPattern({ color })}
              hexLabel={t("hexLabel")}
              swatches={swatches}
            />
          </Field>
          {pattern.kind === "gradient" ? (
            <>
              <Field label={t("gradientTo")}>
                <ColorField
                  value={pattern.background}
                  onValueChange={(background) => setPattern({ background })}
                  hexLabel={t("hexLabel")}
                  swatches={swatches}
                />
              </Field>
              <Field label={t("angle", { angle: pattern.angle ?? 90 })}>
                <Slider
                  value={[pattern.angle ?? 90]}
                  min={0}
                  max={359}
                  onValueChange={([angle]) => setPattern({ angle })}
                  valueText={`${pattern.angle ?? 90}°`}
                />
              </Field>
            </>
          ) : null}
          {pattern.kind !== "solid" && pattern.kind !== "gradient" && (
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

/** The full-wrap picture (U4.4): one image over the whole sheet and its bleed; kept as a design asset. */
function WrapImageField() {
  const t = useTranslations("designer.pattern");
  const image = useEditor((s) => s.content.pattern.image);
  const setPattern = useEditor((s) => s.setPattern);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <p className="text-muted text-xs">{t("wrapHint")}</p>
      {image ? (
        // A data URL or the asset's signed URL: next/image cannot optimise either.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.src} alt={t("wrapAlt")} className="border-border h-24 w-full rounded-md border object-cover" />
      ) : null}
      <Button size="sm" variant="secondary" iconStart="upload" onClick={() => fileRef.current?.click()}>
        {image ? t("wrapReplace") : t("wrapUpload")}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          try {
            const read = (await newImage({ x: 0, y: 0 }, file)) as ImageElement;
            setPattern({
              kind: "image",
              image: { src: read.src, naturalWidth: read.naturalWidth ?? 1, naturalHeight: read.naturalHeight ?? 1 },
            });
          } catch {
            toast.error(t("wrapFailed"));
          }
        }}
      />
    </div>
  );
}
