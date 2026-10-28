import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import styles from "@/i18n/messages/th/customer/styles.json";

import QuickView from "./QuickView";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/browser", () => ({ browserApi: () => ({ GET: get }) }));
vi.mock("next/dynamic", () => ({ default: () => () => <b>3d</b> }));
vi.mock("@/lib/analytics/catalog", () => ({ trackCatalog: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));

const detail = (extra: Record<string, unknown> = {}) => ({
  code: "PK-A-001",
  nameTh: "กล่องฝาครอบ",
  nameEn: "Lid box",
  category: "rigid",
  family: "specialty",
  materialClass: "rigid",
  construction: "x",
  pricePath: "rfq",
  productTypeCode: null,
  startingPrice: null,
  photo: null,
  assets: [],
  axes: [],
  variants: [{ code: "PK-A-001-1", options: {}, pricePath: "rfq" }],
  sizeRanges: [],
  leadTime: null,
  useCases: [],
  descriptionTh: null,
  descriptionEn: null,
  ...extra,
});

const open = async (style: object, props: Partial<React.ComponentProps<typeof QuickView>> = {}) => {
  get.mockResolvedValue({ data: style, error: undefined });
  const onClose = vi.fn();
  render(
    <NextIntlClientProvider locale="th" messages={{ styles }}>
      <button>opener</button>
      <QuickView code="PK-A-001" onClose={onClose} quoteHrefs={{}} signedIn={false} taxInvoiceNote={null} {...props} />
    </NextIntlClientProvider>,
  );
  await screen.findByRole("dialog");
  return onClose;
};

beforeEach(() => get.mockReset());

describe("the quick view", () => {
  it("is a dialog titled with the style, with the studio call to action and a quote call to action", async () => {
    await open(detail());
    expect(await screen.findByRole("heading", { name: "กล่องฝาครอบ" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "เริ่มออกแบบแบบนี้" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ขอใบเสนอราคา" })).toBeInTheDocument();
  });

  it("shows only the facts the API has: no tier table, no sample kit, no cart, no dieline tab, no VAT note", async () => {
    await open(detail());
    await screen.findByRole("button", { name: "เริ่มออกแบบแบบนี้" });
    expect(screen.queryByText(/สั่งกล่องตัวอย่าง/)).toBeNull();
    expect(screen.queryByText(/ขั้นต่ำ/)).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("radio", { name: styles.detail.viewDieline })).toBeNull();
    expect(screen.queryByText(styles.library.quickViewVat)).toBeNull();
    expect(screen.queryByText(styles.library.quickViewLeadTime)).toBeNull();
  });

  it("offers the 'แบบคลี่' view only when a dieline asset exists", async () => {
    await open(detail({ assets: [{ kind: "dieline_svg", url: "https://files.example/d.svg", variantCode: null }] }));
    expect(await screen.findByRole("radio", { name: "แบบคลี่" })).toBeInTheDocument();
  });

  it("writes the price with its VAT label and the VAT note only with a starting price", async () => {
    await open(
      detail({
        pricePath: "instant",
        startingPrice: { unitPrice: "4.85", quantity: 1000, currency: "THB", catalogProductSlug: "box" },
      }),
    );
    await screen.findByRole("button", { name: "เริ่มออกแบบแบบนี้" });
    expect(screen.getByText(styles.library.quickViewVat)).toBeInTheDocument();
    expect(screen.getAllByText("รวม VAT").length).toBeGreaterThan(0);
  });

  it("closes on Escape and keeps keyboard focus inside while open", async () => {
    const onClose = await open(detail());
    await screen.findByRole("button", { name: "เริ่มออกแบบแบบนี้" });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    // Radix traps focus: the element outside the dialog is not where focus lands.
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
  });
});
