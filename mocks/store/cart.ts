/**
 * The customer's cart, mocked (CONTRACT-REQUEST store.cart).
 *
 * A line is a saved quotation (`./quotes.ts`); its price is the quotation's. A quotation past
 * its validity (D-051) is "re-priced" here by a flat 4 % — obviously fake — and the line says so
 * until the customer confirms. Destinations are the returning customer's saved addresses (the
 * first fake customer's, as their orders are); the newcomer has none, so their cart says an
 * address is missing.
 */

import type { z } from "zod";

import type { cartItem, storeCart } from "@/lib/api/requests/store-cart";

import { baht, satang } from "../admin/commerce";
import { mockRequest } from "../route";
import { bangkokIso, mockId, problem } from "../support";
import { bookOf } from "./book";
import { customerOf, type MockCustomer } from "./customers";
import { quotesOf, type StoreQuote } from "./quotes";

type Cart = z.output<typeof storeCart>;
type Item = z.output<typeof cartItem>;

interface Line {
  id: string;
  quoteId: string;
  designOption: Item["designOption"];
  destinations: { id: string; addressId: string | null; quantity: number }[];
  /** Set when the quote expired: what it cost before, until the customer confirms. */
  repricedFrom: { unitPrice: string; grossAmount: string } | null;
  confirmedReprice: boolean;
}

const carts = new Map<string, Line[]>();
const linesOf = (customer: MockCustomer) => {
  if (!carts.has(customer.persona)) carts.set(customer.persona, []);
  return carts.get(customer.persona)!;
};

export function addressesOf(customer: MockCustomer) {
  return bookOf(customer).addresses;
}

let lineSeq = 0;

function toItem(customer: MockCustomer, line: Line, quote: StoreQuote): Item {
  const addresses = addressesOf(customer);
  const expired = Date.parse(quote.validUntil) < Date.now();
  if (expired && !line.repricedFrom) line.repricedFrom = { unitPrice: quote.unitPrice, grossAmount: quote.grossAmount };
  const gross = line.repricedFrom ? baht(Math.round(satang(line.repricedFrom.grossAmount) * 1.04)) : quote.grossAmount;
  const unitPrice = line.repricedFrom ? (Number(line.repricedFrom.unitPrice) * 1.04).toFixed(6) : quote.unitPrice;
  return {
    id: line.id,
    quote: { id: quote.id, quoteCode: quote.quoteCode, validUntil: quote.validUntil, source: quote.source },
    product: quote.product,
    productType: quote.productType,
    specs: quote.specs,
    quantity: quote.quantity,
    unit: quote.unit,
    unitPrice,
    grossAmount: gross,
    currency: "THB",
    designOption: line.designOption,
    mockupOption: quote.mockupOption,
    designOptions: quote.source === "rfq" ? ["own_file"] : ["own_file", "online_designer", "hired_design"],
    destinations: line.destinations.map((destination) => {
      const address = addresses.find((candidate) => candidate.id === destination.addressId);
      return {
        id: destination.id,
        addressId: destination.addressId,
        address: address
          ? {
              recipientName: address.recipientName,
              phone: address.phone,
              line1: address.line1,
              line2: address.line2,
              subdistrict: address.subdistrict,
              district: address.district,
              province: address.province,
              postcode: address.postcode,
            }
          : null,
        quantity: destination.quantity,
      };
    }),
    state: line.repricedFrom && !line.confirmedReprice ? "repriced" : "ok",
    repricing:
      line.repricedFrom && !line.confirmedReprice
        ? {
            previousUnitPrice: line.repricedFrom.unitPrice,
            previousGrossAmount: line.repricedFrom.grossAmount,
            reason: "quote_expired",
          }
        : null,
    unavailableReason: null,
  };
}

export function cartOf(customer: MockCustomer): Cart {
  const quotes = quotesOf(customer.persona);
  const lines = linesOf(customer).filter((line) => quotes.some((quote) => quote.id === line.quoteId));
  const items = lines.map((line) =>
    toItem(
      customer,
      line,
      quotes.find((quote) => quote.id === line.quoteId)!,
    ),
  );
  const gross = items.reduce((sum, item) => sum + satang(item.grossAmount), 0);
  const vatPart = Math.round((gross * 7) / 107);
  const blockers: Cart["blockers"] = items.flatMap((item) => {
    const found: Cart["blockers"] = [];
    if (item.state === "repriced")
      found.push({
        itemId: item.id,
        code: "reprice_unconfirmed",
        message: "ราคาเปลี่ยนเพราะใบเสนอราคาหมดอายุ กรุณายืนยันราคาใหม่",
      });
    if (item.destinations.some((destination) => destination.addressId === null))
      found.push({ itemId: item.id, code: "destination_missing", message: "กรุณาเลือกที่อยู่จัดส่ง" });
    if (item.destinations.reduce((sum, destination) => sum + destination.quantity, 0) !== item.quantity)
      found.push({ itemId: item.id, code: "split_mismatch", message: "จำนวนที่แบ่งส่งรวมกันไม่เท่ากับจำนวนที่สั่ง" });
    return found;
  });
  return {
    id: mockId("crt", customer.id.length + (customer.ownerIndex ?? 9)),
    items,
    itemCount: items.length,
    subtotalAmount: baht(gross),
    vatAmount: baht(vatPart),
    currency: "THB",
    readyForCheckout: items.length > 0 && blockers.length === 0,
    blockers,
    updatedAt: bangkokIso(),
  };
}

