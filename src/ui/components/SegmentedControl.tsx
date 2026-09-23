"use client";

import { ToggleGroup } from "radix-ui";

import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  icon?: IconName;
  disabled?: boolean;
  /** Accessible name when the segment shows only an icon. */
  ariaLabel?: string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Accessible name for the group. Required — a bare row of toggles names nothing. */
  label: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * A small set of mutually exclusive choices shown side by side — text alignment, a density
 * toggle, a preset/custom switch.
 *
 * Radix ToggleGroup in single mode gives roving focus and arrow keys. An empty selection is
 * refused: a segmented control always shows the current state, so `onValueChange` only fires
 * with a real value.
 */
export function SegmentedControl<T extends string = string>({
  options,
  value,
  onValueChange,
  label,
  size = "md",
  className,
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next as T);
      }}
      aria-label={label}
      className={cn("border-border bg-surface-subtle inline-flex gap-0.5 rounded-lg border p-0.5", className)}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          aria-label={option.ariaLabel}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap",
            "text-muted duration-fast ease-standard transition-colors",
            "data-[state=on]:bg-surface data-[state=on]:text-fg data-[state=on]:shadow-sm",
            "disabled:pointer-events-none disabled:opacity-50",
            size === "sm" ? "h-7 px-2 text-xs" : "h-9 px-3 text-sm",
          )}
        >
          {option.icon ? <Icon name={option.icon} size={16} /> : null}
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
