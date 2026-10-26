import { describe, expect, it } from "vitest";

import { CUSTOMER_ORDER_STATUS, statusMeta } from "@/domain/status";
import th from "@/i18n/messages/th/common/status.json";
import type { Schemas } from "@/lib/api/types";

import {
  artworkNoteOf,
  artworkNoteTextOf,
  deliveryDatesOf,
  isHeldByClaim,
  isPaymentOverdue,
  paymentShareOf,
  showAutoComplete,
  visibleActions,
  type OrderStateInput,
} from "./order-state";

type Status = Schemas["CustomerOrderStatus"];

const receipt = (over: Partial<Schemas["OrderReceiptDto"]> = {}): Schemas["OrderReceiptDto"] => ({
  deliveredAt: null,
  confirmedAt: null,
  completedAt: null,
  completionMode: null,
  completionHeldByClaim: false,
  autoCompleteAt: null,
  claimWindowEndsAt: null,
  ...over,
});

const payment = (over: Partial<Schemas["OrderPaymentShareDto"]> = {}): Schemas["OrderPaymentShareDto"] => ({
  groupId: "g1",
  groupCode: "UATOG-2610-00016",
  groupOrderCount: 1,
  orderGrossAmount: "4302.86",
  orderCashAmount: "4302.86",
  groupGrossAmount: "4302.86",
  groupCashAmount: "4302.86",
  dueAt: null,
  overdue: false,
  ...over,
});

/** An order as the API serves it for one customer status — the fields the web reads, nothing else. */
function order(status: Status, over: Partial<OrderStateInput> = {}): OrderStateInput {
  return {
    customerStatus: status,
    artworkStatus: "approved",
    artworkOwner: null,
    artworkNoteTh: null,
    deliveryDateBasis: "planned",
    payment: payment(),
    receipt: receipt(),
    openClaims: [],
    ...over,
  };
}

const claim = {
  id: "c1",
  claimNo: "UATCL-2610-0001",
  status: "under_review",
  statusLabelTh: "ทีมงานกำลังตรวจสอบ",
  statusLabelAdminTh: "ทีมงานกำลังตรวจสอบ",
} as const;
const delivered = receipt({
  deliveredAt: "2026-10-12T10:00:00+07:00",
  autoCompleteAt: "2026-10-19T10:00:00+07:00",
  claimWindowEndsAt: "2026-10-19T10:00:00+07:00",
});
const ALL = [
  { key: "order.upload_artwork" },
  { key: "order.confirm_receipt" },
  { key: "order.open_claim" },
  { key: "order.reorder" },
];

describe("the customer status chip", () => {
  const WORDS: Record<Status, string> = {
    awaiting_payment: "รอชำระเงิน",
    awaiting_artwork: "รอไฟล์งาน",
    awaiting_approval: "รออนุมัติแบบ",
    in_production: "กำลังผลิต",
    shipping: "กำลังจัดส่ง",
    received: "ได้รับแล้ว",
    claim_in_review: "ได้รับแล้ว · เคลมกำลังตรวจ",
    completed: "เสร็จสิ้น",
    cancelled: "ยกเลิก",
  };

  it.each(Object.entries(WORDS))("%s reads %s, with its own tone and icon", (status, words) => {
    const meta = statusMeta(CUSTOMER_ORDER_STATUS, status);
    const key = meta.labelKey.replace("customerOrder.", "") as keyof typeof th.customerOrder;
    expect(th.customerOrder[key]).toBe(words);
    expect(meta.tone).toBeTruthy();
    expect(meta.icon).toBeTruthy();
  });

  it("falls back visibly on a status the web has not met", () => {
    expect(statusMeta(CUSTOMER_ORDER_STATUS, "something_new").labelKey).not.toMatch(/^customerOrder\./);
  });
});

