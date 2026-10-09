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
  /** `xl`: shop-floor targets of 48 px and 18 px text (design-system.md §5 Partner). */
  size?: "sm" | "md" | "xl";
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
      className={cn("border-border bg-surface-subtle rounded-control inline-flex gap-0.5 border p-0.5", className)}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          aria-label={option.ariaLabel}
          data-segment={size}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent font-medium whitespace-nowrap",
            "text-muted duration-fast ease-standard transition-colors",
            // Design language v3: the chosen segment is an ink hairline and semibold — no shadow.
            "data-[state=on]:bg-surface data-[state=on]:text-fg data-[state=on]:border-fg data-[state=on]:font-semibold",
            "disabled:pointer-events-none disabled:opacity-50",
            size === "sm" ? "h-7 px-2 text-xs" : size === "xl" ? "h-12 px-4 text-lg" : "h-9 px-3 text-sm",
          )}
        >
          {option.icon ? <Icon name={option.icon} size={size === "xl" ? 20 : 16} /> : null}
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
