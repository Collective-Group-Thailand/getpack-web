import { describe, expect, it } from "vitest";

import { decodeVapidKey, mayPrompt, pushPermissionState, type PushEnvironment } from "./vapid";

const supported: PushEnvironment = {
  hasVapidKey: true,
  supportsServiceWorker: true,
  supportsPush: true,
  permission: "default",
};

describe("decodeVapidKey", () => {
  it("decodes base64url, which is what a VAPID key ships as", () => {
    // "Hello!" as base64url. The standard alphabet would use + and /, which atob needs.
    expect(new TextDecoder().decode(decodeVapidKey("SGVsbG8h"))).toBe("Hello!");
  });

  it("restores padding the URL-safe form drops", () => {
    expect(decodeVapidKey("SGVsbG8").length).toBe(5);
    expect(decodeVapidKey("SGVsbA").length).toBe(4);
  });

  it("translates the URL-safe alphabet", () => {
    // 0xFB 0xFF encodes as "+/8=" in standard base64 and "-_8" in base64url.
    expect([...decodeVapidKey("-_8")]).toEqual([251, 255]);
  });
});

describe("pushPermissionState", () => {
  it("is unsupported where the browser has no push at all", () => {
    expect(pushPermissionState({ ...supported, supportsPush: false })).toBe("unsupported");
    expect(pushPermissionState({ ...supported, supportsServiceWorker: false })).toBe("unsupported");
    // iOS Safari outside a home-screen app: no Notification API.
    expect(pushPermissionState({ ...supported, permission: undefined })).toBe("unsupported");
  });

  it("is unconfigured when this deployment has no VAPID key", () => {
    expect(pushPermissionState({ ...supported, hasVapidKey: false })).toBe("unconfigured");
  });

  it("distinguishes a refusal from a question not yet asked", () => {
    // Once denied, requestPermission() resolves instantly with no prompt, so a button that
    // offers to ask is offering something that cannot work.
    expect(pushPermissionState({ ...supported, permission: "denied" })).toBe("denied");
    expect(pushPermissionState({ ...supported, permission: "default" })).toBe("askable");
    expect(pushPermissionState({ ...supported, permission: "granted" })).toBe("granted");
  });
});

describe("mayPrompt", () => {
  it("never prompts before a meaningful action", () => {
    // The rule F1 1.3 asks for, as a test rather than a convention: a prompt on page load is
    // refused by most people, and a refusal is permanent.
    expect(mayPrompt("askable", false)).toBe(false);
  });

  it("prompts once there has been one", () => {
    expect(mayPrompt("askable", true)).toBe(true);
  });

  it("never prompts in any other state", () => {
    for (const state of ["unsupported", "unconfigured", "granted", "denied"] as const) {
      expect(mayPrompt(state, true), state).toBe(false);
    }
  });
});
