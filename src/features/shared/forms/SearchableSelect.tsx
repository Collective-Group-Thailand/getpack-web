"use client";

import { useTranslations } from "next-intl";

import { SearchSelect, type SearchSelectOption } from "@/ui/components/SearchSelect";
import type { SelectProps } from "@/ui/components/Select";

/**
 * `Select` with a search box once the list is long enough to need one (six options and up —
 * `SearchSelect`'s own threshold), with the search copy from `src/i18n` so no screen has to
 * carry it. Same props as `Select`, so a screen swaps the import and nothing else.
 *
 * The owner asked for every choice list to be searchable (2026-10-14); a short list keeps the
 * plain listbox, because a search box over four options is noise.
 */
export function SearchableSelect<T extends string = string>({
  options,
  defaultValue,
  value,
  ...props
}: SelectProps<T> & { searchFrom?: number }) {
  const t = useTranslations("common.select");
  return (
    <SearchSelect<T>
      {...props}
      value={value ?? defaultValue ?? null}
      options={options as SearchSelectOption<T>[]}
      labels={{ search: t("search"), empty: t("empty") }}
    />
  );
}
