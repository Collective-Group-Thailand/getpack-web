"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { cn } from "@/ui/lib/cn";
import { ConsoleDateField } from "@/features/admin/console/DateInput";

import { parseDraft, toDraft, type Setting, type SettingValue } from "../setting-value";
import { editorOf, isChoice, leafOf, parseLeaf, setAt, topLeaf, unitOf, type Leaf, type Unit } from "./shape";

type Path = readonly (string | number)[];

/** The words for a setting: its label, a field's label, a unit, an enum choice — i18n first, the API's own key last. */
export function useSettingWords() {
  const t = useTranslations("platform.settings");
  const tOps = useTranslations("platform.ops");
  return {
    label: (key: string) => (t.has(`items.${key}.label`) ? t(`items.${key}.label`) : key),
    help: (key: string) => (t.has(`items.${key}.help`) ? t(`items.${key}.help`) : null),
    field: (settingKey: string, name: string) =>
      t.has(`fields.${name}`)
        ? t(`fields.${name}`)
        : settingKey === "ops.alert_thresholds" && tOps.has(`signals.${name}`)
          ? tOps(`signals.${name}`)
          : name,
    unit: (unit: Unit | null) => (unit ? t(`units.${unit}`) : undefined),
    choice: (value: string) => (t.has(`enums.${value}`) ? t(`enums.${value}`) : value),
    on: t("true"),
    off: t("false"),
  };
}

/** One scalar: text held while typing, the typed value reported up (`undefined` while it isn't one yet). */
function LeafInput({
  leaf,
  value,
  unit,
  label,
  labelHidden,
  disabled,
  onChange,
}: {
  leaf: Leaf;
  value: unknown;
  unit?: string;
  label: string;
  labelHidden?: boolean;
  disabled?: boolean;
  onChange: (next: unknown) => void;
}) {
  const t = useTranslations("platform.settings");
  const words = useSettingWords();
  const [text, setText] = useState(value === null || value === undefined ? "" : String(value));
  const [touched, setTouched] = useState(false);
  // A reset from outside (discard, a save that came back) puts the value back into the field.
  const last = useRef(value);
  useEffect(() => {
    if (last.current !== value && parseLeaf(text, leaf) !== value) setText(value == null ? "" : String(value));
    last.current = value;
    // `text` is the field's own state; only an outside change of `value` resets it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const invalid = touched && leaf.kind !== "boolean" && leaf.kind !== "enum" && parseLeaf(text, leaf) === undefined;
  const update = (next: string) => {
    setText(next);
    setTouched(true);
    onChange(parseLeaf(next, leaf));
  };

  let control: React.ReactNode;
  if (leaf.kind === "boolean")
    control = (
      <SegmentedControl
        label={label}
        value={value ? "true" : "false"}
        onValueChange={(next) => onChange(next === "true")}
        options={[
          { value: "true", label: words.on, disabled },
          { value: "false", label: words.off, disabled },
        ]}
      />
    );
  else if (leaf.kind === "enum")
    control = (
      <NativeSelect
        value={String(value ?? "")}
        disabled={disabled}
        onValueChange={(next) => onChange(next)}
        options={leaf.options.map((option) => ({ value: option, label: words.choice(option) }))}
      />
    );
  else if (leaf.kind === "text")
    control = leaf.long ? (
      <Textarea rows={4} value={text} disabled={disabled} onChange={(e) => update(e.target.value)} />
    ) : (
      <Input value={text} disabled={disabled} onChange={(e) => update(e.target.value)} />
    );
  else if (leaf.kind === "time")
    control = <Input type="time" value={text} disabled={disabled} onChange={(e) => update(e.target.value)} />;
  else if (leaf.kind === "date")
    control = (
      <ConsoleDateField type="date" value={text} disabled={disabled} onChange={(e) => update(e.target.value)} />
    );
  else
    control = (
      <NumberInput
        value={text}
        unit={unit}
        disabled={disabled}
        step={leaf.kind === "integer" ? 1 : "any"}
        inputMode={leaf.kind === "integer" ? "numeric" : "decimal"}
        onChange={(e) => update(e.target.value)}
      />
    );

  return (
    <Field
      label={label}
      labelHidden={labelHidden}
      disabled={disabled}
      error={invalid ? t(text.trim() === "" ? "change.errors.required" : "change.errors.format") : undefined}
    >
      {control}
    </Field>
  );
}

/** A list of numbers or texts: each item a removable chip, one field to add the next. */
function ListInput({
  items,
  label,
  unit,
  disabled,
  onChange,
}: {
  items: (string | number)[];
  label: string;
  unit?: string;
  disabled?: boolean;
  onChange: (next: (string | number)[]) => void;
}) {
  const t = useTranslations("platform.settings");
  const id = useId();
  const [draft, setDraft] = useState("");
  const numeric = typeof items[0] === "number";
  const parsed = numeric
    ? /^-?\d+(\.\d+)?$/.test(draft.trim())
      ? Number(draft.trim())
      : undefined
    : draft.trim() || undefined;
  const add = () => {
    if (parsed === undefined) return;
    onChange([...items, parsed]);
    setDraft("");
  };
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5" aria-describedby={`${id}-hint`}>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((item, at) => (
          <li
            key={`${item}-${at}`}
            className="border-border bg-surface-subtle rounded-control inline-flex h-9 items-center gap-1 border ps-3 pe-1 text-sm tabular-nums"
          >
            {unit ? `${item} ${unit}` : item}
            {disabled ? null : (
              <IconButton
                name="close"
                size="sm"
                label={t("list.remove", { item: String(item) })}
                onClick={() => onChange(items.filter((_, i) => i !== at))}
              />
            )}
          </li>
        ))}
      </ul>
      {disabled ? null : (
        <div className="flex items-center gap-2">
          <Input
            aria-label={t("list.addLabel", { label })}
            value={draft}
            inputMode={numeric ? "decimal" : "text"}
            className="w-36"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <IconButton
            name="plus"
            variant="secondary"
            label={t("list.add")}
            disabled={parsed === undefined}
            onClick={add}
          />
        </div>
      )}
      <p id={`${id}-hint`} className="sr-only">
        {t("list.hint")}
      </p>
    </fieldset>
  );
}

