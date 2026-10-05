"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { pick } from "@/features/customer/catalog/localize";
import { DimensionInput, fromMm, type LengthUnit } from "@/ui/components/DimensionInput";
import { Field } from "@/ui/components/Field";
import { RadioCards } from "@/ui/components/RadioCards";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Spinner } from "@/ui/components/Spinner";
import { GlossaryChip } from "@/features/customer/learn/GlossaryChip";
import { cn } from "@/ui/lib/cn";

import type { Converted } from "./conversion";
import { sizeKindOf, type MeasurementBasis } from "./model";
import {
  axesOf,
  isConverted,
  NO_DIMS,
  patternOf,
  sizeProblems,
  type Axis,
  type Configurator,
  type ConfiguratorState,
  type InternalSize,
  type SizeProblem,
} from "./state";

interface SizeStepProps {
  configurator: Configurator;
  state: ConfiguratorState;
  onChange: (patch: Partial<ConfiguratorState>) => void;
  /** The display unit changed — saved to the customer's profile when signed in (D-183). */
  onUnitChange: (unit: LengthUnit) => void;
  /** The bases this pattern is measured on (the API's, `usePatternBases`). */
  bases: MeasurementBasis[];
  /** The API's conversion of the entered size (`store.specs.convertDimensions`), boxes only. */
  conversion: {
    converted: Converted | null;
    internal: InternalSize;
    pending: boolean;
    problem: string | null;
    caliperUnknown: boolean;
  };
  /** The chosen material's name, for messages that depend on its caliper. */
  materialName: string | null;
}

const HIGHLIGHT = "text-primary";

/** Which side is which, with the side being edited highlighted — the letters come from the messages. */
function BoxDiagram({ labels, active }: { labels: Record<"l" | "w" | "d", string>; active: string | null }) {
  const tone = (axis: string) => (active === axis ? HIGHLIGHT : "text-muted");
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
      <g stroke="currentColor" strokeWidth={active ? 2.5 : 1.5} strokeLinecap="round">
        <path d="M30 101 L90 101" className={tone("l")} />
        <path d="M95 99 L123 80" className={tone("w")} />
        <path d="M24 45 L24 95" className={tone("d")} />
      </g>
      <g className="text-[11px]" fontFamily="inherit">
        <text x="60" y="114" textAnchor="middle" className={cn("fill-current", active === "l" ? HIGHLIGHT : "text-fg")}>
          {labels.l}
        </text>
        <text x="112" y="97" textAnchor="start" className={cn("fill-current", active === "w" ? HIGHLIGHT : "text-fg")}>
          {labels.w}
        </text>
        <text x="20" y="72" textAnchor="end" className={cn("fill-current", active === "d" ? HIGHLIGHT : "text-fg")}>
          {labels.d}
        </text>
      </g>
    </svg>
  );
}

/** A flat item or pouch: width across, height down, the gusset or seal as a band at the bottom. */
function FlatDiagram({
  labels,
  active,
  gusset,
}: {
  labels: Partial<Record<Axis, string>>;
  active: string | null;
  gusset: boolean;
}) {
  const tone = (axis: string) => (active === axis ? HIGHLIGHT : "text-muted");
  return (
    <svg viewBox="0 0 160 120" role="img" aria-label={Object.values(labels).join(" × ")} className="h-28 w-full">
      <rect
        x="45"
        y="15"
        width="70"
        height="85"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="text-muted"
      />
      {gusset ? (
        <path d="M45 88 L115 88" fill="none" stroke="currentColor" strokeDasharray="3 3" className={tone("b")} />
      ) : null}
      <g stroke="currentColor" strokeWidth={active ? 2.5 : 1.5} strokeLinecap="round">
        <path d="M45 108 L115 108" className={tone("w")} />
        <path d="M37 15 L37 100" className={tone("l")} />
      </g>
      <g className="text-[11px]" fontFamily="inherit">
        <text x="80" y="119" textAnchor="middle" className={cn("fill-current", active === "w" ? HIGHLIGHT : "text-fg")}>
          {labels.w}
        </text>
        <text x="31" y="60" textAnchor="end" className={cn("fill-current", active === "l" ? HIGHLIGHT : "text-fg")}>
          {labels.l}
        </text>
      </g>
    </svg>
  );
}

/**
 * The size, on the basis the customer chooses (U2.F1 §1, D-182, D-183).
 *
 * The pattern is shown with its public style code (D-184) and its international name only when
 * Prepress verified it (empty otherwise, D-211). A box is entered on the inside, the outside or
 * over the creases; the other two follow from the API's conversion with the material's caliper and
 * are shown live. The unit is display only — the size is held and sent in millimetres.
 */
