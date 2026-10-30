"use client";

import { Icon } from "../icons";
import { cn } from "../lib/cn";
import { useFieldProps } from "./Field";
import { controlVariants } from "./Input";
import type { SelectOption } from "./Select";

export interface NativeSelectProps<T extends string = string> extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "value" | "defaultValue" | "onChange"
> {
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  options: SelectOption<T>[];
}

/**
 * A single-choice control on the platform's own `<select>`: no script beyond the page's, and the
 * phone's own picker. For a page whose budget cannot carry Select (the home page's quick start);
 * labels are plain text here, since an `<option>` renders nothing else.
 */
export function NativeSelect<T extends string = string>({
  options,
  onValueChange,
  className,
  ...props
}: NativeSelectProps<T>) {
  const fieldProps = useFieldProps();
  return (
    <span className="relative block">
      <select
        data-size="md"
        className={cn(controlVariants(), "appearance-none pe-9", className)}
        {...fieldProps}
        {...props}
        onChange={(event) => onValueChange?.(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon
        name="chevron-down"
        size={18}
        aria-hidden="true"
        className="text-muted pointer-events-none absolute end-3 top-1/2 -translate-y-1/2"
      />
    </span>
  );
}
