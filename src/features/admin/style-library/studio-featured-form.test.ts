import { describe, expect, it } from "vitest";

import { formOf, move, valueOf } from "./studio-featured-form";

describe("studio featured styles form (C7, D-455)", () => {
  it("round-trips the setting", () => {
    const value = {
      styles: [
        { code: "PK-TE-01", enabled: true },
        { code: "PK-CF-01", enabled: false },
      ],
      usage: { minDesigns: 200, windowDays: 90 },
    };
    expect(valueOf(formOf(value))).toEqual({ ok: true, value });
  });

  it("starts empty with the 90-day window and no usage switch", () => {
    expect(formOf(null)).toEqual({ styles: [], minDesigns: "", windowDays: "90" });
    expect(valueOf(formOf(null))).toEqual({
      ok: true,
      value: { styles: [], usage: { minDesigns: null, windowDays: 90 } },
    });
  });

  it("refuses a bad code, a duplicate, a bad threshold or window", () => {
    const base = formOf(null);
    expect(valueOf({ ...base, styles: [{ code: "pk te", enabled: true }] })).toEqual({ ok: false, error: "code" });
    expect(
      valueOf({
        ...base,
        styles: [
          { code: "PK-TE-01", enabled: true },
          { code: "PK-TE-01", enabled: false },
        ],
      }),
    ).toEqual({ ok: false, error: "duplicate" });
    expect(valueOf({ ...base, minDesigns: "0" })).toEqual({ ok: false, error: "minDesigns" });
    expect(valueOf({ ...base, windowDays: "400" })).toEqual({ ok: false, error: "windowDays" });
  });

  it("moves a style up or down within the list", () => {
    expect(move(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(move(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
  });
});