/** A structure of typed fields — an object's fields in a grid, a nested object as its own group. */
function ShapeInput({
  setting,
  value,
  path,
  parentUnit,
  disabled,
  onLeaf,
}: {
  setting: Pick<Setting, "key">;
  value: unknown;
  path: Path;
  parentUnit: Unit | null;
  disabled?: boolean;
  onLeaf: (path: Path, next: unknown) => void;
}) {
  const words = useSettingWords();
  const name = String(path.at(-1) ?? "");
  const label = path.length ? words.field(setting.key, name) : words.label(setting.key);
  const unit = (path.length ? unitOf(name) : null) ?? parentUnit;
  if (Array.isArray(value))
    return (
      <ListInput
        items={value as (string | number)[]}
        label={label}
        unit={words.unit(unit)}
        disabled={disabled}
        onChange={(next) => onLeaf(path, next)}
      />
    );
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const grid = (
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        {entries.map(([key, child]) => (
          <div
            key={key}
            className={cn((Array.isArray(child) || (child !== null && typeof child === "object")) && "sm:col-span-2")}
          >
            <ShapeInput
              setting={setting}
              value={child}
              path={[...path, key]}
              parentUnit={unit}
              disabled={disabled}
              onLeaf={onLeaf}
            />
          </div>
        ))}
      </div>
    );
    if (path.length === 0) return grid;
    return (
      <fieldset className="border-border rounded-control min-w-0 border p-3">
        <legend className="px-1 text-sm font-medium">{label}</legend>
        {grid}
      </fieldset>
    );
  }
  const leaf = leafOf(value, setting.key);
  if (!leaf) return null;
  return (
    <LeafInput
      leaf={leaf}
      value={value}
      unit={leaf.kind === "integer" || leaf.kind === "number" || leaf.kind === "decimal" ? words.unit(unit) : undefined}
      label={label}
      disabled={disabled}
      onChange={(next) => onLeaf(path, next)}
    />
  );
}

/** Every path whose leaf is `undefined` (typed but not a value yet). */
function invalidPaths(value: unknown, path: Path = []): string[] {
  if (value === undefined) return [path.join(".")];
  if (Array.isArray(value)) return value.flatMap((v, i) => invalidPaths(v, [...path, i]));
  if (value !== null && typeof value === "object")
    return Object.entries(value).flatMap(([k, v]) => invalidPaths(v, [...path, k]));
  return [];
}

export interface SettingFieldProps {
  setting: Setting;
  /** The value being edited (the draft, else the one in force). */
  value: SettingValue | null | undefined;
  disabled?: boolean;
  /** `valid` false while any field holds text that isn't a value yet. */
  onChange: (value: SettingValue | null, valid: boolean) => void;
  /** The setting's label is shown by the row; the field's own label is for screen readers only. */
  labelHidden?: boolean;
}

/**
 * The typed editor of one setting (G5): a number with its unit, on/off, a choice, a time window, a
 * list, or a structure of those — and the raw JSON editor only as the "advanced" way in, or for a
 * shape nothing else can hold.
 */
