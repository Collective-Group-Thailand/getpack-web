import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import styles from "@/i18n/messages/th/customer/styles.json";

import { CategoryRail, type RailItem } from "./CategoryRail";
import { categoryIcon } from "./category-icons";

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    disconnect() {}
    unobserve() {}
  },
);

const rail = (items: RailItem[]) =>
  render(
    <NextIntlClientProvider locale="th" messages={{ styles }}>
      <CategoryRail label="หมวดบรรจุภัณฑ์" items={items} />
    </NextIntlClientProvider>,
  );

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const items: RailItem[] = [
  { category: null, label: "ทั้งหมด", countLabel: "122 แบบ", href: "/styles", current: false },
  { category: "rigid", label: "กล่องแข็ง", countLabel: "30 แบบ", href: "/styles?cat=rigid", current: true },
  { category: "label", label: "ฉลาก", href: "/styles?cat=label", current: false },
];

describe("the category rail", () => {
  it("lists every category with its name and count, as links", () => {
    rail(items);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/styles", "/styles?cat=rigid", "/styles?cat=label"]);
    expect(screen.getByText("30 แบบ")).toBeInTheDocument();
  });

  it("marks the selected category and invents no count where the API gave none", () => {
    rail(items);
    expect(screen.getByRole("link", { name: /กล่องแข็ง/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /ทั้งหมด/ })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "ฉลาก" })).toBeInTheDocument();
  });

  it("scrolls sideways instead of wrapping on a narrow screen", () => {
    rail(items);
    expect(screen.getByRole("navigation", { name: "หมวดบรรจุภัณฑ์" }).className).toContain("overflow-x-auto");
  });

  it("draws every card with the same outline icon family and a neutral one for unknown codes", () => {
    rail([...items, { category: "brand_new", label: "ใหม่", href: "/styles?cat=brand_new", current: false }]);
    for (const link of screen.getAllByRole("link")) expect(link.querySelector("svg")).not.toBeNull();
    expect(categoryIcon("rigid")).not.toBe(categoryIcon("brand_new"));
    expect(categoryIcon("brand_new")).toBe(categoryIcon("also_unknown"));
    expect(categoryIcon(null)).toBe("layout-grid");
  });

  it("shows no scroll arrows while everything fits", () => {
    rail(items);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
