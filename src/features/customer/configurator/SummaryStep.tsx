"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { Button } from "@/ui/components/Button";

import type { PriceStep } from "./pricing";
import type { Pattern } from "./model";
import type { Draft } from "./useDraft";

export interface SummaryStepProps {
  /** The priced step for the quantity on screen, when there is one. */
  priced: PriceStep | null;
  pattern: Pattern | null;
  draft: Draft | null;
  draftBusy: "save" | "share" | null;
  onDraft: (action: "save" | "share") => void;
}

/**
 * "มาตรฐานงานและขั้นตอนต่อไป" (prototype step 07): the tolerances every order is made to, and what
 * happens next with the dates the calculation gave. A configuration can be kept as a draft and
 * shared by link (D-185).
 *
 * Tolerances are the calculation's own figures when it sent them; until then the decided standard
 * (GLOBAL-RULES §6: quantity ± 5 % with the shortfall credited, size ± 3 mm, colour ΔE2000 ≤ 3), worded
 * in the message files. A next-step line whose data has not arrived is not drawn.
 */
export function SummaryStep({ priced, pattern, draft, draftBusy, onDraft }: SummaryStepProps) {
  const t = useTranslations("configurator.summary");
  const format = useFormat();

  const quantity =
    priced?.toleranceShortagePct && priced.toleranceOveragePct
      ? t("toleranceQuantity", {
          shortage: format.percent(priced.toleranceShortagePct, 1),
          overage: format.percent(priced.toleranceOveragePct, 1),
        })
      : t("standard.quantity");
  const size = priced?.toleranceDimensionalMm
    ? t("toleranceDimensional", { mm: format.number(Number(priced.toleranceDimensionalMm)) })
    : t("standard.size");
  const colour = priced?.toleranceColourDeltaE
    ? t("toleranceColour", { deltaE: format.number(Number(priced.toleranceColourDeltaE)) })
    : t("standard.colour");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 min-[640px]:grid-cols-2">
        <section aria-labelledby="summary-tolerances" className="border-border rounded-card border p-4 text-sm">
          <h3 id="summary-tolerances" className="m-0 mb-2 text-sm font-semibold">
            {t("tolerances")}
          </h3>
          <dl className="text-muted m-0 grid grid-cols-[4.5rem_1fr] gap-x-2.5 gap-y-1">
            <dt className="text-subtle">{t("toleranceLabels.quantity")}</dt>
            <dd className="m-0">{quantity}</dd>
            <dt className="text-subtle">{t("toleranceLabels.size")}</dt>
            <dd className="m-0">{size}</dd>
            <dt className="text-subtle">{t("toleranceLabels.colour")}</dt>
            <dd className="m-0">{colour}</dd>
          </dl>
        </section>

        <section aria-labelledby="summary-next" className="border-border rounded-card border p-4 text-sm">
          <h3 id="summary-next" className="m-0 mb-2 text-sm font-semibold">
            {t("next")}
          </h3>
          <ol className="text-muted m-0 flex list-decimal flex-col gap-1 ps-5">
            <li>{t("nextSteps.artwork")}</li>
            <li>{t("nextSteps.proof")}</li>
            {priced?.leadTimeDays != null ? (
              <li>{t("nextSteps.productionDays", { days: priced.leadTimeDays })}</li>
            ) : null}
            {priced?.earliestShipDate ? (
              <li>
                {priced.earliestDeliveryDate
                  ? t("nextSteps.deliveryBy", {
                      ship: format.date(priced.earliestShipDate),
                      receive: format.date(priced.earliestDeliveryDate),
                    })
                  : t("nextSteps.shipBy", { ship: format.date(priced.earliestShipDate) })}
              </li>
            ) : null}
          </ol>
          {priced?.earliestShipDate ? <p className="text-muted mt-2 mb-0 text-xs">{t("nextNote")}</p> : null}
        </section>
      </div>

      {pattern ? (
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">{t("styleCode")}</dt>
          <dd className="m-0 font-mono">{pattern.styleCode ?? t("noStyleCode")}</dd>
          <dt className="text-muted">{t("internationalName")}</dt>
          <dd className="m-0">{pattern.internationalName ?? t("noInternationalName")}</dd>
        </dl>
      ) : null}

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
        <p className="text-muted m-0 text-xs">
          {draft ? t("draftKept", { date: format.date(draft.expiresAt) }) : t("draftHint")}
        </p>
      </div>
    </div>
  );
}
