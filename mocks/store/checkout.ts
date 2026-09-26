/**
 * Checkout and payments, mocked (CONTRACT-REQUEST store.checkout, store.payments,
 * store.instalments).
 *
 * Placing an order creates **the back office's own order rows** (`../admin/commerce`): one order
 * per cart line, in one group, waiting for payment — so the CS queues, slip review and the
 * customer's account all see the same orders. The payment schedule belongs to the group; each
 * order carries its share of each instalment, and paying a group instalment pays that share on
 * every order in it.
 *
 * Amounts are computed here in whole satang, standing in for the backend (the only place money is
 * computed), with obviously fake rules: coupon codes from the quote mock, free delivery above
 * THB 30,000, THB 150 per extra destination, the D-020 threshold of THB 20,000, the D-131 point
 * value of THB 2.50 and the D-133 limits. None of it is the real pricing.
 */

import { http, HttpResponse } from "msw";
import type { z } from "zod";

import type { checkoutInput, checkoutPreview, storeInstalment, storePayment } from "@/lib/api/requests/store-checkout";

import { baht, customers as fakeCustomers, orders, refreshOrder, satang, type MockOrder } from "../admin/commerce";
import { mockRequest } from "../route";
import { bangkokIso, mockId, paginate, problem } from "../support";
import { bookOf } from "./book";
import { cartLines, cartOf, clearCart } from "./cart";
import { customerOf, type MockCustomer } from "./customers";
import { checkCode, PROMOTIONS, quotesOf, type StoreQuote } from "./quotes";

type Input = z.output<typeof checkoutInput>;
type Preview = z.output<typeof checkoutPreview>;
type Payment = z.output<typeof storePayment>;
type Instalment = z.output<typeof storeInstalment>;

const DAY = 24 * 60;
const THRESHOLD = 2_000_000; // D-020, THB 20,000 — a setting in the real API.
const FREE_DELIVERY_FROM = 3_000_000;
const EXTRA_DESTINATION_NET = 15_000;
const POINT_VALUE = 250; // D-131, THB 2.50 per point.
const MIN_REDEEM = 4; // D-133: THB 10 → 4 points.
const vatIn = (gross: number) => Math.round((gross * 7) / 107);

/* ---------------------------------------------------------------------------------- pricing */

interface Priced {
  preview: Preview;
  fingerprint: string;
  gross: number;
  schedule: {
    key: string;
    kind: string;
    parts: { label: string; share: number; dueTrigger: string; requiredBefore: string }[];
  };
}

function pointsBalanceOf(customer: MockCustomer): number {
  return customer.points;
}

function scheduleOptions(gross: number) {
  const full = {
    key: "full",
    kind: "full" as const,
    label: "ชำระเต็มจำนวน",
    description: "ชำระครั้งเดียวก่อนเริ่มผลิต",
    parts: [{ label: "ชำระเต็มจำนวน", share: 1, dueTrigger: "at_checkout", requiredBefore: "production" }],
  };
  if (gross < THRESHOLD) return [full];
  const deposit = {
    key: "deposit_50",
    kind: "deposit" as const,
    label: "มัดจำ 50% ส่วนที่เหลือก่อนจัดส่ง",
    description: "ชำระครึ่งหนึ่งเพื่อเริ่มผลิต อีกครึ่งก่อนจัดส่ง",
    parts: [
      { label: "มัดจำ 50%", share: 0.5, dueTrigger: "at_checkout", requiredBefore: "production" },
      { label: "ส่วนที่เหลือก่อนจัดส่ง", share: 0.5, dueTrigger: "before_shipping", requiredBefore: "shipping" },
    ],
  };
  const options = [deposit, full];
  if (gross >= 10_000_000)
    options.push({
      key: "three_40_30_30",
      kind: "template" as never,
      label: "3 งวด 40/30/30",
      description: "40% เริ่มผลิต 30% ก่อนจัดส่ง 30% หลังได้รับสินค้า 7 วัน",
      parts: [
        { label: "งวดที่ 1 (40%)", share: 0.4, dueTrigger: "at_checkout", requiredBefore: "production" },
        { label: "งวดที่ 2 (30%)", share: 0.3, dueTrigger: "before_shipping", requiredBefore: "shipping" },
        { label: "งวดที่ 3 (30%)", share: 0.3, dueTrigger: "days_after_delivery", requiredBefore: "none" },
      ],
    });
  return options;
}

