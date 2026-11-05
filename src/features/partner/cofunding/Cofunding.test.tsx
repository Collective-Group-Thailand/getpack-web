import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import billing from "@/i18n/messages/th/partner/billing.json";
import common from "@/i18n/messages/th/common/common.json";
import { ApiError } from "@/lib/api/problem";

import { AcceptOffer, DeclineOffer } from "./actions";
import { capPct, inView, isClosed, OFFER_STATUS_TONE } from "./offers";
import { OfferTicket } from "./OfferTicket";

const call = vi.fn();
const refresh = vi.fn();
vi.mock("@/lib/api/requests/browser", () => ({ browserRequests: () => ({ call }) }));
vi.mock("@/features/partner/client", () => ({ useRefresh: () => [refresh, false] }));
const toastError = vi.fn();
vi.mock("@/ui/components/Toast", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: (message: string) => toastError(message) }),
}));

const renderTh = (node: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="th" messages={{ partnerBilling: billing, common }} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );

describe("partner co-funding offers (D-506)", () => {
  it("sorts offers into the views and keeps amber for the one waiting state", () => {
    expect(inView({ status: "proposed" }, "open")).toBe(true);
    expect(inView({ status: "accepted" }, "open")).toBe(false);
    expect(isClosed({ status: "declined" })).toBe(true);
    expect(isClosed({ status: "accepted" })).toBe(false);
    expect(Object.entries(OFFER_STATUS_TONE).filter(([, tone]) => tone === "accent")).toEqual([["proposed", "accent"]]);
    expect(capPct({ accruedAmount: "4320.00", capAmount: "12000.00" })).toBe(36);
  });

  it("draws the share on the stub and the respond-by as a static date", () => {
    renderTh(
      <OfferTicket
        href="/cofunding/o-1"
        share="40%"
        shareUnit="ของส่วนลดดีล"
        title="กล่องลูกฟูก · 9 พ.ย. – 15 พ.ย."
        meta="ดีลลด 5% · สูงสุด ฿20,000"
        status={{ label: "รอตอบรับ", tone: "accent" }}
        waiting="ตอบภายใน 7 พ.ย. 2569 23:59"
        linkLabel="ดูข้อเสนอ"
      />,
    );
    expect(screen.getByRole("link", { name: "กล่องลูกฟูก · 9 พ.ย. – 15 พ.ย." })).toHaveAttribute(
      "href",
      "/cofunding/o-1",
    );
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("ตอบภายใน 7 พ.ย. 2569 23:59")).toBeInTheDocument();
  });

  it("accepts after one confirmation with a fresh idempotency key", async () => {
    call.mockResolvedValueOnce({});
    renderTh(<AcceptOffer offerId="o-1" terms="40 % ของส่วนลดดีล สูงสุด ฿20,000" window="9–15 พ.ย." />);
    fireEvent.click(screen.getByRole("button", { name: "ตอบรับข้อเสนอ" }));
    const dialog = await screen.findByRole("alertdialog").catch(() => screen.findByRole("dialog"));
    fireEvent.click(within(dialog).getByRole("button", { name: "ยืนยันตอบรับ" }));
    await waitFor(() =>
      expect(call).toHaveBeenCalledWith(
        "POST /v1/partner/cofunding-offers/{offerId}/actions/accept",
        expect.objectContaining({ path: { offerId: "o-1" }, body: {}, idempotencyKey: expect.any(String) }),
      ),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("words a closed answer window in the factory's language", async () => {
    call.mockRejectedValueOnce(
      new ApiError({
        status: 409,
        code: "cofunding.response_closed",
        title: "x",
        type: "x",
        detail: "closed",
        requestId: "r",
      }),
    );
    renderTh(<DeclineOffer offerId="o-1" />);
    fireEvent.click(screen.getByRole("button", { name: "ปฏิเสธ" }));
    const dialog = await screen.findByRole("alertdialog").catch(() => screen.findByRole("dialog"));
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "ต้นทุนสูงช่วงนี้" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "ปฏิเสธข้อเสนอ" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("หมดเวลาตอบข้อเสนอนี้แล้ว"));
  });
});
