// @vitest-environment node
import { createTranslator } from "next-intl";
import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import catalog from "@/i18n/messages/th/customer/catalog.json";
import storefront from "@/i18n/messages/th/customer/storefront.json";

/**
 * U2.F4 (D-181, D-264): the trust pages' empty states, snapshotted — what a visitor reads when the
 * API has no reviews yet or holds the network's figures back. Never a placeholder testimonial,
 * never a made-up figure.
 */

vi.mock("server-only", () => ({}));
// The pages' structured data reads the request's origin (`publicOrigin`): a fixed one outside a request.
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "getpack.test", "x-forwarded-proto": "https" }),
  cookies: async () => ({ get: () => undefined, getAll: () => [] }),
}));
vi.mock("next-intl/server", () => ({
  setRequestLocale: () => undefined,
  getLocale: async () => "th",
  getTranslations: async (namespace: string) =>
    createTranslator({ locale: "th", messages: { storefront, catalog }, namespace: namespace as never }),
}));
// The next action every empty state now offers (U5.1 §3), as a plain link: it reads the client intl context.
vi.mock("@/features/customer/shell/NextStep", () => ({
  NextStep: ({ to }: { to: string }) => <a href={`/${to}`}>{`next.${to}`}</a>,
}));
vi.mock("@/features/shared/format/server", () => ({
  getFormat: async () => ({
    date: (iso: string) => iso.slice(0, 10),
    number: (n: number) => String(n),
  }),
}));
vi.mock("@/features/customer/trust/api.server", () => ({
  getReviewSummary: async () => ({ averageRating: null, byProductType: [], count: 0, distribution: [] }),
  listReviews: async () => ({ reviews: [], total: 0 }),
  getNetworkStats: async () => ({
    auditCriteria: [],
    coverage: [],
    generatedAt: "2026-10-05T10:00:00+07:00",
    network: {
      published: false,
      partnerCount: null,
      onTimePct: null,
      firstPassPct: null,
      windowDays: 90,
      minFactories: 3,
      minJobs: 30,
    },
  }),
}));

// Streamed to the end: the pages' structured data and breadcrumbs now suspend while they resolve.
const render = async (page: (props: { params: Promise<{ locale: string }> }) => Promise<React.ReactElement>) => {
  const stream = await renderToReadableStream(await page({ params: Promise.resolve({ locale: "th" }) }));
  await stream.allReady;
  return new Response(stream).text();
};

describe("trust pages with nothing to show yet", () => {
  it("reviews: says there are none and that samples are never used", async () => {
    const { default: ReviewsPage } = await import("@/app/[locale]/(storefront)/reviews/page");
    const html = await render(ReviewsPage);
    expect(html).toContain("ยังไม่มีรีวิว");
    expect(html).not.toContain("ยืนยันแล้วว่ามาจากคำสั่งซื้อจริง");
    expect(html).toMatchSnapshot();
  });

  it("network: holds the figures back and says why", async () => {
    const { default: NetworkPage } = await import("@/app/[locale]/(storefront)/network/page");
    const html = await render(NetworkPage);
    expect(html).toContain("ยังไม่เผยแพร่ตัวเลข");
    expect(html).not.toMatch(/\d+%/);
    expect(html).toMatchSnapshot();
  });
});
