/**
 * The customer's cart, on the published contract (`store.cart.*`, U-F0.2): one editable aggregate
 * with an `ETag`, edits under `If-Match`, and a two-step re-price (reprice → confirm-reprice).
 *
 * A line is a saved quotation (`./quotes.ts`); its price is the quotation's. A quotation past
 * its validity (D-051) is "re-priced" here by a flat 4 % — obviously fake — once the customer
 * asks, and the line says so until they confirm. Destinations are the customer's saved addresses
 * (the fake commerce customer's, as their orders are); the newcomer has none.
 *
 * `cartOf` is the mock's own record of a cart, which the checkout mock reads; the handlers answer
 * with `toCartDto`, the published shape.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { baht, orders, satang } from "../admin/commerce";
import { bangkokIso, mockId, precondition, problem, versionTag, withEtag } from "../support";
import { bookOf, toAddressDto } from "./book";
import { customerOf, type MockCustomer } from "./customers";
import type { Cart, Item } from "./model";
import { checkCode, optionIdOf, quoteSummaryOf, quotesOf, type StoreQuote } from "./quotes";

interface Line {
  id: string;
  quoteId: string;
  designOption: Item["designOption"];
  destinations: { id: string; addressId: string | null; quantity: number }[];
  /** Set when the quote expired: what it cost before, until the customer confirms. */
  repricedFrom: { unitPrice: string; grossAmount: string } | null;
  /** The customer asked for today's price (`store.cart.repriceItem`). */
  repriceRequested: boolean;
  confirmedReprice: boolean;
  mockupOption: Schemas["MockupOption"];
  /** D-276: the studio design version the line was ordered with (`store.studio.order`). */
  design?: { documentId: string; versionNo: number };
  /** The brief for the design service (`designNote`, U4.8). */
  designNote?: string | null;
  /** C5 (D-452): a quantity the customer changed in the cart, priced by the mock's fake tier rule below. */
  override?: { quantity: number; unitPrice: string; grossAmount: string };
  /** C9 (D-457): the own file checked before ordering (`store.fileChecks.addToCart`). */
  checkedFile?: Schemas["CartCheckedFileDto"] | null;
}

/**
 * C5 (D-452) — obviously fake tiers for the mock only: from twice the quotation's quantity a piece costs 12 % less,
 * below the quotation's quantity 10 % more. The real cart takes these from the quotation's own options.
 */
function mockTierUnit(quote: StoreQuote, quantity: number): string {
  const base = Number(quote.unitPrice);
  const factor = quantity >= quote.quantity * 2 ? 0.88 : quantity < quote.quantity ? 1.1 : 1;
  return (base * factor).toFixed(2);
}

function mockTierHint(quote: StoreQuote, quantity: number): Schemas["CartTierHintDto"] | null {
  const next = quote.quantity * 2;
  if (quantity >= next) return null;
  const unitPrice = mockTierUnit(quote, next);
  return {
    quoteOptionId: optionIdOf(quote).replace(/.$/, "7"),
    quantity: next,
    unitPrice,
    productGrossAmount: baht(Math.round(Number(unitPrice) * 100 * next)),
  };
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
  const gross = line.repricedFrom
    ? baht(Math.round(satang(line.repricedFrom.grossAmount) * 1.04))
    : (line.override?.grossAmount ?? quote.grossAmount);
  const unitPrice = line.repricedFrom
    ? (Number(line.repricedFrom.unitPrice) * 1.04).toFixed(6)
    : (line.override?.unitPrice ?? quote.unitPrice);
  return {
    id: line.id,
    quote: { id: quote.id, quoteCode: quote.quoteCode, validUntil: quote.validUntil, source: quote.source },
    product: quote.product,
    productType: quote.productType,
    specs: quote.specs,
    quantity: line.override?.quantity ?? quote.quantity,
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
  // Placed: the codes were used on the order.
  if (!lineIds) codes.delete(customer.persona);
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
    repriceRequested: false,
    confirmedReprice: false,
    mockupOption: quote.mockupOption,
  });
  if (quote.status === "saved" || quote.status === "shared") quote.status = "saved";
  return id;
}

