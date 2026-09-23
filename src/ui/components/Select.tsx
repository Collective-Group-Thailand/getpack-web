"use client";

import { Select as SelectPrimitive } from "radix-ui";

import { Icon } from "../icons";
import { cn } from "../lib/cn";
import { useFieldProps } from "./Field";
import { controlVariants } from "./Input";

export interface SelectOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps<T extends string = string> {
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  options: SelectOption<T>[];
  /** Shown when nothing is chosen. Comes from `src/i18n`, never hard-coded here. */
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  /** Accessible name when the Select is used outside a `<Field>`. */
  "aria-label"?: string;
}

/**
 * A single-choice control on Radix Select: typeahead, Home/End, and a listbox that is
 * portalled so it escapes overflow containers (the designer's side panel needs that).
 *
 * For long or remote lists use Combobox (built when a screen first needs one) — a native-feel
 * select stops being usable past about twenty options.
 */
export function Select<T extends string = string>({
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder,
  name,
  disabled,
  required,
  className,
  ...props
}: SelectProps<T>) {
  const fieldProps = useFieldProps();

  return (
    <SelectPrimitive.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange as ((value: string) => void) | undefined}
      name={name}
      disabled={disabled ?? fieldProps.disabled}
      required={required ?? fieldProps.required}
    >
      <SelectPrimitive.Trigger
        id={fieldProps.id}
        aria-describedby={fieldProps["aria-describedby"]}
        aria-invalid={fieldProps["aria-invalid"]}
        aria-label={props["aria-label"]}
        className={cn(controlVariants(), "flex items-center justify-between gap-2 text-start", className)}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <Icon name="chevron-down" size={18} className="text-muted" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={cn(
            "z-modal max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width)",
            "border-border bg-surface-raised overflow-y-auto rounded-lg border p-1 shadow-lg",
          )}
        >
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  "flex cursor-default items-center gap-2 rounded-md px-2 py-2 text-sm outline-none",
                  "data-highlighted:bg-primary-subtle data-highlighted:text-primary-subtle-fg",
                  "data-disabled:pointer-events-none data-disabled:opacity-50",
                )}
              >
                <SelectPrimitive.ItemIndicator>
                  <Icon name="check" size={16} />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
