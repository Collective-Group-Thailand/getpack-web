/**
 * Overrides on top of `mocks/generated/handlers.ts`.
 *
 * The generated handlers answer every operation with the example from the contract, which is
 * enough to render a screen but not to exercise a flow. The modules composed here add
 * behaviour, all of it obviously fake:
 *
 *   ./auth.ts     sign-in, refresh and /me, with one staff persona per D-140 role
 *   ./store/*     the storefront: the catalogue read from the back office's rows, and the
 *                 signed-in customer's profile, consents and orders (two customer personas)
 *   ./admin/*     the back office: published endpoints with state, and contract requests
 *                 through `mockRequest`, which holds every response to its requested schema
 *
 * Order matters: MSW uses the first handler that matches, so overrides come before the
 * generated fallbacks.
 */

import { http, HttpResponse } from "msw";

import { adminHandlers } from "./admin";
import { authHandlers } from "./auth";
import { generatedHandlers } from "./generated/handlers";
import { storeHandlers } from "./store";

export { MOCK_ID_TOKENS, MOCK_NEW_CUSTOMER_PHONE, MOCK_OTP, MOCK_PARTNER, MOCK_STAFF } from "./auth";

/** The notification inbox every surface shares in the mock. Two items, one unread. */
const inbox = [
  {
    id: "00000000-0000-4000-8000-00000000e001",
    eventType: "order.paid",
    title: "รับชำระเงินแล้ว (ข้อมูลจำลอง)",
    body: "คำสั่งซื้อ PK-2569-00042 ชำระเงินครบแล้ว",
    readAt: null as string | null,
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  },
  {
    id: "00000000-0000-4000-8000-00000000e002",
    eventType: "artwork.changes_requested",
    title: "ขอให้แก้ไขไฟล์งาน (ข้อมูลจำลอง)",
    body: "ไฟล์ของ PK-2569-00041 ต้องเพิ่มระยะตัดตก 3 มม.",
    readAt: "2026-09-23T10:00:00+07:00" as string | null,
    createdAt: new Date(Date.now() - 3 * 60 * 60_000).toISOString(),
  },
];

export const handlers = [
  ...authHandlers,
  ...storeHandlers,
  ...adminHandlers,

  // Notifications on the contract B1.3 published (InboxItemDto, cursor feed, per-item read).
  // Stateful, so "mark read" visibly does something; obviously fake.
  http.get("*/v1/:surface/notifications", () =>
    HttpResponse.json({ data: inbox.map((item) => ({ ...item })), meta: { nextCursor: null } }),
  ),
  http.post("*/v1/:surface/notifications/:notificationId/actions/read", ({ params }) => {
    const item = inbox.find((entry) => entry.id === params.notificationId);
    if (item && item.readAt === null) item.readAt = new Date().toISOString();
    return new HttpResponse(null, { status: 204 });
  }),

  // Web push: the VAPID key is null, the contract's way of saying "not configured here", so
  // nothing ever subscribes against the mock.
  http.get("*/v1/:surface/web-push/vapid-public-key", () => HttpResponse.json({ vapidPublicKey: null })),

  // Realtime: the stream is deliberately not mocked — `NEXT_PUBLIC_REALTIME_DRIVER` is unset in
  // development and in the e2e run, so nothing opens one.

  // CONTRACT-REQUEST analytics.events — the D-102 funnel, accepted and discarded.
  http.post("*/v1/store/analytics/events", () => new HttpResponse(null, { status: 202 })),

  // CONTRACT-REQUEST rum.web-vitals — no endpoint exists yet (docs/contract-requests.md).
  // Accepted and discarded, on all three surfaces, so `pnpm dev:mock` and the e2e run do not
  // fill the console with unhandled-request warnings on every page load.
  http.post("*/v1/:surface/rum/web-vitals", () => new HttpResponse(null, { status: 202 })),

  // Anything not overridden falls through to the contract's own examples.
  ...generatedHandlers,
];
