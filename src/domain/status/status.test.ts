import { describe, expect, it } from "vitest";

import { defineStatusMap, statusMeta, UNKNOWN_STATUS } from "./types";

/**
 * The maps themselves land in F1, keyed to the generated contract enums. What matters now is
 * that the shape holds the guarantees the rest of the product leans on.
 */
type ExampleStatus = "draft" | "awaiting_payment" | "in_production" | "cancelled";

const EXAMPLE = defineStatusMap<ExampleStatus>({
  draft: { tone: "neutral", icon: "document", labelKey: "example.draft" },
  awaiting_payment: { tone: "warning", icon: "clock", labelKey: "example.awaitingPayment" },
  in_production: { tone: "info", icon: "package", labelKey: "example.inProduction" },
  cancelled: { tone: "danger", icon: "error", labelKey: "example.cancelled" },
});

describe("status metadata", () => {
  it("gives every status a tone, an icon and a label key — never colour alone", () => {
    for (const meta of Object.values(EXAMPLE)) {
      expect(meta.tone).toBeTruthy();
      expect(meta.icon).toBeTruthy();
      expect(meta.labelKey).toBeTruthy();
    }
  });

  it("falls back visibly when the API sends a status the UI has not met", () => {
    // Better a "?" badge than a crash or an invisible blank in front of a customer.
    expect(statusMeta(EXAMPLE, "some_new_backend_value")).toBe(UNKNOWN_STATUS);
    expect(statusMeta(EXAMPLE, "draft").labelKey).toBe("example.draft");
  });
});
