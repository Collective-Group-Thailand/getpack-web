import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import styles from "@/i18n/messages/th/customer/styles.json";

import { FilterPanel, type PanelGroup } from "./FilterPanel";
import { emptyParams } from "./query";

const router = { replace: vi.fn() };
vi.mock("@/i18n/navigation", () => ({ useRouter: () => router }));

const item = (value: string, count: number, selected = false) => ({ value, label: value, count, selected });
const topics = Array.from({ length: 8 }, (_, i) => ({
  title: `หัวข้อ${i}`,
  items: [item(`t${i}:x`, 10 - i)],
}));
const feature: PanelGroup = { key: "feature", title: "ลูกเล่น", display: "list", subGroups: topics };
const use: PanelGroup = {
  key: "useCase",
  title: "เหมาะกับ",
  display: "chips",
  subGroups: [{ title: null, items: Array.from({ length: 7 }, (_, i) => item(`u${i}`, 7 - i)) }],
};

const view = (groups: PanelGroup[], instantCount: number | null = 16, params = emptyParams()) =>
  render(
    <NextIntlClientProvider locale="th" messages={{ styles }}>
      <FilterPanel params={params} groups={groups} instantCount={instantCount} resultCount={50} />
    </NextIntlClientProvider>,
  );

describe("the filter panel", () => {
  it("puts the instant-price switch first, and leaves it out without data", () => {
    const { container, unmount } = view([feature]);
    expect(container.firstElementChild).toContainElement(screen.getByRole("switch"));
    unmount();
    view([feature], null);
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("shows six sub-group headings and one control for the rest", () => {
    view([feature]);
    const section = screen.getByRole("region", { name: /ลูกเล่น/ });
    expect(within(section).getAllByRole("group")).toHaveLength(6);
    fireEvent.click(within(section).getByRole("button", { name: "ดูเพิ่มอีก 2 หัวข้อ" }));
    expect(within(section).getAllByRole("group")).toHaveLength(8);
  });

  it("shows the first five values and a control for the rest; suits are chips", () => {
    view([use]);
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "ดูเพิ่มอีก 2 รายการ" }));
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(7);
  });

  it("changes the URL by replace, one value per facet while the API takes one", () => {
    view([use]);
    fireEvent.click(screen.getByRole("button", { name: /u1/ }));
    expect(router.replace).toHaveBeenCalledWith("/styles?use=u1", { scroll: false });
  });
});
