import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import styles from "@/i18n/messages/th/customer/styles.json";

import { pageFor, searchWithPage } from "./query";
import { StyleResults } from "./StyleResults";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/browser", () => ({ browserApi: () => ({ GET: get }) }));
vi.mock("@/ui/components/VirtualGrid", () => ({
  VirtualGrid: ({ items, renderItem }: { items: unknown[]; renderItem: (item: unknown) => React.ReactNode }) => (
    <ul>
      {items.map((item, i) => (
        <li key={i}>{renderItem(item)}</li>
      ))}
    </ul>
  ),
}));
vi.mock("next/dynamic", () => ({ default: () => () => <b>card</b> }));

const cards = (from: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ code: `PK-X-${from + i}`, node: <b>card</b> }));
const wrap = (node: React.ReactNode) => (
  <NextIntlClientProvider locale="th" messages={{ styles }}>
    {node}
  </NextIntlClientProvider>
);

beforeEach(() => {
  get.mockReset();
  window.history.replaceState(null, "", "/styles?use=gift");
});

describe("load more", () => {
  it("shows how many of how many, with a bar, and loads the next 24 by cursor", async () => {
    get.mockResolvedValue({
      data: {
        data: Array.from({ length: 24 }, (_, i) => ({ code: `PK-Y-${i}` })),
        meta: { nextCursor: null },
      },
    });
    render(
      wrap(
        <StyleResults
          initial={cards(0, 24)}
          nextCursor="c1"
          query={{ limit: 24, useCase: "gift" }}
          total={50}
          signedIn={false}
          signInHref="/sign-in"
        />,
      ),
    );
    expect(screen.getByText("แสดง 24 จาก 50 แบบ")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "โหลดเพิ่ม" }));
    await waitFor(() => expect(screen.getByText("แสดง 48 จาก 50 แบบ")).toBeInTheDocument());
    expect(get).toHaveBeenCalledWith("/v1/store/styles", {
      params: { query: { limit: 24, useCase: "gift", cursor: "c1" } },
    });
    // The end of the list: nothing more to ask for, and the address says where we are.
    expect(screen.queryByRole("button", { name: "โหลดเพิ่ม" })).toBeNull();
    expect(window.location.search).toBe("?use=gift&page=2");
  });

  it("writes the page to the URL: 24 per page, never past the cap, nothing for the first", () => {
    expect([24, 25, 48, 49, 96, 300].map(pageFor)).toEqual([1, 2, 2, 3, 4, 4]);
    expect(searchWithPage("?use=gift&page=3", 24)).toBe("use=gift");
    expect(searchWithPage("?q=box", 72)).toBe("q=box&page=3");
  });
});
