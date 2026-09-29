import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONSENT_ALL, CONSENT_DENIED, type ConsentState } from "@/lib/analytics/consent";

const state = vi.hoisted(() => ({
  segments: ["configure", "mailer-box"] as string[],
  params: { slug: "mailer-box" } as Record<string, string>,
  consent: null as ConsentState | null,
}));
const setRecording = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("next/navigation", () => ({
  useSelectedLayoutSegments: () => state.segments,
  useParams: () => state.params,
}));
vi.mock("@/lib/analytics/useConsent", () => ({
  useConsent: () => ({ consent: state.consent, asked: state.consent !== null, save: () => {} }),
}));
// A build with replay on, sampled in: only the route and the consent decide.
vi.mock("./replay", async (original) => ({
  ...(await original<typeof import("./replay")>()),
  replayEnabled: true,
  sampleRate: () => 1,
  setRecording,
}));

const { SessionReplay } = await import("./SessionReplay");

describe("<SessionReplay> in a build that has it on", () => {
  beforeEach(() => {
    setRecording.mockClear();
    state.segments = ["configure", "mailer-box"];
    state.params = { slug: "mailer-box" };
  });

  it("records a key journey once analytics is consented to", () => {
    state.consent = CONSENT_ALL;
    render(<SessionReplay />);
    expect(setRecording).toHaveBeenLastCalledWith(true);
  });

  it("does not record without consent", () => {
    state.consent = null;
    const { rerender } = render(<SessionReplay />);
    expect(setRecording).toHaveBeenLastCalledWith(false);
    state.consent = CONSENT_DENIED;
    rerender(<SessionReplay />);
    expect(setRecording).toHaveBeenLastCalledWith(false);
  });

  it("stops on a page that is not a key journey", () => {
    state.consent = CONSENT_ALL;
    const { rerender } = render(<SessionReplay />);
    expect(setRecording).toHaveBeenLastCalledWith(true);
    state.segments = ["(storefront)", "account", "privacy"];
    state.params = {};
    rerender(<SessionReplay />);
    expect(setRecording).toHaveBeenLastCalledWith(false);
  });
});
