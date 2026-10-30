import { describe, expect, it } from "vitest";

import { MENU_BADGES, rowsSourceAt } from "./badges";

describe("sidebar badges count the tab their entry opens", () => {
  it("reads every badge from the list its link opens", () => {
    for (const [key, badge] of Object.entries(MENU_BADGES)) {
      expect(badge.source, key).toBeTruthy();
      expect(badge.source.resource, key).toBeDefined();
    }
  });

  it("counts G2 work queues with the tab's own query", () => {
    expect(MENU_BADGES.shipments!.source.query).toMatchObject({ queue: "pod_review" });
    expect(MENU_BADGES.production!.source.query).toMatchObject({ atRisk: "true" });
    expect(MENU_BADGES.partners!.source.query).toMatchObject({ status: "applied" });
    expect(MENU_BADGES.structural_requests!.source.query).toMatchObject({ status: "submitted" });
    // The desk's default tab: no query of its own.
    expect(MENU_BADGES.prepress!.source.query).not.toHaveProperty("kind");
    expect(MENU_BADGES.style_intakes!.source.query).not.toHaveProperty("status");
  });

  it("has no count for a page that is not a work list", () => {
    expect(rowsSourceAt("/ops")).toBeNull();
  });
});