/** Splits `total` satang by shares, the last part taking the rounding. */
function split(total: number, shares: number[]): number[] {
  const parts = shares.map((share) => Math.round(total * share));
  parts[parts.length - 1] = total - parts.slice(0, -1).reduce((sum, part) => sum + part, 0);
  return parts;
}

export function price(customer: MockCustomer, input: Input): Priced | Response {
  const cart = cartOf(customer);
  const book = bookOf(customer);
  const blockers: Preview["blockers"] = [];
  if (cart.items.length === 0) blockers.push({ code: "cart_empty", message: "ตะกร้าว่าง" });
  for (const blocker of cart.blockers)
    if (!(input.delivery.mode === "shared" && ["destination_missing", "split_mismatch"].includes(blocker.code)))
      blockers.push({ code: blocker.code, message: blocker.message });
  const shared =
    input.delivery.mode === "shared"
      ? book.addresses.find((a) => a.id === (input.delivery as { addressId: string }).addressId)
      : null;
  if (input.delivery.mode === "shared" && !shared)
    return problem(422, "validation.failed", "ไม่พบที่อยู่นี้", [
      { path: "delivery.addressId", code: "exists", message: "unknown address" },
    ]);
  const profile = input.taxProfileId ? book.taxProfiles.find((p) => p.id === input.taxProfileId) : null;
  if (input.taxProfileId && !profile)
    return problem(422, "validation.failed", "ไม่พบข้อมูลใบกำกับภาษีนี้", [
      { path: "taxProfileId", code: "exists", message: "unknown profile" },
    ]);

  const items = cart.items.map((item) => ({
    cartItemId: item.id,
    name: item.product.name,
    quantity: item.quantity,
    unit: item.unit,
    grossAmount: item.grossAmount,
    destinations: shared
      ? [{ label: `${shared.label} · ${shared.province}`, quantity: item.quantity }]
      : item.destinations.map((destination) => ({
          label: destination.address
            ? `${destination.address.recipientName} · ${destination.address.province}`
            : "ยังไม่เลือกที่อยู่",
          quantity: destination.quantity,
        })),
  }));
  const itemsGross = cart.items.reduce((sum, item) => sum + satang(item.grossAmount), 0);
  const extraDestinations = shared
    ? 0
    : cart.items.reduce((sum, item) => sum + Math.max(0, item.destinations.length - 1), 0);
  const shippingGross = Math.round(extraDestinations * EXTRA_DESTINATION_NET * 1.07);

  const applied: Preview["promotions"]["applied"] = [];
  const rejected: Preview["promotions"]["rejected"] = [];
  const types = new Set(cart.items.map((item) => item.productType.code));
  let discount = 0;
  for (const raw of [...new Set(input.couponCodes.map((code) => code.trim().toUpperCase()))]) {
    const results = [...types].map((type) => checkCode(raw, type));
    const hit = results.find((result) => result.promotion);
    if (!hit?.promotion) {
      const reason =
        results[0]?.reason === "expired"
          ? "expired"
          : results.some((r) => r.reason === "not_applicable")
            ? "not_applicable"
            : "not_found";
      rejected.push({
        code: raw,
        reason,
        message:
          reason === "expired"
            ? "โค้ดนี้หมดอายุแล้ว"
            : reason === "not_applicable"
              ? "โค้ดนี้ใช้กับสินค้าในตะกร้าไม่ได้"
              : "ไม่พบโค้ดนี้",
      });
      continue;
    }
    if (applied.some((promotion) => promotion.kind === "coupon")) {
      rejected.push({ code: raw, reason: "not_combinable", message: "ใช้ร่วมกับโค้ดอื่นไม่ได้" });
      continue;
    }
    const promotion = PROMOTIONS[raw]!;
    const base = promotion.types
      ? cart.items
          .filter((item) => promotion.types!.includes(item.productType.code))
          .reduce((sum, item) => sum + satang(item.grossAmount), 0)
      : itemsGross;
    const full = Math.round((base * promotion.pct) / 100);
    const amount = promotion.cap ? Math.min(full, promotion.cap) : full;
    discount += amount;
    applied.push({
      kind: "coupon",
      code: raw,
      title: promotion.title,
      discountAmount: baht(amount),
      capped: amount < full,
      cappedNote: amount < full ? `ส่วนลดสูงสุด ${baht(promotion.cap!)} บาท ตามเงื่อนไขโปรโมชัน` : null,
    });
  }
  if (itemsGross >= FREE_DELIVERY_FROM && shippingGross > 0) {
    applied.push({
      kind: "automatic",
      code: null,
      title: "ส่งฟรีเมื่อสั่งครบ ฿30,000",
      discountAmount: baht(shippingGross),
      capped: false,
      cappedNote: null,
    });
    discount += shippingGross;
  }

  const balance = pointsBalanceOf(customer);
  const afterDiscount = itemsGross + shippingGross - discount;
  const maxPoints = Math.max(0, Math.min(balance, Math.floor((afterDiscount * 0.2) / POINT_VALUE)));
  let redeemed = Math.min(input.pointsToRedeem, maxPoints);
  if (redeemed > 0 && redeemed < MIN_REDEEM) {
    blockers.push({ code: "points_below_minimum", message: `แลกคะแนนขั้นต่ำ ${MIN_REDEEM} คะแนน` });
    redeemed = 0;
  }
  if (input.pointsToRedeem > maxPoints)
    blockers.push({ code: "points_above_maximum", message: `แลกได้สูงสุด ${maxPoints} คะแนนสำหรับคำสั่งซื้อนี้` });
  const pointsAmount = redeemed * POINT_VALUE;

  const gross = Math.max(0, afterDiscount - pointsAmount);
  const withholding = profile?.withholdsTax ? Math.round((gross - vatIn(gross)) * 0.01) : 0;
  const options = scheduleOptions(gross);
  const selected = options.find((option) => option.key === input.scheduleKey) ?? options[0]!;
  const parts = split(
    gross,
    selected.parts.map((part) => part.share),
  );

  const methods: Preview["paymentMethods"] = [
    { method: "scb_qr", available: true, unavailableReason: null, feeAmount: null },
    {
      method: "card_2c2p",
      available: parts[0]! <= 50_000_000,
      unavailableReason: parts[0]! > 50_000_000 ? "เกินวงเงินบัตรต่อครั้ง" : null,
      feeAmount: null,
    },
    { method: "online_banking_2c2p", available: true, unavailableReason: null, feeAmount: null },
    { method: "bank_transfer_slip", available: true, unavailableReason: null, feeAmount: null },
    {
      method: "credit_term_transfer",
      available: false,
      unavailableReason: "สำหรับบัญชีธุรกิจที่ได้รับวงเงินเครดิต",
      feeAmount: null,
    },
  ];
  if (input.paymentMethod && !methods.find((method) => method.method === input.paymentMethod)?.available)
    blockers.push({ code: "method_unavailable", message: "วิธีชำระเงินนี้ใช้กับคำสั่งซื้อนี้ไม่ได้" });

  const fingerprint = JSON.stringify({
    lines: cartLines(customer).map((line) => line.id),
    items: cart.items.map((item) => [item.id, item.grossAmount, item.quantity]),
    input: { ...input, paymentMethod: undefined, note: undefined, poNumber: undefined },
  });
  const preview: Preview = {
    previewToken: "",
    expiresAt: bangkokIso(15),
    items,
    promotions: { applied, rejected },
    points: {
      balance,
      min: MIN_REDEEM,
      max: maxPoints,
      pointValue: baht(POINT_VALUE),
      redeemed,
      redeemedAmount: baht(pointsAmount),
      toEarn: Math.floor((gross - vatIn(gross)) / 50_000),
    },
    schedule: {
      options: options.map((option) => ({
        key: option.key,
        kind: option.kind,
        label: option.label,
        description: option.description,
        instalments: option.parts.map((part, index) => ({
          seq: index + 1,
          label: part.label,
          dueTrigger: part.dueTrigger as never,
          requiredBefore: part.requiredBefore as never,
          grossAmount: baht(
            split(
              gross,
              option.parts.map((entry) => entry.share),
            )[index]!,
          ),
        })),
        creditDays: null,
      })),
      selectedKey: selected.key,
      note:
        gross >= THRESHOLD ? "ยอดตั้งแต่ ฿20,000 เลือกแบ่งชำระได้" : "ยอดต่ำกว่า ฿20,000 ชำระเต็มจำนวนก่อนเริ่มผลิต",
    },
    paymentMethods: methods,
    taxInvoice: profile
      ? {
          name: profile.name,
          taxId: profile.taxId,
          branch: profile.branchType === "head_office" ? "สำนักงานใหญ่" : `สาขา ${profile.branchCode}`,
          withholdsTax: profile.withholdsTax,
        }
      : null,
    totals: {
      itemsAmount: baht(itemsGross),
      discountAmount: baht(discount),
      shippingAmount: baht(shippingGross),
      pointsAmount: baht(pointsAmount),
      vatAmount: baht(vatIn(gross)),
      grossAmount: baht(gross),
      withholdingAmount: baht(withholding),
      payableNowAmount: baht(parts[0]! - (selected.parts.length === 1 ? withholding : 0)),
      currency: "THB",
    },
    blockers,
  };
  return { preview, fingerprint, gross, schedule: selected };
}

