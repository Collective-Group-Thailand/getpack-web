import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import common from "@/i18n/messages/th/common/common.json";
import styles from "@/i18n/messages/th/customer/styles.json";

import { CopyLinkButton, SortSelect } from "./LibraryControls";
import { LibraryToolbar } from "./LibraryToolbar";
import { emptyParams, readParams, SORTS } from "./query";

const router = { replace: vi.fn() };
vi.mock("@/i18n/navigation", () => ({ useRouter: () => router }));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn() }));
vi.mock("@/ui/components/Toast", () => ({ toast }));

const wrap = (node: React.ReactNode) => (
  <NextIntlClientProvider locale="th" messages={{ common, styles }}>
    {node}
  </NextIntlClientProvider>
);
const sorts = SORTS.map((value) => ({ value, label: styles.sorts[value] }));

beforeEach(() => {
  router.replace.mockClear();
  toast.success.mockClear();
});

describe("the toolbar's controls", () => {
  // The shared select field (a listbox button on a desktop pointer, the phone's own picker on touch).
  const trigger = () => screen.getByRole("button", { name: styles.library.sort });

  it("offers exactly the orders the API supports, popular first", () => {
    render(wrap(<SortSelect params={emptyParams()} sorts={sorts} />));
    expect(trigger()).toHaveTextContent("เรียง: ยอดนิยม");
    fireEvent.click(trigger());
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["ยอดนิยม", "มาใหม่", "ราคาทันทีก่อน", "ชื่อ ก–ฮ"].map((l) => `เรียง: ${l}`));
  });

  it("replaces the URL with the chosen order and leaves the default out", () => {
    render(wrap(<SortSelect params={readParams({ use: "gift" })} sorts={sorts} />));
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("option", { name: "เรียง: มาใหม่" }));
    expect(router.replace).toHaveBeenCalledWith("/styles?use=gift&sort=new", { scroll: false });
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("option", { name: "เรียง: ยอดนิยม" }));
    expect(router.replace).toHaveBeenLastCalledWith("/styles?use=gift", { scroll: false });
  });

  it("copies the canonical link: short names, no defaults", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(wrap(<CopyLinkButton params={readParams({ useCase: "gift", sort: "popular" })} />));
    fireEvent.click(screen.getByRole("button", { name: "คัดลอกลิงก์" }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0]?.[0]).toMatch(/\?use=gift$/);
  });
});

describe("the toolbar", () => {
  const base = { count: "50 แบบ", copyLink: <i>copy</i>, sort: <i>sort</i> };
  it("reserves the VAT slot: nothing is drawn unless the page passes the switch", () => {
    const { container, rerender } = render(<LibraryToolbar {...base} />);
    expect(container.querySelector("[data-slot=vat-switch]")).toBeNull();
    rerender(<LibraryToolbar {...base} vatSwitch={<button>ราคารวม VAT</button>} />);
    expect(container.querySelector("[data-slot=vat-switch]")).not.toBeNull();
  });

  it("announces the count politely", () => {
    render(<LibraryToolbar {...base} />);
    expect(screen.getByRole("heading", { name: "50 แบบ" })).toHaveAttribute("aria-live", "polite");
  });
});
