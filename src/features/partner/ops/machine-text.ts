import type { Schemas } from "@/lib/api/types";

type T = (key: string, values?: Record<string, string | number>) => string;

/** A plan's due line on a machine card: "Clean the ink system: 12 days or 40,000 pieces left", or "… due". */
export function planLine(t: T, plan: Schemas["ErpPlanDueDto"], formatNumber: (n: number) => string) {
  if (plan.due) return t("planDue", { title: plan.title });
  const parts = [
    plan.daysLeft !== null ? t("planDays", { n: plan.daysLeft }) : null,
    plan.impressionsLeft !== null ? t("planImpressions", { n: formatNumber(plan.impressionsLeft) }) : null,
  ].filter(Boolean);
  return t("plan", { title: plan.title, days: parts.join(" / ") });
}
