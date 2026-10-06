// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The UAT dataset (`./uat.ts`) is what a scorecard round's participants meet, so it is checked like
 * product data: every participant has the records their task cards start from, no participant
 * shares state with another or with the automated suites, and the moderator's sheet in
 * `docs/ux/uat-round-data.md` is the dataset's own.
 */

const DOC = fileURLToPath(new URL("../docs/ux/uat-round-data.md", import.meta.url));

async function load(dataset: string | undefined) {
  vi.resetModules();
  vi.stubEnv("MOCK_DATASET", dataset ?? "");
  const commerce = await import("./admin/commerce");
  const store = await import("./store/customers");
  const sheet = await import("./uat-sheet");
  const uat = await import("./uat");
  return { commerce, store, sheet, uat };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

// Each test imports the whole mock afresh; cold, under a full parallel run, that outlasts the 5 s default.
describe("the UAT dataset", { timeout: 30_000 }, () => {
  it("is off by default: the automated suites meet the seed they were written against", async () => {
    const { commerce, store, uat } = await load(undefined);
    expect(uat.UAT_ENABLED).toBe(false);
    expect(commerce.customers).toHaveLength(12);
    expect(commerce.orders.filter((order) => commerce.isUatCustomer(order.customer.id))).toEqual([]);
    for (const participant of uat.UAT_PARTICIPANTS)
      expect(store.MOCK_CUSTOMER_PHONES[participant.phone]).toBeUndefined();
  });

  it("leaves every seeded order where it was when switched on", async () => {
    const off = (await load(undefined)).commerce.orders.map((order) => [order.id, order.orderCode, order.customer.id]);
    const on = (await load("uat")).commerce.orders.map((order) => [order.id, order.orderCode, order.customer.id]);
    expect(on.slice(0, off.length)).toEqual(off);
  });

  it("gives each participant their own account and the records their task cards start from", async () => {
    const { commerce, store, sheet, uat } = await load("uat");
    expect(new Set(uat.UAT_PARTICIPANTS.map((p) => p.phone)).size).toBe(uat.UAT_PARTICIPANTS.length);
    const cards = sheet.uatCards();
    expect(cards).toHaveLength(10);
    for (const { participant, delivered, inProduction, job } of cards) {
      const persona = store.MOCK_CUSTOMER_PHONES[participant.phone];
      expect(persona).toBe(uat.uatPersona(participant));
      const customer = store.customerByPersona(persona!);
      // The storefront account owns the commerce customer whose orders these are.
      expect(commerce.customers[customer.ownerIndex!]!.phone).toBe(participant.phone);
      expect(delivered.code).toMatch(/^PK-2569-/);
      expect(inProduction.link).toMatch(/^\/l\/sMOCK/);
      expect(job).toMatch(/^J-2569-/);
    }
    // Nothing is shared between two participants.
    const codes = cards.flatMap((card) => [card.delivered.code, card.inProduction.code, card.job]);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("is what docs/ux/uat-round-data.md lists", async () => {
    const { sheet } = await load("uat");
    const doc = readFileSync(DOC, "utf8");
    for (const row of sheet.uatSheetRows()) expect(doc).toContain(row);
  });
});
