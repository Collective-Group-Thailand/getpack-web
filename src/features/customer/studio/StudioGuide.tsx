"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import { ASSISTANT_BUILT_IN } from "@/features/customer/assistant/flag";
import { useFirstRun } from "@/features/shared/first-run/useFirstRun";
import { IconButton } from "@/ui/components/IconButton";

/** The assistant, only in a build that has it (U5.5, D-218) — and then loaded on first press. */
const AssistantLauncher = ASSISTANT_BUILT_IN
  ? dynamic(
      () => import("@/features/customer/assistant/AssistantLauncher").then((module) => module.AssistantLauncher),
      {
        ssr: false,
      },
    )
  : null;

/** Loaded only when a mark is shown (a first visit, or the "?"), never with the studio. */
const CoachMarks = dynamic(() => import("@/ui/components/CoachMarks").then((module) => module.CoachMarks), {
  ssr: false,
});

/**
 * The studio's three coach marks (U5.2 §2): the steps, the live price, and this "?" — shown once on
 * a first visit, dismissible, never blocking, and re-opened from the "?" at any time.
 */
export function StudioGuide({ signedIn = false, coach = true }: { signedIn?: boolean; coach?: boolean }) {
  const t = useTranslations("studio.guide");
  const { show, dismiss, reopen } = useFirstRun("studio-coach-v1");
  // C8: the redesigned editor starts with its own chooser and the easy mode's 4-step guide — no coach marks.
  if (!coach) return AssistantLauncher ? <AssistantLauncher signedIn={signedIn} signInHref="/sign-in" /> : null;
  return (
    <>
      {AssistantLauncher ? <AssistantLauncher signedIn={signedIn} signInHref="/sign-in" /> : null}
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
