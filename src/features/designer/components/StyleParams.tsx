"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  isActive,
  type BoxStyleDef,
  type Issue,
  type ParamGroup,
  type ParamSchema,
  type ParamValues,
} from "@packio/dieline";

import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { NumberInput, Textarea } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";

export interface StyleParamsProps {
  style: BoxStyleDef;
  values: ParamValues;
  onChange: (values: ParamValues) => void;
  /** The engine's issues for these values; each shows at its parameter. */
  issues?: Issue[];
  groups: ParamGroup[];
  /** Keys rendered elsewhere (e.g. the size fields the dialog draws itself). */
  exclude?: string[];
}

/**
 * A style's parameters as a form, straight from its `ParamSchema`: lengths as millimetre inputs,
 * choices as selects, switches as checkboxes, text as a text area; a parameter whose `when` does
 * not hold is not shown. The words are the engine's (`label`, `help` in Thai and English), so
 * the drawing service and the designer describe a parameter identically.
 *
 * A length left empty means "use the recommended value" — the style computes it from the size.
 */
export function StyleParams({ style, values, onChange, issues = [], groups, exclude = [] }: StyleParamsProps) {
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("designer.setup");
  const params = style.params.filter(
    (p) => groups.includes(p.group) && !exclude.includes(p.key) && isActive(p, { ...style.defaults, ...values }),
  );

  const set = (key: string, value: ParamValues[string] | undefined) => {
    const next = { ...values };
    if (value === undefined) delete next[key];
    else next[key] = value;
    onChange(next);
  };

  const errorOf = (p: ParamSchema) => issues.find((i) => i.param === p.key && i.severity === "error")?.message[locale];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {params.map((p) => {
        const current = values[p.key] ?? style.defaults[p.key];
        const hint = p.help?.[locale];
        const error = errorOf(p);
        if (p.kind === "boolean") {
          return (
            <div key={p.key} className="sm:col-span-2">
              <Checkbox
                label={p.label[locale]}
                description={hint}
                checked={current === true}
                onCheckedChange={(checked) => set(p.key, checked === true)}
              />
            </div>
          );
        }
        if (p.kind === "enum") {
          return (
            <Field key={p.key} label={p.label[locale]} hint={hint} error={error}>
              <Select
                value={typeof current === "string" ? current : undefined}
                onValueChange={(value) => set(p.key, value)}
                options={(p.options ?? []).map((o) => ({ value: o.value, label: o.label[locale] }))}
              />
            </Field>
          );
        }
        if (p.kind === "text") {
          return (
            <Field key={p.key} label={p.label[locale]} hint={hint} error={error} className="sm:col-span-2">
              <Textarea
                rows={3}
                value={typeof current === "string" ? current : ""}
                onChange={(event) => set(p.key, event.target.value)}
              />
            </Field>
          );
        }
        const recommended = style.defaults[p.key] === undefined;
        return (
          <Field key={p.key} label={p.label[locale]} hint={hint} error={error}>
            <NumberInput
              min={p.min}
              max={p.max}
              step={p.step ?? 0.5}
              unit={p.kind === "angle" ? "°" : p.kind === "length" ? t("unitMm") : undefined}
              inputSize="sm"
              placeholder={recommended ? t("recommended") : undefined}
              value={typeof values[p.key] === "number" ? (values[p.key] as number) : recommended ? "" : Number(current)}
              onChange={(event) => set(p.key, event.target.value === "" ? undefined : Number(event.target.value))}
            />
          </Field>
        );
      })}
    </div>
  );
}
