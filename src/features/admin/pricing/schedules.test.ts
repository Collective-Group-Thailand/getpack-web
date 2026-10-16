import { describe, expect, it } from "vitest";

import { checkSchedule, emptyInstalment, toApiInstalments, toApiRule, toEditableRule } from "./schedules";

const rule = toEditableRule(null);

describe("payment schedule templates (D-020)", () => {
  it("needs instalments adding up to exactly 100 %", () => {
    const half = { ...emptyInstalment(), labelTh: "มัดจำ", labelEn: "Deposit", pct: "50" };
    expect(checkSchedule([half], rule)).toEqual({ problems: ["total"], total: 50 });
    expect(checkSchedule([half, { ...half, pct: "50" }], rule).problems).toEqual([]);
    expect(checkSchedule([half, { ...half, pct: "33.3333" }, { ...half, pct: "16.6667" }], rule).problems).toEqual([]);
  });

  it("asks for the days of an instalment due after delivery", () => {
    const later = {
      ...emptyInstalment(),
      labelTh: "ส่วนที่เหลือ",
      labelEn: "Balance",
      pct: "100",
      dueTrigger: "days_after_delivery" as const,
    };
    expect(checkSchedule([later], rule).problems).toEqual(["offset"]);
    expect(toApiInstalments([{ ...later, dueOffsetDays: "30" }])[0]!.dueOffsetDays).toBe(30);
  });

  it("keeps a setting reference in the selection rule", () => {
    const api = {
      orderValue: { gte: { setting: "payments.schedule_split_threshold" } },
      customerTypes: ["juristic"],
      creditApproved: false,
    };
    const editable = toEditableRule(api);
    expect(editable.gte).toBe("setting:payments.schedule_split_threshold");
    expect(toApiRule(editable)).toEqual(api);
    expect(toApiRule(toEditableRule({}))).toEqual({});
  });

  it("refuses a bound that is neither an amount nor a setting", () => {
    const half = { ...emptyInstalment(), labelTh: "ก", labelEn: "a", pct: "100" };
    expect(checkSchedule([half], { ...rule, lt: "lots" }).problems).toEqual(["bound"]);
  });
});
