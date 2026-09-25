"use client";

import { useLocale } from "next-intl";
import { useMemo } from "react";

import { bindFormat, type BoundFormat } from "./bind";
import type { Locale } from "@/i18n/routing";

/**
 * The `src/i18n/format` helpers bound to the locale being rendered, for Client Components.
 * `src/ui` takes formatted strings as props and never imports `src/i18n`; this is the seam.
 */
export function useFormat(): BoundFormat {
  const locale = useLocale() as Locale;
  return useMemo(() => bindFormat(locale), [locale]);
}
