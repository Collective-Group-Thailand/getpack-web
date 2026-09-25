"use client";

import { Checkbox } from "./Checkbox";
import { IconButton } from "./IconButton";
import { Popover } from "./Popover";

export interface ColumnToggleProps {
  columns: readonly { id: string; label: string; hideable?: boolean }[];
  hidden: readonly string[];
  onHiddenChange: (hidden: string[]) => void;
  /** The button's name and the popover's heading, e.g. "คอลัมน์". */
  label: string;
}

/**
 * Which columns a table shows (design-system.md §3 "column visibility"). Checkboxes, not a
 * menu: several can change at once, and each keeps its checked state announced.
 */
export function ColumnToggle({ columns, hidden, onHiddenChange, label }: ColumnToggleProps) {
  return (
    <Popover
      align="end"
      aria-label={label}
      trigger={<IconButton name="columns" variant="secondary" size="sm" label={label} />}
    >
      <fieldset className="w-56 space-y-2 p-3">
        <legend className="mb-2 text-sm font-medium">{label}</legend>
        {columns.map((column, index) => (
          <Checkbox
            key={column.id}
            label={column.label}
            checked={!hidden.includes(column.id)}
            disabled={index === 0 || column.hideable === false}
            onCheckedChange={(checked) =>
              onHiddenChange(checked ? hidden.filter((id) => id !== column.id) : [...hidden, column.id])
            }
          />
        ))}
      </fieldset>
    </Popover>
  );
}
