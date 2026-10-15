// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers, MOCK_ID_TOKENS, MOCK_NEW_CUSTOMER_PHONE, MOCK_OTP } from "../../../mocks/handlers";
import { createApiClient } from "./client";

/**
 * The storefront mock behaves like the surface it stands in for: it shows what the back office
 * has published and nothing else, answers public reads without a session, and gives the two
 * customer personas the state the sign-in steps depend on.
 */

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

const anonymous = () => createApiClient({ baseUrl: "http://api.mock" });
const as = (accessToken: string) => createApiClient({ baseUrl: "http://api.mock", accessToken });

async function signInByOtp(phone: string) {
  const api = anonymous();
  const { data: challenge } = await api.POST("/v1/auth/customer/otp/request", { body: { phone, purpose: "login" } });
  const { data: session } = await api.POST("/v1/auth/customer/otp/verify", {
    body: { challengeId: challenge!.challengeId, code: MOCK_OTP.code },
  });
  return as(session!.accessToken);
}

describe("the storefront catalogue mock", () => {
  it("lists active products only, without a session", async () => {
    const { data } = await anonymous().GET("/v1/store/catalog/products", { params: { query: { perPage: 100 } } });
    const slugs = data!.data.map((product) => product.slug);
    expect(slugs).toContain("mailer-box");
    expect(slugs).not.toContain("tray-box"); // a draft in admin
  });

  it("filters by product type and answers a product's page", async () => {
    const { data } = await anonymous().GET("/v1/store/catalog/products", {
      params: { query: { productType: "corrugated" } },
    });
    expect(data!.data.every((product) => product.productTypeCode === "corrugated")).toBe(true);

    const { data: product } = await anonymous().GET("/v1/store/catalog/products/{slug}", {
      params: { path: { slug: "tuck-end-box" } },
    });
    expect(product!.standardSizes.map((size) => size.code)).toEqual(["S", "M", "L"]);
    expect(product!.optionGroups.length).toBeGreaterThan(0);
  });

  it("hides a draft product's page and an unpublished article", async () => {
    await expect(
      anonymous().GET("/v1/store/catalog/products/{slug}", { params: { path: { slug: "tray-box" } } }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      anonymous().GET("/v1/store/catalog/articles/{slug}", { params: { path: { slug: "food-safe-packaging" } } }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("searches across products and articles", async () => {
    const { data } = await anonymous().GET("/v1/store/catalog/search", { params: { query: { q: "กล่อง" } } });
    const kinds = data!.hits.map((hit) => hit.kind);
    expect(kinds).toContain("catalog_product");
    expect(kinds).toContain("article");
  });
});

describe("the storefront's customers", () => {
  it("signs the returning customer straight in: every consent answered, an e-mail on file", async () => {
    const api = await signInByOtp(MOCK_OTP.phone);
    const { data: consents } = await api.GET("/v1/store/me/consents");
    expect(consents!.every((consent) => consent.granted !== null)).toBe(true);
    const { data: me } = await api.GET("/v1/store/me");
    expect(me!.email).not.toBeNull();
  });

  it("gives the newcomer nothing, and remembers what they record", async () => {
    const api = await signInByOtp(MOCK_NEW_CUSTOMER_PHONE);
    const { data: before } = await api.GET("/v1/store/me/consents");
    expect(before!.every((consent) => consent.granted === null)).toBe(true);

    await api.POST("/v1/store/me/consents", { body: { purpose: "terms_of_service", granted: true, source: "web" } });
    const { data: after } = await api.GET("/v1/store/me/consents");
    expect(after!.find((consent) => consent.purpose === "terms_of_service")?.granted).toBe(true);

    // A fresh sign-in is a fresh account again.
    const again = await signInByOtp(MOCK_NEW_CUSTOMER_PHONE);
    const { data: reset } = await again.GET("/v1/store/me/consents");
    expect(reset!.every((consent) => consent.granted === null)).toBe(true);
  });

  it("accepts its own Firebase and LINE tokens and refuses anything else", async () => {
    const ok = await anonymous().POST("/v1/auth/customer/firebase", { body: { idToken: MOCK_ID_TOKENS.google } });
    expect(ok.data?.subject.type).toBe("customer");
    const line = await anonymous().POST("/v1/auth/customer/line", { body: { idToken: MOCK_ID_TOKENS.line } });
    expect(line.data?.subject.type).toBe("customer");
    await expect(
      anonymous().POST("/v1/auth/customer/firebase", { body: { idToken: "real-looking" } }),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe("the style library mock", () => {
  it("publishes every master base with facets, pages by cursor and finds a Thai synonym", async () => {
    const api = anonymous();
    const { data: first } = await api.GET("/v1/store/styles", { params: { query: { limit: 24 } } });
    expect(first!.data).toHaveLength(24);
    expect(first!.facets.category.reduce((n, f) => n + f.count, 0)).toBe(123);
    const { data: second } = await api.GET("/v1/store/styles", {
      params: { query: { limit: 24, cursor: first!.meta.nextCursor! } },
    });
    expect(second!.data[0]!.code).not.toBe(first!.data[0]!.code);
    const { data: found } = await api.GET("/v1/store/styles", { params: { query: { q: "หูช้าง" } } });
    expect(found!.data.map((s) => s.code)).toContain("PK-CF-01");
  });

  it("publishes a wave-1 style's variants as the engine draws them — all 183 buildable (D-408)", async () => {
    const { data } = await anonymous().GET("/v1/store/styles/{code}", { params: { path: { code: "PK-TE-01" } } });
    expect(data!.variants).toHaveLength(183);
    expect(data!.axes.map((a) => a.axis)).toEqual(["tuck_top", "tuck_bottom", "hang", "window"]);
  });

  it("keeps a customer's favourites", async () => {
    const api = await signInByOtp(MOCK_NEW_CUSTOMER_PHONE);
    await api.PUT("/v1/store/style-favourites/{code}", { params: { path: { code: "PK-TE-01" } } });
    const { data } = await api.GET("/v1/store/style-favourites");
    expect(data!.map((f) => f.style.code)).toContain("PK-TE-01");
  });
});
