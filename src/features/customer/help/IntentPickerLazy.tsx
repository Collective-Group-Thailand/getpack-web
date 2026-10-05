"use client";

import { useTranslations } from "next-intl";
import { lazy, Suspense } from "react";

import { useFirstRun } from "@/features/shared/first-run/useFirstRun";

const Picker = lazy(() => import("./IntentPicker").then((module) => ({ default: module.IntentPicker })));

/**
 * The first-visit intent picker (U5.2 §1). Its code loads only for a browser that has not seen it,
 * or that asks for it again from the link left in its place — every later visit costs a link.
 */
export function IntentPicker(props: { here: "configurator" | "studio"; productSlug?: string | null }) {
  const t = useTranslations("help.intent");
  const firstRun = useFirstRun("intent-v1");
  if (!firstRun.show)
    return (
      <button
        type="button"
        onClick={firstRun.reopen}
        className="text-primary self-start text-sm underline-offset-4 hover:underline"
      >
        {t("reopen")}
      </button>
    );
  return (
    <Suspense fallback={null}>
      <Picker {...props} firstRun={firstRun} />
    </Suspense>
  );
}
