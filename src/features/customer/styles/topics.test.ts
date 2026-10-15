import { describe, expect, it } from "vitest";

import master from "../../../../docs/design-tool/style-library-master.json" with { type: "json" };
import th from "../../../i18n/messages/th/customer/styles.json" with { type: "json" };
import en from "../../../i18n/messages/en/customer/styles.json" with { type: "json" };

import { shortName, topicFilter, topicsOf, TOPICS, variantIn } from "./topics";
import { USE_CASES } from "./use-cases";

describe("option topics (D-410)", () => {
  it("reads a style's chips from its options, never from a value it lacks", () => {
    const ids = topicsOf(["tuck_bottom:crash_lock", "window:front_window", "hang:euro_slot"]).map((t) => t.id);
    expect(ids).toEqual(["with-window", "with-hang-tab", "lock-bottom"]);
    expect(topicsOf(["tuck_bottom:tuck", "window:none"])).toEqual([]);
  });

  it("filters a style on the one axis it has: a front and a top window are one page", () => {
    const window = TOPICS.find((t) => t.id === "with-window")!;
    expect(topicFilter(window, ["window:front_window", "window:top_window"])).toEqual([
      "window:front_window",
      "window:top_window",
    ]);
    expect(topicFilter(window, ["pouch_feat:window", "pouch_feat:zipper"])).toEqual(["pouch_feat:window"]);
    expect(variantIn(window, { pouch_feat: ["zipper", "window"] })).toBe(true);
    expect(variantIn(window, { window: "none" })).toBe(false);
  });

  it("gives the library about 150 style pages for a feature (D-410: 150–250 with the hubs and products)", () => {
    const pages = master.styles.flatMap((s) => {
      const axes = s.variant_axes.split(";").filter(Boolean);
      return TOPICS.filter((t) => Object.keys(t.options).some((a) => axes.includes(a)));
    });
    const total = pages.length + TOPICS.length + USE_CASES.length;
    expect(total).toBeGreaterThanOrEqual(150);
    expect(total).toBeLessThanOrEqual(250);
  });

  it("names every topic and product in both languages, and every master use case has a page", () => {
    for (const messages of [th, en]) {
      for (const t of TOPICS)
        expect(Object.keys((messages.topics as Record<string, object>)[t.id] ?? {}).sort()).toEqual([
          "about",
          "chip",
          "phrase",
          "title",
        ]);
      for (const u of USE_CASES)
        expect((messages.useCasePages as Record<string, { title?: string }>)[u]?.title).toBeTruthy();
    }
    const used = new Set(master.styles.flatMap((s) => (s as { use_cases?: string[] }).use_cases ?? []));
    expect([...used].filter((u) => !(USE_CASES as readonly string[]).includes(u))).toEqual([]);
  });

  it("shortens a style's name for a title", () => {
    expect(shortName("กล่องฝาเสียบ (ปรับฝาบน-ล่างได้)")).toBe("กล่องฝาเสียบ");
    expect(shortName("Pillow box")).toBe("Pillow box");
  });
});
