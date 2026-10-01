import { getTranslations } from "next-intl/server";

import { getFormat } from "@/features/shared/format/server";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";

/**
 * How much arrived against what was ordered (D-021, D-080), as the API evaluated it once every
 * delivery was in: within the tolerance a shortage comes back as credit (the API's amount), outside
 * it the customer can claim. Nothing here compares quantities.
 */
export async function ToleranceOutcome({
  outcome,
  unit,
}: {
  outcome: Schemas["OrderToleranceOutcomeDto"];
  unit: string;
}) {
  const [t, format] = await Promise.all([getTranslations("myOrders.tolerance"), getFormat()]);
  const values = {
    delivered: format.number(outcome.deliveredQuantity),
    ordered: format.number(outcome.orderedQuantity),
    unit,
    credit: format.thb(outcome.creditAmount),
  };
  const key =
    outcome.outcome === "shortage_within" && !outcome.creditAmount ? "shortage_within_no_credit" : outcome.outcome;
  const outside = outcome.outcome === "shortage_outside" || outcome.outcome === "overage_outside";
  return (
    <Callout tone={outside ? "warning" : "info"} title={t("title")}>
      {t(key, values)}
    </Callout>
  );
}
