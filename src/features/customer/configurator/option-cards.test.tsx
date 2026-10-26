import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupServer } from "msw/node";
import { NextIntlClientProvider } from "next-intl";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { handlers } from "../../../../mocks/handlers";
import { mockBatch } from "../../../../mocks/store/quotes";
import { loadAllMessages } from "@/i18n/messages";
import { createApiClient } from "@/lib/api/client";

import { Configurator } from "./Configurator";
import { resetOptionPricesSupport } from "./option-prices";
import type { Configurator as ConfiguratorData } from "./state";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/lib/api/browser", async () => {
  const { createApiClient: make } = await import("@/lib/api/client");
  return { browserApi: () => make({ baseUrl: "http://api.test" }), isApiError: () => false };
});
vi.mock("@/lib/analytics/track", () => ({ track: vi.fn() }));
vi.mock("@/features/customer/cart/cart-events", () => ({ useJustAdded: () => false }));
// The 3D preview is a canvas of its own; this suite is about the cards and the summary.
vi.mock("./ConfiguratorPreview", () => ({ ConfiguratorPreview: () => null, boxStyleOf: () => null }));

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
beforeEach(() => {
  mockBatch.mode = "ok";
  mockBatch.requests.length = 0;
  resetOptionPricesSupport();
});
afterEach(cleanup);
vi.setConfig({ testTimeout: 30_000 });

async function open(change: (configurator: ConfiguratorData) => void = () => {}, syncUrl = false) {
  const api = createApiClient({ baseUrl: "http://api.test" });
  const { data } = await api.GET("/v1/store/catalog/products/{slug}/configurator", {
    params: { path: { slug: "shipping-box" } },
  });
  const configurator = data as ConfiguratorData;
  change(configurator);
  const messages = await loadAllMessages("th");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="th" messages={messages}>
        <Configurator
          configurator={configurator}
          productName={{ th: "กล่องพัสดุ", en: "Shipping box" }}
          signedIn={false}
          lineOaId={null}
          rfqPath="/rfq"
          pageUrl="http://localhost/configure/shipping-box"
          syncUrl={syncUrl}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return configurator;
}

/* ------------------------------------------------------------------------------------ helpers */

const dockPrice = () => document.querySelector("[data-unit-price]")?.textContent ?? "";
const section = (title: RegExp) => screen.getByRole("region", { name: title });
/** A size card by its code: the accessible name is the card's text, which starts with the code. */
const card = (name: RegExp) => {
  const found = screen.getAllByRole("radio").find((radio) => name.test(radio.textContent ?? ""));
  if (!found) throw new Error(`no radio card matches ${name}`);
  return found;
};
const slotOf = (element: HTMLElement) => element.querySelector<HTMLElement>("[data-price-slot]")!;

/** The batch request has been answered and no card is dimmed any more. */
async function settled(requests: number) {
  await waitFor(() => expect(mockBatch.requests).toHaveLength(requests), { timeout: 5000 });
  await waitFor(() => expect(document.querySelector("[data-price-slot][aria-busy]")).toBeNull(), { timeout: 5000 });
}

/**
 * What the customer chose in the other steps, as each step's own hint words it (the material's name,
 * the print by side, the quantity). Prices on those steps move with any choice, so they are not compared.
 */
const otherSteps = (...except: RegExp[]) =>
  [/วัสดุ/, /การพิมพ์/, /จำนวน/, /ขนาดและรูปแบบ/]
    .filter((title) => !except.some((skip) => skip.source === title.source))
    .map((title) => section(title).querySelector("header p")?.textContent ?? "");

