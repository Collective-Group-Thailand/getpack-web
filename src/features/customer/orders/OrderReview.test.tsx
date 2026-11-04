import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import myOrders from "@/i18n/messages/th/customer/my-orders.json";
import { ApiError } from "@/lib/api/problem";

import { OrderReview } from "./OrderReview";
import { canReview, type Review } from "./review";

const post = vi.fn();
vi.mock("@/lib/api/browser", () => ({ browserApi: () => ({ POST: post }) }));
// The picker's upload is its own (claims); here a button stands in for "one photo uploaded".
vi.mock("@/features/customer/fulfilment/PhotoPicker", () => ({
  PhotoPicker: ({
    max,
    onChange,
  }: {
    max: number;
    onChange: (update: (current: { key: string; name: string; preview: string; fileId?: string }[]) => unknown) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onChange((current) => [...current, { key: "k1", name: "box.jpg", preview: "blob:1", fileId: FILE }])
      }
    >
      {`picker max ${max}`}
    </button>
  ),
}));

const ORDER = "0192f3a0-7c1e-7d2a-9b1f-0000000b0011";
const FILE = "0192f3a0-7c1e-7d2a-9b1f-00000000f101";
const review = (over: Partial<Review> = {}): Review => ({
  id: "0192f3a0-7c1e-7d2a-9b1f-0000000b0010",
  orderId: ORDER,
  orderCode: "OR-2610-0042",
  productTypeCode: "folding_carton",
  rating: 4,
  comment: "กล่องแข็งแรง สีตรง",
  status: "pending",
  reply: null,
  rewardPoints: 10,
  createdAt: "2026-11-04T10:00:00+07:00",
  photos: [],
  photoRewardPoints: 0,
  ...over,
});
const problem = (status: number, code: string) =>
  new ApiError({ type: "about:blank", title: code, status, code, detail: code, requestId: "r1" } as never);

function renderTh(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="th" messages={{ myOrders }} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  post.mockReset();
});

describe("review rules", () => {
  it("offers the review only for a delivered order that is not cancelled", () => {
    expect(canReview({ cancelledAt: null, receipt: { deliveredAt: "2026-11-01T10:00:00+07:00" } })).toBe(true);
    expect(canReview({ cancelledAt: null, receipt: { deliveredAt: null } })).toBe(false);
    expect(canReview({ cancelledAt: "2026-11-01T10:00:00+07:00", receipt: { deliveredAt: "2026-11-01" } })).toBe(false);
  });
});

describe("OrderReview", () => {
  it("asks for a star rating before sending", async () => {
    renderTh(<OrderReview orderId={ORDER} initial={null} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "ส่งรีวิว" })));
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("เลือกจำนวนดาวก่อนส่งรีวิว");
  });

  it("sends the rating and comment, then shows the review with the API's reward", async () => {
    post.mockResolvedValue({ data: review({ rating: 5, comment: "ดีมาก" }) });
    renderTh(<OrderReview orderId={ORDER} initial={null} />);
    fireEvent.click(screen.getByRole("radio", { name: "5 จาก 5 ดาว" }));
    expect(screen.getByText("พอใจมาก")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  ดีมาก  " } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "ส่งรีวิว" })));
    expect(post).toHaveBeenCalledWith("/v1/store/orders/{orderId}/review", {
      params: { path: { orderId: ORDER } },
      body: { rating: 5, comment: "ดีมาก" },
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(screen.getByText("รอตรวจสอบ")).toBeInTheDocument();
    expect(screen.getByText(/ได้รับ/)).toHaveTextContent("ได้รับ 10 แต้ม จากรีวิวนี้");
    expect(screen.getByRole("button", { name: "แนบรูป" })).toBeInTheDocument();
  });

  it("attaches the photos after the review and shows the combined reward", async () => {
    const photo = { id: FILE, url: "/v1/store/catalog/images/x" };
    post.mockImplementation((path: string) =>
      Promise.resolve({
        data: path.endsWith("/photos")
          ? review({ photos: [photo], rewardPoints: 20, photoRewardPoints: 10 })
          : review(),
      }),
    );
    renderTh(<OrderReview orderId={ORDER} initial={null} />);
    fireEvent.click(screen.getByRole("radio", { name: "4 จาก 5 ดาว" }));
    fireEvent.click(screen.getByRole("button", { name: "picker max 4" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "ส่งรีวิว" })));
    expect(post).toHaveBeenLastCalledWith("/v1/store/orders/{orderId}/review/photos", {
      params: { path: { orderId: ORDER } },
      body: { photoFileIds: [FILE] },
    });
    // The reply is the whole review: its one photo is listed once.
    expect(screen.getAllByRole("img", { name: /รูปในรีวิว/ })).toHaveLength(1);
    expect(screen.getByText(/ได้รับ/)).toHaveTextContent("ได้รับ 20 แต้ม");
  });

  it("keeps the review when only the photos fail, and says so", async () => {
    post.mockImplementation((path: string) =>
      path.endsWith("/photos")
        ? Promise.reject(problem(422, "reviews.photo_window_closed"))
        : Promise.resolve({ data: review() }),
    );
    renderTh(<OrderReview orderId={ORDER} initial={null} />);
    fireEvent.click(screen.getByRole("radio", { name: "3 จาก 5 ดาว" }));
    fireEvent.click(screen.getByRole("button", { name: "picker max 4" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "ส่งรีวิว" })));
    expect(screen.getByText("รอตรวจสอบ")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("แนบรูปได้ภายใน 30 วันหลังส่งรีวิว");
  });

  it("names a duplicate review", async () => {
    post.mockRejectedValue(problem(409, "reviews.exists"));
    renderTh(<OrderReview orderId={ORDER} initial={null} />);
    fireEvent.click(screen.getByRole("radio", { name: "4 จาก 5 ดาว" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "ส่งรีวิว" })));
    expect(screen.getByRole("alert")).toHaveTextContent("คำสั่งซื้อนี้มีรีวิวแล้ว");
  });

  it("shows an existing review with the reply, its photos and room for the rest", () => {
    renderTh(
      <OrderReview
        orderId={ORDER}
        initial={review({
          status: "published",
          rewardPoints: 0,
          reply: { body: "ขอบคุณครับ", repliedAt: "2026-11-05T10:00:00+07:00" },
          photos: [{ id: FILE, url: "/p.jpg" }],
        })}
      />,
    );
    expect(screen.getByRole("img", { name: "4 จาก 5 ดาว" })).toBeInTheDocument();
    expect(screen.getByText("แสดงบนหน้ารีวิวแล้ว")).toBeInTheDocument();
    expect(screen.getByText("ขอบคุณครับ")).toBeInTheDocument();
    expect(screen.queryByText(/ได้รับ/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "แนบรูปเพิ่ม" }));
    expect(screen.getByRole("button", { name: "picker max 3" })).toBeInTheDocument();
  });
});
