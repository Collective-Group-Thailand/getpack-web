import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CategoryRail, type RailItem } from "./CategoryRail";

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
    render(<CategoryRail label="หมวดบรรจุภัณฑ์" items={items} />);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/styles", "/styles?cat=rigid", "/styles?cat=label"]);
    expect(screen.getByText("30 แบบ")).toBeInTheDocument();
  });

  it("marks the selected category and invents no count where the API gave none", () => {
    render(<CategoryRail label="หมวดบรรจุภัณฑ์" items={items} />);
    expect(screen.getByRole("link", { name: /กล่องแข็ง/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /ทั้งหมด/ })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "ฉลาก" })).toBeInTheDocument();
  });

  it("scrolls sideways instead of wrapping on a narrow screen", () => {
    render(<CategoryRail label="หมวดบรรจุภัณฑ์" items={items} />);
    expect(screen.getByRole("navigation", { name: "หมวดบรรจุภัณฑ์" }).className).toContain("overflow-x-auto");
  });
});
