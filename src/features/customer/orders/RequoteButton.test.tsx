import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NextIntlClientProvider } from "next-intl";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import myOrders from "@/i18n/messages/th/customer/my-orders.json";
import { createApiClient } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

import { RequoteButton } from "./RequoteButton";

const router = { push: vi.fn(), refresh: vi.fn() };
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => router,
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/lib/api/browser", async () => {
  const { createApiClient: make } = await import("@/lib/api/client");
  return { browserApi: () => make({ baseUrl: "http://api.test" }) };
});
vi.mock("@/ui/components/Toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const GROUP = "0192f3a0-7c1e-7d2a-9b1f-0000000d0001";
const preview = (total: string, previous = "9284.96", difference = "172.14"): Schemas["RequotePreviewDto"] => ({
  groupId: GROUP,
  groupCode: "OG-2610-00016",
  previousGrossAmount: previous,
  newGrossAmount: total,
  differenceAmount: difference,
  newCashAmount: total,
  priceValidUntil: "2026-11-09T10:00:00+07:00",
  paymentDueAt: "2026-11-01T10:00:00+07:00",
  orders: [
    {
      orderId: "o1",
      orderCode: "OR-2610-00016",
      quoteId: "q1",
      quoteOptionId: "qo1",
      quantity: 300,
      previousGrossAmount: "4302.86",
      newGrossAmount: "4388.92",
      differenceAmount: "86.06",
      newUnitPrice: "14.629733",
      leadTimeDays: 5,
      promisedShipDate: "2026-11-03",
      estimatedDeliveryDate: "2026-11-05",
    },
  ],
});
const problem = (status: number, code: string) =>
  HttpResponse.json(
    { type: `https://errors.getpack/${code}`, title: code, status, code, detail: `detail ${code}`, requestId: "req-1" },
    { status, headers: { "content-type": "application/problem+json" } },
  );

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => {
  router.push.mockClear();
  router.refresh.mockClear();
});

function renderButton() {
  return render(
    <NextIntlClientProvider locale="th" messages={{ myOrders }} timeZone="Asia/Bangkok">
      <RequoteButton groupId={GROUP} payHref="/account/orders/o1#instalments" />
    </NextIntlClientProvider>,
  );
}
const requote = "http://api.test/v1/store/order-groups/:groupId/actions/requote";
const confirm = "http://api.test/v1/store/order-groups/:groupId/actions/confirm-requote";
void createApiClient;

describe("ตรวจราคาใหม่และชำระ", () => {
  it("shows the price difference before anything is confirmed, then confirms the preview and goes to payment", async () => {
    let sent: { key: string | null; body: unknown } | null = null;
    server.use(
      http.post(requote, () => HttpResponse.json(preview("9457.10"))),
      http.post(confirm, async ({ request }) => {
        sent = { key: request.headers.get("idempotency-key"), body: await request.json() };
        return HttpResponse.json({ id: GROUP, paymentOverdue: false });
      }),
    );
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole("button", { name: "ตรวจราคาใหม่และชำระ" }));

    // The difference is on screen, and nothing has been written yet.
    expect(await screen.findByText("ยอดใหม่ของทั้งกลุ่ม")).toBeInTheDocument();
    expect(screen.getByText("ราคาเพิ่มขึ้น")).toBeInTheDocument();
    expect(screen.getAllByText(/172\.14/).length).toBeGreaterThan(0);
    expect(sent).toBeNull();

    await user.click(screen.getByRole("button", { name: /ยืนยันราคาใหม่/ }));
    await waitFor(() => expect(sent).not.toBeNull());
    expect(sent!.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent!.body).toMatchObject({
      expectedGrossAmount: "9457.10",
      orders: [{ orderId: "o1", quoteId: "q1", quoteOptionId: "qo1" }],
    });

    await user.click(await screen.findByRole("button", { name: "ไปชำระเงิน" }));
    expect(router.push).toHaveBeenCalledWith("/account/orders/o1#instalments");
  });

  it("on order.requote_changed shows the newer price and asks again instead of writing the old one", async () => {
    let previews = 0;
    server.use(
      http.post(requote, () =>
        HttpResponse.json(previews++ === 0 ? preview("9457.10") : preview("9500.00", "9284.96", "215.04")),
      ),
      http.post(confirm, () => problem(409, "order.requote_changed")),
    );
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole("button", { name: "ตรวจราคาใหม่และชำระ" }));
    await user.click(await screen.findByRole("button", { name: /ยืนยันราคาใหม่/ }));
    expect(await screen.findByText(/ราคาเปลี่ยนแล้วระหว่างที่คุณดูอยู่/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ยืนยันราคาใหม่ .*9,500/ })).toBeInTheDocument();
  });

  it("on order.requote_unavailable says the team will re-quote, with no flow of its own", async () => {
    server.use(http.post(requote, () => problem(409, "order.requote_unavailable")));
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole("button", { name: "ตรวจราคาใหม่และชำระ" }));
    expect(await screen.findByText("ตรวจราคาใหม่เองไม่ได้")).toBeInTheDocument();
    expect(screen.getByText(/ทีมงานจะตรวจราคาใหม่ให้/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ติดต่อทีมงาน" })).toHaveAttribute("href", "/help/contact");
    expect(screen.queryByRole("button", { name: /ยืนยันราคาใหม่/ })).not.toBeInTheDocument();
  });

  it("never uses auto-cancel wording", () => {
    expect(JSON.stringify(myOrders)).not.toMatch(/ยกเลิก.{0,20}อัตโนมัติ|อัตโนมัติ.{0,20}ยกเลิก/);
  });
});