export function SizeStep({
  configurator,
  state,
  onChange,
  onUnitChange,
  bases,
  conversion,
  materialName,
}: SizeStepProps) {
  const t = useTranslations("configurator.size");
  const locale = useLocale();
  const [active, setActive] = useState<string | null>(null);
  const kind = sizeKindOf(configurator);
  const pattern = patternOf(configurator, state);
  const sizes = kind === "box" ? configurator.standardSizes : [];
  const problems = state.sizeMode === "custom" ? sizeProblems(configurator, state, conversion.internal) : {};
  const unitLabels: Record<LengthUnit, string> = { mm: t("units.mm"), cm: t("units.cm"), in: t("units.in") };
  const axisLabels: Record<Axis, string> = {
    l: kind === "pouch" ? t("axes.height") : t("axes.l"),
    w: t("axes.w"),
    d: t("axes.d"),
    b: t("axes.b"),
    s: t("axes.s"),
    cs: t("axes.cs"),
  };
  // Display only: the API's sizes (e.g. 150.5 mm over the creases, a 0.4 mm caliper) keep their
  // tenths in millimetres; `fromMm` rounds an entry to whole millimetres.
  const inUnit = (mm: number) => (state.unit === "mm" ? String(Number(mm.toFixed(1))) : fromMm(mm, state.unit));
  const show = (mm: number) => `${inUnit(mm)} ${unitLabels[state.unit]}`;
  const dimsText = (size: { l: number; w: number; d: number }) =>
    [size.l, size.w, kind === "box" ? size.d : null]
      .filter((value): value is number => value !== null)
      .map(inUnit)
      .join(" × ") + ` ${unitLabels[state.unit]}`;
  const styleName = pattern?.name ?? "";
  const converted = isConverted(state.basis);

  const limits = (axis: Axis): [number | null, number | null] => {
    if (!pattern) return [null, null];
    const { rules, pouch } = pattern;
    return {
      l: [rules.minLMm, rules.maxLMm],
      w: [rules.minWMm, rules.maxWMm],
      d: [rules.minHMm, rules.maxHMm],
      b: [pouch?.minBMm ?? null, pouch?.maxBMm ?? null],
      s: [pouch?.minSMm ?? null, pouch?.maxSMm ?? null],
      cs: [pouch?.minCsMm ?? null, pouch?.maxCsMm ?? null],
    }[axis] as [number | null, number | null];
  };

  const message = (problem: SizeProblem | undefined) => {
    if (!problem) return undefined;
    switch (problem.code) {
      case "required":
        return t("errors.required");
      case "basis_required":
        return t("errors.basisRequired");
      case "min":
      case "max": {
        // The rules are the style's inside limits; a size entered on another basis is checked
        // through the API's conversion, and the message says what that inside size is.
        const params = { limit: show(problem.limitMm), style: styleName };
        const base = converted ? t(`errors.${problem.code}Inside`, params) : t(`errors.${problem.code}`, params);
        return problem.internalMm !== null
          ? `${base} ${t("errors.convertedTo", {
              size: show(problem.internalMm),
              material: materialName ?? t("errors.theMaterial"),
            })}`
          : base;
      }
      case "length_exceeds_width":
        return t("errors.lengthExceedsWidth", { style: styleName });
      case "length_exceeds_height":
        return t("errors.lengthExceedsHeight", { style: styleName });
      case "width_exceeds_height":
        return t("errors.widthExceedsHeight", { style: styleName });
    }
  };

  const rangeHint = (axis: Axis) => {
    const [min, max] = limits(axis);
    if (min === null || max === null) return undefined;
    const range = { min: show(min), max: show(max) };
    return converted ? t("rangeInside", range) : t("range", range);
  };

  const legend =
    kind === "box" && !state.flatStyle
      ? state.basis
        ? t(`legend.${state.basis}`)
        : t("legend.box")
      : kind === "pouch"
        ? t("legend.pouch")
        : t("legend.flat");

  return (
    <div className="flex flex-col gap-5">
      {configurator.patterns.length > 1 ? (
        <Field label={t("pattern")}>
          <RadioCards
            columns={2}
            value={pattern?.id}
            onValueChange={(patternId) => onChange({ patternId, advisory: null })}
            options={configurator.patterns.map((entry) => ({
              value: entry.id,
              label: entry.name,
              description:
                [entry.styleCode, entry.internationalName, pick(locale, entry.descriptionTh ?? "", entry.descriptionEn)]
                  .filter(Boolean)
                  .join(" · ") || undefined,
              visual: entry.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- API image, decorative beside its name
                <img src={entry.imageUrl} alt="" className="h-16 w-full rounded-md object-contain" />
              ) : undefined,
            }))}
          />
        </Field>
      ) : pattern?.styleCode ? (
        <p className="text-sm">
          <span className="text-muted">{t("styleCode")}</span> <span className="font-mono">{pattern.styleCode}</span>
          {pattern.internationalName ? <span className="text-muted"> · {pattern.internationalName}</span> : null}
        </p>
      ) : null}

      {sizes.length > 0 ? (
        <SegmentedControl
          label={t("mode")}
          value={state.sizeMode}
          onValueChange={(sizeMode) => {
            const first = sizes[0]!;
            onChange(
              sizeMode === "standard"
                ? {
                    sizeMode,
                    standardSizeCode: state.standardSizeCode ?? first.code,
                    // The catalogue's standard sizes are inside sizes.
                    basis: "internal",
                    dims: { ...NO_DIMS, l: first.lengthMm, w: first.widthMm, d: first.heightMm },
                    advisory: null,
                  }
                : // A typed size is measured on the basis the customer chooses again (D-182).
                  { sizeMode, basis: bases.length === 1 ? bases[0]! : null, advisory: null },
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
                basis: "internal",
                dims: { ...NO_DIMS, l: size.lengthMm, w: size.widthMm, d: size.heightMm },
                advisory: null,
              });
            }}
            options={sizes.map((size) => ({
              value: size.code,
              label: size.name,
              description: dimsText({ l: size.lengthMm, w: size.widthMm, d: size.heightMm }),
            }))}
          />
        </Field>
      ) : (
        <>
          {bases.length > 1 ? (
            <Field
              label={t("basis")}
              hint={
                <>
                  {t("basisHint")} <GlossaryChip slug="measurement-basis" />
                </>
              }
              error={message(problems.basis)}
            >
              <RadioCards
                columns={3}
                value={state.basis ?? undefined}
                onValueChange={(basis) => onChange({ basis: basis as MeasurementBasis, advisory: null })}
                options={bases.map((basis) => ({
                  value: basis,
                  label: t(`bases.${basis}.label`),
                  description: t(`bases.${basis}.description`),
                }))}
              />
            </Field>
          ) : null}
          <DimensionInput
            legend={legend}
            unit={state.unit}
            onUnitChange={onUnitChange}
            unitLabels={unitLabels}
            unitToggleLabel={t("unitToggle")}
            onActiveAxisChange={setActive}
            diagram={
              kind === "box" && !state.flatStyle ? (
                <BoxDiagram labels={{ l: axisLabels.l, w: axisLabels.w, d: axisLabels.d }} active={active} />
              ) : (
                <FlatDiagram
                  labels={{ w: axisLabels.w, l: axisLabels.l }}
                  active={active}
                  gusset={kind === "pouch" && axesOf(configurator, state).length > 2}
                />
              )
            }
            onChange={(axis, valueMm) =>
              onChange({ standardSizeCode: null, dims: { ...state.dims, [axis as Axis]: valueMm }, advisory: null })
            }
            axes={axesOf(configurator, state).map((axis) => ({
              key: axis,
              label: axisLabels[axis],
              valueMm: state.dims[axis],
              hint: rangeHint(axis),
              error: message(problems[axis]),
            }))}
          />
        </>
      )}

      {kind === "box" && !state.flatStyle ? (
        <DerivedSizes
          basis={state.basis}
          conversion={conversion}
          show={(size) => dimsText(size)}
          caliper={(mm) => `${Number(mm.toFixed(2))} ${unitLabels.mm}`}
        />
      ) : (
        <p className="text-muted text-xs">{t("flatNote")}</p>
      )}
    </div>
  );
}

