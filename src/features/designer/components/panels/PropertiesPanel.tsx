"use client";

import { useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { allFaces } from "@packio/dieline";

import { formatNumber } from "@/i18n/format";
import { Callout } from "@/ui/components/Callout";
import { ColorField } from "@/ui/components/ColorField";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Select } from "@/ui/components/Select";
import { Slider } from "@/ui/components/Slider";
import { toast } from "@/ui/components/Toast";

import { FONT_FAMILIES } from "../../catalog";
import { MIN_TEXT_MM } from "../../lib/checks";
import { isValidEan13, qrMatrix } from "../../lib/codes";
import { outOfPrintGamut } from "../../lib/colour";
import { newImage } from "../../lib/create";
import { useFaceNames } from "../../lib/useFaceNames";
import { useEditor } from "../../store/editor";
import type { DesignElement, ImageElement } from "../../types";
import { useDesigner } from "../DesignerContext";
import { useSwatches } from "./swatches";

const WHOLE_SHEET = "__sheet";
const round1 = (n: number) => Math.round(n * 10) / 10;
const num = (value: string, min = -Infinity) => Math.max(min, Number(value) || 0);

/** The colours an element prints in — for the on-screen-only colour warning. */
function coloursOf(el: DesignElement): string[] {
  if (el.type === "text") return [el.fill];
  if (el.type === "code") return [el.fill, el.background];
  if (el.type === "image") return [];
  return el.strokeWidth > 0 ? [el.fill, el.stroke] : [el.fill];
}

