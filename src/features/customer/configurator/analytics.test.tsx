import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
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
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/api/browser", async () => {
  const { createApiClient: make } = await import("@/lib/api/client");
  return { browserApi: () => make({ baseUrl: "http://api.test" }), isApiError: () => false };
});
vi.mock("@/lib/analytics/track", () => ({ track: vi.fn() }));
vi.mock("@/features/customer/cart/cart-events", () => ({ useJustAdded: () => false }));
vi.mock("./ConfiguratorPreview", () => ({ ConfiguratorPreview: () => null, boxStyleOf: () => null }));
// The sample dialog and the sign-in sheet are other features'; this suite is about what the configurator reports.
vi.mock("@/features/customer/samples/RequestSample", () => ({ RequestSampleDialog: () => null }));
vi.mock("./useQuoteActions", async (importOriginal) => {
  const original = await importOriginal<typeof import("./useQuoteActions")>();
  return {
    ...original,
    useQuoteActions: () => ({
      run: vi.fn(),
      busy: null,
      lastQuote: null,
      levers: null,
      sampleFor: null,
      closeSample: vi.fn(),
      applyLever: vi.fn(),
    }),
  };
});

const server = setupServer(...handlers);
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  // What the API answered to the batch, as sent: the deltas the cards carry.
  server.events.on("response:mocked", async ({ response, request }) => {
    if (request.url.includes("calculate-batch")) batchAnswer = (await response.clone().json()) as BatchAnswer;
  });
});
afterAll(() => server.close());
vi.setConfig({ testTimeout: 30_000 });

type BatchAnswer = { results: { key: string; deltas: { unitPriceDelta: string | null }[] | null }[] };
let batchAnswer: BatchAnswer | null = null;

type Layer = Record<string, unknown>[];
const layer = () => (window as unknown as { dataLayer: Layer }).dataLayer;
const events = (name?: string) => layer().filter((entry) => !name || entry.event === name);
const consent = (value: string | null) => {
  document.cookie = value ? `pk_consent=${value}; path=/` : "pk_consent=; path=/; max-age=0";
};

beforeEach(() => {
  (window as unknown as { dataLayer: Layer }).dataLayer = [];
  mockBatch.mode = "ok";
  mockBatch.requests.length = 0;
  resetOptionPricesSupport();
  window.localStorage.clear();
  batchAnswer = null;
});
afterEach(() => {
  cleanup();
  consent(null);
  server.resetHandlers();
});

async function open() {
  const api = createApiClient({ baseUrl: "http://api.test" });
  const { data } = await api.GET("/v1/store/catalog/products/{slug}/configurator", {
    params: { path: { slug: "shipping-box" } },
  });
  const configurator = data as ConfiguratorData;
  const messages = await loadAllMessages("th");
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
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
  await waitFor(() => expect(document.querySelector("[data-unit-price]")?.textContent).toMatch(/^฿\d/), {
    timeout: 8000,
  });
  return configurator;
}

const card = (name: RegExp) => {
  const found = screen.getAllByRole("radio").find((radio) => name.test(radio.textContent ?? ""));
  if (!found) throw new Error(`no radio card matches ${name}`);
  return found;
};
/** The batch has answered and the cards carry its prices. */
const batchSettled = async () => {
  await waitFor(() => expect(batchAnswer).not.toBeNull(), { timeout: 8000 });
  await waitFor(() => expect(document.querySelector("[data-price-slot][aria-busy]")).toBeNull(), { timeout: 8000 });
};