/** C9 (D-457): the checked own file a cart line orders (the file-check mock's add-to-cart). */
export function attachCheckedFile(customer: MockCustomer, lineId: string, file: Schemas["CartCheckedFileDto"]): void {
  const line = linesOf(customer).find((candidate) => candidate.id === lineId);
  if (!line) return;
  line.checkedFile = file;
  line.designOption = "own_file";
}

/** Pins a studio design version on a cart line (D-276). */
export function pinDesign(
  customer: MockCustomer,
  lineId: string,
  documentId: string,
  versionNo: number,
  designOption?: Item["designOption"],
): void {
  const line = linesOf(customer).find((candidate) => candidate.id === lineId);
  if (!line) return;
  line.design = { documentId, versionNo };
  if (designOption) line.designOption = designOption;
}

const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
const notFound = () => problem(404, "http.not_found", "ไม่พบรายการนี้ในตะกร้า");

/* ------------------------------------------------------------------------- the published cart */

const versions = new Map<string, number>();
const cartTag = (customer: MockCustomer) => versionTag(`cart-${customer.persona}`, versions.get(customer.persona) ?? 1);
const bump = (customer: MockCustomer) => versions.set(customer.persona, (versions.get(customer.persona) ?? 1) + 1);

export function toCartDto(customer: MockCustomer): Schemas["CartDto"] {
  const cart = cartOf(customer);
  const lines = linesOf(customer);
  const addresses = addressesOf(customer);
  return {
    id: cart.id,
    customerId: customer.id,
    channel: "web",
    currency: "THB",
    codes: (codes.get(customer.persona) ?? []).map((code) => ({ ...code })),
    productGrossAmount: cart.subtotalAmount,
    vatAmount: cart.vatAmount,
    maxCodes: 3,
    quantityStep: 50,
    updatedAt: cart.updatedAt,
    items: cart.items.map((item) => {
      const line = lines.find((candidate) => candidate.id === item.id)!;
      const quote = quotesOf(customer.persona).find((candidate) => candidate.id === item.quote.id)!;
      const expired = Date.parse(quote.validUntil) < Date.now();
      const pending = expired && line.repriceRequested && !line.confirmedReprice;
      const designFee = quote.lines.find((entry) => entry.lineType === "design_fee")?.netAmount ?? "0.00";
      const shipping = quote.lines.find((entry) => entry.lineType === "shipping")?.netAmount ?? null;
      return {
        id: item.id,
        // The studio design version pinned at add-to-cart (D-276), when the line came from the studio.
        designVersionNo: line.design?.versionNo ?? null,
        quoteId: quote.id,
        quoteOptionId: optionIdOf(quote),
        quoteCode: quote.quoteCode,
        source: quote.source,
        productTypeCode: quote.productType.code,
        summary: quoteSummaryOf(quote),
        quantity: item.quantity,
        unitPrice: pending || line.confirmedReprice ? item.unitPrice : (line.override?.unitPrice ?? quote.unitPrice),
        productGrossAmount: line.confirmedReprice
          ? item.grossAmount
          : (line.override?.grossAmount ?? quote.grossAmount),
        designOption: item.designOption,
        mockupOption: line.mockupOption,
        designFeeAmount: designFee,
        designDocumentId: line.design?.documentId ?? null,
        designNote: line.designNote ?? null,
        quoteShippingAmount: shipping,
        destinations: item.destinations.map((destination) => {
          const saved = addresses.find((candidate) => candidate.id === destination.addressId);
          const dto = saved ? toAddressDto(saved) : null;
          return {
            id: destination.id,
            addressId: destination.addressId,
            quantity: destination.quantity,
            address: {
              recipientName: dto?.recipientName ?? "",
              phone: dto?.phone ?? "",
              line1: dto?.line1 ?? "",
              line2: dto?.line2 ?? null,
              subdistrictId: dto?.subdistrict?.id ?? null,
              subdistrictNameTh: dto?.subdistrict?.nameTh ?? null,
              districtNameTh: saved?.district ?? null,
              provinceId: dto?.province.id ?? mockId("prv", 0),
              provinceNameTh: dto?.province.nameTh ?? "",
              postcode: dto?.postcode ?? "",
            },
          };
        }),
        destinationsComplete:
          item.destinations.every((destination) => destination.addressId !== null) &&
          item.destinations.reduce((sum, destination) => sum + destination.quantity, 0) === item.quantity,
        priceLocked: !expired || line.confirmedReprice,
        priceLockedUntil: line.confirmedReprice ? bangkokIso(15 * 24 * 60) : quote.validUntil,
        pendingReprice: pending
          ? {
              quoteId: quote.id,
              quoteOptionId: optionIdOf(quote),
              previousGrossAmount: quote.grossAmount,
              newGrossAmount: item.grossAmount,
              newUnitPrice: item.unitPrice,
              differenceAmount: baht(satang(item.grossAmount) - satang(quote.grossAmount)),
              validUntil: bangkokIso(15 * 24 * 60),
            }
          : null,
        // A reorder's quotation names the order it repeats (D-153).
        reorderOf: reorderedOf(quote),
        reusesApprovedArtwork: reorderedOf(quote) !== null && quote.designOption === "own_file",
        checkedFile: line.checkedFile ?? null,
        quantityEditable: quantityEditable(line, quote, pending),
        quantityLimits: quote.source === "rfq" ? null : { min: 100, max: null },
        tierHint: quantityEditable(line, quote, pending) && !expired ? mockTierHint(quote, item.quantity) : null,
        earliestShipDate: quote.earliestShipDate >= bangkokIso().slice(0, 10) ? quote.earliestShipDate : null,
        leadTimeDays: quote.leadTimeDays,
      };
    }),
  };
}

