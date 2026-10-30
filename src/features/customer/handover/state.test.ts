import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/problem";

import { displayPhone, screenOfError, screenOfHandover, telHref, trackingTokenOf, type Handover } from "./state";

const handover = {
  shipmentNo: "SH-2610-0001",
  status: "ready",
  statusLabelTh: "พร้อมส่ง",
  cartonsCount: 2,
  cartons: [
    { seq: 1, labelCode: "9F3A0C1B2D4E-01" },
    { seq: 2, labelCode: "9F3A0C1B2D4E-02" },
  ],
  weightG: 12000,
  plannedShipOn: null,
  recipient: {
    name: "สมหญิง ใจดี",
    phone: "+66810001234",
    line1: "99/9 ถนนกาญจนวนิช",
    line2: null,
    postcode: "90110",
    province: { nameTh: "สงขลา", nameEn: "Songkhla" },
  },
  sender: { name: "getpack", phone: "+6620000000" },
  expiresAt: "2026-10-26T16:05:00+07:00",
  pickupConfirmedAt: null,
  canConfirmPickup: true,
} as Handover;

const problem = (status: number, code: string) =>
  new ApiError({ status, code, title: code, detail: code, requestId: "r", type: "about:blank" } as never);

describe("driver handover screens (D-462)", () => {
  it("shows the trip until the pickup is recorded, then the success card", () => {
    expect(screenOfHandover(handover)).toEqual({ kind: "ready", handover });
    const picked = { ...handover, pickupConfirmedAt: "2026-10-20T09:15:00+07:00" };
    expect(screenOfHandover(picked)).toEqual({ kind: "picked-up", handover: picked });
  });

  it("maps an unknown or revoked link (404) and a malformed token (422) to not found", () => {
    expect(screenOfError(problem(404, "http.not_found"))).toEqual({ kind: "not-found" });
    expect(screenOfError(problem(422, "validation.failed"))).toEqual({ kind: "not-found" });
  });

  it("maps 410 to expired", () => {
    expect(screenOfError(problem(410, "handover.expired"), handover)).toEqual({ kind: "expired" });
  });

  it("maps a closed shipping gate (409) to not ready, keeping the trip", () => {
    expect(screenOfError(problem(409, "handover.not_ready"), handover)).toEqual({ kind: "not-ready", handover });
  });

  it("maps a carton of another trip (422 handover.scan_mismatch) to wrong carton", () => {
    expect(screenOfError(problem(422, "handover.scan_mismatch"), handover)).toEqual({
      kind: "wrong-carton",
      handover,
    });
  });

  it("treats throttling, server errors and the network as a retryable error", () => {
    expect(screenOfError(problem(429, "http.too_many_requests"), handover)).toEqual({ kind: "error", handover });
    expect(screenOfError(problem(502, "bff.upstream_unreachable"))).toEqual({ kind: "error", handover: null });
    expect(screenOfError(new TypeError("Failed to fetch"))).toEqual({ kind: "error", handover: null });
  });
});

describe("carton QR", () => {
  const token = "q3J9f0T1xYk8Zb2mR4sW6uE7vN0aLcDh";

  it("reads the tracking token from the public tracking URL, with or without a locale", () => {
    expect(trackingTokenOf(`https://www.getpack.co/track/${token}`)).toBe(token);
    expect(trackingTokenOf(`https://www.getpack.co/en/track/${token}/`)).toBe(token);
    expect(trackingTokenOf(` ${token} `)).toBe(token);
  });

  it("refuses any other QR", () => {
    expect(trackingTokenOf("9F3A0C1B2D4E-01")).toBeNull();
    expect(trackingTokenOf("https://example.com/track/x")).toBeNull();
    expect(trackingTokenOf(`https://www.getpack.co/l/${token}`)).toBeNull();
    expect(trackingTokenOf("WIFI:S:shop;T:WPA;P:secret;;")).toBeNull();
  });

  it("dials the phone as digits and shows it the Thai way", () => {
    expect(telHref("+66 81-000-1234")).toBe("tel:+66810001234");
    expect(displayPhone("+66810001234")).toBe("081-000-1234");
    expect(displayPhone("+6621234567")).toBe("02-123-4567");
    expect(displayPhone("+6653123456")).toBe("053-123-456");
    expect(displayPhone("1234")).toBe("1234");
  });
});
