import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import styles from "@/i18n/messages/th/customer/styles.json";

import { CompareTray } from "./CompareTray";
import { CompareLimitProvider, useCompare } from "./compare-store";
import { CompareToggle } from "./StyleCardActions";

const toast = vi.hoisted(() => vi.fn());
vi.mock("@/ui/components/Toast", () => ({ toast }));
vi.mock("@/lib/analytics/catalog", () => ({ trackCatalog: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function Page({ limit }: { limit?: number | null }) {
  return (
    <NextIntlClientProvider locale="th" messages={{ styles }}>
      <CompareLimitProvider limit={limit}>
        {["PK-A-1", "PK-A-2", "PK-A-3", "PK-A-4"].map((code) => (
          <CompareToggle key={code} code={code} name={code} />
        ))}
        <CompareTray />
      </CompareLimitProvider>
    </NextIntlClientProvider>
  );
}

const pick = (code: string) => fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(code) }));

beforeEach(() => {
  toast.mockReset();
  window.localStorage.clear();
  // The store is module-level: empty it through its own API.
  function Reset() {
    const { clear } = useCompare();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
    useEffect(() => clear(), []);
    return null;
  }
  render(<Reset />).unmount();
});

describe("the compare tray", () => {
  it("is absent until a style is chosen, then says 'เลือกแล้ว x/3' with a link to the compare page", () => {
    render(<Page />);
    expect(screen.queryByRole("region", { name: styles.library.compareTray })).toBeNull();
    act(() => pick("PK-A-1"));
    act(() => pick("PK-A-2"));
    expect(screen.getByText("เลือกแล้ว 2/3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เปรียบเทียบ" })).toHaveAttribute(
      "href",
      "/styles/compare?codes=PK-A-1,PK-A-2",
    );
  });

  it("refuses a fourth style with a toast and keeps three (fallback limit 3)", () => {
    render(<Page />);
    for (const code of ["PK-A-1", "PK-A-2", "PK-A-3", "PK-A-4"]) act(() => pick(code));
    expect(toast).toHaveBeenCalledWith("เปรียบเทียบได้สูงสุด 3 แบบ");
    expect(screen.getByText("เลือกแล้ว 3/3")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /PK-A-4/ })).not.toBeChecked();
  });

  it("takes the limit from settings when the API supplies one", () => {
    render(<Page limit={2} />);
    for (const code of ["PK-A-1", "PK-A-2", "PK-A-3"]) act(() => pick(code));
    expect(toast).toHaveBeenCalledWith("เปรียบเทียบได้สูงสุด 2 แบบ");
    expect(screen.getByText("เลือกแล้ว 2/2")).toBeInTheDocument();
  });

  it("removes one style and clears them all", () => {
    render(<Page />);
    act(() => pick("PK-A-1"));
    act(() => pick("PK-A-2"));
    fireEvent.click(screen.getByRole("button", { name: "เอา PK-A-1 ออก" }));
    expect(screen.getByText("เลือกแล้ว 1/3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ล้าง" }));
    expect(screen.queryByText(/เลือกแล้ว/)).toBeNull();
  });
});
