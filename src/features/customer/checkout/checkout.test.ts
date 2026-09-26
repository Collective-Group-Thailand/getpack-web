// @vitest-environment node
import { setupServer } from "msw/node";
import type { Client } from "openapi-fetch";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../../mocks/handlers";
import { accessToken } from "../../../../mocks/support";
import { createApiClient } from "@/lib/api/client";
import { createRequestClient } from "@/lib/api/requests/client";
import { REQUESTS } from "@/lib/api/requests/registry";

import { quantityBand } from "../analytics/bands";
import { formatTaxId, isValidThaiTaxId } from "../account/tax-id";
import { buildConfiguration } from "../configurator/build";
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
  const client = () =>
    createRequestClient(
      REQUESTS,
      createApiClient({ baseUrl: "http://api.mock", accessToken: accessToken("customer") }) as unknown as Client<never>,
    );
  const customer = {
    call: ((...args: unknown[]) => (client().call as (...a: unknown[]) => unknown)(...args)) as ReturnType<
      typeof client
    >["call"],
  };

  async function cartWith(quantity: number) {
    const cart = await customer.call("GET /v1/store/cart");
    for (const item of cart.items)
      await customer.call("DELETE /v1/store/cart/items/{itemId}", { path: { itemId: item.id } });
    const configurator = await customer.call("GET /v1/store/catalog/products/{slug}/configurator", {
      path: { slug: "tuck-end-box" },
    });
    const state = { ...initialState(configurator), quantities: [quantity], quantity };
    const quote = await customer.call("POST /v1/store/quotes", {
      body: {
        productTypeCode: configurator.productTypeCode,
        catalogProductSlug: configurator.slug,
        configuration: buildConfiguration(configurator, state) as unknown as Record<string, unknown>,
        quantity,
        designOption: "own_file",
        mockupOption: "none",
      },
    });
    await customer.call("POST /v1/store/cart/items", { body: { quoteId: quote.id } });
  }

  const input = {
    contact: { name: "ทดสอบ", phone: "0812345678", email: "seed.customer@packio.invalid" },
    delivery: { mode: "per_item" as const },
    taxProfileId: null,
    couponCodes: [],
    pointsToRedeem: 0,
  };

  it("offers only full payment below the threshold, and 50/50 above it (D-020)", async () => {
    await cartWith(500);
    const small = await customer.call("POST /v1/store/checkout/actions/preview", { body: input });
    expect(small.schedule.options.map((option) => option.key)).toEqual(["full"]);
    expect(small.totals.payableNowAmount).toBe(small.totals.grossAmount);

    await cartWith(5000);
    const large = await customer.call("POST /v1/store/checkout/actions/preview", { body: input });
    expect(large.schedule.selectedKey).toBe("deposit_50");
    expect(large.schedule.options[0]!.instalments.map((instalment) => instalment.requiredBefore)).toEqual([
      "production",
      "shipping",
    ]);
  });

  it("keeps points within the D-133 limits and says so", async () => {
    await cartWith(1000);
    const preview = await customer.call("POST /v1/store/checkout/actions/preview", {
      body: { ...input, pointsToRedeem: 999_999 },
    });
    expect(preview.points.redeemed).toBe(preview.points.max);
    expect(preview.blockers.map((blocker) => blocker.code)).toContain("points_above_maximum");
    const tooFew = await customer.call("POST /v1/store/checkout/actions/preview", {
      body: { ...input, pointsToRedeem: 1 },
    });
    expect(tooFew.blockers.map((blocker) => blocker.code)).toContain("points_below_minimum");
  });

  it("refuses a placement whose cart changed after the preview", async () => {
    await cartWith(1000);
    const preview = await customer.call("POST /v1/store/checkout/actions/preview", { body: input });
    await cartWith(2000);
    await expect(
      customer.call("POST /v1/store/checkout", {
        body: { ...input, previewToken: preview.previewToken },
        idempotencyKey: "test-reprice",
      }),
    ).rejects.toMatchObject({ status: 409, code: "checkout.repriced" });
  });
});
