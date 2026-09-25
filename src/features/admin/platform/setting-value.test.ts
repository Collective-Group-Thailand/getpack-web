import { describe, expect, it } from "vitest";

import { bindFormat } from "@/features/shared/format/bind";

import { describeValue, parseDraft, settingGroup, toDraft } from "./setting-value";

const format = bindFormat("en");

describe("setting values", () => {
  it("shows each type the way the business reads it", () => {
    expect(describeValue("20000.00", "money", format)).toBe("฿20,000.00");
    expect(describeValue("10", "percent", format)).toBe("10%");
    expect(describeValue(15, "integer", format)).toBe("15");
    expect(describeValue({ from: "09:00", to: "20:00", timezone: "Asia/Bangkok" }, "time_of_day_window", format)).toBe(
      "09:00–20:00",
    );
    expect(describeValue(null, "money", format)).toBeNull();
  });

  it("parses money as a two-decimal string, never through a float", () => {
    expect(parseDraft("20000", "money")).toEqual({ ok: true, value: "20000.00" });
    expect(parseDraft("0.1", "money")).toEqual({ ok: true, value: "0.10" });
    expect(parseDraft("1.005", "money")).toEqual({ ok: false, error: "format" });
  });

  it("keeps percentages and decimals as the API's decimal strings", () => {
    expect(parseDraft("12.5", "percent")).toEqual({ ok: true, value: "12.5" });
    expect(parseDraft("12,5", "percent")).toEqual({ ok: false, error: "format" });
  });

  it("parses integers as numbers and refuses a fraction", () => {
    expect(parseDraft("15", "integer")).toEqual({ ok: true, value: 15 });
    expect(parseDraft("1.5", "integer")).toEqual({ ok: false, error: "format" });
  });

  it("validates a marketing window's times (D-144)", () => {
    expect(parseDraft('{"from":"09:00","to":"20:00","timezone":"Asia/Bangkok"}', "time_of_day_window").ok).toBe(true);
    expect(parseDraft('{"from":"9am","to":"20:00"}', "time_of_day_window")).toEqual({ ok: false, error: "format" });
    expect(parseDraft("{not json", "json")).toEqual({ ok: false, error: "json" });
  });

  it("round-trips through the draft", () => {
    const window = { from: "09:00", to: "20:00", timezone: "Asia/Bangkok" };
    expect(parseDraft(toDraft(window, "time_of_day_window"), "time_of_day_window")).toEqual({
      ok: true,
      value: window,
    });
    expect(parseDraft(toDraft(true, "boolean"), "boolean")).toEqual({ ok: true, value: true });
  });

  it("groups by the key's first segment", () => {
    expect(settingGroup("pricing.margin_floor_pct")).toBe("pricing");
  });
});
