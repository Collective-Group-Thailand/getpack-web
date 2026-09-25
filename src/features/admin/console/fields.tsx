"use client";

import { useTranslations } from "next-intl";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";

import { FormField } from "@/ui/components/FormField";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";
import { Switch } from "@/ui/components/Switch";

/**
 * How one form field renders. The *rules* live in the zod schema beside it; this is only the
 * control, its label and its hint.
 */
export type FieldDef<TValues extends FieldValues> = {
  name: Path<TValues>;
  label: string;
  hint?: string;
  required?: boolean;
  /** Spans both columns of the form grid. */
  wide?: boolean;
} & (
  | { kind: "text" | "email" | "url"; placeholder?: string; maxLength?: number }
  | { kind: "textarea"; rows?: number }
  | { kind: "number"; unit?: string; min?: number; max?: number; step?: number }
  /** Money is typed as text and sent as the decimal string the API expects — never a float. */
  | { kind: "money" }
  | { kind: "percent" }
  | { kind: "select"; options: readonly { value: string; label: string }[] }
  | { kind: "switch"; description?: string }
  | { kind: "date" | "datetime" }
  /** A custom control for anything else (rich text, image upload, a combobox). */
  | { kind: "custom"; render: (field: { value: unknown; onChange: (value: unknown) => void }) => React.ReactNode }
);

export function FormFields<TValues extends FieldValues>({
  control,
  fields,
}: {
  control: Control<TValues>;
  fields: readonly FieldDef<TValues>[];
}) {
  const tCommon = useTranslations("common");
  const t = useTranslations("console.form");

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map((field) =>
        field.kind === "switch" ? (
          // A switch labels itself; wrapping it in a Field would add a second, orphaned label.
          <Controller
            key={field.name}
            control={control}
            name={field.name}
            render={({ field: { value, onChange } }) => (
              <div className={field.wide ? "sm:col-span-2" : undefined}>
                <Switch
                  label={field.label}
                  description={field.description ?? field.hint}
                  checked={Boolean(value)}
                  onCheckedChange={onChange}
                />
              </div>
            )}
          />
        ) : (
          <FormField
            key={field.name}
            control={control}
            name={field.name}
            label={field.label}
            hint={field.hint}
            required={field.required}
            requiredLabel={tCommon("state.required")}
            className={field.wide || field.kind === "textarea" || field.kind === "custom" ? "sm:col-span-2" : undefined}
          >
            {({ value, onChange, onBlur, name }) => {
              switch (field.kind) {
                case "textarea":
                  return (
                    <Textarea
                      name={name}
                      rows={field.rows ?? 4}
                      value={(value as string) ?? ""}
                      onChange={onChange}
                      onBlur={onBlur}
                    />
                  );
                case "number":
                  return (
                    <NumberInput
                      name={name}
                      unit={field.unit}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={value === null || value === undefined ? "" : String(value)}
                      onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
                      onBlur={onBlur}
                    />
                  );
                case "money":
                  return (
                    <NumberInput
                      name={name}
                      unit={t("baht")}
                      inputMode="decimal"
                      step="0.01"
                      value={(value as string) ?? ""}
                      onChange={(event) => onChange(event.target.value)}
                      onBlur={onBlur}
                    />
                  );
                case "percent":
                  return (
                    <NumberInput
                      name={name}
                      unit={tCommon("units.percent")}
                      inputMode="decimal"
                      step="0.01"
                      value={(value as string) ?? ""}
                      onChange={(event) => onChange(event.target.value)}
                      onBlur={onBlur}
                    />
                  );
                case "select":
                  return (
                    <Select
                      value={(value as string) || undefined}
                      onValueChange={onChange}
                      options={[...field.options]}
                      placeholder={t("choose")}
                    />
                  );
                case "date":
                  return (
                    <Input
                      type="date"
                      name={name}
                      value={(value as string) ?? ""}
                      onChange={onChange}
                      onBlur={onBlur}
                    />
                  );
                case "datetime":
                  return (
                    <Input
                      type="datetime-local"
                      name={name}
                      value={(value as string) ?? ""}
                      onChange={onChange}
                      onBlur={onBlur}
                    />
                  );
                case "custom":
                  return field.render({ value, onChange });
                default:
                  return (
                    <Input
                      name={name}
                      type={field.kind}
                      placeholder={field.placeholder}
                      maxLength={field.maxLength}
                      value={(value as string) ?? ""}
                      onChange={onChange}
                      onBlur={onBlur}
                    />
                  );
              }
            }}
          </FormField>
        ),
      )}
    </div>
  );
}
