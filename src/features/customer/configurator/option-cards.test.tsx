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

async function open() {
  const api = createApiClient({ baseUrl: "http://api.test" });
  const { data } = await api.GET("/v1/store/catalog/products/{slug}/configurator", {
    params: { path: { slug: "shipping-box" } },
  });
  const configurator = data as ConfiguratorData;
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

  it("asks for the prices once per state change, after a pause, and never per card", async () => {
    const user = userEvent.setup();
    await open();
    await settled(1);
    // Two changes inside the pause are one request, for the last state.
    await user.click(card(/^M\d/));
    await user.click(await screen.findByRole("radio", { name: /ลอน E/ }));
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
      for (const slot of document.querySelectorAll<HTMLElement>("[data-price-slot]")) {
        expect(slot.textContent).toBe("");
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
