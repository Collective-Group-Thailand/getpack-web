import { getLocale, getTranslations } from "next-intl/server";

import { pick } from "@/features/customer/catalog/localize";
import { getFormat } from "@/features/shared/format/server";
import type { Schemas } from "@/lib/api/types";
import { ProgressTracker } from "@/ui/components/ProgressTracker";

type Step = Schemas["ProgressStepDto"];

const STATE = { completed: "done", in_progress: "current", pending: "upcoming", skipped: "skipped" } as const;

/**
 * An order's stages as the API lists them (`store.timeline.progress`, F3 3.6): a done stage says
 * when. Shared by the order page and the public tracking page.
 *
 * CONTRACT-GAP store.tracking — the published steps have no promised dates, so a stage still to come
 * says only that it is to come.
 */
export async function OrderStages({ steps, className }: { steps: readonly Step[]; className?: string }) {
  const [t, format, locale] = await Promise.all([getTranslations("fulfilment.stages"), getFormat(), getLocale()]);
  return (
    <ProgressTracker
      className={className}
      label={t("label")}
      stateLabels={{
        done: t("state.done"),
        current: t("state.current"),
        upcoming: t("state.upcoming"),
        skipped: t("state.skipped"),
      }}
      stages={steps.map((step) => ({
        key: step.key,
        title: pick(locale, step.labelTh, step.labelEn),
        state: STATE[step.status],
        time: step.completedAt ? <time dateTime={step.completedAt}>{format.date(step.completedAt)}</time> : undefined,
      }))}
    />
  );
}
