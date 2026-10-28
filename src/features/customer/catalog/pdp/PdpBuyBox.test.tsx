import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupServer } from "msw/node";
import { NextIntlClientProvider } from "next-intl";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { handlers } from "../../../../../mocks/handlers";
import { mockBatch } from "../../../../../mocks/store/quotes";
import { resetOptionPricesSupport } from "@/features/customer/configurator/option-prices";
import type { Configurator } from "@/features/customer/configurator/model";
import { loadAllMessages } from "@/i18n/messages";
import { createApiClient } from "@/lib/api/client";

import { configuratorStateFor } from "./model";
import { PdpBuyBox } from "./PdpBuyBox";
import { PdpMobileBar } from "./PdpMobileBar";
import { PdpProvider } from "./PdpProvider";
import { PdpSizesTable } from "./PdpSizes";
import { PdpTiers } from "./PdpTiers";
import { PdpToleranceAnswer } from "./PdpToleranceAnswer";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  Link: ({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/api/browser", async () => {
  const { createApiClient: make } = await import("@/lib/api/client");
  return { browserApi: () => make({ baseUrl: "http://api.test" }) };
});
vi.mock("@/lib/analytics/track", () => ({ track: vi.fn() }));
const pdpEvents = vi.hoisted(() => [] as unknown[][]);
vi.mock("@/lib/analytics/pdp", () => ({ trackPdp: (...args: unknown[]) => pdpEvents.push(args) }));

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
beforeEach(() => {
  mockBatch.mode = "ok";
  mockBatch.requests.length = 0;
  pdpEvents.length = 0;
  resetOptionPricesSupport();
});
afterEach(cleanup);
vi.setConfig({ testTimeout: 30_000 });

async function open(slug = "mailer-box") {
  const api = createApiClient({ baseUrl: "http://api.test" });
  const { data } = await api.GET("/v1/store/catalog/products/{slug}/configurator", { params: { path: { slug } } });
  const configurator = data as Configurator;
  const messages = await loadAllMessages("th");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="th" messages={messages} timeZone="Asia/Bangkok">
        <PdpProvider configurator={configurator} productName="กล่องไปรษณีย์" signedIn={false}>
          <div id="buy">
            <PdpBuyBox
              dielineFallback="/styles"
              studioHref={null}
              guaranteeHref="/guarantee"
              materialsAnchor="materials"
            />
          </div>
          <PdpSizesTable buyBoxId="buy" />
          <PdpTiers guaranteeHref="/guarantee" />
          <PdpMobileBar />
          <p data-testid="faq-tolerance">
            <PdpToleranceAnswer />
          </p>
        </PdpProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return configurator;
}

const configureLink = () => screen.getByRole("link", { name: "ปรับแต่งต่อและสั่งซื้อ" }).getAttribute("href")!;

describe("the product page's buy box (pdp redesign Phase 1)", () => {
  it("shows the configurator's price for the default spec, with its line and the tier prices", async () => {
    const configurator = await open();
    const start = configuratorStateFor(configurator, `/configure/${configurator.slug}`);
    // Price per piece and the total, the quantity · size · VAT line.
    await waitFor(() => expect(screen.getByText(/รวม VAT แล้ว · ไม่รวมค่าจัดส่ง/)).toBeTruthy());
    const line = `${start.quantity.toLocaleString("th-TH")} ชิ้น · เบอร์ ${start.standardSizeCode} · รวม VAT แล้ว`;
    expect(screen.getByText(new RegExp(line))).toBeTruthy();
    // Every tier card carries its own unit price once the calculation is in.
    const quantities = within(screen.getByRole("group", { name: "จำนวน" })).getAllByRole("button");
    expect(quantities).toHaveLength(start.quantities.length);
    await waitFor(() => quantities.forEach((button) => expect(button.textContent).toMatch(/฿/)));
    // No configuration is in the link while the page is on the default spec.
    expect(configureLink()).toBe(`/configure/${configurator.slug}`);
  });

  it("hands every change to the configurator's link and reports it", async () => {
    const user = userEvent.setup();
    const configurator = await open();
    const sizes = within(screen.getByRole("group", { name: "ขนาด" }));
    const other = configurator.standardSizes.find((size) => !size.isDefault)!;
    await user.click(sizes.getByRole("button", { name: new RegExp(`^เบอร์ ${other.code} `) }));
    const materials = within(screen.getByRole("group", { name: "วัสดุ" })).getAllByRole("button");
    await user.click(materials.find((button) => button.getAttribute("aria-pressed") === "false")!);
    const tiers = within(screen.getByRole("group", { name: "จำนวน" })).getAllByRole("button");
    await user.click(tiers[0]!);

    const opened = configuratorStateFor(configurator, configureLink());
    expect(opened.standardSizeCode).toBe(other.code);
    expect(opened.quantity).toBe(Number(tiers[0]!.firstChild!.textContent!.replace(/,/g, "")));
    expect(pdpEvents.map(([name, props]) => [name, (props as { option?: string }).option])).toEqual(
      expect.arrayContaining([
        ["pdp_option_change", "size"],
        ["pdp_option_change", "material"],
        ["pdp_option_change", "quantity"],
      ]),
    );
    // The sizes table follows the buy box.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: `เลือกเบอร์ ${other.code} อยู่` }).getAttribute("aria-pressed")).toBe(
        "true",
      ),
    );
  });

  it("prices every standard size in one batch and picks one from the table", async () => {
    const user = userEvent.setup();
    const configurator = await open();
    await waitFor(() => expect(mockBatch.requests.length).toBeGreaterThan(0));
    const target = configurator.standardSizes.find((size) => !size.isDefault)!;
    await user.click(screen.getByRole("button", { name: `เลือกเบอร์ ${target.code}` }));
    expect(configuratorStateFor(configurator, configureLink()).standardSizeCode).toBe(target.code);
    expect(pdpEvents.some(([name]) => name === "pdp_size_table_pick")).toBe(true);
  });

  it("answers the FAQ's tolerance question with the API's figures, never a fixed ±5 % (C1f, §14.9)", async () => {
    await open();
    const answer = screen.getByTestId("faq-tolerance");
    // Before the calculation arrives there is no figure to quote.
    expect(answer.textContent).toMatch(/เล็กน้อย/);
    await waitFor(() => expect(screen.getByText(/รวม VAT แล้ว · ไม่รวมค่าจัดส่ง/)).toBeTruthy());
    await waitFor(() => expect(answer.textContent).toMatch(/\d+(\.\d+)?\s?%/));
    expect(answer.textContent).not.toMatch(/เล็กน้อย/);
  });

  it("keeps the price area's height while the first price loads (no layout shift)", async () => {
    await open();
    const box = screen.getByRole("link", { name: "ปรับแต่งต่อและสั่งซื้อ" }).closest("div.rounded-card")!;
    const priceArea = box.querySelector("[aria-live]")!;
    expect(priceArea.className).toMatch(/min-h-/);
  });
});
