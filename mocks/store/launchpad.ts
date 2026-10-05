/**
 * The signed-in home and the pre-fill defaults (U5.B1), mocked over the mock world's own rows so a
 * walk through the storefront meets the same orders, designs and suggestions the launchpad names:
 *
 *   `store.me.getLaunchpad` (D-297) — up to 5 designs, latest change first; up to 5 reorder candidates
 *     (open suggestions, then delivered orders); the orders waiting for the customer with that action;
 *     one recommended step in the API's fixed order.
 *   `store.me.getDefaults` (D-298) — the default (else first) address and tax profile, the companies
 *     the customer belongs to. Last material per product type is left empty: the mock's quotations do
 *     not keep the configurator's option ids.
 *   `store.deepLinks.resolve` (D-299) — the stateless `sMOCK…` tokens of `mockDeepLink`; anything else 404.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { bangkokIso, problem } from "../support";
import { bookOf } from "./book";
import { companyMembershipOf } from "./business";
import { customerOf } from "./customers";
import { designProductRefOf, designsOwnedBy } from "./designs";
import { storeOrderActions, toOrderDto } from "./order-dto";
import { ordersOf } from "./orders";
import { ownerIdOf } from "./owner";
import { suggestionsOf } from "./repeat";

const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");

const ACTION_OF: Record<string, Schemas["LaunchpadAction"]> = {
  "order.upload_artwork": "upload_artwork",
  "order.approve_proof": "approve_proof",
  "order.confirm_receipt": "confirm_receipt",
};
const ORDER: Schemas["LaunchpadAction"][] = ["pay", "approve_proof", "upload_artwork", "confirm_receipt"];

const typeRef = (type: { code: string; name: string; id?: string }): Schemas["CodeNameRefDto"] => ({
  id: type.id ?? `00000000-0000-4000-8000-${type.code.length.toString(16).padStart(12, "0")}`,
  code: type.code,
  nameTh: type.name,
  nameEn: type.name,
});

/**
 * Deep links in the mock are stateless: `sMOCK` + base64url of `{ path, customerId, expired? }`, so a
 * test can write one without reaching into the server. A real token is random (D-299).
 */
export function mockDeepLink(link: { path: string; customerId: string; expired?: boolean }): string {
  return `sMOCK${Buffer.from(JSON.stringify(link)).toString("base64url")}`;
}

function readMockLink(token: string): { path: string; customerId: string; expired?: boolean } | null {
  if (!token.startsWith("sMOCK")) return null;
  try {
    return JSON.parse(Buffer.from(token.slice(5), "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export const launchpadHandlers = [
  http.get("*/v1/store/me/launchpad", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const owner = ownerIdOf(customer);
    const orders = ordersOf(customer);

    const needsAction: Schemas["LaunchpadActionItemDto"][] = [];
    for (const order of orders) {
      const dto = toOrderDto(order);
      const actions = new Set(
        storeOrderActions(order)
          .map((a) => ACTION_OF[a.key])
          .filter(Boolean),
      );
      if (dto.status === "waiting_payment") actions.add("pay");
      for (const action of ORDER.filter((a) => actions.has(a))) {
        needsAction.push({
          action,
          subject: "order",
          id: order.id,
          code: order.orderCode,
          productType: typeRef(order.productType),
          dueAt: null,
          amount: action === "pay" ? dto.totals.grossAmount : null,
        });
        break;
      }
    }
    needsAction.sort((a, b) => ORDER.indexOf(a.action) - ORDER.indexOf(b.action));

    const designs = designsOwnedBy(owner)
      .slice(0, 5)
      .map((row): Schemas["LaunchpadDesignDto"] => {
        const product = designProductRefOf(row.catalogProductId);
        return {
          id: row.design.id,
          title: row.design.name,
          catalogProductId: row.catalogProductId,
          catalogProductNameTh: product.nameTh,
          catalogProductNameEn: product.nameEn,
          thumbnailFileId: row.thumbnailFileId,
          lockedByOrderCode: row.lockedByOrderCode,
          updatedAt: row.design.updatedAt,
        };
      });

    const suggested = suggestionsOf(customer)
      .filter((s) => s.status === "open")
      .map((s): Schemas["ReorderCandidateDto"] => ({
        source: "suggestion",
        suggestionId: s.id,
        orderId: s.lastOrder.orderId,
        orderCode: s.lastOrder.orderCode,
        productType: s.productType,
        quantity: s.lastOrder.quantity,
        suggestedOn: s.suggestedOn,
        suggestedQuantity: s.suggestedQuantity,
        due: s.suggestedOn !== null && s.suggestedOn <= bangkokIso().slice(0, 10),
      }));
    const past = orders
      .filter((order) => order.status === "completed" && !suggested.some((s) => s.orderId === order.id))
      .map((order): Schemas["ReorderCandidateDto"] => ({
        source: "past_order",
        suggestionId: null,
        orderId: order.id,
        orderCode: order.orderCode,
        productType: typeRef(order.productType),
        quantity: order.quantity,
        suggestedOn: null,
        suggestedQuantity: null,
        due: false,
      }));
    const reorderCandidates = [...suggested, ...past].slice(0, 5);

    // The fixed order of D-297: pay → proof → artwork → receipt → due reorder → design → configure.
    const first = needsAction[0];
    const due = reorderCandidates.find((c) => c.due);
    const nextStep: Schemas["NextStepDto"] = first
      ? { kind: first.action, target: "order", targetId: first.id }
      : due
        ? due.suggestionId
          ? { kind: "reorder", target: "reorder_suggestion", targetId: due.suggestionId }
          : { kind: "reorder", target: "order_reorder", targetId: due.orderId }
        : designs[0]
          ? { kind: "resume_design", target: "design", targetId: designs[0].id }
          : { kind: "start_configuration", target: null, targetId: null };

    return HttpResponse.json({
      designs,
      reorderCandidates,
      needsAction: needsAction.slice(0, 20),
      nextStep,
    } satisfies Schemas["LaunchpadDto"]);
  }),

  http.get("*/v1/store/me/defaults", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const book = bookOf(customer);
    const address = book.addresses.find((a) => a.isDefault) ?? book.addresses[0];
    const profile = book.taxProfiles.find((p) => p.isDefault) ?? null;
    const membership = companyMembershipOf(customer);
    return HttpResponse.json({
      deliveryAddress: address ? { id: address.id, basis: address.isDefault ? "default" : "last_used" } : null,
      taxProfile: profile
        ? { id: profile.id, name: profile.name, taxId: profile.taxId, branchCode: profile.branchCode }
        : null,
      companies: membership
        ? [
            {
              id: membership.companyId,
              legalName: "บริษัท ตัวอย่าง จำกัด (ข้อมูลจำลอง)",
              taxId: "0105500000019",
              defaultBranchId: null,
              withholdsTax: false,
              mayOrder: true,
              hasBrandKit: false,
            },
          ]
        : [],
      productTypes: [],
    } as Schemas["DefaultsDto"]);
  }),

  http.post("*/v1/store/deep-links/actions/resolve", async ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const { token } = (await request.json()) as Schemas["ResolveDeepLinkDto"];
    const link = readMockLink(token);
    if (!link || link.customerId !== customer.id) return problem(404, "http.not_found", "ไม่พบลิงก์นี้");
    if (link.expired) return problem(410, "deep_links.expired", "ลิงก์นี้หมดอายุแล้ว");
    return HttpResponse.json({
      path: link.path,
      expiresAt: bangkokIso(72 * 60),
    } satisfies Schemas["DeepLinkTargetDto"]);
  }),
];
