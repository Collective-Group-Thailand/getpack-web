"use client";

import { RadioGroup as RadioGroupPrimitive } from "radix-ui";

import { cn } from "../lib/cn";
import { useFieldGroupProps } from "./Field";

export interface RadioCardOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  description?: React.ReactNode;
  /** Image, dieline preview, material swatch — "show the box" (design-system.md §1.2). */
  visual?: React.ReactNode;
  disabled?: boolean;
  /** A short tag after the label ("ค่าเริ่มต้น"). */
  badge?: React.ReactNode;
  /**
   * Beside the label and description, aligned to the end (a price change, "เลือกอยู่"). Its box is the
   * caller's to reserve: a card whose figure arrives later must not change height when it does.
   */
  trailing?: React.ReactNode;
  /** Under the description: a figure such as the price per piece. Reserve its height in the caller. */
  footer?: React.ReactNode;
}

export interface RadioCardsProps<T extends string = string> {
  options: RadioCardOption<T>[];
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  name?: string;
  /** Accessible name for the group when it is not inside a `<Field>`. */
  "aria-label"?: string;
  /** Column count at `sm` and up; one column on phones. */
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

/**
 * One choice from a few, each with room for a picture — the box-style and material pickers.
 *
 * Radix RadioGroup gives the roving-tabindex arrow-key behaviour a radio group must have,
 * and the whole card is the label, so the hit target is the card rather than a 16-px dot.
 */
export function RadioCards<T extends string = string>({
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  columns = 3,
  className,
  ...props
}: RadioCardsProps<T>) {
  const groupProps = useFieldGroupProps();

  return (
    <RadioGroupPrimitive.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange as ((value: string) => void) | undefined}
      name={name}
      {...groupProps}
      // An explicit aria-label wins, for a group used outside a Field.
      aria-label={props["aria-label"]}
      className={cn(
        "grid gap-2",
        columns === 3 && "sm:grid-cols-3",
        columns === 2 && "sm:grid-cols-2",
        columns === 4 && "grid-cols-2 sm:grid-cols-4",
        className,
      )}
    >
      {options.map((option) => (
        <RadioGroupPrimitive.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className={cn(
            "duration-fast ease-standard rounded-card flex flex-col gap-1 border p-3 text-start transition-colors",
            "border-border hover:border-border-strong",
            // Selection is a border *and* a ring, so it survives greyscale and high contrast.
            "data-[state=checked]:border-primary data-[state=checked]:bg-primary-subtle",
            "data-[state=checked]:ring-primary/25 data-[state=checked]:ring-2",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          {option.visual ? <div className="mb-1">{option.visual}</div> : null}
          {option.trailing !== undefined ? (
            <span className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5">
              <span className="text-sm font-medium">
                {option.label}
                {option.badge ? <span className="ms-2 align-middle">{option.badge}</span> : null}
              </span>
              <span className="text-muted col-start-2 row-span-2 row-start-1 self-center text-xs font-semibold whitespace-nowrap tabular-nums">
                {option.trailing}
              </span>
              {option.description ? <span className="text-muted text-xs">{option.description}</span> : null}
            </span>
          ) : (
            <>
              <span className="text-sm font-medium">
                {option.label}
                {option.badge ? <span className="ms-2 align-middle">{option.badge}</span> : null}
              </span>
              {option.description ? <span className="text-muted text-xs">{option.description}</span> : null}
            </>
          )}
          {option.footer !== undefined ? (
            <span className="mt-1 text-xs font-semibold tabular-nums">{option.footer}</span>
          ) : null}
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
