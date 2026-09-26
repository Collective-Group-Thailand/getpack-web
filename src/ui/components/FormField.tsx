"use client";

import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";

import { Field, type FieldProps } from "./Field";

export interface FormFieldProps<TValues extends FieldValues, TName extends FieldPath<TValues>> extends Omit<
  FieldProps,
  "children" | "error"
> {
  control: Control<TValues>;
  name: TName;
  /** The control, given the props react-hook-form needs it to have. */
  children: (field: {
    name: TName;
    value: unknown;
    onChange: (...event: unknown[]) => void;
    onBlur: () => void;
    ref: (instance: unknown) => void;
  }) => React.ReactNode;
  /**
   * The words for a validation message: a schema says `"required"`, the person reads
   * "กรุณากรอก". A message the API sent is already words and passes through.
   */
  formatError?: (message: string) => React.ReactNode;
}

/**
 * `<Field>` with its error read from react-hook-form instead of passed in.
 *
 * `Field` already owns the whole a11y contract — the label's `for`, `aria-describedby`,
 * `aria-invalid`, the required marker — and controls inside it pick that up from context.
 * All this adds is the one thing a form has that `Field` cannot know: which message is
 * current. Keeping them separate means a screen with no form library still uses the same
 * `Field`, and the a11y wiring has exactly one implementation.
 *
 * `Controller` rather than `register` so the same component works for a plain `<input>` and
 * for the Radix-based controls (Checkbox, Select, SegmentedControl), which are controlled and
 * have no `ref` to register.
 */
export function FormField<TValues extends FieldValues, TName extends FieldPath<TValues>>({
  control,
  name,
  children,
  formatError,
  ...fieldProps
}: FormFieldProps<TValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field
          {...fieldProps}
          error={
            fieldState.error?.message && formatError ? formatError(fieldState.error.message) : fieldState.error?.message
          }
        >
          {children(field as Parameters<typeof children>[0])}
        </Field>
      )}
    />
  );
}