/** Empties the cart once its lines became an order (the checkout mock, F3 3.3). */
export function clearCart(customer: MockCustomer, lineIds?: string[]): void {
  carts.set(customer.persona, lineIds ? linesOf(customer).filter((line) => !lineIds.includes(line.id)) : []);
}

export function cartLines(customer: MockCustomer): readonly Line[] {
  return linesOf(customer);
}

/** Puts a saved quotation in the cart once (the reorder mock, F3 3.6, adds its quotation here too). */
export function addToCart(customer: MockCustomer, quote: StoreQuote): string {
  const lines = linesOf(customer);
  const existing = lines.find((line) => line.quoteId === quote.id);
  if (existing) return existing.id;
  const address = addressesOf(customer).find((candidate) => candidate.isDefault) ?? null;
  lineSeq += 1;
  const id = mockId("cit", lineSeq);
  lines.push({
    id,
    quoteId: quote.id,
    designOption: quote.designOption,
    destinations: [{ id: mockId("cds", lineSeq * 10), addressId: address?.id ?? null, quantity: quote.quantity }],
    repricedFrom: null,
    confirmedReprice: false,
  });
  if (quote.status === "saved" || quote.status === "shared") quote.status = "saved";
  return id;
}

const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
const notFound = () => problem(404, "http.not_found", "ไม่พบรายการนี้ในตะกร้า");

export const storeCartHandlers = [
  mockRequest("GET /v1/store/cart", ({ request }) => {
    const customer = customerOf(request);
    return customer ? cartOf(customer) : unauthenticated();
  }),

  mockRequest("POST /v1/store/cart/items", ({ body, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const quote = quotesOf(customer.persona).find((candidate) => candidate.id === body.quoteId);
    if (!quote) return problem(404, "http.not_found", "ไม่พบใบเสนอราคานี้");
    addToCart(customer, quote);
    return cartOf(customer);
  }),

  mockRequest("PATCH /v1/store/cart/items/{itemId}", ({ params, body, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const line = linesOf(customer).find((candidate) => candidate.id === params.itemId);
    if (!line) return notFound();
    if (body.designOption) line.designOption = body.designOption;
    return cartOf(customer);
  }),

  mockRequest("DELETE /v1/store/cart/items/{itemId}", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    if (!linesOf(customer).some((line) => line.id === params.itemId)) return notFound();
    clearCart(customer, [params.itemId]);
    return cartOf(customer);
  }),

  mockRequest("PUT /v1/store/cart/items/{itemId}/destinations", ({ params, body, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const line = linesOf(customer).find((candidate) => candidate.id === params.itemId);
    const quote = line && quotesOf(customer.persona).find((candidate) => candidate.id === line.quoteId);
    if (!line || !quote) return notFound();
    const total = body.destinations.reduce((sum, destination) => sum + destination.quantity, 0);
    if (total !== quote.quantity)
      return problem(422, "cart.split_mismatch", "จำนวนที่แบ่งส่งต้องรวมกันเท่ากับจำนวนที่สั่ง", [
        { path: "destinations", code: "sum", message: `รวม ${total} จาก ${quote.quantity}` },
      ]);
    const known = new Set(addressesOf(customer).map((address) => address.id));
    const unknown = body.destinations.findIndex((destination) => !known.has(destination.addressId));
    if (unknown >= 0)
      return problem(422, "validation.failed", "ไม่พบที่อยู่นี้", [
        { path: `destinations[${unknown}].addressId`, code: "exists", message: "unknown address" },
      ]);
    line.destinations = body.destinations.map((destination, index) => ({
      id: mockId("cds", Number.parseInt(line.id.slice(-4), 16) * 10 + index),
      addressId: destination.addressId,
      quantity: destination.quantity,
    }));
    return cartOf(customer);
  }),

  mockRequest("POST /v1/store/cart/items/{itemId}/actions/accept-reprice", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const line = linesOf(customer).find((candidate) => candidate.id === params.itemId);
    if (!line) return notFound();
    line.confirmedReprice = true;
    return cartOf(customer);
  }),
];
