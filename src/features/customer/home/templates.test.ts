import { describe, expect, it } from "vitest";

import type { StyleCard } from "@/features/customer/catalog/api.server";

import { HOME_TEMPLATE_CODES, homeTemplates } from "./templates";

const card = (code: string) => ({ code }) as StyleCard;

describe("homeTemplates", () => {
  it("leads with the curated codes in the board's order", () => {
    const published = [...HOME_TEMPLATE_CODES].reverse().map(card);
    expect(homeTemplates(published, []).map((s) => s.code)).toEqual([...HOME_TEMPLATE_CODES]);
  });

  it("fills a gap from the popular styles without repeating one", () => {
    const published = ["PK-LB-01", "PK-CF-01"].map(card);
    const popular = ["PK-CF-01", "PK-XX-01", "PK-XX-02", "PK-XX-03", "PK-XX-04", "PK-XX-05", "PK-XX-06"].map(card);
    expect(homeTemplates(published, popular).map((s) => s.code)).toEqual([
      "PK-LB-01",
      "PK-CF-01",
      "PK-XX-01",
      "PK-XX-02",
      "PK-XX-03",
      "PK-XX-04",
      "PK-XX-05",
    ]);
  });
});
