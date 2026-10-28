// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../../../mocks/handlers";
import { buildCalculateBody } from "@/features/customer/configurator/build";
import type { Configurator } from "@/features/customer/configurator/model";
import { createApiClient } from "@/lib/api/client";

import {
  bodyOf,
  configuratorStateFor,
  configureLinkOf,
  customSizeLinkOf,
  hasStandardSizes,
  materialsOf,
  pickMaterial,
  pickQuantity,
  pickSize,
  printChoicesOf,
  startOf,
  tiersOf,
  type Selection,
} from "./model";

/**
 * pdp redesign Phase 1, acceptance: the product page's price equals the configurator's for every
 * combination, and what the page chose arrives preselected in the configurator. Every combination of
 * size × board × outside print × quantity tier of every instant mock product is turned into the page's
 * "ปรับแต่งต่อและสั่งซื้อ" link; the configurator's own reading of that link must build the very same
 * calculate body — and, for a sample, the API answers both bodies with the same unit price.
 */

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

const api = () => createApiClient({ baseUrl: "http://api.mock" });

async function instantConfigurators(): Promise<Configurator[]> {
  const { data } = await api().GET("/v1/store/catalog/products", { params: { query: { page: 1, perPage: 100 } } });
  const slugs = data!.data.filter((card) => card.availability === "instant").map((card) => card.slug);
  const all = await Promise.all(
    slugs.map(async (slug) => {
      const { data: configurator } = await api().GET("/v1/store/catalog/products/{slug}/configurator", {
        params: { path: { slug } },
      });
      return configurator!;
    }),
  );
  return all.filter((configurator) => configurator.instant);
}

/** Every page selection: sizes × boards × prints × tiers (each axis only where the product offers it). */
function combinations(configurator: Configurator): Selection[] {
  const start = startOf(configurator);
  const sized = hasStandardSizes(configurator)
    ? configurator.standardSizes.map((size) => pickSize(configurator, start, size.code))
    : [start];
  const boards = sized.flatMap((selection) => {
    const materials = materialsOf(configurator);
    return materials.length > 1 ? materials.map((option) => pickMaterial(selection, option.id)) : [selection];
  });
  const printed = boards.flatMap((selection) => {
    const choices = printChoicesOf(configurator, selection);
    return choices.length > 0 ? choices.map((choice) => choice.selection) : [selection];
  });
  return printed.flatMap((selection) => tiersOf(selection).map((quantity) => pickQuantity(selection, quantity)));
}

describe("the product page hands the configurator exactly what it priced", () => {
  it("builds the configurator's own body for every combination, from the page's link", async () => {
    const configurators = await instantConfigurators();
    expect(configurators.length).toBeGreaterThanOrEqual(2);
    let checked = 0;
    for (const configurator of configurators) {
      for (const selection of combinations(configurator)) {
        const page = bodyOf(configurator, selection);
        if (!page) continue;
        const link = configureLinkOf(configurator, selection);
        const opened = configuratorStateFor(configurator, link);
        expect(buildCalculateBody(configurator, opened), `${configurator.slug} ${link}`).toEqual(page);
        // Preselected: the size, board, outside print and quantity the page showed.
        expect(opened.standardSizeCode).toBe(selection.standardSizeCode);
        expect(opened.choices.material).toEqual(selection.choices.material);
        expect(opened.choices.print_front ?? []).toEqual(selection.choices.print_front ?? []);
        expect(opened.quantity).toBe(selection.quantity);
        checked += 1;
      }
    }
    // Not vacuous: the corrugated and folding products bring dozens of combinations.
    expect(checked).toBeGreaterThan(50);
  });

  it("is answered with the same unit price on both sides (sample of combinations)", async () => {
    const configurators = await instantConfigurators();
    for (const configurator of configurators.slice(0, 3)) {
      const sample = combinations(configurator)
        .filter((_, index) => index % 7 === 0)
        .slice(0, 6);
      for (const selection of sample) {
        const page = bodyOf(configurator, selection);
        if (!page) continue;
        const opened = configuratorStateFor(configurator, configureLinkOf(configurator, selection));
        const [{ data: onPage }, { data: inConfigurator }] = await Promise.all([
          api().POST("/v1/store/quotes/actions/calculate", { body: page }),
          api().POST("/v1/store/quotes/actions/calculate", { body: buildCalculateBody(configurator, opened) }),
        ]);
        const unit = (steps: { quantity: number; unitPrice: string | null }[]) =>
          steps.find((step) => step.quantity === selection.quantity)?.unitPrice ?? null;
        expect(unit(onPage!.steps)).toBe(unit(inConfigurator!.steps));
      }
    }
  });

  it("reads `print=` as the outside print, as the brief spells the link", async () => {
    const [configurator] = (await instantConfigurators()).filter((entry) => entry.calculator === "corrugate");
    expect(configurator).toBeDefined();
    const choice = printChoicesOf(configurator!, startOf(configurator!)).find(
      (entry) => !entry.selected && entry.label.kind !== "none",
    );
    expect(choice).toBeDefined();
    const ids = choice!.selection.choices.print_front!;
    const opened = configuratorStateFor(configurator!, `/configure/${configurator!.slug}?print=${ids.join(",")}`);
    expect(opened.choices.print_front).toEqual(ids);
  });

  it("starts where the configurator starts and keeps the default spec out of the link", async () => {
    const [configurator] = await instantConfigurators();
    const start = startOf(configurator!);
    expect(configureLinkOf(configurator!, start)).toBe(`/configure/${configurator!.slug}`);
    expect(configuratorStateFor(configurator!, configureLinkOf(configurator!, start))).toEqual(start);
  });
});

describe("กำหนดเอง", () => {
  it("opens the configurator's custom tab on the chosen inside size, keeping the rest", async () => {
    const [configurator] = (await instantConfigurators()).filter((entry) => hasStandardSizes(entry));
    const size = configurator!.standardSizes.at(-1)!;
    const selection = pickSize(configurator!, startOf(configurator!), size.code);
    const opened = configuratorStateFor(configurator!, customSizeLinkOf(configurator!, selection));
    expect(opened.sizeMode).toBe("custom");
    expect([opened.dims.l, opened.dims.w, opened.dims.d]).toEqual([size.lengthMm, size.widthMm, size.heightMm]);
    expect(opened.choices.material).toEqual(selection.choices.material);
  });
});
