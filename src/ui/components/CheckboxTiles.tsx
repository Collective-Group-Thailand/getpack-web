"use client";

import { useFieldGroupProps } from "./Field";
import { Icon } from "../icons";
import { cn } from "../lib/cn";

export interface CheckboxTileOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
}

export interface CheckboxTilesProps<T extends string = string> {
  options: CheckboxTileOption<T>[];
  value: readonly T[];
  onValueChange: (value: T[]) => void;
  /** Columns from `sm` up; phones get two (`compact`: four, for short labels such as months). */
  columns?: 2 | 3 | 4 | 6;
  compact?: boolean;
  className?: string;
  "aria-label"?: string;
}

/**
 * Several choices from a short list, each a 44 px tile (the packaging profile's product types, regions and months).
 *
 * The tiles are real checkboxes inside their labels, so the whole tile is the hit target and the keyboard, form
 * semantics and screen readers come from the platform. Inside a `<Field>` the group is named by the field's label
 * and described by its hint and error (`useFieldGroupProps`). Selection is a border, a tint and a tick, never colour
 * alone.
 */
export function CheckboxTiles<T extends string = string>({
  options,
  value,
  onValueChange,
  columns = 3,
  compact = false,
  className,
  ...props
}: CheckboxTilesProps<T>) {
  const groupProps = useFieldGroupProps();
  const toggle = (option: T, checked: boolean) =>
    onValueChange(
      checked
        ? options.map((o) => o.value).filter((v) => v === option || value.includes(v))
        : value.filter((v) => v !== option),
    );

  return (
    <div
      role="group"
      {...groupProps}
      aria-label={props["aria-label"]}
      tabIndex={groupProps["aria-invalid"] ? -1 : undefined}
      className={cn(
        "grid gap-2 outline-none",
        compact ? "grid-cols-4" : "grid-cols-2",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-3",
        columns === 4 && "sm:grid-cols-4",
        columns === 6 && "sm:grid-cols-6",
        className,
      )}
    >
      {options.map((option) => {
        const checked = value.includes(option.value);
        return (
          <label
            key={option.value}
            className={cn(
              "rounded-control flex min-h-11 cursor-pointer items-center gap-2.5 border px-3 py-2 text-sm",
              "duration-fast ease-standard transition-colors",
              "has-[:focus-visible]:ring-focus-ring has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-1",
              compact && "justify-center gap-2 px-2",
              checked
                ? "border-primary bg-primary-subtle text-primary-subtle-fg font-medium"
                : "border-border bg-surface hover:border-border-strong",
            )}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={checked}
              disabled={groupProps.disabled}
              onChange={(event) => toggle(option.value, event.target.checked)}
            />
            <span
              aria-hidden="true"
              className={cn(
                "grid size-4.5 shrink-0 place-items-center rounded-sm border-[1.5px]",
                checked ? "border-primary bg-primary text-primary-fg" : "border-border-strong bg-surface",
              )}
            >
              {checked ? <Icon name="check" size={12} /> : null}
            </span>
            <span className="min-w-0">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}