/* ------------------------------------------------------------------------------ placed groups */

interface Group {
  id: string;
  code: string;
  persona: string;
  orderIds: string[];
  instalments: {
    id: string;
    seq: number;
    label: string;
    dueTrigger: string;
    requiredBefore: string;
    gross: number;
    paid: boolean;
    dueAt: string | null;
  }[];
}

const previews = new Map<string, { fingerprint: string; gross: number; persona: string; expiresAt: number }>();
export const groups = new Map<string, Group>();
const payments = new Map<string, Payment & { groupId: string; persona: string; orderPaymentId: string | null }>();
let groupSeq = 0;
let paymentSeq = 0;

function placeOrders(customer: MockCustomer, input: Input, priced: Priced): Group {
  groupSeq += 1;
  const cart = cartOf(customer);
  const quotes = quotesOf(customer.persona);
  const book = bookOf(customer);
  const owner = customer.ownerIndex === null ? null : fakeCustomers[customer.ownerIndex]!;
  const groupId = mockId("wgr", groupSeq);
  const groupCode = `PG-2569-W${String(groupSeq).padStart(4, "0")}`;
  const now = bangkokIso();
  const shares = split(
    priced.gross,
    cart.items.map((item) => satang(item.grossAmount)).map((g, _, all) => g / all.reduce((a, b) => a + b, 0)),
  );
  const instalmentTemplate = priced.schedule.parts;
  const group: Group = {
    id: groupId,
    code: groupCode,
    persona: customer.persona,
    orderIds: [],
    instalments: instalmentTemplate.map((part, index) => ({
      id: mockId("wis", groupSeq * 10 + index),
      seq: index + 1,
      label: part.label,
      dueTrigger: part.dueTrigger,
      requiredBefore: part.requiredBefore,
      gross: split(
        priced.gross,
        instalmentTemplate.map((entry) => entry.share),
      )[index]!,
      paid: false,
      dueAt: index === 0 ? bangkokIso(3 * DAY) : null,
    })),
  };
  const profile = input.taxProfileId ? book.taxProfiles.find((p) => p.id === input.taxProfileId) : null;
  const shared =
    input.delivery.mode === "shared"
      ? book.addresses.find((a) => a.id === (input.delivery as { addressId: string }).addressId)
      : null;

  cart.items.forEach((item, index) => {
    const quote = quotes.find((candidate) => candidate.id === item.quote.id) as StoreQuote;
    const gross = shares[index]!;
    const net = gross - vatIn(gross);
    const orderId = mockId("word", groupSeq * 10 + index);
    const orderCode = `PK-2569-W${String(groupSeq * 10 + index).padStart(5, "0")}`;
    const instalments: MockOrder["instalments"] = group.instalments.map((entry, at) => ({
      id: mockId("woi", groupSeq * 100 + index * 10 + at),
      seq: entry.seq,
      label: entry.label,
      dueTrigger: entry.dueTrigger as never,
      requiredBefore: entry.requiredBefore as never,
      dueAt: entry.dueAt,
      grossAmount: baht(
        split(
          gross,
          instalmentTemplate.map((part) => part.share),
        )[at]!,
      ),
      paidAmount: "0.00",
      status: at === 0 ? "due" : "pending",
    }));
    const destinations = shared
      ? [{ ...shared, id: mockId("wds", groupSeq * 10 + index), quantity: item.quantity }]
      : item.destinations.map((destination, at) => ({
          id: mockId("wds", groupSeq * 100 + index * 10 + at),
          recipientName: destination.address?.recipientName ?? "",
          phone: destination.address?.phone ?? "",
          line1: destination.address?.line1 ?? "",
          line2: destination.address?.line2 ?? null,
          subdistrict: destination.address?.subdistrict ?? null,
          district: destination.address?.district ?? null,
          province: destination.address?.province ?? "",
          postcode: destination.address?.postcode ?? "",
          quantity: destination.quantity,
        }));
    const order: MockOrder = {
      id: orderId,
      orderCode,
      groupId,
      groupCode,
      channel: "web",
      customer: owner
        ? {
            id: owner.id,
            customerCode: owner.customerCode,
            displayName: owner.displayName,
            companyName: owner.companyName,
          }
        : { id: customer.id, customerCode: "C-NEW", displayName: customer.displayName, companyName: null },
      productType: item.productType,
      factory: null,
      quantity: item.quantity,
      unit: item.unit,
      grossAmount: baht(gross),
      currency: "THB",
      status: "waiting_payment",
      artworkStatus: item.designOption === "hired_design" ? "awaiting_template" : "awaiting_upload",
      nextInstalment: null,
      hasSlipToReview: false,
      promisedShipDate: quote?.earliestShipDate ?? null,
      slaDueAt: bangkokIso(3 * DAY),
      urgency: "normal",
      createdAt: now,
      group: {
        id: groupId,
        groupCode,
        status: "waiting_payment",
        grossAmount: baht(priced.gross),
        orderCount: cart.items.length,
      },
      netAmount: baht(net),
      discountAmount: "0.00",
      shippingAmount: quote?.shippingAmount ?? "0.00",
      vatAmount: baht(vatIn(gross)),
      specs: item.specs,
      parts: [],
      lines: (quote?.lines ?? []).map((line, at) => ({
        lineNo: at + 1,
        lineType: line.lineType,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitPrice: line.unitPrice,
        netAmount: line.netAmount,
        vatAmount: line.vatAmount,
        grossAmount: line.grossAmount,
        waivedReason: line.waivedReason,
      })),
      tolerance: quote?.tolerance ?? { shortagePct: "5.0000", overagePct: "5.0000" },
      designOption: item.designOption,
      mockupOption: item.mockupOption,
      leadTimeDays: quote?.leadTimeDays ?? 10,
      confirmedProductionDate: null,
      startMode: null,
      destinations,
      taxProfile: profile
        ? {
            name: profile.name,
            taxId: profile.taxId,
            branch: profile.branchType === "head_office" ? "สำนักงานใหญ่" : `สาขา ${profile.branchCode}`,
            address: profile.address,
            withholdsTax: profile.withholdsTax,
          }
        : null,
      poNumber: input.poNumber ?? null,
      instalments,
      payments: [],
      artwork: {
        status: item.designOption === "hired_design" ? "awaiting_template" : "awaiting_upload",
        submissions: [],
        proofs: [],
      },
      jobs: [],
      shipments: [],
      documents: [],
      claims: [],
      ccEmails: [input.contact.email],
      csRemarks: input.note ?? null,
      expiresAt: bangkokIso(7 * DAY),
      cancelledAt: null,
      cancelReason: null,
      nextActions: [],
    };
    orders.unshift(refreshOrder(order));
    group.orderIds.push(orderId);
    if (quote) quote.status = "converted";
  });
  if (owner) owner.ordersCount += cart.items.length;
  groups.set(groupId, group);
  clearCart(customer);
  return group;
}

