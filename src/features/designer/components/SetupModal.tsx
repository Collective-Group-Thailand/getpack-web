"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  getStyle,
  SPEC_VERSION,
  STYLES,
  stylesByCategory,
  type BoxCategory,
  type BoxStyleDef,
  type ParamValues,
} from "@packio/dieline";

import { boardColour, dimsFromProduct, getPaper, papersFor } from "@/features/designer/catalog";
import { insideSize } from "@/features/designer/document";
import type { BoxDims, BoxStyleId, DesignSpec } from "@/features/designer/types";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { NumberInput } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Select } from "@/ui/components/Select";
import { CANVAS_COLORS } from "@/features/designer/canvas-colors";

import { BoxPreview } from "./BoxPreview";
import { StyleParams } from "./StyleParams";

type SizeMode = "preset" | "custom";

interface SetupProps {
  open: boolean;
  initial: DesignSpec | null;
  onConfirm: (spec: DesignSpec) => void;
  onClose?: () => void;
  hasContent: boolean;
}

/**
 * The box setup dialog.
 *
 * The form's state lives in `SetupForm`, which Radix mounts only while the dialog is open, so
 * abandoned edits reset on the next open with no effect and no remount. BoxStudio forced a
 * remount with a `key` instead, which unmounted Radix's focus scope and meant focus never
 * returned to the button that opened the dialog.
 */
export function SetupModal({ open, initial, onConfirm, onClose, hasContent }: SetupProps) {
  const t = useTranslations("designer.setup");
  const tCommon = useTranslations("common");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose?.()}
      title={t("title")}
      size="lg"
      closeLabel={onClose ? tCommon("actions.close") : undefined}
    >
      <SetupForm open={open} initial={initial} onConfirm={onConfirm} onClose={onClose} hasContent={hasContent} />
    </Dialog>
  );
}

const sizeKeys = (style: BoxStyleDef) => style.params.filter((p) => p.group === "size").map((p) => p.key);
/** A box sized by length × width × height, which can also be sized from the product it holds. */
const isBox = (style: BoxStyleDef) => ["length", "width", "height"].every((k) => sizeKeys(style).includes(k));
const pick = (values: ParamValues, keys: string[], keep: boolean) =>
  Object.fromEntries(Object.entries(values).filter(([k]) => keys.includes(k) === keep));

