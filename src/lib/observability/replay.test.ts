import { describe, expect, it } from "vitest";

import { CONSENT_ALL, CONSENT_DENIED } from "@/lib/analytics/consent";

import { mayRecord, REPLAY_OPTIONS, replayEnabled, sampleRate } from "./replay";

const base = { enabled: true, consent: CONSENT_ALL, route: "/configure/[slug]", sampled: true };

describe("session replay", () => {
  it("is off in a build that did not turn it on", () => {
    expect(replayEnabled).toBe(false);
  });

  it("records only when every condition holds", () => {
    expect(mayRecord(base)).toBe(true);
    expect(mayRecord({ ...base, enabled: false })).toBe(false);
    expect(mayRecord({ ...base, sampled: false })).toBe(false);
  });

  it("needs analytics consent — not asked yet is not consent", () => {
    expect(mayRecord({ ...base, consent: null })).toBe(false);
    expect(mayRecord({ ...base, consent: CONSENT_DENIED })).toBe(false);
    expect(mayRecord({ ...base, consent: { analytics: false, marketing: true } })).toBe(false);
    expect(mayRecord({ ...base, consent: { analytics: true, marketing: false } })).toBe(true);
  });

  it.each([
    ["/configure/[slug]", true],
    ["/design/[id]", true],
    ["/studio/[designId]", true],
    ["/cart", true],
    ["/checkout", true],
    ["/checkout/pay/[paymentId]", true],
    ["/account/orders/[orderId]/claim", true],
    ["/account/orders/[orderId]/reorder", true],
    ["/liff/orders/[orderId]/reorder", true],
    ["/", false],
    ["/account", false],
    ["/account/orders/[orderId]", false],
    ["/account/privacy", false],
    ["/sign-in", false],
    ["/track/[token]", false],
    // A real path is never a pattern: an order id in the route never matches.
    ["/account/orders/9f2c/claim", false],
  ])("on %s: %s", (route, allowed) => {
    expect(mayRecord({ ...base, route })).toBe(allowed);
  });

  it("masks everything and captures no bodies", () => {
    expect(REPLAY_OPTIONS).toMatchObject({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
      networkCaptureBodies: false,
      networkDetailAllowUrls: [],
    });
  });

  it("reads the sample rate, clamped, with 10 % as the default", () => {
    expect(sampleRate(undefined)).toBe(0.1);
    expect(sampleRate("0.25")).toBe(0.25);
    expect(sampleRate("7")).toBe(1);
    expect(sampleRate("-1")).toBe(0);
    expect(sampleRate("nope")).toBe(0.1);
  });
});
