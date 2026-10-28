/**
 * The multi-item RFQ basket (U5.B3, D-301), mocked with state: one draft per customer, up to 20
 * items, details shared by every item; submitting checks each item again, numbers the basket, files
 * one RFQ per item through the same path as a single RFQ (`createStoreRfq`) and opens one
 * conversation; accepting items accepts a quote of each RFQ (`acceptStoreRfq`) and puts the quotation
 * in the cart at the quoted price.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { bangkokIso, mockId, problem } from "../support";
import { addToCart, toCartDto } from "./cart";
import { threads } from "./conversations";
import { customerOf, type MockCustomer } from "./customers";
import { basketProductOf, productRefOf } from "./catalog";
import { ownerIdOf } from "./owner";
import { acceptStoreRfq, createStoreRfq, myRfq, rfqRefusal, rfqTypeNames, storeRfqDto } from "./rfq";

/** A pending line (C1b, D-447) keeps `null` in place of its not-yet-filled form. */
type Basket = Schemas["RfqBasketDto"] & {
  customerId: string;
  inputs: (Schemas["RfqBasketItemInputDto"] | null)[];
};

const sameProduct = (
  a: { catalogProductSlug?: unknown; stockProductSku?: unknown },
  b: { catalogProductSlug?: string; stockProductSku?: string },
) =>
  (!!b.catalogProductSlug && a.catalogProductSlug === b.catalogProductSlug) ||
  (!!b.stockProductSku && a.stockProductSku === b.stockProductSku);

const MAX_ITEMS = 20;
const baskets: Basket[] = [];
let seq = 0;
let numbered = 0;

const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
const notFound = () => problem(404, "http.not_found", "ไม่พบตะกร้าคำขอนี้");
const keyRequired = (request: Request) =>
  request.headers.get("idempotency-key")
    ? null
    : problem(400, "idempotency.key_required", "ต้องส่ง Idempotency-Key สำหรับคำสั่งนี้");
const english = (request: Request) => request.headers.get("accept-language")?.startsWith("en") ?? false;

function draftOf(customer: MockCustomer): Basket {
  let draft = baskets.find((b) => b.customerId === customer.id && b.status === "draft");
  if (!draft) {
    seq += 1;
    draft = {
      id: mockId("b45k", seq),
      customerId: customer.id,
      basketCode: null,
      status: "draft",
      deliveryPostcode: null,
      targetDate: null,
      notes: "",
      conversationId: null,
      submittedAt: null,
      items: [],
      inputs: [],
      createdAt: bangkokIso(),
    };
    baskets.push(draft);
  }
  return draft;
}

/** The DTO, with each submitted item's RFQ as it stands now. */
function toDto(customer: MockCustomer, basket: Basket): Schemas["RfqBasketDto"] {
  const { customerId: _owner, inputs: _inputs, ...dto } = basket;
  void _owner;
  void _inputs;
  return {
    ...dto,
    items: basket.items.map((item) => {
      const rfq = item.rfq ? myRfq(customer, item.rfq.id) : undefined;
      return { ...item, rfq: rfq ? storeRfqDto(rfq) : item.rfq };
    }),
  };
}

function itemOf(input: Schemas["RfqBasketItemInputDto"], sort: number): Schemas["RfqBasketItemDto"] {
  const [nameTh, nameEn] = rfqTypeNames(input.productTypeCode) ?? [input.productTypeCode, input.productTypeCode];
  return {
    id: mockId("b1tm", ++seq),
    sort,
    productType: { id: mockId("ptyp", input.productTypeCode.length), code: input.productTypeCode, nameTh, nameEn },
    specification: {
      spec: input.spec,
      quantities: input.quantities,
      ...(input.catalogProductSlug ? { catalogProductSlug: input.catalogProductSlug } : {}),
      ...(input.stockProductSku ? { stockProductSku: input.stockProductSku } : {}),
      ...(input.lengthMm ? { lengthMm: input.lengthMm, widthMm: input.widthMm, heightMm: input.heightMm ?? null } : {}),
    },
    design: input.design ?? null,
    formPending: false,
    categoryCode: basketProductOf(input)?.categoryCode ?? null,
    product: (() => {
      const product = productRefOf(input);
      return product && !("refused" in product) ? product : null;
    })(),
    rfq: null,
  };
}

