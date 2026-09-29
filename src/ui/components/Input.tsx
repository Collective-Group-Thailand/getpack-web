"use client";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";
import { useFieldProps } from "./Field";

/** Shared shell for every text-like control, so Input, NumberInput and Textarea match. */
export const controlVariants = cva(
  [
    "w-full rounded-control border bg-surface text-fg",
    "transition-colors duration-fast ease-standard",
    "aria-invalid:border-danger",
    "disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-subtle",
  ],
  {
    variants: {
      inputSize: {
        sm: "h-8 px-2.5 text-sm",
        md: "h-10 px-3 text-base",
        lg: "h-12 px-4 text-lg",
      },
      // border-strong, not border: an input outline is a UI component and needs 3:1 (1.4.11).
      tone: { default: "border-border-strong", invalid: "border-danger" },
    },
    defaultVariants: { inputSize: "md", tone: "default" },
  },
);

export interface InputProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    Pick<VariantProps<typeof controlVariants>, "inputSize"> {}

export function Input({ className, inputSize, type = "text", ...props }: InputProps) {
  const fieldProps = useFieldProps();
  return <input type={type} className={cn(controlVariants({ inputSize }), className)} {...fieldProps} {...props} />;
}

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, rows = 3, ...props }: TextareaProps) {
  const fieldProps = useFieldProps();
  return (
    <textarea
      rows={rows}
      className={cn(controlVariants({ inputSize: "md" }), "h-auto py-2 leading-normal", className)}
      {...fieldProps}
      {...props}
    />
  );
}

export interface NumberInputProps extends Omit<InputProps, "type"> {
  /** mm, cm, ชิ้น, % … shown inside the control and announced as part of it. */
  unit?: string;
}

/**
 * A number with its unit (design-system.md §3). Tabular figures so a column of dimensions
 * lines up, and `inputMode="decimal"` so a phone offers the right keypad.
 *
 * The unit is rendered inside the control and referenced by `aria-describedby`, so "80" is
 * never read out without "mm".
 */
export function NumberInput({ className, unit, inputSize, id, ...props }: NumberInputProps) {
  const fieldProps = useFieldProps();
  const inputId = id ?? fieldProps.id;
  const unitId = unit && inputId ? `${inputId}-unit` : undefined;
  const describedBy = [fieldProps["aria-describedby"], unitId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="relative">
      <input
        type="number"
        inputMode="decimal"
        className={cn(controlVariants({ inputSize }), "tabular-nums", unit && "pe-12", className)}
        {...fieldProps}
        id={inputId}
        aria-describedby={describedBy}
        {...props}
      />
      {unit ? (
        <span id={unitId} className="text-muted pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm">
          {unit}
        </span>
      ) : null}
    </div>
  );
}