/** One selected element: every property as a field, the canvas's gestures as numbers. */
export function PropertiesPanel({ el }: { el: DesignElement }) {
  const t = useTranslations("designer.properties");
  const locale = useLocale() as "th" | "en";
  const { dieline, catalog } = useDesigner();
  const { updateElement, removeElement, duplicateElement, reorder, setLocked } = useEditor.getState();
  const swatches = useSwatches();
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<DesignElement>) => updateElement(el.id, patch);
  const locked = el.locked === true;
  const fonts = [...new Set([...(catalog?.fonts.map((f) => f.family) ?? []), ...FONT_FAMILIES])];
  const faces = dieline ? allFaces(dieline) : [];
  const names = useFaceNames(dieline);
  const dull = coloursOf(el).some(outOfPrintGamut);

  const colour = (label: string, value: string, onValueChange: (hex: string) => void) => (
    <Field label={label}>
      <ColorField value={value} onValueChange={onValueChange} hexLabel={label} swatches={swatches} disabled={locked} />
    </Field>
  );

  const replaceImage = async (file: File | undefined) => {
    if (!file || el.type !== "image") return;
    try {
      const next = (await newImage({ x: 0, y: 0 }, file)) as Omit<ImageElement, "id">;
      set({
        src: next.src,
        assetId: undefined,
        naturalWidth: next.naturalWidth,
        naturalHeight: next.naturalHeight,
        crop: undefined,
        height: (el.width * next.height) / next.width,
      } as Partial<ImageElement>);
    } catch (error) {
      toast.error(error instanceof Error && error.message === "too_large" ? t("imageTooLarge") : t("imageUnreadable"));
    }
  };

  /** Crops by insets (%), keeping the shown width and the cropped part's proportions. */
  const setCrop = (side: "left" | "right" | "top" | "bottom", percent: number) => {
    if (el.type !== "image") return;
    const c = el.crop ?? { x: 0, y: 0, width: 1, height: 1 };
    const inset = { left: c.x, top: c.y, right: 1 - c.x - c.width, bottom: 1 - c.y - c.height, [side]: percent / 100 };
    const width = Math.max(0.05, 1 - inset.left - inset.right);
    const height = Math.max(0.05, 1 - inset.top - inset.bottom);
    const crop = { x: inset.left, y: inset.top, width, height };
    const ratio =
      el.naturalWidth && el.naturalHeight
        ? (height * el.naturalHeight) / (width * el.naturalWidth)
        : el.height / el.width;
    set({ crop, height: el.width * ratio } as Partial<ImageElement>);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{t(`title.${el.type === "code" ? el.kind : el.type}`)}</h3>
        <div className="flex gap-1">
          <IconButton
            name="lock"
            label={locked ? t("unlock") : t("lock")}
            aria-pressed={locked}
            size="sm"
            variant={locked ? "secondary" : "ghost"}
            onClick={() => setLocked([el.id], !locked)}
          />
          <IconButton
            name="copy"
            label={t("duplicate")}
            size="sm"
            variant="ghost"
            onClick={() => duplicateElement(el.id)}
          />
          <IconButton
            name="trash"
            label={t("remove")}
            size="sm"
            variant="ghost"
            className="text-danger"
            disabled={locked}
            onClick={() => removeElement(el.id)}
          />
        </div>
      </div>

      {locked ? <Callout tone="info" title={t("lockedHint")} /> : null}

      <Field label={t("name")}>
        <Input
          inputSize="sm"
          value={el.name ?? ""}
          placeholder={t("namePlaceholder")}
          onChange={(event) => set({ name: event.target.value || undefined })}
        />
      </Field>

      {el.type === "text" && (
        <>
          <Field label={t("textContent")}>
            <Textarea
              rows={3}
              value={el.text}
              disabled={locked}
              onChange={(event) => set({ text: event.target.value })}
            />
          </Field>
          <Field label={t("font")}>
            <Select
              value={el.fontFamily}
              disabled={locked}
              onValueChange={(fontFamily) => set({ fontFamily })}
              options={fonts.map((family) => ({
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
                unit={t("mm")}
                value={el.fontSize}
                disabled={locked}
                onChange={(event) => set({ fontSize: num(event.target.value, 1) })}
              />
            </Field>
            <Field label={t("fontStyle")}>
              <Select
                value={el.fontStyle}
                disabled={locked}
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
          {el.fontSize * el.scaleY < MIN_TEXT_MM && <Callout tone="warning" title={t("tooSmall")} />}
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
          {colour(t("color"), el.fill, (fill) => set({ fill }))}
        </>
      )}

      {(el.type === "rect" || el.type === "circle" || el.type === "shape") && (
        <>
          {colour(t("fill"), el.fill, (fill) => set({ fill }))}
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("strokeWidth")}>
              <NumberInput
                min={0}
                step={0.25}
                inputSize="sm"
                value={el.strokeWidth}
                disabled={locked}
                onChange={(event) => set({ strokeWidth: num(event.target.value, 0) })}
              />
            </Field>
            {el.type === "rect" && (
              <Field label={t("cornerRadius")}>
                <NumberInput
                  min={0}
                  inputSize="sm"
                  value={el.cornerRadius}
                  disabled={locked}
                  onChange={(event) => set({ cornerRadius: num(event.target.value, 0) })}
                />
              </Field>
            )}
          </div>
          {el.strokeWidth > 0 && colour(t("stroke"), el.stroke, (stroke) => set({ stroke }))}
        </>
      )}

      {el.type === "code" && (
        <>
          <Field
            label={el.kind === "qr" ? t("qrValue") : t("eanValue")}
            error={
              (el.kind === "qr" ? qrMatrix(el.value) === null : !isValidEan13(el.value)) ? t("codeInvalid") : undefined
            }
          >
            <Input
              inputSize="sm"
              value={el.value}
              disabled={locked}
              onChange={(event) => set({ value: event.target.value.trim() })}
            />
          </Field>
          {colour(t("codeColour"), el.fill, (fill) => set({ fill }))}
          {colour(t("codeBackground"), el.background, (background) => set({ background }))}
          <p className="text-muted text-xs">{t("codeHint")}</p>
        </>
      )}

      {el.type === "image" && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            hidden
            onChange={(event) => {
              void replaceImage(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <div className="flex gap-2">
            <IconButton
              name="refresh"
              label={t("replaceImage")}
              size="sm"
              variant="secondary"
              disabled={locked}
              onClick={() => fileRef.current?.click()}
            />
            <IconButton
              name="reset"
              label={t("resetCrop")}
              size="sm"
              variant="ghost"
              disabled={locked || !el.crop}
              onClick={() =>
                set({
                  crop: undefined,
                  height:
                    el.naturalWidth && el.naturalHeight ? (el.width * el.naturalHeight) / el.naturalWidth : el.height,
                } as Partial<ImageElement>)
              }
            />
          </div>
          <fieldset className="grid grid-cols-2 gap-2" disabled={locked}>
            <legend className="mb-1 text-sm font-medium">{t("crop")}</legend>
            {(["left", "right", "top", "bottom"] as const).map((side) => {
              const c = el.crop ?? { x: 0, y: 0, width: 1, height: 1 };
              const value = { left: c.x, top: c.y, right: 1 - c.x - c.width, bottom: 1 - c.y - c.height }[side];
              return (
                <Field key={side} label={t(`cropSide.${side}`)}>
                  <NumberInput
                    min={0}
                    max={90}
                    step={1}
                    unit="%"
                    inputSize="sm"
                    value={Math.round(value * 100)}
                    onChange={(event) => setCrop(side, Math.min(90, num(event.target.value, 0)))}
                  />
                </Field>
              );
            })}
          </fieldset>
        </>
      )}

      {dull ? (
        <Callout tone="warning" title={t("outOfGamut")}>
          {t("outOfGamutBody")}
        </Callout>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Field label={t("x")}>
          <NumberInput
            inputSize="sm"
            value={round1(el.x)}
            disabled={locked}
            onChange={(event) => set({ x: num(event.target.value) })}
          />
        </Field>
        <Field label={t("y")}>
          <NumberInput
            inputSize="sm"
            value={round1(el.y)}
            disabled={locked}
            onChange={(event) => set({ y: num(event.target.value) })}
          />
        </Field>
        {el.type !== "text" && (
          <>
            <Field label={t("width")}>
              <NumberInput
                inputSize="sm"
                min={1}
                value={round1(el.width * el.scaleX)}
                disabled={locked}
                onChange={(event) => set({ width: num(event.target.value, 1) / el.scaleX } as Partial<DesignElement>)}
              />
            </Field>
            <Field label={t("height")}>
              <NumberInput
                inputSize="sm"
                min={1}
                value={round1(el.height * el.scaleY)}
                disabled={locked}
                onChange={(event) => set({ height: num(event.target.value, 1) / el.scaleY } as Partial<DesignElement>)}
              />
            </Field>
          </>
        )}
        <Field label={t("rotation")}>
          <NumberInput
            inputSize="sm"
            value={Math.round(el.rotation)}
            disabled={locked}
            onChange={(event) => set({ rotation: num(event.target.value) })}
          />
        </Field>
        <Field label={t("opacity", { percent: Math.round(el.opacity * 100) })}>
          <Slider
            value={[el.opacity]}
            min={0.05}
            max={1}
            step={0.05}
            disabled={locked}
            onValueChange={([opacity]) => set({ opacity })}
            valueText={`${formatNumber(Math.round(el.opacity * 100), locale)} %`}
          />
        </Field>
      </div>

      {faces.length > 1 ? (
        <Field label={t("clip")} hint={t("clipHint")}>
          <Select
            value={el.clipFaceId ?? WHOLE_SHEET}
            disabled={locked}
            onValueChange={(value) => set({ clipFaceId: value === WHOLE_SHEET ? undefined : value })}
            options={[
              { value: WHOLE_SHEET, label: t("clipSheet") },
              ...faces.map((f) => ({ value: f.id, label: names.get(f.id) ?? f.label })),
            ]}
          />
        </Field>
      ) : null}

      <Field label={t("layer")}>
        <div className="grid grid-cols-4 gap-1">
          {(
            [
              ["top", t("layerTop"), "layer-top"],
              ["up", t("layerUp"), "layer-up"],
              ["down", t("layerDown"), "layer-down"],
              ["bottom", t("layerBottom"), "layer-bottom"],
            ] as const
          ).map(([direction, label, icon]) => (
            <IconButton
              key={direction}
              name={icon}
              label={label}
              size="sm"
              variant="ghost"
              onClick={() => reorder(el.id, direction)}
            />
          ))}
        </div>
      </Field>
    </div>
  );
}
