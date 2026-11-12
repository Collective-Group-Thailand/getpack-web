import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPopup = vi.fn();
const signOut = vi.fn(async () => undefined);

vi.mock("firebase/app", () => ({ getApps: () => [], initializeApp: () => ({}) }));
vi.mock("firebase/auth", () => ({
  getAuth: () => ({}),
  GoogleAuthProvider: class {},
  OAuthProvider: class {
    constructor(public providerId: string) {}
  },
  signInWithPopup: (...args: unknown[]) => signInWithPopup(...args),
  signOut: () => signOut(),
}));

import { firebaseIdToken, ProviderCancelled } from "./provider-sdks";

describe("the Firebase sign-in adapter", () => {
  beforeEach(() => {
    signInWithPopup.mockReset();
    signOut.mockClear();
  });

  it("returns the ID token for the API to verify, and keeps no Firebase session", async () => {
    signInWithPopup.mockResolvedValue({ user: { getIdToken: async () => "firebase-id-token" } });
    await expect(firebaseIdToken("google")).resolves.toBe("firebase-id-token");
    expect(signOut).toHaveBeenCalled();
  });

  it("treats a closed popup as a change of mind, not a failure", async () => {
    signInWithPopup.mockRejectedValue(Object.assign(new Error("closed"), { code: "auth/popup-closed-by-user" }));
    await expect(firebaseIdToken("apple")).rejects.toBeInstanceOf(ProviderCancelled);
  });

  it("lets a real failure through", async () => {
    signInWithPopup.mockRejectedValue(Object.assign(new Error("nope"), { code: "auth/internal-error" }));
    await expect(firebaseIdToken("google")).rejects.not.toBeInstanceOf(ProviderCancelled);
  });
});
