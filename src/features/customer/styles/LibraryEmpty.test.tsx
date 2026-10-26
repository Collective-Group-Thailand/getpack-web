import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import styles from "@/i18n/messages/th/customer/styles.json";

import { LibraryEmpty } from "./LibraryEmpty";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("the empty library", () => {
  it("says nothing matched and offers to clear the filters or ask the team for a new structure", () => {
    const l = styles.library;
    render(
      <LibraryEmpty
        title={l.emptyTitle}
        body={l.emptyBody}
        clearLabel={l.emptyClear}
        clearHref="/styles"
        requestLabel={l.emptyRequest}
        requestHref="/account/structural-requests/new"
      />,
    );
    expect(screen.getByText("ไม่พบแบบที่ตรงกับเงื่อนไข")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ล้างตัวกรองทั้งหมด" })).toHaveAttribute("href", "/styles");
    expect(screen.getByRole("link", { name: "ขอแบบใหม่จากทีม" })).toHaveAttribute(
      "href",
      "/account/structural-requests/new",
    );
  });
});
