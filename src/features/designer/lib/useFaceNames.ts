"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Dieline } from "@packio/dieline";

import { faceNames } from "./faceNames";

/** `faceNames` in the viewer's language, once per dieline. */
export function useFaceNames(d: Dieline | null): Map<string, string> {
  const t = useTranslations("designer.box.position");
  const locale = useLocale() as "th" | "en";
  return useMemo(
    () =>
      d
        ? faceNames(d, locale, { top: t("top"), bottom: t("bottom"), left: t("left"), right: t("right") })
        : new Map<string, string>(),
    [d, locale, t],
  );
}