/** Marks a group instalment paid on every order of the group, and moves the orders on. */
export function settleInstalment(group: Group, instalmentId: string): void {
  const instalment = group.instalments.find((entry) => entry.id === instalmentId);
  if (!instalment || instalment.paid) return;
  instalment.paid = true;
  for (const orderId of group.orderIds) {
    const order = orders.find((candidate) => candidate.id === orderId);
    if (!order) continue;
    const share = order.instalments.find((entry) => entry.seq === instalment.seq);
    if (share) {
      share.status = "paid";
      share.paidAmount = share.grossAmount;
    }
    const next = order.instalments.find((entry) => entry.status !== "paid");
    if (next && next.status === "pending" && next.dueTrigger === "at_checkout") next.status = "due";
    if (order.status === "waiting_payment" && instalment.requiredBefore === "production") {
      order.status = "paid_for_production";
      order.group.status = "in_progress";
      order.expiresAt = null;
    }
    order.hasSlipToReview = false;
    refreshOrder(order);
  }
}

function groupOfInstalment(instalmentId: string): Group | undefined {
  for (const group of groups.values()) if (group.instalments.some((entry) => entry.id === instalmentId)) return group;
  return undefined;
}

/** A payment's view, synced from the order payment Finance may have decided in the back office. */
function view(payment: Payment & { groupId: string; persona: string; orderPaymentId: string | null }): Payment {
  if (payment.orderPaymentId && payment.status === "awaiting_verification") {
    const group = groups.get(payment.groupId);
    const first = group ? orders.find((order) => order.id === group.orderIds[0]) : undefined;
    const decided = first?.payments.find((entry) => entry.id === payment.orderPaymentId);
    if (decided?.status === "succeeded") {
      payment.status = "succeeded";
      payment.paidAt = decided.paidAt;
      for (const slip of payment.slips) slip.status = "manual_approved";
      if (group) settleInstalment(group, payment.instalmentId);
    } else if (decided?.status === "failed") {
      payment.status = "failed";
      for (const slip of payment.slips) slip.status = "manual_rejected";
      payment.failureReason = decided.slips.at(-1)?.reviewNote ?? "สลิปไม่ผ่านการตรวจสอบ";
    }
  }
  if (payment.status === "pending" && payment.expiresAt && Date.parse(payment.expiresAt) < Date.now())
    payment.status = "expired";
  return {
    id: payment.id,
    instalmentId: payment.instalmentId,
    orderGroupCode: payment.orderGroupCode,
    method: payment.method,
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
    expiresAt: payment.expiresAt,
    qr: payment.qr,
    redirectUrl: payment.redirectUrl,
    bankAccount: payment.bankAccount,
    slips: payment.slips,
    paidAt: payment.paidAt,
    failureReason: payment.failureReason,
  };
}

