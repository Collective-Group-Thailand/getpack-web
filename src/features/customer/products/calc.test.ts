// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../../mocks/handlers";
import { buildCalculateBody } from "@/features/customer/configurator/build";
import { initialState, type Configurator } from "@/features/customer/configurator/state";
import { seedFromDesign } from "@/features/customer/configurator/url-state";
import { createApiClient } from "@/lib/api/client";

import {
  calcBody,
  calcCtaHref,
  calcQuantities,
  defaultPrintChoice,
  printOptions,
  quantityProblem,
  startQuantity,
} from "./calc";

/**
 * Acceptance (prompt Phase 1): "Calculator numbers equal the configurator's numbers for the same inputs".
 * The calculator prices the configurator's own body for the state its CTA link opens, so the same
 * `store.quotes.calculate` answers both.
 */
const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

const api = () => createApiClient({ baseUrl: "http://api.mock" });

async function configurator(slug: string): Promise<Configurator> {
  const { data } = await api().GET("/v1/store/catalog/products/{slug}/configurator", { params: { path: { slug } } });
  return data!;
}

/** What /configure/[slug] would price when opened on `href` (its page seeds from the query the same way). */
function configuratorBodyFor(base: Configurator, href: string) {
  const query = Object.fromEntries(new URL(href, "http://x").searchParams);
  return buildCalculateBody(base, initialState(base, seedFromDesign(base, query) ?? {}));
}

describe("the quick calculator prices what the configurator prices (products item 4)", () => {
  it.each(["mailer-box", "tuck-end-box", "shipping-box"])(
    "%s: same body, same unit price, at every print",
    async (slug) => {
      const base = await configurator(slug);
      const prints = [null, ...printOptions(base).map((option) => option.choice)];
      let priced = 0;
      for (const print of prints) {
        const quantity = base.quantity.presets.find((preset) => quantityProblem(base, preset) === null)!;
        const input = { quantity, print };
        const body = calcBody(base, input);
        if (!body) continue;
        priced += 1;
        const fromCta = configuratorBodyFor(base, calcCtaHref(base, input));
        // Identical configuration but for the extra quantities the calculator asks for (its bars).
        const { quantities: _calc, ...calcConfiguration } = body.configuration as Record<string, unknown>;
        const { quantities: _cfg, ...cfgConfiguration } = fromCta.configuration as Record<string, unknown>;
        void _calc;
        void _cfg;
        expect(calcConfiguration).toEqual(cfgConfiguration);
        expect(body.productTypeCode).toBe(fromCta.productTypeCode);

        const [calc, cfg] = await Promise.all([
          api().POST("/v1/store/quotes/actions/calculate", { body }),
          api().POST("/v1/store/quotes/actions/calculate", { body: fromCta }),
        ]);
        const unit = (steps: { quantity: number; unitPrice: string | null }[] | undefined) =>
          steps?.find((step) => step.quantity === quantity)?.unitPrice;
        expect(unit(calc.data?.steps)).toBe(unit(cfg.data?.steps));
      }
      expect(priced).toBeGreaterThan(0);
    },
  );

  it("the tier table (default spec at the presets) equals calculate at the same quantity", async () => {
    const slug = "mailer-box";
    const base = await configurator(slug);
    const { data: tiers } = await api().GET("/v1/store/catalog/price-hints/{slug}/tiers", {
      params: { path: { slug } },
    });
    const quantity = startQuantity(base);
    const body = calcBody(base, { quantity, print: null })!;
    const { data: calc } = await api().POST("/v1/store/quotes/actions/calculate", { body });
    expect(tiers!.tiers.find((step) => step.quantity === quantity)?.unitPrice).toBe(
      calc!.steps.find((step) => step.quantity === quantity)?.unitPrice,
    );
  });

  it("asks for the presets and the chosen quantity within the product's tier limit", async () => {
    const base = await configurator("mailer-box");
    const quantities = calcQuantities(base, 750);
    expect(quantities).toContain(750);
    expect(quantities.length).toBeLessThanOrEqual(base.quantity.maxTiers);
    expect([...quantities].sort((a, b) => a - b)).toEqual(quantities);
  });

  it("opens on the default spec's print and quantity, and links there without extra parameters", async () => {
    const base = await configurator("mailer-box");
    const choice = defaultPrintChoice(base);
    const href = calcCtaHref(base, { quantity: startQuantity(base), print: choice });
    expect(href).toBe(`/configure/mailer-box`);
    expect(quantityProblem(base, 0)).toBe("invalid");
    if (base.quantity.min) expect(quantityProblem(base, base.quantity.min - 1)).toBe("min");
  });
});
