import { defineStatusMap } from "./types";
import type { PnlActualBasis, PnlCellMode, PnlMonthKind, PnlPlanStatus } from "./contract";

/** A management P&L plan (D-472): a draft people fill, or locked — frozen as the baseline of plan vs actual. */
export const PNL_PLAN_STATUS = defineStatusMap<PnlPlanStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "pnlPlan.draft" },
  locked: { tone: "info", icon: "lock", labelKey: "pnlPlan.locked" },
});

/**
 * Where a P&L cell's value comes from (D-472) — the four marks ระบบ · คำนวณ · กรอกเอง · แก้ทับ. Each has its own shape
 * (icon) and words; the tone only reinforces. An override is the one a reader must notice, so it alone is warm.
 */
export const PNL_CELL_MODE = defineStatusMap<PnlCellMode>({
  auto: { tone: "neutral", icon: "zap", labelKey: "pnlCell.auto", descriptionKey: "pnlCell.autoHint" },
  calculated: {
    tone: "neutral",
    icon: "calculator",
    labelKey: "pnlCell.calculated",
    descriptionKey: "pnlCell.calculatedHint",
  },
  manual: { tone: "primary", icon: "edit", labelKey: "pnlCell.manual", descriptionKey: "pnlCell.manualHint" },
  override: { tone: "warning", icon: "flag", labelKey: "pnlCell.override", descriptionKey: "pnlCell.overrideHint" },
});

/** A month of the plan: actual (from the posted ledger) or forecast. */
export const PNL_MONTH_KIND = defineStatusMap<PnlMonthKind>({
  actual: { tone: "neutral", icon: "check", labelKey: "pnlMonth.actual" },
  forecast: { tone: "info", icon: "trend-up", labelKey: "pnlMonth.forecast" },
});

/** What an "actual" figure in plan vs actual rests on (D-472). */
export const PNL_ACTUAL_BASIS = defineStatusMap<PnlActualBasis>({
  ledger: { tone: "neutral", icon: "layers", labelKey: "pnlActual.ledger" },
  calculated: { tone: "neutral", icon: "calculator", labelKey: "pnlActual.calculated" },
  includes_plan_values: { tone: "warning", icon: "edit", labelKey: "pnlActual.includes_plan_values" },
  none: { tone: "neutral", icon: "ban", labelKey: "pnlActual.none" },
  not_yet: { tone: "neutral", icon: "hourglass", labelKey: "pnlActual.not_yet" },
});