describe("size cards", () => {
  it("shows each standard size with its unit price from ONE batch request, and the selected card equals the summary", async () => {
    await open();
    await settled(1);
    const sizes = section(/ขนาดและรูปแบบ/);
    const selected = card(/^S\d/);
    const dock = dockPrice();
    expect(dock).toMatch(/^฿\d/);
    // The selected card is the baseline: the very figure the summary shows.
    expect(slotOf(selected).textContent).toBe(`${dock}/ชิ้น`);
    expect(selected).toBeChecked();
    expect(within(sizes).getAllByText(/\/ชิ้น$/)).toHaveLength(2);
    expect(mockBatch.requests[0]!.variants.length).toBeLessThanOrEqual(24);
    expect(mockBatch.requests[0]!.quantities).toEqual([1000]);
  });

  it("selecting a size through its card gives the summary exactly the price the card showed, and touches no other step", async () => {
    const user = userEvent.setup();
    await open();
    await settled(1);
    const other = card(/^M\d/);
    const shown = slotOf(other).getAttribute("data-option-price")!;
    expect(slotOf(other).textContent).toBe(`฿${shown}/ชิ้น`.replace("฿", "฿"));
    const before = otherSteps(/ขนาดและรูปแบบ/);

    await user.click(other);
    await waitFor(() => expect(dockPrice()).toBe(`฿${shown}`));
    expect(otherSteps(/ขนาดและรูปแบบ/)).toEqual(before);
    // The card that is selected now is the baseline of the next request, and equals the summary.
    await settled(2);
    expect(slotOf(card(/^M\d/)).getAttribute("data-option-price")).toBe(shown);
  });

  it("keeps the configuration in the address after a pause, with the defaults left out and other parameters kept", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/configure/shipping-box?from=pdp&calc=abc");
    const replace = vi.spyOn(window.history, "replaceState");
    await open(() => {}, true);
    await settled(1);
    // Nothing is written until the customer changes something.
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(replace).not.toHaveBeenCalled();

    await user.click(card(/^M\d/));
    await waitFor(() => expect(replace).toHaveBeenCalled(), { timeout: 3000 });
    const params = new URLSearchParams(window.location.search);
    expect(params.get("size")).toMatch(/^M/);
    expect(params.get("from")).toBe("pdp");
    expect(params.get("calc")).toBe("abc");
    expect(params.has("postcode")).toBe(false);
    expect(params.has("qty")).toBe(false);
    replace.mockRestore();
    window.history.replaceState(null, "", "/");
  });

  it("asks for the prices once per state change, after a pause, and never per card", async () => {
    const user = userEvent.setup();
    await open();
    await settled(1);
    // Two changes inside the pause are one request, for the last state.
    const material = await screen.findByRole("radio", { name: /ลอน E/ });
    await user.click(card(/^M\d/));
    await user.click(material);
    expect(mockBatch.requests).toHaveLength(1);
    await settled(2);
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(mockBatch.requests).toHaveLength(2);
    const body = mockBatch.requests[1]!;
    expect(body.baselineKey).toBe("size:M");
    // The cards of the last state are one request: the baseline plus the other options, in a single body.
    expect(body.variants.length).toBeGreaterThan(5);
    expect(body.variants.length).toBeLessThanOrEqual(24);
  });

  it("keeps the cards usable and shows no price when the endpoint is missing (404) or throttled (429)", async () => {
    for (const mode of ["missing", "throttled"] as const) {
      cleanup();
      mockBatch.mode = mode;
      mockBatch.requests.length = 0;
      resetOptionPricesSupport();
      const user = userEvent.setup();
      await open();
      await waitFor(() => expect(mockBatch.requests).toHaveLength(1), { timeout: 5000 });
      await waitFor(() => expect(dockPrice()).toMatch(/^฿\d/));
      // The option cards (size, material, print) — the quantity cards are priced by the ordinary calculation.
      for (const slot of document.querySelectorAll<HTMLElement>("[data-price-slot]:not(#step-quantity *)")) {
        // No figure at all (the selected card may still say "เลือกอยู่": that is not a price).
        expect(slot.textContent).not.toMatch(/฿|ขอใบเสนอราคา/);
        expect(slot.hasAttribute("data-option-price")).toBe(false);
        // The slot is still there, with its height: nothing moves when a price is missing.
        expect(slot.className).toContain("min-h-5");
      }
      const before = dockPrice();
      await user.click(card(/^M\d/));
      await waitFor(() => expect(dockPrice()).not.toBe(before));
      expect(card(/^M\d/)).toBeChecked();
    }
  });

  it("stops asking after a 404 for the rest of the visit", async () => {
    const user = userEvent.setup();
    mockBatch.mode = "missing";
    await open();
    await waitFor(() => expect(mockBatch.requests).toHaveLength(1), { timeout: 5000 });
    await user.click(card(/^M\d/));
    await new Promise((resolve) => setTimeout(resolve, 900));
    expect(mockBatch.requests).toHaveLength(1);
  });

  it("reserves the price slot's height before, while and after the prices arrive, and shows no raw message key", async () => {
    await open();
    const heights = () =>
      [...document.querySelectorAll<HTMLElement>("[data-price-slot]")].map((slot) => slot.className);
    const early = heights();
    expect(early.length).toBeGreaterThan(0);
    for (const className of early) expect(className).toContain("min-h-5");
    await settled(1);
    for (const className of heights()) expect(className).toContain("min-h-5");
    expect(document.body.textContent).not.toMatch(/\bconfigurator\.[a-z]+\.[a-zA-Z.]+/);
  });
});

