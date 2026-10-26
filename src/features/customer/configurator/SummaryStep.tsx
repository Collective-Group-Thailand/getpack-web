"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { Button } from "@/ui/components/Button";
import { Meter } from "@/ui/components/Meter";
import type { StepStatus } from "@/ui/components/Stepper";
import { Icon } from "@/ui/icons";

import type { PriceStep } from "./pricing";
import type { Pattern } from "./model";
import type { StepKey } from "./state";
import type { Draft } from "./useDraft";

export interface SummaryStepProps {
  /** Every step but this one, in order, with what was answered. */
  sections: { step: StepKey; label: string; summary: string | undefined; status: StepStatus }[];
  onEdit: (step: StepKey) => void;
  pattern: Pattern | null;
  /** The priced step for the quantity on screen, when there is one. */
  priced: PriceStep | null;
  /** The spec the price is for, as the API words it (`QuoteCalculationDto.specLabel`), already in the reader's language. */
  pricedSpec?: string | null;
  unit: string;
  draft: Draft | null;
  draftBusy: "save" | "share" | null;
  onDraft: (action: "save" | "share") => void;
}

/**
 * The summary (U2.F1 §5): how complete the configuration is, each section with a way back to
 * edit it, the style code and its international name (D-184, only when verified — D-211), the
 * tolerances the order is made to (D-186, D-163) and what happens next and when — every date and
 * figure the API's. A configuration can be kept as a draft and shared by link (D-185).
 */
export function SummaryStep({ sections, onEdit, pattern, priced, pricedSpec, unit, draft, draftBusy, onDraft }: SummaryStepProps) {
  const t = useTranslations("configurator.summary");
  const format = useFormat();
  const answered = sections.filter((section) => section.status === "complete").length;
  // The API's completeness once a draft exists (D-185); until then, the sections answered.
  const completeness = draft ? draft.completenessPct : (answered / Math.max(1, sections.length)) * 100;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{t("completeness")}</span>
          <span className="tabular-nums">
            {draft
              ? t("completenessDraft", { pct: format.number(draft.completenessPct) })
              : t("completenessSections", { answered, total: sections.length })}
          </span>
        </div>
        <Meter
          value={completeness}
          label={t("completeness")}
          valueText={
            draft
              ? t("completenessDraft", { pct: format.number(draft.completenessPct) })
              : t("completenessSections", { answered, total: sections.length })
          }
          tone={completeness >= 100 ? "success" : "primary"}
        />
        {draft && draft.missingFields.length > 0 ? (
          <p className="text-muted text-xs">{t("missingFields", { count: draft.missingFields.length })}</p>
        ) : null}
      </div>

      {pricedSpec ? (
        <div>
          <p className="text-sm font-medium">{t("pricedSpec")}</p>
          <p className="text-muted text-sm break-words">{pricedSpec}</p>
        </div>
      ) : null}

      <ul className="divide-border flex flex-col divide-y">
        {sections.map((section) => (
          <li key={section.step} className="flex items-start justify-between gap-3 py-2">
            <div className="flex min-w-0 items-start gap-2">
              <Icon
                name={section.status === "complete" ? "success" : section.status === "error" ? "error" : "clock"}
                size={16}
                className={
                  section.status === "complete"
                    ? "text-success mt-0.5"
                    : section.status === "error"
                      ? "text-danger mt-0.5"
                      : "text-muted mt-0.5"
                }
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">{section.label}</p>
                <p className="text-muted text-sm break-words">{section.summary ?? t("notAnswered")}</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(section.step)}
              aria-label={t("editSection", { section: section.label })}
            >
              {t("edit")}
            </Button>
          </li>
        ))}
      </ul>

      {pattern ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">{t("styleCode")}</dt>
          <dd className="font-mono">{pattern.styleCode ?? t("noStyleCode")}</dd>
          <dt className="text-muted">{t("internationalName")}</dt>
          <dd>{pattern.internationalName ?? t("noInternationalName")}</dd>
        </dl>
      ) : null}

      <section aria-labelledby="summary-tolerances">
        <h3 id="summary-tolerances" className="text-sm font-medium">
          {t("tolerances")}
        </h3>
        {priced ? (
          <ul className="text-muted mt-1 flex flex-col gap-0.5 text-sm">
            {priced.toleranceShortagePct && priced.toleranceOveragePct ? (
              <li>
                {t("toleranceQuantity", {
                  shortage: format.percent(priced.toleranceShortagePct, 1),
                  overage: format.percent(priced.toleranceOveragePct, 1),
                })}
              </li>
            ) : null}
            {priced.toleranceDimensionalMm ? (
              <li>{t("toleranceDimensional", { mm: format.number(Number(priced.toleranceDimensionalMm)) })}</li>
            ) : null}
            {priced.toleranceColourDeltaE ? (
              <li>{t("toleranceColour", { deltaE: format.number(Number(priced.toleranceColourDeltaE)) })}</li>
            ) : null}
          </ul>
        ) : (
          <p className="text-muted mt-1 text-sm">{t("tolerancesPending")}</p>
        )}
      </section>

      <section aria-labelledby="summary-next">
        <h3 id="summary-next" className="text-sm font-medium">
          {t("next")}
        </h3>
        <ol className="mt-1 flex list-decimal flex-col gap-0.5 ps-5 text-sm">
          <li>{t("nextSteps.artwork")}</li>
          <li>{t("nextSteps.proof")}</li>
          <li>
            {priced?.leadTimeDays !== null && priced?.leadTimeDays !== undefined
              ? t("nextSteps.productionDays", { days: priced.leadTimeDays })
              : t("nextSteps.production")}
          </li>
          <li>
            {priced?.earliestShipDate
              ? priced.earliestDeliveryDate
                ? t("nextSteps.deliveryBy", {
                    ship: format.date(priced.earliestShipDate),
                    receive: format.date(priced.earliestDeliveryDate),
                  })
                : t("nextSteps.shipBy", { ship: format.date(priced.earliestShipDate) })
              : t("nextSteps.delivery")}
          </li>
        </ol>
        {priced ? <p className="text-muted mt-1 text-xs">{t("nextNote", { unit })}</p> : null}
      </section>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            iconStart="save"
            loading={draftBusy === "save"}
            onClick={() => onDraft("save")}
          >
            {draft ? t("updateDraft") : t("saveDraft")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            iconStart="link"
            loading={draftBusy === "share"}
            onClick={() => onDraft("share")}
          >
            {t("shareDraft")}
          </Button>
        </div>
        <p className="text-muted text-xs">
          {draft ? t("draftKept", { date: format.date(draft.expiresAt) }) : t("draftHint")}
        </p>
      </div>
    </div>
  );
}