function SetupForm({ initial, onConfirm, onClose, hasContent }: SetupProps) {
  const t = useTranslations("designer.setup");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "th" | "en";

  const initialStyle = initial?.styleId ?? "rsc";
  const [category, setCategory] = useState<BoxCategory>(getStyle(initialStyle).category);
  const [style, setStyle] = useState<BoxStyleId>(initialStyle);
  const [mode, setMode] = useState<SizeMode>(initial ? "custom" : "preset");
  const [presetIndex, setPresetIndex] = useState(0);
  const [product, setProduct] = useState<BoxDims>(
    initial?.productDims ??
      (initial && isBox(getStyle(initialStyle)) ? insideSize(initial) : { length: 200, width: 150, height: 100 }),
  );
  const [sizeValues, setSizeValues] = useState<ParamValues>(
    initial ? pick(initial.values, sizeKeys(getStyle(initialStyle)), true) : {},
  );
  const [options, setOptions] = useState<ParamValues>(
    initial ? pick(initial.values, sizeKeys(getStyle(initialStyle)), false) : {},
  );
  const [paperId, setPaperId] = useState(initial?.materialId ?? papersFor(initialStyle)[0].id);
  const [resizeWarningOpen, setResizeWarningOpen] = useState(false);

  const styleDef = getStyle(style);
  const box = isBox(styleDef);
  const papers = papersFor(style);
  const paper = papers.find((candidate) => candidate.id === paperId) ?? papers[0];
  const preset = styleDef.presets[presetIndex] ?? styleDef.presets[0];

  const size: ParamValues =
    mode === "preset"
      ? pick(preset.values, sizeKeys(styleDef), true)
      : box
        ? { ...dimsFromProduct(product) }
        : sizeValues;
  // Presets may also set a construction choice (a full-depth lid, a pouch type).
  const values: ParamValues = {
    ...(mode === "preset" ? pick(preset.values, sizeKeys(styleDef), false) : {}),
    ...options,
    ...size,
  };
  // The engine's rules, in the customer's language — the same ones the drawing service applies.
  const issues = styleDef.validate(values, paper.material);
  const blocking = issues.filter((issue) => issue.severity === "error");
  const errors = blocking.map((issue) => issue.message[locale]);

  const DIM_FIELDS: { key: keyof BoxDims; label: string }[] = [
    { key: "length", label: t("productLength") },
    { key: "width", label: t("productWidth") },
    { key: "height", label: t("productHeight") },
  ];

  const changeStyle = (next: BoxStyleId) => {
    const nextDef = getStyle(next);
    setStyle(next);
    setPresetIndex(0);
    setOptions({});
    setSizeValues(pick(nextDef.presets[0].values, sizeKeys(nextDef), true));
    const nextPapers = papersFor(next);
    if (!nextPapers.some((candidate) => candidate.id === paperId)) setPaperId(nextPapers[0].id);
  };

  const changeCategory = (next: BoxCategory) => {
    setCategory(next);
    const first = STYLES.find((candidate) => candidate.category === next);
    if (first && getStyle(style).category !== next) changeStyle(first.id);
  };

  const commit = () => {
    onConfirm({
      specVersion: SPEC_VERSION,
      styleId: style,
      values,
      material: paper.material,
      materialId: paper.id,
      productDims: mode === "custom" && box ? product : undefined,
    });
  };

  const submit = () => {
    if (errors.length) return;
    // Changing the box under existing artwork moves every element relative to the sheet, so
    // it is a decision, not a side effect (design-system.md §4).
    if (hasContent && initial) {
      setResizeWarningOpen(true);
      return;
    }
    commit();
  };

  const sizeText = sizeKeys(styleDef)
    .map((k) => values[k])
    .filter((v) => typeof v === "number")
    .join(" × ");

  return (
    <>
      <div className="grid gap-6 md:grid-cols-[1fr_260px]">
        <div className="space-y-5">
          <Field label={t("styleHeading")}>
            <div className="space-y-3">
              <SegmentedControl
                label={t("categoryLabel")}
                size="sm"
                value={category}
                onValueChange={(next) => changeCategory(next as BoxCategory)}
                options={stylesByCategory().map((group) => ({
                  value: group.category,
                  label: t(`categories.${group.category}`),
                }))}
              />
              <RadioCards
                value={style}
                columns={2}
                onValueChange={(next) => changeStyle(next as BoxStyleId)}
                options={STYLES.filter((option) => option.category === category).map((option) => ({
                  value: option.id,
                  label: option.name[locale],
                  description: option.description[locale],
                  visual: (
                    <span className="block h-16 w-16 shrink-0" aria-hidden="true">
                      <BoxPreview styleId={option.id} values={option.presets[0].values} />
                    </span>
                  ),
                }))}
              />
            </div>
          </Field>

          <Field label={t("sizeHeading")}>
            <div className="space-y-3">
              <SegmentedControl
                label={t("modeLabel")}
                value={mode}
                onValueChange={(next) => setMode(next as SizeMode)}
                options={[
                  { value: "preset", label: t("modePreset") },
                  { value: "custom", label: box ? t("modeCustom") : t("modeCustomDirect") },
                ]}
              />

              {mode === "preset" ? (
                <Field label={t("presetLabel")} labelHidden>
                  <Select
                    value={String(presetIndex)}
                    onValueChange={(value) => setPresetIndex(Number(value))}
                    options={styleDef.presets.map((option, index) => ({
                      value: String(index),
                      label: t("presetOption", { label: option.label[locale] }),
                    }))}
                  />
                </Field>
              ) : box ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {DIM_FIELDS.map(({ key, label }) => (
                      <Field key={key} label={label}>
                        <NumberInput
                          min={1}
                          step={0.5}
                          unit={t("unitMm")}
                          inputSize="sm"
                          value={product[key]}
                          onChange={(event) => setProduct({ ...product, [key]: Number(event.target.value) || 0 })}
                        />
                      </Field>
                    ))}
                  </div>
                  <p className="text-muted text-xs">{t("allowanceNote", { ...dimsFromProduct(product) })}</p>
                </>
              ) : (
                <StyleParams
                  style={styleDef}
                  values={sizeValues}
                  onChange={setSizeValues}
                  issues={issues}
                  groups={["size"]}
                />
              )}
              {errors.map((error) => (
                <Callout key={error} tone="danger" title={error} live />
              ))}
            </div>
          </Field>

          <Field label={t("materialHeading")}>
            <Select
              value={paper.id}
              onValueChange={setPaperId}
              options={papers.map((option) => ({
                value: option.id,
                label: option.printable
                  ? t("materialOption", { name: option.name, thickness: option.material.caliperMm })
                  : t("materialOptionNoPrint", { name: option.name, thickness: option.material.caliperMm }),
              }))}
            />
            {!getPaper(paper.id)?.printable ? <Callout tone="warning" title={t("flexoOnly")} className="mt-2" /> : null}
          </Field>

          {styleDef.params.some((p) => p.group !== "size") ? (
            <details className="border-border rounded-xl border">
              <summary className="focus-visible:ring-focus-ring cursor-pointer rounded-xl px-4 py-3 font-medium outline-none focus-visible:ring-2">
                {t("moreOptions")}
              </summary>
              <div className="px-4 pb-4">
                <StyleParams
                  style={styleDef}
                  values={options}
                  onChange={setOptions}
                  issues={issues}
                  groups={["construction", "closure", "options", "window"]}
                />
              </div>
            </details>
          ) : null}
        </div>

        <aside className="bg-surface-subtle flex flex-col rounded-xl p-3">
          <div className="aspect-square w-full">
            {errors.length === 0 ? (
              <BoxPreview
                styleId={style}
                values={values}
                material={paper.material}
                colour={boardColour({ materialId: paper.id, material: paper.material })}
              />
            ) : null}
          </div>
          {/* A <dl> may only hold dt/dd pairs (wrapped in a div at most) — the line legend
                below is not a definition, so it sits outside. axe in a real browser caught
                this; jsdom could not, because the component tests render fragments. */}
          <dl className="text-muted mt-3 text-xs">
            <div className="flex justify-between gap-2">
              <dt>{box ? t("innerSize") : t("size")}</dt>
              <dd className="tabular-nums">{sizeText}</dd>
            </div>
          </dl>
          <p className="text-muted mt-2 flex gap-3 text-xs">
            <span className="flex items-center gap-1">
              <i className="inline-block h-0.5 w-4" style={{ backgroundColor: CANVAS_COLORS.cut }} />
              {t("cutLine")}
            </span>
            <span className="flex items-center gap-1">
              <i className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: CANVAS_COLORS.fold }} />
              {t("foldLine")}
            </span>
          </p>
        </aside>
      </div>

      {/* Sticky rather than a Dialog footer prop, so the actions stay reachable while the
          form scrolls on a phone, and stay inside the component that owns the form state. */}
      <div className="border-border bg-surface-raised sticky bottom-0 -mx-5 mt-4 -mb-4 flex flex-wrap justify-end gap-2 border-t px-5 py-3">
        {onClose ? (
          <Button variant="secondary" onClick={onClose}>
            {tCommon("actions.cancel")}
          </Button>
        ) : null}
        <Button onClick={submit} disabled={errors.length > 0}>
          {initial ? t("submitUpdate") : t("submitNew")}
        </Button>
      </div>

      <AlertDialog
        open={resizeWarningOpen}
        onOpenChange={setResizeWarningOpen}
        title={t("resizeWarning.title")}
        description={t("resizeWarning.body")}
        confirmLabel={t("resizeWarning.confirm")}
        cancelLabel={tCommon("actions.cancel")}
        onConfirm={() => {
          setResizeWarningOpen(false);
          commit();
        }}
      />
    </>
  );
}
