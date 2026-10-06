"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { SearchInput } from "@/ui/components/SearchInput";
import { Select } from "@/ui/components/Select";

/** A filter a list offers. Its value lives in the URL under `id`. */
export type FilterDef =
  | { id: string; label: string; kind: "select"; options: readonly { value: string; label: string }[] }
  | { id: string; label: string; kind: "date" }
  | { id: string; label: string; kind: "text"; placeholder?: string };

/** Radix Select cannot hold an empty value, so "any" is a sentinel that never reaches the URL. */
const ANY = "__any";

export function FilterControl({
  filter,
  value,
  onChange,
}: {
  filter: FilterDef;
  value: string | undefined;
  onChange: (value: string | null) => void;
}) {
  const t = useTranslations("console.filters");

  return (
    <Field label={filter.label} className="min-w-40">
      {filter.kind === "select" ? (
        <Select
          value={value ?? ANY}
          onValueChange={(next) => onChange(next === ANY ? null : next)}
          options={[{ value: ANY, label: t("any") }, ...filter.options]}
          className="h-9 text-sm"
        />
      ) : filter.kind === "date" ? (
        <Input
          type="date"
          inputSize="sm"
          className="h-9"
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value || null)}
        />
      ) : (
        <TextFilter value={value ?? ""} onChange={onChange} placeholder={filter.placeholder} />
      )}
    </Field>
  );
}

function TextFilter({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string | null) => void;
  placeholder?: string;
}) {
  const [text, setText] = useDebouncedValue(value, (next) => onChange(next || null));
  return (
    <Input
      inputSize="sm"
      className="h-9"
      value={text}
      placeholder={placeholder}
      onChange={(event) => setText(event.target.value)}
    />
  );
}

/**
 * Local text that reaches the URL 300 ms after the last keystroke — fast enough to feel live,
 * slow enough that typing an order code is one request, not eleven.
 */
export function useDebouncedValue(external: string, commit: (value: string) => void, delay = 300) {
  const [text, setText] = useState(external);
  const [lastExternal, setLastExternal] = useState(external);

  // The URL changed underneath (back button, a saved view): follow it.
  if (external !== lastExternal) {
    setLastExternal(external);
    setText(external);
  }

  useEffect(() => {
    if (text === external) return;
    const timer = setTimeout(() => commit(text), delay);
    return () => clearTimeout(timer);
  }, [text, external, commit, delay]);

  return [text, setText] as const;
}

/** The list's search box, debounced into `?q=`. */
export function ListSearch({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (q: string) => void;
  label: string;
  placeholder?: string;
}) {
  const t = useTranslations("console.filters");
  const [text, setText] = useDebouncedValue(value, onChange);
  return (
    // The placeholder says what to type; the label stays for screen readers only (UX audit: one-line toolbar).
    <Field label={label} labelHidden className="w-full max-w-sm">
      <SearchInput
        value={text}
        onValueChange={setText}
        clearLabel={t("clearSearch")}
        // With no hint of its own, the box says what it searches — never an empty field.
        placeholder={placeholder ?? label}
        inputSize="sm"
        className="[&_input]:h-9"
      />
    </Field>
  );
}
