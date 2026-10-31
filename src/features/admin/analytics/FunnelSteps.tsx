"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format";
import { BarValue } from "@/ui/components/charts";
import { DataTable } from "@/ui/components/DataTable";

export interface FunnelStep {
  key: string;
  label: string;
  sessions: number;
  /** The API's sessions at this step ÷ sessions at the step before, % (`null` for the first). */
  fromPreviousPct: string | null;
  /** The API's sessions at this step ÷ the first step's, % — the site funnel sends it. */
  fromVisitPct?: string | null;
}

/** True when a step counted more sessions than the one before — only possible because steps are counted apart. */
export const aboveBefore = (pct: string | null | undefined) => pct !== null && pct !== undefined && Number(pct) > 100;

/**
 * A funnel as a dense table: each step, its sessions with a thin green bar (against the largest step), and the
 * API's ratio to the step before. The API counts every step's sessions on its own, per day (a session may enter
 * mid-way), so the ratio is "sessions here against sessions there". A step that counted more than the one before
 * shows no percentage (a step conversion is never over 100 %): it says so, and the note under the table says why.
 */
export function FunnelSteps({ caption, steps }: { caption: string; steps: readonly FunnelStep[] }) {
  const t = useTranslations("analytics.journeys");
  const format = useFormat();
  const max = Math.max(0, ...steps.map((step) => step.sessions));
  const visits = steps.some((step) => step.fromVisitPct !== undefined);
  const ratio = (pct: string | null | undefined, first: boolean) =>
    first ? (
      <span className="text-muted">{t("first")}</span>
    ) : pct === null || pct === undefined ? (
      "—"
    ) : aboveBefore(pct) ? (
      // Not a conversion: never "166 %". The counts beside it are the API's figures.
      <span className="text-muted text-xs">{t("above")}</span>
    ) : (
      format.percent(pct)
    );
  return (
    <div className="flex flex-col gap-2">
      <DataTable<FunnelStep>
        caption={caption}
        density="compact"
        rows={steps}
        getRowId={(step) => step.key}
        columns={[
          { id: "step", header: t("step"), cell: (step) => step.label },
          {
            id: "sessions",
            header: t("sessions"),
            numeric: true,
            cell: (step) => (
              <BarValue value={step.sessions} max={max}>
                {format.number(step.sessions)}
              </BarValue>
            ),
          },
          {
            id: "previous",
            header: t("relative"),
            numeric: true,
            cell: (step) => ratio(step.fromPreviousPct, step === steps[0]),
          },
          ...(visits
            ? [
                {
                  id: "visits",
                  header: t("fromVisit"),
                  numeric: true,
                  cell: (step: FunnelStep) => ratio(step.fromVisitPct, step === steps[0]),
                },
              ]
            : []),
        ]}
      />
      {steps.some((step) => aboveBefore(step.fromPreviousPct)) ? (
        <p className="text-muted text-xs text-pretty">{t("relativeNote")}</p>
      ) : null}
    </div>
  );
}
