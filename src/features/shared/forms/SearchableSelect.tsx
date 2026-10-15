"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { SearchSelect, type SearchSelectOption } from "@/ui/components/SearchSelect";
import type { SelectProps } from "@/ui/components/Select";

/**
 * `Select` with a search box once the list is long enough to need one (six options and up —
 * `SearchSelect`'s own threshold), with the search copy from `src/i18n` so no screen has to
 * carry it. Same props as `Select`, so a screen swaps the import and nothing else — the
 * storefront, the account and the back office all use it.
 *
 * The owner asked for every choice list to be searchable (2026-10-14); a short list keeps the
 * plain listbox, because a search box over four options is noise. Uncontrolled use
 * (`defaultValue` alone) keeps its own choice, as `Select` does.
 */
export function SearchableSelect<T extends string = string>({
  options,
  defaultValue,
  value,
  onValueChange,
  ...props
}: SelectProps<T> & { searchFrom?: number }) {
  const t = useTranslations("common.select");
  const [own, setOwn] = useState<T | null>(defaultValue ?? null);
  // `value={x || undefined}` is the controlled "nothing chosen yet"; only `defaultValue` without
  // `value` makes the control keep its own choice.
  const controlled = value !== undefined || defaultValue === undefined;
  return (
    <SearchSelect<T>
      {...props}
      value={controlled ? (value ?? null) : own}
      onValueChange={(next) => {
        if (!controlled) setOwn(next);
        onValueChange?.(next);
      }}
      options={options as SearchSelectOption<T>[]}
      labels={{ search: t("search"), empty: t("empty") }}
    />
  );
}
