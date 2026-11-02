import { getTranslations } from "next-intl/server";

import { getFormat } from "@/features/shared/format/server";
import type { Schemas } from "@/lib/api/types";

type Terms = Schemas["StoreAgentTermsDto"];

/**
 * A sales agent plan's terms as the API sends them (D-416, D-464): first-order and repeat rates, the attribution
 * window, "uncapped", the minimum order. Shared by the storefront's programme pages and getpack Agent (D-467).
 */
export async function PlanTerms({ terms }: { terms: Terms }) {
  const [t, format] = await Promise.all([getTranslations("agent.terms"), getFormat()]);
  return (
    <ul className="text-muted flex list-disc flex-col gap-1 ps-5 text-sm">
      <li>{t("first", { pct: terms.firstOrderPct })}</li>
      <li>{t("repeat", { pct: terms.repeatOrderPct, months: terms.attributionMonths })}</li>
      {/* D-464: the full rate at every order size, no cap. */}
      {terms.uncapped ? <li className="text-foreground font-medium">{t("uncapped")}</li> : null}
      {Number(terms.minBaseAmount) > 0 ? <li>{t("minBase", { amount: format.thb(terms.minBaseAmount) })}</li> : null}
      <li>{t("when")}</li>
    </ul>
  );
}

/** The programme's four steps, numbered — the same on the storefront and in getpack Agent. */
export async function HowItWorks({
  leadProtectionDays,
  paymentTermsDays,
  className = "mt-3",
}: {
  leadProtectionDays: number;
  paymentTermsDays: number;
  className?: string;
}) {
  const t = await getTranslations("agent.home");
  return (
    <ol className={`flex flex-col gap-3 text-sm ${className}`}>
      {[t("how1"), t("how2", { days: leadProtectionDays }), t("how3"), t("how4", { days: paymentTermsDays })].map(
        (step, index) => (
          <li key={index} className="flex gap-3">
            <span
              aria-hidden="true"
              className="border-primary text-primary grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums"
            >
              {index + 1}
            </span>
            <span className="pt-0.5 text-pretty">{step}</span>
          </li>
        ),
      )}
    </ol>
  );
}
