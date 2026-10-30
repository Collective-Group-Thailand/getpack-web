"use client";

import { Icon } from "../icons";
import { cn } from "../lib/cn";
import { useFieldProps } from "./Field";
import { IconButton } from "./IconButton";
import { controlVariants } from "./Input";

export interface SearchInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value" | "type"
> {
  value: string;
  onValueChange: (value: string) => void;
  /** Accessible name of the clear button. */
  clearLabel: string;
  inputSize?: "sm" | "md";
}

/**
 * A search box: magnifier, `type="search"` (so Escape clears it and mobile keyboards say
 * "search"), and a clear button that returns focus to the field. Debouncing belongs to the
 * caller — this control reports every keystroke.
 */
export function SearchInput({
  value,
  onValueChange,
  clearLabel,
  inputSize = "md",
  className,
  ...props
}: SearchInputProps) {
  const fieldProps = useFieldProps();
  return (
    <div className={cn("relative", className)}>
      <Icon
        name="search"
        size={16}
        className="text-muted pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        data-size={inputSize}
        className={cn(controlVariants({ inputSize }), "ps-8 pe-9 [&::-webkit-search-cancel-button]:hidden")}
        {...fieldProps}
        {...props}
      />
      {value ? (
        <IconButton
          name="close"
          variant="ghost"
          size="sm"
          label={clearLabel}
          className="absolute end-0.5 top-1/2 size-7 -translate-y-1/2"
          onClick={(event) => {
            onValueChange("");
            (event.currentTarget.parentElement?.querySelector("input") as HTMLInputElement | null)?.focus();
          }}
        />
      ) : null}
    </div>
  );
}
