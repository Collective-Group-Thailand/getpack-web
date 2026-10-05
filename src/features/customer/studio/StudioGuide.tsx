"use client";

import { useTranslations } from "next-intl";

import { useFirstRun } from "@/features/shared/first-run/useFirstRun";
import { CoachMarks } from "@/ui/components/CoachMarks";
import { IconButton } from "@/ui/components/IconButton";

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
    </>
  );
}