/** The box on every basis, as the API converted it (D-182) — read-only, never computed here. */
function DerivedSizes({
  basis,
  conversion,
  show,
  caliper,
}: {
  basis: MeasurementBasis | null;
  conversion: SizeStepProps["conversion"];
  show: (size: { l: number; w: number; d: number }) => string;
  caliper: (mm: number) => string;
}) {
  const t = useTranslations("configurator.size");
  const { converted, pending, problem } = conversion;
  if (!basis) return <p className="text-muted text-xs">{t("derived.chooseBasis")}</p>;
  const rows = converted
    ? (
        [
          ["internal", converted.sizes.internal],
          ["external", converted.sizes.external],
          ["over_crease", converted.sizes.overCrease],
        ] as const
      ).filter(([, size]) => size !== null)
    : [];
  return (
    <section aria-labelledby="derived-sizes" className="border-border rounded-xl border p-3" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <h3 id="derived-sizes" className="text-sm font-medium">
          {t("derived.title")}
        </h3>
        {pending ? <Spinner size={14} label={t("derived.converting")} /> : null}
      </div>
      {problem || conversion.caliperUnknown ? (
        <p className="text-muted mt-2 text-sm">
          {problem && problem !== "specs.caliper_missing" ? t("derived.failed") : t("derived.caliperMissing")}
        </p>
      ) : rows.length > 0 ? (
        <>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {rows.map(([key, size]) => (
              <div key={key} className="contents">
                <dt className={cn("text-muted", key === basis && "text-fg font-medium")}>
                  {t(`bases.${key}.label`)}
                  {key === basis ? ` ${t("derived.entered")}` : ""}
                </dt>
                <dd className="tabular-nums">{show(size!)}</dd>
              </div>
            ))}
          </dl>
          {converted?.caliperMm !== null && converted?.caliperMm !== undefined ? (
            <p className="text-muted mt-2 text-xs">{t("derived.caliper", { caliper: caliper(converted.caliperMm) })}</p>
          ) : null}
        </>
      ) : (
        <p className="text-muted mt-2 text-xs">{t("derived.empty")}</p>
      )}
    </section>
  );
}