describe("configurator analytics", () => {
  it("sends nothing before the visitor has answered, or after analytics was refused", async () => {
    const user = userEvent.setup();
    await open();
    await user.click(card(/^M\d/));
    await user.click(screen.getByRole("radio", { name: /จ้างนักออกแบบ/ }));
    expect(layer()).toEqual([]);
    consent("a0m1");
    await user.click(screen.getByRole("radio", { name: /มีไฟล์งานแล้ว/ }));
    expect(layer()).toEqual([]);
  });

  it("reports a size card once, with the API's own delta for that card", async () => {
    consent("a1m0");
    const user = userEvent.setup();
    await open();
    await batchSettled();
    const target = card(/^M\d/);
    await user.click(target);
    const changes = events("cfg_option_change");
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ step: "size", option: "size", value: expect.stringMatching(/^M/) });
    // The delta is the API's string for that card, passed through untouched.
    const answered = batchAnswer!.results.find((result) => result.key === `size:${changes[0]!.value}`);
    expect(changes[0]!.delta).toMatch(/^[+-]\d+\.\d{2}$/);
    expect(changes[0]!.delta).toBe(answered!.deltas![0]!.unitPriceDelta);
    expect(events("cfg_size_mode")).toHaveLength(0);
  });

  it("reports the size mode, the design path and a custom quantity once each", async () => {
    consent("a1m0");
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole("radio", { name: "กำหนดเอง" }));
    expect(events("cfg_size_mode")).toEqual([{ event: "cfg_size_mode", mode: "custom" }]);
    expect(events("cfg_option_change")).toHaveLength(0);

    await user.click(screen.getByRole("radio", { name: /จ้างนักออกแบบ/ }));
    expect(events("cfg_design_path")).toEqual([{ event: "cfg_design_path", path: "hired_design" }]);

    const input = screen.getByRole("spinbutton", { name: /จำนวนอื่น/ });
    await user.type(input, "2345");
    await user.click(screen.getByRole("button", { name: "ดูราคา" }));
    expect(events("cfg_qty_custom")).toEqual([{ event: "cfg_qty_custom", quantity: 2345 }]);
  });

  it("reports the postcode by its area's name only, once the customer typed it — and never the target price's amount", async () => {
    consent("a1m0");
    const user = userEvent.setup();
    await open();
    await user.type(screen.getByLabelText(/รหัสไปรษณีย์ปลายทาง/), "10110");
    await waitFor(() => expect(events("cfg_postcode_set")).toHaveLength(1));
    expect(events("cfg_postcode_set")[0]).toEqual({ event: "cfg_postcode_set", zone: "Bangkok" });

    await user.click(screen.getByText("มีงบต่อชิ้นในใจ? (ไม่บังคับ)"));
    await user.type(screen.getByLabelText(/งบต่อชิ้น/), "12.5");
    expect(events("cfg_target_price_set")).toEqual([{ event: "cfg_target_price_set" }]);

    const everything = JSON.stringify(layer());
    expect(everything).not.toContain("10110");
    expect(everything).not.toMatch(/12\.5|"12"/);
    expect(Object.keys(events("cfg_target_price_set")[0]!)).toEqual(["event"]);
  });

  it("does not report a remembered postcode that fills the field by itself", async () => {
    consent("a1m0");
    window.localStorage.setItem("getpack.postcode", "10110");
    await open();
    await waitFor(() => expect(screen.getByLabelText(/รหัสไปรษณีย์ปลายทาง/)).toHaveValue("10110"));
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(events("cfg_postcode_set")).toHaveLength(0);
  });

  it("reports the sample checkbox and the summary's buttons", async () => {
    consent("a1m0");
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole("checkbox", { name: "ขอตัวอย่างจริงก่อนผลิต" }));
    expect(events("cfg_sample_toggle")).toEqual([{ event: "cfg_sample_toggle", on: true }]);

    const summary = screen.getByRole("complementary");
    await user.click(within(summary).getByRole("button", { name: /ใส่ตะกร้า|เพิ่มลงตะกร้า/ }));
    expect(events("cfg_cta")).toEqual([{ event: "cfg_cta", cta: "cart" }]);
  });

  it("reports a quote-only size and quantity once", async () => {
    consent("a1m0");
    server.use(
      http.post("*/v1/store/quotes/actions/calculate", async ({ request }) => {
        const body = (await request.json()) as { configuration: { quantities: number[] } };
        return HttpResponse.json({
          calculationId: null,
          calculatorVersion: "test",
          dimensions: null,
          specLabel: { th: "สเปก", en: "Spec" },
          specs: [],
          target: null,
          steps: body.configuration.quantities.map((quantity) => ({
            quantity,
            instant: false,
            reason: "not_priceable",
            unitPrice: null,
            grossAmount: null,
            shippingPending: true,
          })),
        });
      }),
    );
    const api = createApiClient({ baseUrl: "http://api.test" });
    const { data } = await api.GET("/v1/store/catalog/products/{slug}/configurator", {
      params: { path: { slug: "shipping-box" } },
    });
    const messages = await loadAllMessages("th");
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <NextIntlClientProvider locale="th" messages={messages}>
          <Configurator
            configurator={data as ConfiguratorData}
            productName={{ th: "กล่องพัสดุ", en: "Shipping box" }}
            signedIn={false}
            lineOaId={null}
            rfqPath="/rfq"
            pageUrl="http://localhost/configure/shipping-box"
          />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(events("cfg_quote_only_shown")).toHaveLength(1), { timeout: 8000 });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(events("cfg_quote_only_shown")).toHaveLength(1);
    expect(events("cfg_quote_only_shown")[0]).toMatchObject({ size: expect.any(String), qty: expect.any(Number) });
  });
});
