import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SearchTracker } from "./LibraryControls";

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/catalog", () => ({ trackCatalog: track }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/styles" }));

beforeEach(() => track.mockReset());

describe("the search tracker", () => {
  it("fires a zero-result search with result_count 0, once", () => {
    const { rerender } = render(<SearchTracker query="ลูกโป่ง" resultCount={0} />);
    rerender(<SearchTracker query="ลูกโป่ง" resultCount={0} />);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("catalog_search", { query: "ลูกโป่ง", mode: "word", result_count: 0 });
  });

  it("stays quiet without a query", () => {
    render(<SearchTracker query={undefined} resultCount={5} />);
    expect(track).not.toHaveBeenCalled();
  });
});