describe("material cards", () => {
  const materialCard = (name: RegExp) => screen.findByRole("radio", { name });

  it("shows every material with its one line, the default marked, the selected one as เลือกอยู่ and the others' change", async () => {
    await open();
    await settled(1);
    const bc = await materialCard(/ลอน BC/);
    expect(bc).toBeChecked();
    expect(bc.textContent).toContain("ค่าเริ่มต้น");
    expect(slotOf(bc).textContent).toBe("เลือกอยู่");
    expect(bc.textContent).toContain("5 ชั้น แข็งแรงมาก สำหรับสินค้าหนัก");
    const e = await materialCard(/ลอน E/);
    expect(e.textContent).not.toContain("ค่าเริ่มต้น");
    // The sign comes from the API's string: "+฿x" or "−฿x" (never computed here).
    expect(slotOf(e).textContent).toMatch(/^[+\u2212]฿\d+\.\d{2}$/);
  });

  it("selecting a material through its card gives the summary the unit price the card carried, and touches no other step", async () => {
    const user = userEvent.setup();
    await open();
    await settled(1);
    const e = await materialCard(/ลอน E/);
    const shown = slotOf(e).getAttribute("data-option-price")!;
    const change = slotOf(e).textContent!;
    const before = otherSteps(/วัสดุ/);

    await user.click(e);
    await waitFor(() => expect(dockPrice()).toBe(`฿${shown}`));
    expect(otherSteps(/วัสดุ/)).toEqual(before);
    await settled(2);
    expect(slotOf(await materialCard(/ลอน E/)).textContent).toBe("เลือกอยู่");
    // The material left is now the one that differs, in the opposite direction by the same amount.
    const back = slotOf(await materialCard(/ลอน BC/)).textContent!;
    expect(back.slice(1)).toBe(change.slice(1));
    expect(back[0]).not.toBe(change[0]);
  });

  it("shows no line for a material with no description, and never one invented", async () => {
    await open((configurator) => {
      const bare = configurator.optionGroups.find((group) => group.kind === "material")!.options[1]!;
      bare.descriptionTh = null;
      bare.descriptionEn = null;
    });
    await settled(1);
    const e = await materialCard(/ลอน E/);
    expect(e.textContent).not.toContain("3 ชั้น น้ำหนักเบา");
    const withLine = await materialCard(/ลอน B \(/);
    expect(withLine.textContent).toContain("3 ชั้น น้ำหนักเบา");
  });
});

describe("print cards", () => {
  const side = async (name: string) => within(await screen.findByRole("radiogroup", { name }));
  const outside = () => side("ด้านนอก");
  const inside = () => side("ด้านใน");
  const printCard = async (group: ReturnType<typeof side>, name: RegExp) => (await group).getByRole("radio", { name });
  const areaChips = () => screen.queryByRole("radiogroup", { name: /บริเวณ/ });

  it("offers ไม่พิมพ์ and only the methods the product's print model offers, with the default marked", async () => {
    await open();
    await settled(1);
    const out = await outside();
    const names = out.getAllByRole("radio").map((radio) => radio.textContent ?? "");
    expect(names[0]).toMatch(/^ไม่พิมพ์/);
    expect(names.some((name) => /CMYK/.test(name))).toBe(true);
    // One card per offered method: none, four spot inks, CMYK (shipping-box's model).
    expect(names).toHaveLength(6);
    const cmyk = await printCard(outside(), /CMYK/);
    expect(cmyk).toBeChecked();
    expect(cmyk.textContent).toContain("ค่าเริ่มต้น");
    expect(slotOf(cmyk).textContent).toBe("เลือกอยู่");
    // The inside starts on ไม่พิมพ์ (the model's default), explicit.
    const plain = await printCard(inside(), /^ไม่พิมพ์/);
    expect(plain).toBeChecked();
    expect(plain.textContent).toContain("ค่าเริ่มต้น");
  });

  it("each card carries its change from the batch, and selecting it gives the summary the price the card carried", async () => {
    const user = userEvent.setup();
    await open();
    await settled(1);
    const none = await printCard(outside(), /^ไม่พิมพ์/);
    expect(slotOf(none).textContent).toMatch(/^[+\u2212]฿\d+\.\d{2}$/);
    const shown = slotOf(none).getAttribute("data-option-price")!;
    const before = otherSteps(/การพิมพ์/);

    await user.click(none);
    await waitFor(() => expect(dockPrice()).toBe(`฿${shown}`));
    expect(otherSteps(/การพิมพ์/)).toEqual(before);
    await settled(2);
    expect(slotOf(await printCard(outside(), /^ไม่พิมพ์/)).textContent).toBe("เลือกอยู่");
  });

  it("prices the inside options on their own, and shows the print area only while something prints", async () => {
    const user = userEvent.setup();
    await open();
    await settled(1);
    await outside();
    expect(areaChips()).not.toBeNull();
    const cmykInside = await printCard(inside(), /CMYK/);
    const shown = slotOf(cmykInside).getAttribute("data-option-price")!;
    expect(slotOf(cmykInside).textContent).toMatch(/^\+฿\d+\.\d{2}$/);

    await user.click(cmykInside);
    await waitFor(() => expect(dockPrice()).toBe(`฿${shown}`));
    await settled(2);
    // Outside to ไม่พิมพ์: the inside still prints, so the area is still asked.
    await user.click(await printCard(outside(), /^ไม่พิมพ์/));
    await settled(3);
    expect(areaChips()).not.toBeNull();
    // Nothing prints any more: nothing to place.
    await user.click(await printCard(inside(), /^ไม่พิมพ์/));
    await settled(4);
    expect(areaChips()).toBeNull();
  });
});

describe("quantity cards", () => {
  const tiers = async () => within(await screen.findByRole("radiogroup", { name: "จำนวนที่ต้องการเปรียบเทียบ" }));
  const tierCard = async (quantity: string) => {
    const group = await tiers();
    const found = group.getAllByRole("radio").find((radio) => (radio.textContent ?? "").startsWith(quantity));
    if (!found) throw new Error(`no tier card for ${quantity}`);
    return found;
  };

  it("shows the smallest quantity first with the API's price per piece, and no saving it was not given", async () => {
    await open();
    await settled(1);
    const group = await tiers();
    const names = group.getAllByRole("radio").map((radio) => radio.textContent ?? "");
    expect(names.map((name) => name.split("฿")[0])).toEqual(["500", "1,000", "2,000", "3,000"]);
    expect(names.every((name) => /฿\d+\.\d{2}\/ชิ้น$/.test(name))).toBe(true);
    // The selected card is the one the summary shows.
    const selected = await tierCard("1,000");
    expect(selected).toBeChecked();
    expect(slotOf(selected).textContent).toBe(`${dockPrice()}/ชิ้น`);
    // The API sends no saving figure: none is shown, and none is worked out from the prices.
    expect(document.body.textContent).not.toMatch(/ประหยัด/);
  });

  it("selecting a tier through its card gives the summary the price the card showed, and touches no other step", async () => {
    const user = userEvent.setup();
    await open();
    await settled(1);
    const other = await tierCard("2,000");
    const shown = slotOf(other).getAttribute("data-option-price")!;
    expect(slotOf(other).textContent).toBe(`฿${shown}/ชิ้น`);
    // The size's hint names the quantity ("ราคาที่ 1,000 ชิ้น"); the material and the print do not move.
    const chosen = () => [/วัสดุ/, /การพิมพ์/].map((title) => section(title).querySelector("header p")?.textContent);
    const before = chosen();

    await user.click(other);
    await waitFor(() => expect(dockPrice()).toBe(`฿${shown}`));
    expect(chosen()).toEqual(before);
  });

  it("adds a custom quantity as a new card, priced by the ordinary calculation, up to the API's maximum", async () => {
    const user = userEvent.setup();
    const configurator = await open();
    await settled(1);
    const field = await screen.findByLabelText("จำนวนอื่น");
    // The API's range is stated, and a quantity outside it (the field's own min) adds nothing.
    expect(screen.getByText("สั่งได้ 100–500,000 ชิ้น")).toBeInTheDocument();
    await user.type(field, "50");
    await user.click(screen.getByRole("button", { name: "ดูราคา" }));
    expect((await tiers()).getAllByRole("radio")).toHaveLength(4);
    await user.clear(field);
    await user.type(field, "1500");
    await user.click(screen.getByRole("button", { name: "ดูราคา" }));
    const added = await tierCard("1,500");
    expect(added).toBeChecked();
    // Between 1,000 and 2,000: smallest first.
    const order = (await tiers()).getAllByRole("radio").map((radio) => (radio.textContent ?? "").split("฿")[0]);
    expect(order).toEqual(["500", "1,000", "1,500", "2,000", "3,000"]);
    await settled(2);
    await waitFor(() => expect(slotOf(added).textContent).toBe(`${dockPrice()}/ชิ้น`));

    // The API's cap on the quantities it prices at once.
    await user.type(field, "4000");
    await user.click(screen.getByRole("button", { name: "ดูราคา" }));
    await user.type(field, "5000");
    await user.click(screen.getByRole("button", { name: "ดูราคา" }));
    expect(configurator.quantity.maxTiers).toBe(6);
    await user.type(field, "6000");
    await user.click(screen.getByRole("button", { name: "ดูราคา" }));
    expect(screen.getByText(/เปรียบเทียบได้สูงสุด 6 จำนวน/)).toBeInTheDocument();
    expect((await tiers()).getAllByRole("radio")).toHaveLength(6);
  });

  it("keeps the budget per piece behind a collapsed disclosure with its private-use note", async () => {
    const user = userEvent.setup();
    await open();
    await settled(1);
    const summary = await screen.findByText("มีงบต่อชิ้นในใจ? (ไม่บังคับ)");
    const details = summary.closest("details")!;
    expect(details.open).toBe(false);
    await user.click(summary);
    expect(details.open).toBe(true);
    expect(within(details).getByText("ตัวเลขนี้ใช้ภายในทีมงานเท่านั้น ไม่แสดงต่อผู้อื่น")).toBeInTheDocument();
    await user.type(within(details).getByRole("textbox"), "50");
    // The existing behaviour: the target goes to the calculation, which answers with the gap.
    await waitFor(() => expect(document.body.textContent).toMatch(/50|งบ/));
  });
});
