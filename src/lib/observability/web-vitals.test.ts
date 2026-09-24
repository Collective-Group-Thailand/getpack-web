import { describe, expect, it, vi } from "vitest";

import { sendReport, shouldReport, type WebVitalReport } from "./web-vitals";

const report: WebVitalReport = {
  name: "LCP",
  value: 1820,
  rating: "good",
  id: "v5-1",
  route: "/orders/[orderId]",
  zone: "admin",
};

describe("shouldReport", () => {
  it("sends the five metrics the budgets are written against", () => {
    for (const name of ["LCP", "INP", "CLS", "FCP", "TTFB"]) expect(shouldReport(name)).toBe(true);
  });

  it("drops Next's internal timings", () => {
    // Sending them would triple the traffic for numbers no budget mentions.
    expect(shouldReport("Next.js-hydration")).toBe(false);
    expect(shouldReport("Next.js-route-change-to-render")).toBe(false);
  });
});

describe("sendReport", () => {
  it("uses sendBeacon, which survives the page being closed", () => {
    // CLS is only final when the page goes away, so an ordinary fetch would lose it.
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal("navigator", { sendBeacon });

    expect(sendReport("/bff/v1/admin/rum/web-vitals", report)).toBe(true);
    expect(sendBeacon).toHaveBeenCalledOnce();

    const [url, blob] = sendBeacon.mock.calls[0] as unknown as [string, Blob];
    expect(url).toBe("/bff/v1/admin/rum/web-vitals");
    // Without an explicit type the browser sends text/plain and the API rejects the body.
    expect(blob.type).toBe("application/json");

    vi.unstubAllGlobals();
  });

  it("falls back to keepalive fetch, with the CSRF header the BFF demands", () => {
    vi.stubGlobal("navigator", {});
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal("fetch", fetchMock);

    expect(sendReport("/bff/v1/admin/rum/web-vitals", report)).toBe(true);

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.keepalive).toBe(true);
    // A POST through the BFF without this is refused (`bff.csrf_header_missing`).
    expect((init.headers as Record<string, string>)["x-packio-csrf"]).toBe("1");

    vi.unstubAllGlobals();
  });

  it("never lets telemetry surface as an error to the person on the page", async () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );

    expect(() => sendReport("/bff/v1/admin/rum/web-vitals", report)).not.toThrow();
    // Let the rejected promise settle; an unhandled rejection would fail the suite.
    await new Promise((resolve) => setTimeout(resolve, 0));

    vi.unstubAllGlobals();
  });
});
