"use client";

import { cn } from "../lib/cn";
import { useFieldProps } from "./Field";
import { controlVariants } from "./Input";

export interface ColorFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Brand and material swatches offered as one-click presets. */
  swatches?: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
  /** Accessible name for the picker when it is not inside a `<Field>`. */
  "aria-label"?: string;
  /** Accessible name for the paired hex input, from `src/i18n`. */
  hexLabel: string;
}

/**
 * A colour with its hex value beside it. Deliberately minimal: the full ColorPicker in
 * design-system.md §3 (contrast hint, recent colours, eyedropper) is built when a screen
 * needs it. The native `<input type="color">` is used on purpose — it is keyboard accessible
 * and gives every platform its own familiar picker.
 *
 * The hex input is the non-pointer path: WCAG 2.5.7 needs an alternative to dragging inside
 * a colour area, and typing a hex is it.
 */
export function ColorField({
  value,
  onValueChange,
  swatches,
  disabled,
  className,
  hexLabel,
  ...props
}: ColorFieldProps) {
  const fieldProps = useFieldProps();

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          disabled={disabled ?? fieldProps.disabled}
          id={fieldProps.id}
          aria-label={props["aria-label"]}
          aria-describedby={fieldProps["aria-describedby"]}
          className="border-border-strong bg-surface size-10 shrink-0 cursor-pointer rounded-md border p-1"
        />
        <input
          type="text"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          disabled={disabled ?? fieldProps.disabled}
          aria-label={hexLabel}
          spellCheck={false}
          className={cn(controlVariants({ inputSize: "sm" }), "font-mono uppercase")}
        />
      </div>

      {swatches?.length ? (
        <div className="flex flex-wrap gap-1">
          {swatches.map((swatch) => (
            <button
              key={swatch.value}
              type="button"
              onClick={() => onValueChange(swatch.value)}
              disabled={disabled ?? fieldProps.disabled}
              title={swatch.label}
              aria-label={swatch.label}
              aria-pressed={value.toLowerCase() === swatch.value.toLowerCase()}
              style={{ backgroundColor: swatch.value }}
              className={cn(
                "border-border-strong size-6 rounded-md border",
                "aria-pressed:ring-focus-ring aria-pressed:ring-2 aria-pressed:ring-offset-2",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