export const rfqBasketHandlers = [
  http.get("*/v1/store/rfq-baskets/draft", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    return HttpResponse.json(toDto(customer, draftOf(customer)));
  }),

  http.patch("*/v1/store/rfq-baskets/draft", async ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const body = (await request.json()) as Schemas["SetBasketDetailsDto"];
    if (body.deliveryPostcode !== undefined && !/^\d{5}$/.test(body.deliveryPostcode))
      return problem(422, "validation.failed", "รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก", [
        { path: "deliveryPostcode", code: "pattern", message: "pattern" },
      ]);
    const draft = draftOf(customer);
    if (body.deliveryPostcode !== undefined) draft.deliveryPostcode = body.deliveryPostcode;
    if (body.targetDate !== undefined) draft.targetDate = body.targetDate;
    if (body.notes !== undefined) draft.notes = body.notes;
    return HttpResponse.json(toDto(customer, draft));
  }),

  http.post("*/v1/store/rfq-baskets/draft/items", async ({ request }) => {
    const refused = keyRequired(request);
    if (refused) return refused;
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const draft = draftOf(customer);
    if (draft.items.length >= MAX_ITEMS)
      return problem(422, "validation.failed", `ตะกร้ารับได้สูงสุด ${MAX_ITEMS} รายการ`, [
        { path: "items", code: "max_items", message: "max" },
      ]);
    const input = (await request.json()) as Schemas["RfqBasketItemInputDto"];
    if (!input.quantities?.length)
      return problem(422, "validation.failed", "ระบุจำนวนอย่างน้อยหนึ่งจำนวน", [
        { path: "quantities", code: "required", message: "required" },
      ]);
    // C1-API-3: a named product must be an active product of the line's type.
    const product = productRefOf(input);
    if (product && "refused" in product)
      return problem(422, "validation.failed", "ไม่พบสินค้านี้ในประเภทที่เลือก", [
        { path: product.refused, code: "exists", message: "exists" },
      ]);
    // C1b (D-447): the filled form of a product waiting in the basket fills that line.
    const waiting = draft.items.findIndex((item) => item.formPending && sameProduct(item.specification, input));
    if (waiting >= 0) {
      draft.items[waiting] = { ...itemOf(input, waiting), id: draft.items[waiting]!.id };
      draft.inputs[waiting] = input;
      return HttpResponse.json(toDto(customer, draft), { status: 201 });
    }
    draft.items.push(itemOf(input, draft.items.length));
    draft.inputs.push(input);
    return HttpResponse.json(toDto(customer, draft), { status: 201 });
  }),

  // store.rfqBaskets.addProduct (C1b, D-447): the signed-in quote tray — a product waits for its form.
  http.post("*/v1/store/rfq-baskets/draft/products", async ({ request }) => {
    const refused = keyRequired(request);
    if (refused) return refused;
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const body = (await request.json()) as Schemas["AddBasketProductDto"];
    if (!body.catalogProductSlug === !body.stockProductSku)
      return problem(422, "validation.failed", "ระบุสินค้าหนึ่งรายการ", [
        { path: "catalogProductSlug", code: "oneOf", message: "oneOf" },
      ]);
    const found = basketProductOf(body);
    if (!found)
      return problem(422, "validation.failed", "ไม่พบสินค้านี้", [
        { path: body.catalogProductSlug ? "catalogProductSlug" : "stockProductSku", code: "exists", message: "exists" },
      ]);
    const draft = draftOf(customer);
    if (draft.items.some((item) => item.formPending && sameProduct(item.specification, body)))
      return HttpResponse.json(toDto(customer, draft), { status: 201 });
    if (draft.items.length >= MAX_ITEMS)
      return problem(422, "validation.failed", `ตะกร้ารับได้สูงสุด ${MAX_ITEMS} รายการ`, [
        { path: "items", code: "max_items", message: "max" },
      ]);
    const [nameTh, nameEn] = rfqTypeNames(found.productTypeCode) ?? [found.productTypeCode, found.productTypeCode];
    draft.items.push({
      id: mockId("b1tm", ++seq),
      sort: draft.items.length,
      productType: {
        id: mockId("ptyp", found.productTypeCode.length),
        code: found.productTypeCode,
        nameTh,
        nameEn,
      },
      specification: {
        productTypeCode: found.productTypeCode,
        ...(body.catalogProductSlug ? { catalogProductSlug: body.catalogProductSlug } : {}),
        ...(body.stockProductSku ? { stockProductSku: body.stockProductSku } : {}),
      },
      design: null,
      formPending: true,
      categoryCode: found.categoryCode,
      product: found.product,
      rfq: null,
    });
    draft.inputs.push(null);
    return HttpResponse.json(toDto(customer, draft), { status: 201 });
  }),

  http.delete("*/v1/store/rfq-baskets/draft/items/:itemId", ({ request, params }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const draft = draftOf(customer);
    const index = draft.items.findIndex((item) => item.id === params.itemId);
    if (index < 0) return notFound();
    draft.items.splice(index, 1);
    draft.inputs.splice(index, 1);
    draft.items.forEach((item, sort) => (item.sort = sort));
    return HttpResponse.json(toDto(customer, draft));
  }),

  http.post("*/v1/store/rfq-baskets/draft/actions/discard", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const draft = draftOf(customer);
    draft.status = "discarded";
    return HttpResponse.json(toDto(customer, draft));
  }),

  http.post("*/v1/store/rfq-baskets/draft/actions/submit", async ({ request }) => {
    const refused = keyRequired(request);
    if (refused) return refused;
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const draft = draftOf(customer);
    if (draft.items.length === 0)
      return problem(422, "validation.failed", "ยังไม่มีรายการในตะกร้า", [
        { path: "items", code: "required", message: "required" },
      ]);
    if (!draft.deliveryPostcode)
      return problem(422, "validation.failed", "ระบุรหัสไปรษณีย์ปลายทางก่อนส่ง", [
        { path: "deliveryPostcode", code: "required", message: "required" },
      ]);
    const pending = draft.items.findIndex((item) => item.formPending);
    if (pending >= 0)
      return problem(422, "validation.failed", "กรอกรายละเอียดของทุกรายการก่อนส่ง", [
        { path: `items[${pending}]`, code: "required", message: "required" },
      ]);
    const en = english(request);
    // Every item is checked first (errors under `items[i]`); nothing is filed unless all of them pass.
    const inputs = draft.inputs.filter((input): input is Schemas["RfqBasketItemInputDto"] => input !== null);
    for (const [index, input] of inputs.entries()) {
      const refused = rfqRefusal(input, `items[${index}].`);
      if (refused) return refused;
    }
    const created = inputs.map((input) =>
      createStoreRfq(
        customer,
        {
          productTypeCode: input.productTypeCode,
          specSchemaVersion: input.specSchemaVersion ?? 1,
          spec: input.spec,
          quantities: input.quantities,
          deliveryPostcode: draft.deliveryPostcode!,
          ...(input.lengthMm
            ? { lengthMm: input.lengthMm, widthMm: input.widthMm!, heightMm: input.heightMm ?? undefined }
            : {}),
          ...(draft.targetDate ? { targetDate: draft.targetDate } : {}),
          ...(draft.notes ? { notes: draft.notes } : {}),
          fileIds: input.fileIds ?? [],
          ...(input.catalogProductSlug ? { catalogProductSlug: input.catalogProductSlug } : {}),
          ...(input.stockProductSku ? { stockProductSku: input.stockProductSku } : {}),
        } as Schemas["SubmitRfqDto"],
        en,
      ),
    );
    const failed = created.findIndex((rfq) => rfq instanceof Response);
    if (failed >= 0) return created[failed] as Response;
    numbered += 1;
    draft.basketCode = `RFB-2569-${String(numbered).padStart(4, "0")}`;
    draft.status = "submitted";
    draft.submittedAt = bangkokIso();
    draft.items = draft.items.map((item, index) => {
      const rfq = created[index] as Exclude<(typeof created)[number], Response>;
      return { ...item, rfq: storeRfqDto(rfq) };
    });
    // One conversation for the basket (D-301).
    const conversationId = mockId("c0nv", 9000 + numbered);
    threads.push({
      id: conversationId,
      customerId: customer.id,
      ownerId: ownerIdOf(customer),
      customerName: customer.displayName,
      subjectType: "rfq_basket",
      subject: { type: "rfq_basket", id: draft.id, label: draft.basketCode },
      status: "open",
      channel: "web",
      replyChannel: "web",
      replyChannelChosen: false,
      assignee: null,
      messages: [],
      customerReadAt: null,
      staffReadAt: null,
      firstResponseDueAt: null,
      firstRespondedAt: null,
      resolvedAt: null,
    });
    draft.conversationId = conversationId;
    return HttpResponse.json(toDto(customer, draft));
  }),

  http.get("*/v1/store/rfq-baskets", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const rows = baskets
      .filter((b) => b.customerId === customer.id && b.status !== "discarded")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50)
      .map((b) => toDto(customer, b));
    return HttpResponse.json(rows);
  }),

  http.get("*/v1/store/rfq-baskets/:basketId", ({ request, params }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const basket = baskets.find((b) => b.id === params.basketId && b.customerId === customer.id);
    return basket ? HttpResponse.json(toDto(customer, basket)) : notFound();
  }),

  http.post("*/v1/store/rfq-baskets/:basketId/actions/accept-items", async ({ request, params }) => {
    const refused = keyRequired(request);
    if (refused) return refused;
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const basket = baskets.find((b) => b.id === params.basketId && b.customerId === customer.id);
    if (!basket) return notFound();
    if (basket.status !== "submitted") return problem(409, "rfq_baskets.not_submitted", "ตะกร้านี้ยังไม่ได้ส่ง");
    const { items } = (await request.json()) as Schemas["AcceptBasketItemsDto"];
    const en = english(request);
    // Every choice is checked before any is accepted.
    for (const [index, choice] of items.entries()) {
      const item = basket.items.find((row) => row.id === choice.itemId);
      const rfq = item?.rfq ? myRfq(customer, item.rfq.id) : undefined;
      const quote = rfq?.quotes.find((q) => q.id === choice.rfqQuoteId);
      if (!rfq || !quote || !quote.lines.some((line) => line.quantity === choice.quantity))
        return problem(422, "validation.failed", "ตัวเลือกนี้ไม่ตรงกับใบเสนอราคาที่ส่งมา", [
          { path: `items[${index}]`, code: "invalid", message: "invalid" },
        ]);
    }
    for (const choice of items) {
      const item = basket.items.find((row) => row.id === choice.itemId)!;
      const rfq = myRfq(customer, item.rfq!.id)!;
      const quote = acceptStoreRfq(customer, rfq, choice.rfqQuoteId, choice.quantity, en);
      if (quote instanceof Response) return quote;
      addToCart(customer, quote);
    }
    return HttpResponse.json({
      basket: toDto(customer, basket),
      cart: toCartDto(customer),
    } satisfies Schemas["AcceptedBasketDto"]);
  }),
];
