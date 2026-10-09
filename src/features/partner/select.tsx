"use client";

import { useTranslations } from "next-intl";

import { SearchSelect, type SearchSelectProps } from "@/ui/components/SearchSelect";

/**
 * The factory app's dropdown: every list can be typed into (product owner, 2026-10-09 — "let the
 * dropdowns search"), so an owner types "ลูกฟูก" instead of scrolling. Same props as `Select`.
 */
export function Select<T extends string = string>(props: Omit<SearchSelectProps<T>, "labels" | "searchFrom">) {
  const t = useTranslations("partner.select");
  return <SearchSelect {...props} searchFrom={0} labels={{ search: t("search"), empty: t("empty") }} />;
}
