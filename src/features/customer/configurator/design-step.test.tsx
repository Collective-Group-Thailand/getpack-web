import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupServer } from "msw/node";
import { NextIntlClientProvider } from "next-intl";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { handlers } from "../../../../mocks/handlers";
import { loadAllMessages } from "@/i18n/messages";
import { createApiClient } from "@/lib/api/client";

import { DesignStep } from "./DesignStep";
import { designOptionOf, initialState, type Configurator, type ConfiguratorState } from "./state";
import { seedFromDesign } from "./url-state";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/lib/api/browser", async () => {
  const { createApiClient: make } = await import("@/lib/api/client");
  return { browserApi: () => make({ baseUrl: "http://api.test" }), isApiError: () => false };
});

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(cleanup);

async function product(): Promise<Configurator> {
  const { data } = await createApiClient({ baseUrl: "http://api.test" }).GET(
    "/v1/store/catalog/products/{slug}/configurator",
    { params: { path: { slug: "shipping-box" } } },
  );
  return data as Configurator;
}

/** A product whose API default is not "own_file", so "own_file" showing up by accident is visible. */
const defaultingTo = (configurator: Configurator, option: "hired_design" | "online_designer"): Configurator => ({
  ...configurator,
  design: { options: ["own_file", "online_designer", "hired_design"], default: option },
});

describe("the design step opens on the API's default", () => {
  it("no ?design: the API's default; ?design=own_file: own_file; a size alone never picks own_file or the Studio", async () => {
    const configurator = defaultingTo(await product(), "hired_design");
    const chosen = (query: Parameters<typeof seedFromDesign>[1]) =>
      designOptionOf(configurator, initialState(configurator, seedFromDesign(configurator, query)).designOption, true);

    expect(chosen({})).toBe("hired_design");
    expect(chosen({ size: configurator.standardSizes[0]?.code })).toBe("hired_design");
    expect(chosen({ l: "200", w: "150", d: "100", qty: "1000" })).toBe("hired_design");
    expect(chosen({ from: "home", material: "x" })).toBe("hired_design");
    expect(chosen({ design: "own_file" })).toBe("own_file");
    expect(chosen({ design: "own_file", size: configurator.standardSizes[0]?.code })).toBe("own_file");
    // A value that is not an option of this product is ignored, not turned into own_file.
    expect(chosen({ design: "nonsense" })).toBe("hired_design");
  });
});

describe("DesignStep", () => {
  async function renderStep(
    props: Partial<React.ComponentProps<typeof DesignStep>> & { configurator: Configurator },
    designOption: ConfiguratorState["designOption"] = props.configurator.design.default,
  ) {
    const messages = await loadAllMessages("th");
    const state = { ...initialState(props.configurator), designOption };
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NextIntlClientProvider locale="th" messages={messages}>
          <DesignStep state={state} onChange={() => {}} designerAvailable studioLink={null} {...props} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
  }

  it("shows the three paths with the exact own-file copy and no invented revision count", async () => {
    const configurator = defaultingTo(await product(), "hired_design");
    await renderStep({ configurator });
    const names = screen.getAllByRole("radio").map((radio) => radio.textContent);
    expect(names).toHaveLength(3);
    expect(names[0]).toContain("มีไฟล์งานแล้ว");
    expect(names[0]).toContain("อัปโหลดไฟล์หลังสั่งซื้อ ทีมงานตรวจไฟล์ให้ก่อนผลิต");
    expect(names[1]).toContain("ออกแบบในสตูดิโอ");
    expect(names[2]).toContain("จ้างนักออกแบบ");
    expect(document.body.textContent).not.toMatch(/ฟรี 3 ครั้ง|3 ครั้ง/);
    expect(screen.getByRole("radio", { name: /จ้างนักออกแบบ/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /มีไฟล์งานแล้ว/ })).not.toBeChecked();
  });

  it("hides the Studio card where the product cannot open in the Studio", async () => {
    const configurator = defaultingTo(await product(), "hired_design");
    await renderStep({ configurator, designerAvailable: false });
    expect(screen.queryByRole("radio", { name: /ออกแบบในสตูดิโอ/ })).toBeNull();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("links to the Studio once that card is the chosen path", async () => {
    const configurator = await product();
    await renderStep({ configurator, studioLink: "/studio/new?product=shipping-box&step=start" }, "online_designer");
    expect(screen.getByRole("link", { name: "เปิดสตูดิโอ" })).toHaveAttribute(
      "href",
      "/studio/new?product=shipping-box&step=start",
    );
  });

  it("asks for the sample through the existing flow, and says what it needs while there is no price", async () => {
    const configurator = await product();
    const onChange = vi.fn();
    await renderStep({ configurator, sample: { checked: false, disabled: false, onChange } });
    await userEvent.click(screen.getByRole("checkbox", { name: "ขอตัวอย่างจริงก่อนผลิต" }));
    expect(onChange).toHaveBeenCalledWith(true);
    cleanup();
    await renderStep({ configurator, sample: { checked: false, disabled: true, onChange } });
    expect(screen.getByRole("checkbox", { name: "ขอตัวอย่างจริงก่อนผลิต" })).toBeDisabled();
    expect(document.body.textContent).toContain("ดูราคาก่อน");
  });
});