function succeed(payment: Payment & { groupId: string }) {
  payment.status = "succeeded";
  payment.paidAt = bangkokIso();
  const group = groups.get(payment.groupId);
  if (group) settleInstalment(group, payment.instalmentId);
}

const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");

/** An obviously fake "QR": a pattern that is not a real code, labelled mock. */
function fakeQr(seed: string): string {
  const cells = [...seed.replace(/-/g, "")].slice(0, 25).map((char, index) => (parseInt(char, 16) + index) % 2 === 0);
  const rects = cells
    .map((on, index) =>
      on ? `<rect x="${(index % 5) * 36 + 20}" y="${Math.floor(index / 5) * 36 + 20}" width="34" height="34"/>` : "",
    )
    .join("");
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 240"><rect width="220" height="240" fill="#fff"/><g fill="#111">${rects}</g><text x="110" y="232" font-size="14" text-anchor="middle" font-family="sans-serif">mock QR</text></svg>`)}`;
}

export const storeCheckoutHandlers = [
  mockRequest("POST /v1/store/checkout/actions/preview", ({ body, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const priced = price(customer, body);
    if (priced instanceof Response) return priced;
    const token = `pvw${Math.random().toString(36).slice(2, 12)}`;
    previews.set(token, {
      fingerprint: priced.fingerprint,
      gross: priced.gross,
      persona: customer.persona,
      expiresAt: Date.now() + 15 * 60_000,
    });
    return { ...priced.preview, previewToken: token };
  }),

  mockRequest("POST /v1/store/checkout", ({ body, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const { previewToken, ...input } = body;
    const known = previews.get(previewToken);
    if (!known || known.persona !== customer.persona || known.expiresAt < Date.now())
      return problem(409, "checkout.preview_expired", "ราคาที่แสดงหมดเวลาแล้ว กรุณาตรวจสอบราคาอีกครั้ง");
    const priced = price(customer, input);
    if (priced instanceof Response) return priced;
    if (priced.preview.blockers.length > 0)
      return problem(422, "checkout.blocked", priced.preview.blockers.map((blocker) => blocker.message).join(" · "));
    if (priced.fingerprint !== known.fingerprint || priced.gross !== known.gross)
      return problem(
        409,
        "checkout.repriced",
        "ราคาหรือรายการในตะกร้าเปลี่ยนไปตั้งแต่ที่คุณตรวจสอบ กรุณายืนยันราคาใหม่",
      );
    previews.delete(previewToken);
    const group = placeOrders(customer, input, priced);
    customer.points -= priced.preview.points.redeemed;
    const first = group.instalments[0]!;
    return {
      groupId: group.id,
      groupCode: group.code,
      orders: group.orderIds.map((id) => ({ id, orderCode: orders.find((order) => order.id === id)!.orderCode })),
      grossAmount: baht(priced.gross),
      firstInstalment: { id: first.id, label: first.label, grossAmount: baht(first.gross), dueAt: first.dueAt },
      expiresAt: bangkokIso(7 * DAY),
    };
  }),

  mockRequest("POST /v1/store/instalments/{instalmentId}/payments", ({ params, body, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const group = groupOfInstalment(params.instalmentId);
    if (!group || group.persona !== customer.persona) return problem(404, "http.not_found", "ไม่พบงวดชำระนี้");
    const instalment = group.instalments.find((entry) => entry.id === params.instalmentId)!;
    if (instalment.paid) return problem(409, "instalment.already_paid", "งวดนี้ชำระแล้ว");
    if (
      !["scb_qr", "scb_qr_cross_bank", "card_2c2p", "online_banking_2c2p", "bank_transfer_slip"].includes(body.method)
    )
      return problem(422, "payment.method_unavailable", "วิธีชำระเงินนี้ใช้ไม่ได้");
    paymentSeq += 1;
    const id = mockId("wpy", paymentSeq);
    const returnUrl = body.returnUrl ?? "/checkout/return";
    const payment: Payment & { groupId: string; persona: string; orderPaymentId: string | null } = {
      id,
      instalmentId: instalment.id,
      orderGroupCode: group.code,
      method: body.method,
      status: body.method === "bank_transfer_slip" ? "initiated" : "pending",
      amount: baht(instalment.gross),
      currency: "THB",
      expiresAt: body.method.startsWith("scb_qr")
        ? bangkokIso(15)
        : body.method.includes("2c2p")
          ? bangkokIso(30)
          : null,
      qr: body.method.startsWith("scb_qr")
        ? { payload: `00020101021230mock${id.slice(-8)}`, imageUrl: fakeQr(id) }
        : null,
      // A mock-only "gateway" page approves it and sends the customer back, as 2C2P would.
      redirectUrl: body.method.includes("2c2p")
        ? `/bff/v1/store/mock-gateway/payments/${id}/checkout?return=${encodeURIComponent(
            `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}payment=${id}`,
          )}`
        : null,
      bankAccount:
        body.method === "bank_transfer_slip"
          ? {
              bank: "ธนาคารตัวอย่าง (ข้อมูลจำลอง)",
              accountName: "บจก. คอลเลคทีฟ กรุ๊ป (ประเทศไทย) (ข้อมูลจำลอง)",
              accountNo: "000-0-00000-0",
            }
          : null,
      slips: [],
      paidAt: null,
      failureReason: null,
      groupId: group.id,
      persona: customer.persona,
      orderPaymentId: null,
    };
    payments.set(id, payment);
    return view(payment);
  }),

  mockRequest("GET /v1/store/payments/{paymentId}", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const payment = payments.get(params.paymentId);
    if (!payment || payment.persona !== customer.persona)
      return problem(404, "http.not_found", "ไม่พบรายการชำระเงินนี้");
    return view(payment);
  }),

  mockRequest("POST /v1/store/payments/{paymentId}/slips", ({ params, body, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const payment = payments.get(params.paymentId);
    if (!payment || payment.persona !== customer.persona)
      return problem(404, "http.not_found", "ไม่พบรายการชำระเงินนี้");
    if (payment.method !== "bank_transfer_slip")
      return problem(409, "payment.not_slip", "รายการนี้ไม่ได้ชำระด้วยการโอน");
    const matches = body.declaredAmount === payment.amount;
    const slip = {
      id: mockId("wsl", paymentSeq * 10 + payment.slips.length),
      status: (matches ? "passed" : "manual_review") as Payment["slips"][number]["status"],
      message: matches ? null : "ยอดโอนไม่ตรงกับยอดที่ต้องชำระ ทีมการเงินจะตรวจสอบให้",
      reviewDueAt: matches ? null : bangkokIso(4 * 60),
      uploadedAt: bangkokIso(),
    };
    payment.slips.push(slip);
    if (matches) {
      succeed(payment);
    } else {
      payment.status = "awaiting_verification";
      // Finance reviews it in the back office's slip queue (D-061).
      const group = groups.get(payment.groupId);
      const first = group ? orders.find((order) => order.id === group.orderIds[0]) : undefined;
      if (first) {
        const orderPaymentId = mockId("wop", paymentSeq);
        first.payments.push({
          id: orderPaymentId,
          method: "bank_transfer_slip",
          status: "awaiting_verification",
          amount: payment.amount,
          feeAmount: "0.00",
          providerRef: null,
          paidAt: null,
          slips: [
            {
              id: slip.id,
              file: {
                id: body.fileId,
                originalName: "slip.jpg",
                mimeType: "image/jpeg",
                sizeBytes: 0,
                thumbnailUrl: null,
                url: null,
              },
              declaredAmount: body.declaredAmount,
              declaredTransferredAt: body.declaredTransferredAt,
              verificationStatus: "manual_review",
              checks: { receiverMatched: true, amountMatched: false, dateMatched: true, duplicate: false },
              slaDueAt: slip.reviewDueAt,
              reviewedBy: null,
              reviewNote: null,
              uploadedAt: slip.uploadedAt,
            },
          ],
        });
        first.hasSlipToReview = true;
        refreshOrder(first);
        payment.orderPaymentId = orderPaymentId;
      }
    }
    return view(payment);
  }),

  mockRequest("GET /v1/store/instalments", ({ query, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const rows: Instalment[] = [...groups.values()]
      .filter((group) => group.persona === customer.persona)
      .flatMap((group) => {
        const first = orders.find((order) => order.id === group.orderIds[0]);
        return group.instalments.map((entry) => {
          const active = [...payments.values()].find(
            (payment) =>
              payment.instalmentId === entry.id &&
              ["pending", "awaiting_verification", "initiated"].includes(payment.status),
          );
          const cancelled = first?.status === "cancelled";
          const status: Instalment["status"] = entry.paid
            ? "paid"
            : cancelled
              ? "cancelled"
              : entry.dueTrigger === "at_checkout" ||
                  (entry.dueTrigger === "before_shipping" && first?.status === "in_production")
                ? "due"
                : "pending";
          return {
            id: entry.id,
            order: { id: first?.id ?? group.orderIds[0]!, orderCode: first?.orderCode ?? "" },
            groupCode: group.code,
            seq: entry.seq,
            label: entry.label,
            dueTrigger: entry.dueTrigger as never,
            requiredBefore: entry.requiredBefore as never,
            dueAt: entry.dueAt,
            grossAmount: baht(entry.gross),
            paidAmount: entry.paid ? baht(entry.gross) : "0.00",
            currency: "THB" as const,
            status,
            receipt: entry.paid
              ? {
                  id: mockId("wrc", entry.seq),
                  originalName: `receipt-${group.code}-${entry.seq}.pdf`,
                  mimeType: "application/pdf",
                  sizeBytes: 48_000,
                  thumbnailUrl: null,
                  url: `data:text/plain;charset=utf-8,${encodeURIComponent(`ใบเสร็จรับเงิน/ใบกำกับภาษี ${group.code} งวดที่ ${entry.seq} (ข้อมูลจำลอง)`)}`,
                }
              : null,
            activePaymentId: active?.id ?? null,
            payable: !entry.paid && !cancelled && status === "due",
          };
        });
      })
      .filter((row) => !query.status || row.status === query.status);
    return paginate(rows, query);
  }),

  // Mock only: the 2C2P page. It approves the payment and sends the customer back to the store's
  // return page — a meta refresh, not a redirect, because the BFF would follow a redirect itself.
  http.get("*/v1/store/mock-gateway/payments/:paymentId/checkout", ({ params, request }) => {
    const payment = payments.get(String(params.paymentId));
    if (!payment) return problem(404, "http.not_found", "no such payment");
    if (payment.status === "pending") succeed(payment);
    const back = new URL(request.url).searchParams.get("return") ?? "/";
    const safe = back.startsWith("http://") || back.startsWith("https://") || back.startsWith("/") ? back : "/";
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${safe.replace(/"/g, "&quot;")}"><title>Mock gateway</title></head><body><p>Mock 2C2P — approved.</p><p><a href="${safe.replace(/"/g, "&quot;")}">กลับไปที่ร้านค้า</a></p></body></html>`;
    return new HttpResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  }),

  // Mock only: what the gateway's webhook does when a QR is paid. Tests call it through the BFF.
  http.post("*/v1/store/mock-gateway/payments/:paymentId/settle", ({ params }) => {
    const payment = payments.get(String(params.paymentId));
    if (!payment) return problem(404, "http.not_found", "no such payment");
    succeed(payment);
    return HttpResponse.json({ ok: true });
  }),
];
