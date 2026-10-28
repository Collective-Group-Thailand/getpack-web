import { describe, expect, it } from "vitest";

import { formatSupportHours, schemaOpeningHours } from "./support-hours";

const TH = {
  days: (d: string) => ({ daily: "ทุกวัน", business_days: "วันทำการ", mon_fri: "จันทร์–ศุกร์", mon_sat: "จันทร์–เสาร์" })[d]!,
  text: (p: { days: string; open: string; close: string }) => `${p.days} ${p.open}–${p.close}`,
};
const EN = {
  days: (d: string) => ({ daily: "Daily", business_days: "Business days", mon_fri: "Mon–Fri", mon_sat: "Mon–Sat" })[d]!,
  text: (p: { days: string; open: string; close: string }) => `${p.days}, ${p.open}–${p.close}`,
};
const DAILY = { days: "daily", open: "09:00", close: "18:00", tz: "Asia/Bangkok" } as const;

describe("support hours from storefront.support_hours (DECISIONS-STAGE-A §11.7)", () => {
  it("words the structured value per locale", () => {
    expect(formatSupportHours(DAILY, TH)).toBe("ทุกวัน 09:00–18:00");
    expect(formatSupportHours(DAILY, EN)).toBe("Daily, 09:00–18:00");
    expect(formatSupportHours({ ...DAILY, days: "mon_fri" }, EN)).toBe("Mon–Fri, 09:00–18:00");
  });

  it("says nothing without a value", () => {
    expect(formatSupportHours(null, EN)).toBeNull();
    expect(formatSupportHours(undefined, TH)).toBeNull();
  });

  it("gives schema.org opening hours where the days have a form", () => {
    expect(schemaOpeningHours(DAILY)).toBe("Mo-Su 09:00-18:00");
    expect(schemaOpeningHours({ ...DAILY, days: "business_days" })).toBeNull();
    expect(schemaOpeningHours(null)).toBeNull();
  });
});
