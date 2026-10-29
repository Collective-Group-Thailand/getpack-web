"use client";

import { Slider as SliderPrimitive } from "radix-ui";

import { cn } from "../lib/cn";
import { useFieldGroupProps } from "./Field";

export interface SliderProps extends Omit<React.ComponentProps<typeof SliderPrimitive.Root>, "children"> {
  /** Accessible name for the thumb when there is no `<Field>` around it. */
  "aria-label"?: string;
  /** Or the id of the visible label that names it (the thumb is the control, so it goes there). */
  "aria-labelledby"?: string;
  /** Human-readable current value, e.g. "120 %" — read instead of the bare number. */
  valueText?: string;
}

/**
 * A slider for a value the user can also type (zoom, pattern size). WCAG 2.5.7: every
 * dragging interaction needs a non-drag alternative, and the arrow keys Radix wires up are
 * it — the paired number input in the designer is the visible one.
 */
export function Slider({
  className,
  valueText,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: SliderProps) {
  const groupProps = useFieldGroupProps();

  return (
    <SliderPrimitive.Root
      className={cn("relative flex h-5 w-full touch-none items-center select-none", className)}
      disabled={props.disabled ?? groupProps.disabled}
      {...props}
    >
      <SliderPrimitive.Track className="bg-neutral-subtle rounded-control relative h-1.5 w-full grow">
        <SliderPrimitive.Range className="bg-primary rounded-control absolute h-full" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        // The thumb is the control, so the name and description belong on it, not on the root.
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : (ariaLabelledBy ?? groupProps["aria-labelledby"])}
        aria-describedby={groupProps["aria-describedby"]}
        aria-valuetext={valueText}
        className={cn(
          "border-primary bg-surface shadow-card block size-5 rounded-full border-2",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      />
    </SliderPrimitive.Root>
  );
}