export function SettingField({ setting, value, disabled, onChange, labelHidden = true }: SettingFieldProps) {
  const t = useTranslations("platform.settings");
  const words = useSettingWords();
  const kind = editorOf(setting, value);
  const [raw, setRaw] = useState<string | null>(null);
  const report = (next: unknown) => onChange(next as SettingValue, invalidPaths(next).length === 0);
  const label = words.label(setting.key);
  const unit =
    unitOf(setting.key) ?? (setting.valueType === "percent" ? "pct" : setting.valueType === "money" ? "baht" : null);

  if (kind === "json" && raw === null)
    return (
      <div className="flex flex-col items-start gap-2">
        <SettingValueView setting={{ ...setting, valueType: "json" }} value={value} />
        {disabled ? null : (
          <Button
            variant="secondary"
            size="sm"
            iconStart="edit"
            onClick={() => setRaw(value === null || value === undefined ? "" : toDraft(value, "json"))}
          >
            {value === null || value === undefined ? t("advanced.set") : t("advanced.open")}
          </Button>
        )}
      </div>
    );

  if (kind === "json" || raw !== null) {
    const text = raw ?? (value === null || value === undefined ? "" : toDraft(value, "json"));
    const parsed = parseDraft(text, "json");
    return (
      <div className="flex flex-col gap-2">
        <Field
          label={t("advanced.label", { label })}
          labelHidden={labelHidden && kind === "json"}
          hint={kind === "json" ? t("advanced.unknownShape") : undefined}
          error={raw !== null && !parsed.ok ? t(`change.errors.${parsed.error}`) : undefined}
          disabled={disabled}
        >
          <Textarea
            className="font-mono text-xs"
            rows={Math.min(14, Math.max(4, text.split("\n").length))}
            value={text}
            disabled={disabled}
            onChange={(e) => {
              setRaw(e.target.value);
              const next = parseDraft(e.target.value, "json");
              onChange(next.ok ? next.value : null, next.ok);
            }}
          />
        </Field>
        <button
          type="button"
          className="text-primary self-start text-sm font-medium hover:underline"
          onClick={() => {
            setRaw(null);
            onChange((value ?? null) as SettingValue | null, true);
          }}
        >
          {kind === "json" ? t("advanced.cancel") : t("advanced.back")}
        </button>
      </div>
    );
  }

  const advanced =
    setting.valueType === "json" && !disabled ? (
      <button
        type="button"
        className="text-muted hover:text-fg self-start text-xs font-medium underline-offset-2 hover:underline"
        onClick={() => setRaw(toDraft(value, "json"))}
      >
        {t("advanced.open")}
      </button>
    ) : null;

  if (kind === "window") {
    const window = (value ?? {}) as { from?: string; to?: string; timezone?: string };
    return (
      <div className="grid max-w-sm grid-cols-2 gap-3">
        {(["from", "to"] as const).map((end) => (
          <LeafInput
            key={end}
            leaf={{ kind: "time" }}
            value={window[end]}
            label={t(`window.${end}`)}
            disabled={disabled}
            onChange={(next) => report({ ...window, [end]: next })}
          />
        ))}
      </div>
    );
  }

  if (kind === "shape")
    return (
      <div className="flex flex-col gap-2">
        <ShapeInput
          setting={setting}
          value={value}
          path={[]}
          parentUnit={unitOf(setting.key)}
          disabled={disabled}
          onLeaf={(path, next) => report(setAt(value, path, next))}
        />
        {advanced}
      </div>
    );

  const leaf = topLeaf(setting, value)!;
  return (
    <div className={cn(leaf.kind === "text" && leaf.long ? "w-full" : "max-w-xs")}>
      <LeafInput
        leaf={leaf}
        value={value}
        unit={words.unit(unit)}
        label={label}
        labelHidden={labelHidden}
        disabled={disabled}
        onChange={(next) => report(next)}
      />
    </div>
  );
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isScalar = (v: unknown) => v === null || typeof v !== "object";
const NUMERIC = /^-?\d+(\.\d+)?$/;

/** An API field name the messages don't know, read as words — `minSpend12m` → "Min spend 12m". */
function spoken(name: string): string {
  // A code with hyphens (a model id) is a name, not words.
  if (name.includes("-")) return name;
  const words = name
    .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * A value to read, not edit — never as JSON: a figure with its unit, on/off, a list as chips, a list of records as a
 * small table, a structure as labelled rows with its nested parts indented under their own label.
 */
export function SettingValueView({
  setting,
  value,
  compact = false,
}: {
  setting: Pick<Setting, "key" | "valueType" | "masked">;
  value: SettingValue | null | undefined;
  /** One block of small text (a history row). */
  compact?: boolean;
}) {
  const t = useTranslations("platform.settings");
  const words = useSettingWords();
  if (setting.masked) return <span className="text-muted">{t("masked")}</span>;
  if (value === null || value === undefined) return <span className="text-muted">{t("notSet")}</span>;
  if (setting.valueType === "time_of_day_window") {
    const w = value as { from?: string; to?: string };
    return <span className="tabular-nums">{t("window.range", { from: w.from ?? "—", to: w.to ?? "—" })}</span>;
  }
  const size = compact ? "text-xs" : "text-sm";
  const label = (name: string) => {
    const said = words.field(setting.key, name);
    return said === name ? spoken(name) : said;
  };
  /** One scalar: a unit only beside a figure, a known choice in words. */
  const text = (v: unknown, unitName: string | null): string => {
    if (v === null || v === undefined || v === "") return "—";
    if (typeof v === "boolean") return v ? words.on : words.off;
    const figure = typeof v === "number" || (typeof v === "string" && NUMERIC.test(v));
    const unit = figure
      ? (words.unit(unitName ? unitOf(unitName) : null) ??
        (unitName === setting.key && setting.valueType === "percent" ? words.unit("pct") : undefined))
      : undefined;
    if (figure && unitName === setting.key && setting.valueType === "money") return `${v} ${words.unit("baht")}`;
    const shown = typeof v === "string" && isChoice(setting.key, v) ? words.choice(v) : String(v);
    return unit ? `${shown} ${unit}` : shown;
  };
  const none = <span className="text-muted">{t("none")}</span>;

  const tree = (v: unknown, unitName: string | null, inCell = false): React.ReactNode => {
    if (isScalar(v))
      return (
        <span className={cn("tabular-nums", inCell ? "whitespace-nowrap" : "[overflow-wrap:anywhere]")}>
          {text(v, unitName)}
        </span>
      );
    if (Array.isArray(v)) {
      if (v.length === 0) return none;
      if (v.every(isScalar))
        return (
          <ul className="flex flex-wrap gap-1">
            {v.map((item, at) => (
              <li
                key={`${String(item)}-${at}`}
                className="border-border bg-surface-subtle rounded-thumb border px-1.5 py-0.5 text-xs tabular-nums"
              >
                {text(item, unitName)}
              </li>
            ))}
          </ul>
        );
      if (v.every(isRecord)) {
        const columns = [...new Set(v.flatMap((row) => Object.keys(row)))];
        return (
          <div className="border-border rounded-control relative max-w-full overflow-x-auto border">
            <table className={cn("w-full border-collapse", size)}>
              <thead className="bg-surface-subtle text-muted text-start text-xs">
                <tr>
                  {columns.map((column) => (
                    <th key={column} scope="col" className="px-2.5 py-1.5 text-start font-medium whitespace-nowrap">
                      {label(column)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {v.map((row, at) => (
                  <tr key={at} className="border-border border-t align-top">
                    {columns.map((column) => (
                      <td key={column} className="px-2.5 py-1.5">
                        {tree(row[column], column, true)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      return (
        <ol className="flex flex-col gap-2">
          {v.map((item, at) => (
            <li key={at}>{tree(item, unitName)}</li>
          ))}
        </ol>
      );
    }
    const entries = Object.entries(v as Record<string, unknown>);
    if (entries.length === 0) return none;
    // Inside a table cell a structure reads as short "label value" lines.
    if (inCell)
      return (
        <dl className="flex flex-col gap-0.5">
          {entries.map(([key, child]) => (
            <div key={key} className="flex items-baseline gap-1.5 whitespace-nowrap">
              <dt className="text-muted">{label(key)}</dt>
              <dd className="font-medium">{tree(child, unitOf(key) ? key : unitName, true)}</dd>
            </div>
          ))}
        </dl>
      );
    return (
      <dl className={cn("grid min-w-0 gap-x-6 gap-y-1.5", size, !compact && "sm:grid-cols-2")}>
        {entries.map(([key, child]) =>
          isScalar(child) || (Array.isArray(child) && child.every(isScalar)) ? (
            <div key={key} className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
              <dt className="text-muted">{label(key)}</dt>
              <dd className="font-medium">{tree(child, unitOf(key) ? key : unitName)}</dd>
            </div>
          ) : (
            <div key={key} className="col-span-full flex min-w-0 flex-col gap-1.5">
              <dt className="font-medium">{label(key)}</dt>
              <dd className="border-border min-w-0 border-s ps-3">{tree(child, unitOf(key) ? key : unitName)}</dd>
            </div>
          ),
        )}
      </dl>
    );
  };
  return <div className={cn("min-w-0", size)}>{tree(value, setting.key)}</div>;
}
