import type { StepKey } from "./state";

/** The steps whose answer starts as the catalogue's default (material, printing, finishing, assembly). */
const DEFAULTED: readonly StepKey[] = ["material", "printing", "finishing", "assembly"];

/**
 * A choice step still on its starting value is shown as "ค่าเริ่มต้น", not as done, until the
 * customer changes something in it or confirms it with "ถัดไป" (UAT: steps 2–4 read "เรียบร้อยแล้ว"
 * before anyone touched them). Display only — it does not change what is priced.
 */
export const isDefaultStep = (step: StepKey, touched: ReadonlySet<StepKey>) =>
  DEFAULTED.includes(step) && !touched.has(step);
