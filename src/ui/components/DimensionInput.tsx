"use client";

import { useId, useState } from "react";

import { cn } from "../lib/cn";
import { controlVariants } from "./Input";
import { SegmentedControl } from "./SegmentedControl";

export type LengthUnit = "mm" | "cm" | "in";

const MM_PER: Record<LengthUnit, number> = { mm: 1, cm: 10, in: 25.4 };
const DECIMALS: Record<LengthUnit, number> = { mm: 0, cm: 1, in: 2 };

/** A length in millimetres, shown in `unit` — display only, the value stays in mm. */
export function fromMm(mm: number, unit: LengthUnit): string {
  const value = mm / MM_PER[unit];
  return String(Number(value.toFixed(DECIMALS[unit])));
}

/** What the customer typed, in `unit`, back to whole millimetres; `null` for anything not a number. */
export function toMm(text: string, unit: LengthUnit): number | null {
  const normalised = text.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalised)) return null;
  return Math.round(Number(normalised) * MM_PER[unit]);
}

export interface DimensionAxis {
  key: string;
  label: string;
  /** Millimetres; `null` while empty. */
  valueMm: number | null;
  /** The rule for this axis in the unit shown, e.g. "30–500 มม.". */
  hint?: string;
  error?: string;
}

export interface DimensionInputProps {
  axes: DimensionAxis[];
  unit: LengthUnit;
  onUnitChange: (unit: LengthUnit) => void;
  /** Millimetres, or `null` when the field is cleared or not a number yet. */
  onChange: (key: string, valueMm: number | null) => void;
  unitLabels: Record<LengthUnit, string>;
  /** Accessible name of the unit switch, e.g. "หน่วยที่แสดง". */
  unitToggleLabel: string;
  /** Legend of the whole group, e.g. "ขนาดภายในกล่อง". */
  legend: React.ReactNode;
  /** A picture of which side is which — the box diagram. */
  diagram?: React.ReactNode;
  className?: string;
}

/**
 * Length × width × height with a visual diagram (design-system.md §3 "DimensionInput").
 *
 * The unit switch is **display only** (F3 3.2): the values held and sent are whole millimetres,
 * so switching to centimetres never changes the box. Each axis keeps the text as typed while it
 * is being edited — "12." is a valid moment on the way to "12.5" — and reports millimetres once
 * the text is a number.
 */
export function DimensionInput({
  axes,
  unit,
  onUnitChange,
  onChange,
  unitLabels,
  unitToggleLabel,
  legend,
  diagram,
  className,
}: DimensionInputProps) {
  const baseId = useId();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  return (
    <fieldset className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <legend className="text-sm font-medium">{legend}</legend>
        <SegmentedControl
          label={unitToggleLabel}
          size="sm"
          value={unit}
          onValueChange={(next) => {
            setDrafts({});
            onUnitChange(next as LengthUnit);
          }}
          options={(["mm", "cm", "in"] as const).map((value) => ({ value, label: unitLabels[value] }))}
        />
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {diagram ? <div className="w-full shrink-0 sm:w-40">{diagram}</div> : null}
        <div className={cn("grid flex-1 gap-3", axes.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
          {axes.map((axis) => {
            const inputId = `${baseId}-${axis.key}`;
            const hintId = `${inputId}-hint`;
            const errorId = `${inputId}-error`;
            const unitId = `${inputId}-unit`;
            const shown = drafts[axis.key] ?? (axis.valueMm === null ? "" : fromMm(axis.valueMm, unit));
            return (
              <div key={axis.key} className="flex min-w-0 flex-col gap-1">
                <label htmlFor={inputId} className="text-sm font-medium">
                  {axis.label}
                </label>
                <div className="relative">
                  <input
                    id={inputId}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={shown}
                    aria-invalid={axis.error ? true : undefined}
                    aria-describedby={[axis.error && errorId, axis.hint && hintId, unitId].filter(Boolean).join(" ")}
                    onChange={(event) => {
                      const text = event.target.value;
                      setDrafts((current) => ({ ...current, [axis.key]: text }));
                      onChange(axis.key, text.trim() === "" ? null : toMm(text, unit));
                    }}
                    onBlur={() =>
                      setDrafts((current) => {
                        const next = { ...current };
                        delete next[axis.key];
                        return next;
                      })
                    }
                    className={cn(controlVariants({ tone: axis.error ? "invalid" : "default" }), "pe-11 tabular-nums")}
                  />
                  <span
                    id={unitId}
                    className="text-muted pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm"
                  >
                    {unitLabels[unit]}
                  </span>
                </div>
                {axis.hint ? (
                  <p id={hintId} className="text-muted text-xs">
                    {axis.hint}
                  </p>
                ) : null}
                {axis.error ? (
                  <p id={errorId} className="text-danger text-xs font-medium">
                    {axis.error}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </fieldset>
  );
}
