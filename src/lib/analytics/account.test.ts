import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { trackAccount } from "./account";
import { trackAccount as fromBarrel } from "./index";

type Window = { dataLayer?: unknown[] };
const layer = () => (window as unknown as Window).dataLayer!;
const consent = (value: string | null) => {
  document.cookie = value ? `pk_consent=${value}; path=/` : "pk_consent=; path=/; max-age=0";
};

beforeEach(() => {
  (window as unknown as Window).dataLayer = [];
});
afterEach(() => consent(null));

describe("trackAccount (account redesign, C6)", () => {
  it("is the same function from the analytics barrel", () => {
    expect(fromBarrel).toBe(trackAccount);
  });

  it("pushes the typed events once analytics is accepted", () => {
    consent("a1m0");
    trackAccount("orders_tab", { tab: "todo" });
    trackAccount("orders_search", { length: 5 });
    trackAccount("order_doc_download", { type: "tr" });
    expect(layer()).toEqual([
      { event: "orders_tab", tab: "todo" },
      { event: "orders_search", length: 5 },
      { event: "order_doc_download", type: "tr" },
    ]);
  });

  it("sends nothing without consent", () => {
    consent("a0m0");
    trackAccount("orders_export", { tab: "active", format: "csv" });
    expect(layer()).toEqual([]);
  });
});
