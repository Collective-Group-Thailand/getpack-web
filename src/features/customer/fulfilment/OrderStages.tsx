import { getTranslations } from "next-intl/server";

import { getFormat } from "@/features/shared/format/server";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { ProgressTracker } from "@/ui/components/ProgressTracker";

type Stage = ResponseOf<Requests, "GET /v1/store/orders/{orderId}">["stages"][number];

/**
 * An order's stages as the API lists them (F3 3.6), promised against actual: a done stage says
 * when, and when it was promised if it was; a stage still to come says what was promised.
 * Shared by the order page and the public tracking page.
 */
export async function OrderStages({ stages, className }: { stages: readonly Stage[]; className?: string }) {
  const [t, format] = await Promise.all([getTranslations("fulfilment.stages"), getFormat()]);
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
      stages={stages.map((stage) => ({
        key: stage.key,
        title: stage.title,
        state: stage.state,
        time: stage.at ? (
          <time dateTime={stage.at}>
            {stage.promisedAt
              ? t("actualPromised", { actual: format.date(stage.at), promised: format.date(stage.promisedAt) })
              : format.date(stage.at)}
          </time>
        ) : stage.promisedAt ? (
          t("promised", { date: format.date(stage.promisedAt) })
        ) : undefined,
        detail: stage.detail ?? undefined,
      }))}
    />
  );
}
