import { describe, expect, it } from "vitest";

import { lifeLeft, timeLeft } from "./time-left";

describe("timeLeft (round 2, B12)", () => {
  it("says hours and minutes while there are hours", () => {
    expect(timeLeft((23 * 3600 + 59 * 60 + 14) * 1000)).toEqual({ kind: "hours", hours: 23, minutes: 59 });
  });

  it("says minutes and seconds in the last hour", () => {
    expect(timeLeft((14 * 60 + 5) * 1000)).toEqual({ kind: "minutes", minutes: 14, seconds: "05" });
  });

  it("never goes below zero", () => {
    expect(timeLeft(-5000)).toEqual({ kind: "minutes", minutes: 0, seconds: "00" });
  });
});

describe("lifeLeft", () => {
  it("is the share of the QR's life still ahead", () => {
    const created = "2026-10-06T20:00:00+07:00";
    const expires = "2026-10-07T20:00:00+07:00";
    expect(lifeLeft(created, expires, 12 * 3600 * 1000)).toBeCloseTo(0.5);
    expect(lifeLeft(created, expires, 0)).toBe(0);
  });
});
