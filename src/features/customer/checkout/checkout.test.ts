// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../../mocks/handlers";
import { accessToken } from "../../../../mocks/support";
import { createApiClient } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

import { quantityBand } from "../analytics/bands";
import { formatTaxId, isValidThaiTaxId } from "../account/tax-id";
import { buildCalculateBody } from "../configurator/build";
import { initialState } from "../configurator/state";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

describe("tax ids and funnel bands", () => {
  it("checks the 13-digit checksum", () => {
    expect(isValidThaiTaxId("0105556000017")).toBe(true);
    expect(isValidThaiTaxId("0105556000019")).toBe(false);
    expect(isValidThaiTaxId("010555600001")).toBe(false);
    expect(formatTaxId("0105556000017")).toBe("0-1055-56000-01-7");
  });

  it("reports quantities as bands, never exact", () => {
    expect(quantityBand(50)).toBe("<100");
    expect(quantityBand(1000)).toBe("1000-2999");
    expect(quantityBand(2999)).toBe("1000-2999");
    expect(quantityBand(250_000)).toBe("100000+");
  });
});

/** The checkout mock's rules, as the storefront relies on them (the API's are the real ones). */
describe("the checkout, against the mock", () => {
  // Built per call: a client made before `server.listen()` would hold the unpatched `fetch`.
  const api = () => createApiClient({ baseUrl: "http://api.mock", accessToken: accessToken("customer") });

  /** An empty cart, then one quotation of `quantity` in it — through the published cart. */
  async function cartWith(quantity: number) {
    const { data: cart } = await api().GET("/v1/store/cart");
    for (const item of cart!.items)
      await api().DELETE("/v1/store/cart/items/{itemId}", { params: { path: { itemId: item.id } } });
    const { data: published } = await api().GET("/v1/store/catalog/products/{slug}/configurator", {
      params: { path: { slug: "tuck-end-box" } },
    });
    const configurator = published!;
    const state = { ...initialState(configurator), quantities: [quantity], quantity };
    const { data: quote } = await api().POST("/v1/store/quotes", {
      body: buildCalculateBody(configurator, state) as unknown as Schemas["SaveQuoteDto"],
    });
    const { response } = await api().GET("/v1/store/cart");
    await api().POST("/v1/store/cart/items", {
      params: { header: { "If-Match": response.headers.get("etag")! } },
      body: { quoteId: quote!.id, quoteOptionId: quote!.options[0]!.id, designOption: "own_file" },
    });
  }

  const preview = async (body: Schemas["CheckoutDto"] = { taxProfileId: null }) =>
    (await api().POST("/v1/store/checkout/actions/preview", { body })).data!;

  it("pays in full below the threshold, and 50/50 above it (D-020) — the schedule the rules chose", async () => {
    await cartWith(500);
    const small = await preview();
    expect(small.paymentSchedule!.instalments).toHaveLength(1);
    expect(small.paymentSchedule!.instalments[0]).toMatchObject({ dueTrigger: "at_checkout" });

    await cartWith(5000);
    const large = await preview();
    expect(large.paymentSchedule!.templateKey).toBe("deposit_50");
    expect(large.paymentSchedule!.instalments.map((instalment) => instalment.requiredBefore)).toEqual([
      "production",
      "shipping",
    ]);
  });

  it("keeps points within the D-133 limits and says so in its notices", async () => {
    await cartWith(1000);
    const many = await preview({ taxProfileId: null, redeemPoints: 999_999 });
    expect(many.notices.map((notice) => notice.code)).toContain("points.capped");
    const one = await preview({ taxProfileId: null, redeemPoints: 1 });
    expect(one.notices.map((notice) => notice.code)).toContain("points.rejected");
  });

  it("refuses a placement whose total moved since the preview", async () => {
    await cartWith(1000);
    const seen = await preview();
    await cartWith(2000);
    await expect(
      api().POST("/v1/store/checkout", {
        params: { header: { "Idempotency-Key": "test-reprice" } },
        body: { taxProfileId: null, expectedGrossAmount: seen.totals.grossAmount },
      }),
    ).rejects.toMatchObject({ status: 409, code: "checkout.total_changed" });
  });
});
