import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import deals from "@/i18n/messages/th/customer/deals.json";
import { DealCard } from "@/features/shared/deals/DealCard";
import { ApiError } from "@/lib/api/problem";

import { fixtureDeal } from "../../../../mocks/store/deals-fixtures";

import { BundleSheet } from "./BundleSheet";
import { forYouReasonText } from "./for-you";

const call = vi.fn();
let failWith: Error | null = null;
const push = vi.fn();
vi.mock("@/lib/api/requests/browser", () => ({
  browserRequests: () => ({ call: (...args: unknown[]) => (failWith ? Promise.reject(failWith) : call(...args)) }),
}));
vi.mock("@/lib/api/browser", () => ({
  browserApi: () => ({
    GET: async () => ({ data: {}, response: new Response(null, { headers: { etag: 'W/"cart.3"' } }) }),
  }),
}));
vi.mock("@/ui/components/Toast", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

function renderTh(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="th" messages={{ deals }} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );
}

const words = {
  newCustomer: "สำหรับลูกค้าใหม่",
  tier: "สำหรับสมาชิกตามระดับของคุณ",
  orderedType: (type: string) => `สำหรับลูกค้าที่เคยสั่ง${type}`,
  orderedAny: "สำหรับลูกค้าที่เคยสั่งสินค้าประเภทนี้",
};
const bundle = fixtureDeal("starter-bundle");
const NOW = Date.parse("2026-11-04T10:00:00+07:00");

beforeEach(() => {
  call.mockReset();
  push.mockReset();
  failWith = null;
});

describe("the for-you reason", () => {
  it("words only the reasons the API may disclose", () => {
    expect(forYouReasonText(bundle, words, { corrugated: "กล่องลูกฟูก" })).toBe("สำหรับลูกค้าที่เคยสั่งกล่องลูกฟูก");
    expect(forYouReasonText({ ...bundle, forYouReason: "tier" } as never, words, {})).toBe(words.tier);
    // A business-type or inactivity match comes without a reason: no line at all.
    expect(forYouReasonText({ ...bundle, forYouReason: null } as never, words, {})).toBeNull();
    expect(forYouReasonText({ ...bundle, forYou: false } as never, words, {})).toBeNull();
  });
});

describe("a bundle deal", () => {
  it("shows the estimated saving, the pieces, the reason and the add-to-cart action", () => {
    const onAddBundle = vi.fn();
    renderTh(
      <DealCard
        deal={bundle}
        signedIn
        now={NOW}
        reasonText="สำหรับลูกค้าที่เคยสั่งกล่องลูกฟูก"
        onAddBundle={onAddBundle}
      />,
    );
    expect(screen.getByText("ประหยัดประมาณ")).toBeInTheDocument();
    expect(screen.getByText("ก่อน VAT")).toBeInTheDocument();
    expect(screen.getByText("สำหรับลูกค้าที่เคยสั่งกล่องลูกฟูก")).toBeInTheDocument();
    expect(screen.getByText("กล่องลูกฟูก")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มชุดนี้ลงตะกร้า" }));
    expect(onAddBundle).toHaveBeenCalledWith(bundle);
  });
});

describe("BundleSheet", () => {
  it("adds the set under the cart's ETag with each item's design choice, then goes to the cart", async () => {
    call.mockResolvedValue({ id: "c", items: [] });
    renderTh(<BundleSheet deal={bundle} signedIn onOpenChange={vi.fn()} />);
    expect(screen.getByText("฿14.79 ต่อใบ (รวม VAT)")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("radio", { name: "จ้างออกแบบ" })[1]!);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "เพิ่ม 2 รายการลงตะกร้า" })));
    expect(call).toHaveBeenCalledWith("POST /v1/store/promotions/{promotionId}/actions/add-bundle", {
      path: { promotionId: bundle.id },
      etag: 'W/"cart.3"',
      body: { items: [{ designOption: "own_file" }, { designOption: "hired_design" }] },
    });
    expect(push).toHaveBeenCalledWith("/cart");
  });

  it("names the piece that no longer prices", async () => {
    failWith = new ApiError({
      title: "",
      status: 422,
      code: "promotions.bundle_unavailable",
      detail: "",
      requestId: "r",
      errors: [{ path: "items[1]", code: "unpriceable", message: "" }],
    } as never);
    renderTh(<BundleSheet deal={bundle} signedIn onOpenChange={vi.fn()} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "เพิ่ม 2 รายการลงตะกร้า" })));
    expect(screen.getByRole("alert")).toHaveTextContent("สติกเกอร์");
  });

  it("sends a guest to sign in instead", async () => {
    renderTh(<BundleSheet deal={bundle} signedIn={false} onOpenChange={vi.fn()} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบเพื่อเพิ่มชุดนี้" })));
    expect(push).toHaveBeenCalledWith("/sign-in?next=%2Fdeals%2Fstarter-bundle");
    expect(call).not.toHaveBeenCalled();
  });
});
