"use client";

import { useTranslations } from "next-intl";

import { DimensionInput, fromMm, type LengthUnit } from "@/ui/components/DimensionInput";
import { Field } from "@/ui/components/Field";
import { RadioCards } from "@/ui/components/RadioCards";
import { SegmentedControl } from "@/ui/components/SegmentedControl";

import {
  axesOf,
  patternOf,
  sizeProblems,
  type Axis,
  type Configurator,
  type ConfiguratorState,
  type SizeProblem,
} from "./state";

interface StepProps {
  configurator: Configurator;
  state: ConfiguratorState;
  onChange: (patch: Partial<ConfiguratorState>) => void;
}

/** Which side is which, drawn once — the letters come from the messages, not the drawing. */
function BoxDiagram({ labels }: { labels: Record<"l" | "w" | "d", string> }) {
  return (
    <svg
      viewBox="0 0 160 120"
      role="img"
      aria-label={`${labels.l} × ${labels.w} × ${labels.d}`}
      className="h-28 w-full"
    >
      <g fill="none" stroke="currentColor" strokeWidth={1.5} className="text-muted" strokeLinejoin="round">
        <path d="M30 45 L90 45 L120 25 L60 25 Z" />
        <path d="M30 45 L30 95 L90 95 L90 45" />
        <path d="M90 95 L120 75 L120 25" />
      </g>
      <g className="fill-fg text-[11px]" fontFamily="inherit">
        <text x="60" y="110" textAnchor="middle">
          {labels.l}
        </text>
        <text x="112" y="95" textAnchor="start">
          {labels.w}
        </text>
        <text x="20" y="72" textAnchor="end">
          {labels.d}
        </text>
      </g>
      <g stroke="currentColor" className="text-primary" strokeWidth={1.5}>
        <path d="M30 101 L90 101" />
        <path d="M95 99 L123 80" />
        <path d="M24 45 L24 95" />
      </g>
    </svg>
  );
}

export function SizeStep({ configurator, state, onChange }: StepProps) {
  const t = useTranslations("configurator.size");
  const { patterns, standardSizes, customAllowed, kind } = configurator.size;
  const pattern = patternOf(configurator, state);
  const sizes = standardSizes.filter((size) => size.patternId === null || size.patternId === pattern?.id);
  const problems = state.sizeMode === "custom" ? sizeProblems(configurator, state) : {};
  const unitLabels: Record<LengthUnit, string> = { mm: t("units.mm"), cm: t("units.cm"), in: t("units.in") };
  const axisLabels: Record<Axis, string> = { l: t("axes.l"), w: t("axes.w"), d: t("axes.d"), gusset: t("axes.gusset") };
  const show = (mm: number) => `${fromMm(mm, state.unit)} ${unitLabels[state.unit]}`;
  const dimsText = (l: number, w: number, d: number | null) =>
    [l, w, d]
      .filter((value): value is number => value !== null)
      .map((value) => fromMm(value, state.unit))
      .join(" × ") + ` ${unitLabels[state.unit]}`;

  const limits = (axis: Axis): [number | null, number | null] => {
    const rules = pattern?.rules;
    if (!rules) return [null, null];
    return {
      l: [rules.minLengthMm, rules.maxLengthMm] as [number | null, number | null],
      w: [rules.minWidthMm, rules.maxWidthMm] as [number | null, number | null],
      d: [rules.minHeightMm, rules.maxHeightMm] as [number | null, number | null],
      gusset: [rules.minGussetMm, rules.maxGussetMm] as [number | null, number | null],
    }[axis];
  };

  const message = (problem: SizeProblem | undefined) => {
    if (!problem) return undefined;
    switch (problem.code) {
      case "required":
        return t("errors.required");
      case "min":
        return t("errors.min", { limit: show(problem.limitMm) });
      case "max":
        return t("errors.max", { limit: show(problem.limitMm) });
      case "step":
        return t("errors.step", { step: show(problem.stepMm) });
      case "length_exceeds_width":
        return t("errors.lengthExceedsWidth");
      case "length_exceeds_height":
        return t("errors.lengthExceedsHeight");
      case "width_exceeds_height":
        return t("errors.widthExceedsHeight");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {patterns.length > 1 ? (
        <Field label={t("pattern")}>
          <RadioCards
            columns={2}
            value={pattern?.id}
            onValueChange={(patternId) => onChange({ patternId })}
            options={patterns.map((entry) => ({
              value: entry.id,
              label: entry.name,
              visual: entry.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- API image, decorative beside its name
                <img src={entry.imageUrl} alt="" className="h-16 w-full rounded-md object-contain" />
              ) : undefined,
            }))}
          />
        </Field>
      ) : null}

      {sizes.length > 0 && customAllowed ? (
        <SegmentedControl
          label={t("mode")}
          value={state.sizeMode}
          onValueChange={(sizeMode) => {
            const first = sizes[0];
            onChange(
              sizeMode === "standard" && first
                ? {
                    sizeMode,
                    standardSizeCode: state.standardSizeCode ?? first.code,
                    dims: {
                      l: first.lengthMm,
                      w: first.widthMm,
                      d: first.heightMm,
                      gusset: first.gussetMm,
                    },
                  }
                : { sizeMode },
            );
          }}
          options={[
            { value: "standard", label: t("standard") },
            { value: "custom", label: t("custom") },
          ]}
        />
      ) : null}

      {state.sizeMode === "standard" && sizes.length > 0 ? (
        <Field label={t("standardSizes")} hint={t("standardHint")}>
          <RadioCards
            columns={3}
            value={state.standardSizeCode ?? undefined}
            onValueChange={(code) => {
              const size = sizes.find((entry) => entry.code === code);
              if (!size) return;
              onChange({
                standardSizeCode: code,
                dims: { l: size.lengthMm, w: size.widthMm, d: size.heightMm, gusset: size.gussetMm },
              });
            }}
            options={sizes.map((size) => ({
              value: size.code,
              label: size.name,
              description: dimsText(size.lengthMm, size.widthMm, kind === "box" ? size.heightMm : null),
            }))}
          />
        </Field>
      ) : (
        <DimensionInput
          legend={kind === "box" ? t("customLegendBox") : t("customLegendFlat")}
          unit={state.unit}
          onUnitChange={(unit) => onChange({ unit })}
          unitLabels={unitLabels}
          unitToggleLabel={t("unitToggle")}
          diagram={
            kind === "box" ? <BoxDiagram labels={{ l: axisLabels.l, w: axisLabels.w, d: axisLabels.d }} /> : undefined
          }
          onChange={(axis, valueMm) =>
            onChange({ standardSizeCode: null, dims: { ...state.dims, [axis as Axis]: valueMm } })
          }
          axes={axesOf(kind).map((axis) => {
            const [min, max] = limits(axis);
            return {
              key: axis,
              label: axisLabels[axis],
              valueMm: state.dims[axis],
              hint: min !== null && max !== null ? t("range", { min: show(min), max: show(max) }) : undefined,
              error: message(problems[axis]),
            };
          })}
        />
      )}

      <p className="text-muted text-xs">{kind === "box" ? t("insideNote") : t("flatNote")}</p>
    </div>
  );
}