describe("status transitions", () => {
  it("awaiting_payment: dates follow payment and a team-owned artwork step has no upload", () => {
    const unpaid = order("awaiting_payment", {
      deliveryDateBasis: "after_payment",
      artworkOwner: "team",
      artworkStatus: "awaiting_template",
    });
    expect(deliveryDatesOf(unpaid)).toBe("after_payment");
    expect(isPaymentOverdue(unpaid)).toBe(false);
    expect(visibleActions(unpaid, ALL).map((a) => a.key)).not.toContain("order.upload_artwork");
  });

  it("awaiting_artwork: upload only when the customer owns the step", () => {
    const customer = order("awaiting_artwork", { artworkOwner: "customer", artworkStatus: "awaiting_upload" });
    const team = order("awaiting_artwork", { artworkOwner: "team", artworkStatus: "awaiting_template" });
    expect(visibleActions(customer, ALL).map((a) => a.key)).toContain("order.upload_artwork");
    expect(visibleActions(team, ALL).map((a) => a.key)).not.toContain("order.upload_artwork");
    expect(artworkNoteOf(customer)).toBe("customer_upload");
    expect(artworkNoteOf(team)).toBe("team_dieline");
  });

  it("own-file order before payment: the API's awaiting_upload/customer shows the upload and the dieline-as-help note", () => {
    const own = order("awaiting_payment", {
      deliveryDateBasis: "after_payment",
      artworkOwner: "customer",
      artworkStatus: "awaiting_upload",
    });
    expect(visibleActions(own, ALL).map((a) => a.key)).toContain("order.upload_artwork");
    expect(artworkNoteOf(own)).toBe("customer_upload");
  });

  it("hired design: awaiting_template/team explains what happens next and offers no upload", () => {
    const hired = order("awaiting_artwork", { artworkOwner: "team", artworkStatus: "awaiting_template" });
    expect(artworkNoteOf(hired)).toBe("team_dieline");
    expect(visibleActions(hired, ALL)).not.toContainEqual(expect.objectContaining({ key: "order.upload_artwork" }));
  });

  it("an old API that still says awaiting_template for an own-file order is rendered as sent: no invented upload", () => {
    const old = order("awaiting_artwork", { artworkOwner: "team", artworkStatus: "awaiting_template" });
    expect(visibleActions(old, [{ key: "order.upload_artwork" }]).map((a) => a.key)).toEqual([]);
  });

  it("artworkNoteTh is the API's sentence in Thai only; null, absent and other languages show nothing", () => {
    const note = "ไฟล์ได้รับแล้ว ทีมงานจะตรวจหลังชำระเงิน";
    expect(artworkNoteTextOf("th", { artworkNoteTh: note })).toBe(note);
    expect(artworkNoteTextOf("en", { artworkNoteTh: note })).toBeNull();
    expect(artworkNoteTextOf("th", { artworkNoteTh: null })).toBeNull();
    expect(artworkNoteTextOf("th", {})).toBeNull();
  });

  it("awaiting_approval: a proof the customer must answer is the customer's step, without a plain-words note", () => {
    const proof = order("awaiting_approval", { artworkOwner: "customer", artworkStatus: "proof_sent" });
    expect(artworkNoteOf(proof)).toBeNull();
    expect(visibleActions(proof, ALL).map((a) => a.key)).toContain("order.upload_artwork");
  });

  it("in_production and shipping: nothing about artwork or dates is held back", () => {
    for (const status of ["in_production", "shipping"] as const) {
      const row = order(status);
      expect(artworkNoteOf(row)).toBeNull();
      expect(deliveryDatesOf(row)).toBe("planned");
      expect(isHeldByClaim(row)).toBe(false);
    }
  });

  it("received: the auto-confirm date shows and the receipt can be confirmed", () => {
    const row = order("received", { receipt: delivered });
    expect(showAutoComplete(row)).toBe(true);
    expect(visibleActions(row, ALL).map((a) => a.key)).toContain("order.confirm_receipt");
  });

  it("claim_in_review (UATOR-2610-00008): held by the claim, no confirm-receipt, no auto-confirm message", () => {
    const row = order("claim_in_review", {
      openClaims: [claim],
      receipt: receipt({ deliveredAt: "2026-10-12T10:00:00+07:00", completionHeldByClaim: true, autoCompleteAt: null }),
    });
    expect(isHeldByClaim(row)).toBe(true);
    expect(showAutoComplete(row)).toBe(false);
    expect(visibleActions(row, ALL).map((a) => a.key)).not.toContain("order.confirm_receipt");
  });

  it("claim_in_review: a stale auto-confirm date is still not shown while a claim is open", () => {
    const row = order("claim_in_review", { openClaims: [claim], receipt: delivered });
    expect(showAutoComplete(row)).toBe(false);
  });

  it("completed and cancelled: nothing is held, nothing is overdue", () => {
    for (const status of ["completed", "cancelled"] as const) {
      const row = order(status, {
        receipt: receipt({ deliveredAt: "2026-10-12T10:00:00+07:00", completedAt: "2026-10-14T10:00:00+07:00" }),
      });
      expect(isHeldByClaim(row)).toBe(false);
      expect(showAutoComplete(row)).toBe(false);
      expect(isPaymentOverdue(row)).toBe(false);
    }
  });
});

describe("payment", () => {
  it("overdue is the API's flag — the order stays awaiting_payment, never cancelled", () => {
    const row = order("awaiting_payment", { payment: payment({ overdue: true, dueAt: "2026-10-22T11:47:00+07:00" }) });
    expect(isPaymentOverdue(row)).toBe(true);
    expect(row.customerStatus).toBe("awaiting_payment");
  });

  it("separates this order's share from the group total only when the group has more than one order", () => {
    const solo = paymentShareOf(order("awaiting_payment"));
    expect(solo.shared).toBe(false);
    const grouped = paymentShareOf(
      order("awaiting_payment", {
        payment: payment({ groupOrderCount: 2, orderGrossAmount: "4302.86", groupGrossAmount: "9284.96" }),
      }),
    );
    expect(grouped).toMatchObject({ shared: true, orderGross: "4302.86", groupGross: "9284.96", groupOrderCount: 2 });
  });
});
