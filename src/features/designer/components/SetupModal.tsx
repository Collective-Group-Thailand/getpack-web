"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { BOX_STYLES, dimsFromProduct, getPaper, getStyle, papersFor } from "@/features/designer/catalog";
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

function SetupForm({ initial, onConfirm, onClose, hasContent }: SetupProps) {
  const t = useTranslations("designer.setup");
  const tCommon = useTranslations("common");

  const [style, setStyle] = useState<BoxStyleId>(initial?.style ?? "rsc");
  const [mode, setMode] = useState<SizeMode>(initial ? "custom" : "preset");
  const [presetIndex, setPresetIndex] = useState(0);
  const [product, setProduct] = useState<BoxDims>(
    initial?.productDims ?? initial?.dims ?? { length: 200, width: 150, height: 100 },
  );
  const [paperId, setPaperId] = useState(initial?.paperId ?? papersFor("rsc")[0].id);
  const [resizeWarningOpen, setResizeWarningOpen] = useState(false);

  const styleDef = getStyle(style);
  const papers = papersFor(style);
  const paper = papers.find((candidate) => candidate.id === paperId) ?? papers[0];

  /*
   * Computed straight, with no useMemo. It is a lookup and three additions, and the React
   * Compiler could not preserve the hand-written memoisation that used to be here — which
   * made it skip optimising this component altogether (the warning F0.1 recorded for F0.2).
   * The compiler now memoises it correctly on its own.
   */
  const dims: BoxDims =
    mode === "preset"
      ? (styleDef.presets[presetIndex]?.dims ?? styleDef.presets[0].dims)
      : dimsFromProduct(product, paper.thickness);

  const DIM_FIELDS: { key: keyof BoxDims; label: string }[] = [
    { key: "length", label: t("productLength") },
    { key: "width", label: t("productWidth") },
    { key: "height", label: t("productHeight") },
  ];

  const errors =
    mode === "custom"
      ? DIM_FIELDS.filter(({ key }) => !(dims[key] >= styleDef.limits.min && dims[key] <= styleDef.limits.max)).map(
          ({ label }) => t("outOfRange", { label, min: styleDef.limits.min, max: styleDef.limits.max }),
        )
      : [];

  const changeStyle = (next: BoxStyleId) => {
    setStyle(next);
    setPresetIndex(0);
    const nextPapers = papersFor(next);
    if (!nextPapers.some((candidate) => candidate.id === paperId)) setPaperId(nextPapers[0].id);
  };

  const commit = () => {
    onConfirm({ style, dims, paperId: paper.id, productDims: mode === "custom" ? product : undefined });
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

  return (
    <>
      <div className="grid gap-6 md:grid-cols-[1fr_260px]">
        <div className="space-y-5">
          <Field label={t("styleHeading")}>
            <RadioCards
              value={style}
              onValueChange={(next) => changeStyle(next as BoxStyleId)}
              options={BOX_STYLES.map((option) => ({
                value: option.id,
                label: option.name,
                description: option.description,
              }))}
            />
          </Field>

          <Field label={t("sizeHeading")}>
            <div className="space-y-3">
              <SegmentedControl
                label={t("modeLabel")}
                value={mode}
                onValueChange={(next) => setMode(next as SizeMode)}
                options={[
                  { value: "preset", label: t("modePreset") },
                  { value: "custom", label: t("modeCustom") },
                ]}
              />

              {mode === "preset" ? (
                <Field label={t("presetLabel")} labelHidden>
                  <Select
                    value={String(presetIndex)}
                    onValueChange={(value) => setPresetIndex(Number(value))}
                    options={styleDef.presets.map((preset, index) => ({
                      value: String(index),
                      label: t("presetOption", { label: preset.label }),
                    }))}
                  />
                </Field>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {DIM_FIELDS.map(({ key, label }) => (
                      <Field key={key} label={label}>
                        <NumberInput
                          min={1}
                          step={0.5}
                          unit="มม."
                          inputSize="sm"
                          value={product[key]}
                          onChange={(event) => setProduct({ ...product, [key]: Number(event.target.value) || 0 })}
                        />
                      </Field>
                    ))}
                  </div>
                  <p className="text-muted text-xs">
                    {t("allowanceNote", { length: dims.length, width: dims.width, height: dims.height })}
                  </p>
                  {errors.map((error) => (
                    <Callout key={error} tone="danger" title={error} live />
                  ))}
                </>
              )}
            </div>
          </Field>

          <Field label={t("materialHeading")}>
            <Select
              value={paper.id}
              onValueChange={setPaperId}
              options={papers.map((option) => ({
                value: option.id,
                label: option.printable
                  ? t("materialOption", { name: option.name, thickness: option.thickness })
                  : t("materialOptionNoPrint", { name: option.name, thickness: option.thickness }),
              }))}
            />
            {!getPaper(paper.id).printable ? <Callout tone="warning" title={t("flexoOnly")} className="mt-2" /> : null}
          </Field>
        </div>

        <aside className="bg-surface-subtle flex flex-col rounded-xl p-3">
          <div className="aspect-square w-full">
            <BoxPreview style={style} dims={dims} paper={paper.id} />
          </div>
          {/* A <dl> may only hold dt/dd pairs (wrapped in a div at most) — the line legend
                below is not a definition, so it sits outside. axe in a real browser caught
                this; jsdom could not, because the component tests render fragments. */}
          <dl className="text-muted mt-3 text-xs">
            <div className="flex justify-between gap-2">
              <dt>{t("innerSize")}</dt>
              <dd className="tabular-nums">
                {dims.length} × {dims.width} × {dims.height}
              </dd>
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