function quantityEditable(line: Line, quote: StoreQuote, pending: boolean): boolean {
  return quote.source === "instant" && !line.design && reorderedOf(quote) === null && !pending;
}

/** Codes applied to a customer's cart (`store.cart.applyCode`), which the checkout prices. */
export const codes = new Map<string, Schemas["CartCodeDto"][]>();

/** Answers an edit with the cart after it, under its next `ETag` (the reorder mock's too). */
export function edited(customer: MockCustomer, status = 200) {
  bump(customer);
  return withEtag(toCartDto(customer), cartTag(customer), status);
}

async function bodyOf<T>(request: Request): Promise<T | null> {
  return (await request.json().catch(() => null)) as T | null;
}

export const storeCartHandlers = [
  http.get("*/v1/store/cart", ({ request }) => {
    const customer = customerOf(request);
    return customer ? withEtag(toCartDto(customer), cartTag(customer)) : unauthenticated();
  }),

  http.post("*/v1/store/cart/items", async ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const refused = precondition(request, cartTag(customer));
    if (refused) return refused;
    const body = await bodyOf<Schemas["AddCartItemDto"]>(request);
    const quote = quotesOf(customer.persona).find((candidate) => candidate.id === body?.quoteId);
    if (!body || !quote) return problem(404, "http.not_found", "ไม่พบใบเสนอราคานี้");
    if (body.quoteOptionId !== optionIdOf(quote)) return problem(404, "http.not_found", "ไม่พบตัวเลือกนี้ในใบเสนอราคา");
    if (linesOf(customer).some((line) => line.quoteId === quote.id))
      return problem(409, "cart.item_exists", "ใบเสนอราคานี้อยู่ในตะกร้าแล้ว");
    const id = addToCart(customer, quote);
    const line = linesOf(customer).find((candidate) => candidate.id === id)!;
    line.designOption = body.designOption;
    if (body.mockupOption) line.mockupOption = body.mockupOption;
    return edited(customer, 201);
  }),

  http.patch("*/v1/store/cart/items/:itemId", async ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const refused = precondition(request, cartTag(customer));
    if (refused) return refused;
    const line = linesOf(customer).find((candidate) => candidate.id === params.itemId);
    if (!line) return notFound();
    const body = await bodyOf<Schemas["UpdateCartItemDto"]>(request);
    const quote = quotesOf(customer.persona).find((candidate) => candidate.id === line.quoteId);
    if (body?.designOption && quote?.source === "rfq" && body.designOption !== "own_file")
      return problem(422, "cart.design_option_unavailable", "ใบเสนอราคาจากทีมงานเปลี่ยนงานออกแบบไม่ได้");
    if (body?.designOption) line.designOption = body.designOption;
    if (body?.mockupOption) line.mockupOption = body.mockupOption;
    if (body?.designNote !== undefined) line.designNote = body.designNote;
    return edited(customer);
  }),

  // No If-Match and no ETag in the answer (as published): the next edit reads the cart first.
  http.delete("*/v1/store/cart/items/:itemId", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    if (!linesOf(customer).some((line) => line.id === params.itemId)) return notFound();
    clearCart(customer, [String(params.itemId)]);
    bump(customer);
    return HttpResponse.json(toCartDto(customer));
  }),

  http.put("*/v1/store/cart/items/:itemId/destinations", async ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const refused = precondition(request, cartTag(customer));
    if (refused) return refused;
    const line = linesOf(customer).find((candidate) => candidate.id === params.itemId);
    const quote = line && quotesOf(customer.persona).find((candidate) => candidate.id === line.quoteId);
    if (!line || !quote) return notFound();
    const body = await bodyOf<Schemas["SetDestinationsDto"]>(request);
    const destinations = body?.destinations ?? [];
    const total = destinations.reduce((sum, destination) => sum + destination.quantity, 0);
    const ordered = line.override?.quantity ?? quote.quantity;
    if (total !== ordered)
      return problem(422, "validation.failed", "จำนวนที่แบ่งส่งต้องรวมกันเท่ากับจำนวนที่สั่ง", [
        { path: "destinations", code: "sum", message: `รวม ${total} จาก ${ordered}` },
      ]);
    const known = new Set(addressesOf(customer).map((address) => address.id));
    const unknown = destinations.findIndex((destination) => !known.has(destination.addressId));
    if (unknown >= 0)
      return problem(422, "validation.failed", "ไม่พบที่อยู่นี้", [
        { path: `destinations[${unknown}].addressId`, code: "exists", message: "unknown address" },
      ]);
    line.destinations = destinations.map((destination, index) => ({
      id: mockId("cds", Number.parseInt(line.id.slice(-4), 16) * 10 + index),
      addressId: destination.addressId,
      quantity: destination.quantity,
    }));
    return edited(customer);
  }),

  // Asks for today's price; the line then carries it as `pendingReprice` until confirmed.
  http.post("*/v1/store/cart/items/:itemId/actions/reprice", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const line = linesOf(customer).find((candidate) => candidate.id === params.itemId);
    const quote = line && quotesOf(customer.persona).find((candidate) => candidate.id === line.quoteId);
    if (!line || !quote) return notFound();
    if (Date.parse(quote.validUntil) >= Date.now() || line.confirmedReprice)
      return problem(409, "cart.price_locked", "ราคานี้ยังคงที่อยู่ ไม่ต้องคำนวณใหม่");
    line.repriceRequested = true;
    bump(customer);
    return HttpResponse.json(toCartDto(customer));
  }),

  // A code is applied to the cart (`store.cart.applyCode`) and checked against what is in it; the
  // checkout prices the validated ones.
  http.post("*/v1/store/cart/codes", async ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const refused = precondition(request, cartTag(customer));
    if (refused) return refused;
    const body = await bodyOf<Schemas["ApplyCodeDto"]>(request);
    const code = body?.code?.trim().toUpperCase();
    if (!code) return problem(422, "promotions.code_invalid", "กรุณาใส่โค้ด");
    const types = [...new Set(cartOf(customer).items.map((item) => item.productType.code))];
    const results = types.map((type) => checkCode(code, type));
    const hit = results.find((result) => result.promotion);
    const list = (codes.get(customer.persona) ?? []).filter((entry) => entry.code !== code);
    list.push(
      hit
        ? { code, status: "validated", rejectReason: null }
        : {
            code,
            status: "rejected",
            rejectReason:
              results[0]?.reason === "expired" ? "โค้ดนี้หมดอายุแล้ว" : "ไม่พบโค้ดนี้ หรือใช้กับสินค้าในตะกร้าไม่ได้",
          },
    );
    codes.set(customer.persona, list);
    return edited(customer, 201);
  }),

  http.delete("*/v1/store/cart/codes/:code", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const refused = precondition(request, cartTag(customer));
    if (refused) return refused;
    codes.set(
      customer.persona,
      (codes.get(customer.persona) ?? []).filter((entry) => entry.code !== String(params.code).toUpperCase()),
    );
    return edited(customer);
  }),

  // C5 (D-452): a new quantity, priced by the mock's fake tier rule; one destination follows, a split is cleared.
  http.post("*/v1/store/cart/items/:itemId/actions/change-quantity", async ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const refused = precondition(request, cartTag(customer));
    if (refused) return refused;
    const line = linesOf(customer).find((candidate) => candidate.id === params.itemId);
    const quote = line && quotesOf(customer.persona).find((candidate) => candidate.id === line.quoteId);
    if (!line || !quote) return notFound();
    if (!quantityEditable(line, quote, line.repriceRequested && !line.confirmedReprice))
      return problem(409, "cart.quantity_unavailable", "รายการนี้เปลี่ยนจำนวนในตะกร้าไม่ได้");
    const body = await bodyOf<Schemas["ChangeQuantityDto"]>(request);
    const quantity = body?.quantity ?? 0;
    if (!Number.isInteger(quantity) || quantity < 100)
      return problem(422, "validation.failed", "จำนวนต้องไม่น้อยกว่า 100", [
        { path: "quantity", code: "min", message: "at least 100" },
      ]);
    const unitPrice = mockTierUnit(quote, quantity);
    line.override =
      quantity === quote.quantity
        ? undefined
        : { quantity, unitPrice, grossAmount: baht(Math.round(Number(unitPrice) * 100 * quantity)) };
    if (line.destinations.length === 1) line.destinations[0]!.quantity = quantity;
    else line.destinations = [];
    return edited(customer);
  }),

  // C5 (D-452): obviously fake estimate — ฿120 + 3 % of the goods to 10xxx–13xxx, ฿220 + 6 % elsewhere (incl. VAT).
  http.post("*/v1/store/cart/actions/estimate-shipping", async ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const body = await bodyOf<Schemas["EstimateShippingDto"]>(request);
    const postcode = body?.postcode ?? "";
    if (!/^\d{5}$/.test(postcode))
      return problem(422, "validation.failed", "รหัสไปรษณีย์ 5 หลัก", [
        { path: "postcode", code: "pattern", message: "5 digits" },
      ]);
    const cart = cartOf(customer);
    const goods = cart.items.reduce((sum, item) => sum + satang(item.grossAmount), 0);
    const near = /^1[0-3]/.test(postcode);
    const shipping = Math.round((near ? 12000 : 22000) + goods * (near ? 0.03 : 0.06));
    const estimate: Schemas["CartShippingEstimateDto"] = {
      postcode,
      available: cart.items.length > 0,
      shippingGrossAmount: cart.items.length > 0 ? baht(shipping) : null,
      totalGrossAmount: cart.items.length > 0 ? baht(goods + shipping) : null,
      vatAmount: cart.items.length > 0 ? baht(Math.round(((goods + shipping) * 7) / 107)) : null,
      zone: near ? { th: "กรุงเทพฯ และปริมณฑล", en: "Bangkok & vicinity" } : { th: "ต่างจังหวัด", en: "Upcountry" },
      readyDate: bangkokIso(6 * 24 * 60).slice(0, 10),
      arrival: {
        from: bangkokIso((near ? 7 : 8) * 24 * 60).slice(0, 10),
        to: bangkokIso((near ? 8 : 10) * 24 * 60).slice(0, 10),
      },
      unavailableItemIds: [],
    };
    return HttpResponse.json(estimate);
  }),

  http.post("*/v1/store/cart/items/:itemId/actions/confirm-reprice", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const refused = precondition(request, cartTag(customer));
    if (refused) return refused;
    const line = linesOf(customer).find((candidate) => candidate.id === params.itemId);
    if (!line) return notFound();
    if (!line.repriceRequested || line.confirmedReprice)
      return problem(409, "cart.no_pending_reprice", "ไม่มีราคาใหม่ให้ยืนยัน");
    line.confirmedReprice = true;
    return edited(customer);
  }),
];

function reorderedOf(quote: { configuration: Record<string, unknown> }): Schemas["OrderRefDto"] | null {
  const orderId = quote.configuration.reorderOf;
  const order = typeof orderId === "string" ? orders.find((candidate) => candidate.id === orderId) : undefined;
  return order ? { orderId: order.id, orderCode: order.orderCode } : null;
}
