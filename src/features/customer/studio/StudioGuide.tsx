"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import { useFirstRun } from "@/features/shared/first-run/useFirstRun";
import { IconButton } from "@/ui/components/IconButton";

/** Loaded only when a mark is shown (a first visit, or the "?"), never with the studio. */
const CoachMarks = dynamic(() => import("@/ui/components/CoachMarks").then((module) => module.CoachMarks), {
  ssr: false,
});

/**
 * The studio's three coach marks (U5.2 §2): the steps, the live price, and this "?" — shown once on
 * a first visit, dismissible, never blocking, and re-opened from the "?" at any time.
 */
export function StudioGuide() {
  const t = useTranslations("studio.guide");
  const { show, dismiss, reopen } = useFirstRun("studio-coach-v1");
  return (
    <>
      <IconButton name="help" size="sm" variant="ghost" label={t("open")} data-coach="studio-help" onClick={reopen} />
      {show ? (
        <CoachMarks
          open={show}
          onClose={dismiss}
          marks={[
            { target: '[data-coach="studio-steps"]', title: t("steps.title"), body: t("steps.body") },
            { target: '[data-coach="studio-price"]', title: t("price.title"), body: t("price.body") },
            { target: '[data-coach="studio-help"]', title: t("help.title"), body: t("help.body") },
          ]}
          labels={{
            next: t("next"),
            done: t("done"),
            skip: t("skip"),
            progress: (current, total) => t("progress", { current, total }),
          }}
        />
      ) : null}
    </>
  );
}
