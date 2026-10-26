import type { Client } from "openapi-fetch";

import type { ApiPaths, Schemas } from "@/lib/api/types";
import { isApiError } from "@/lib/api/problem";

export type RequotePreview = Schemas["RequotePreviewDto"];
export type ConfirmRequoteBody = Schemas["ConfirmRequoteDto"];

/** The problem codes the re-quote flow branches on (D-436); everything else is shown in the API's words. */
export const REQUOTE_CODES = {
  required: "order.requote_required",
  notDue: "order.requote_not_due",
  unavailable: "order.requote_unavailable",
  changed: "order.requote_changed",
} as const;

/** Step 1: price the overdue group at today's price. Nothing on the order changes. */
export async function previewRequote(api: Client<ApiPaths>, groupId: string): Promise<RequotePreview> {
  const { data } = await api.POST("/v1/store/order-groups/{groupId}/actions/requote", {
    params: { path: { groupId } },
  });
  return data!;
}

/** The body step 2 sends: the preview's quotations and its new total, exactly (the API refuses any other). */
export function confirmBodyOf(preview: RequotePreview): ConfirmRequoteBody {
  return {
    orders: preview.orders.map((row) => ({
      orderId: row.orderId,
      quoteId: row.quoteId,
      quoteOptionId: row.quoteOptionId,
    })),
    expectedGrossAmount: preview.newGrossAmount,
  };
}

/** Step 2: write the preview. Needs an `Idempotency-Key`; a replay with the same key answers the same group. */
export async function confirmRequote(
  api: Client<ApiPaths>,
  groupId: string,
  preview: RequotePreview,
  idempotencyKey: string,
): Promise<Schemas["OrderGroupDto"]> {
  const { data } = await api.POST("/v1/store/order-groups/{groupId}/actions/confirm-requote", {
    params: { path: { groupId }, header: { "Idempotency-Key": idempotencyKey } },
    body: confirmBodyOf(preview),
  });
  return data!;
}

/** The way a failed re-quote step goes on: the team re-quotes, price again, or the API's own message. */
export type RequoteFailure = "unavailable" | "changed" | "not_due" | "other";

export function requoteFailureOf(error: unknown): RequoteFailure {
  if (!isApiError(error)) return "other";
  switch (error.code) {
    case REQUOTE_CODES.unavailable:
      return "unavailable";
    case REQUOTE_CODES.changed:
      return "changed";
    case REQUOTE_CODES.notDue:
      return "not_due";
    default:
      return "other";
  }
}

/** True when a payment was refused because the group is overdue and must be re-quoted first. */
export function isRequoteRequired(error: unknown): boolean {
  return isApiError(error) && error.code === REQUOTE_CODES.required;
}

/** The sign of a difference the API sent as a decimal string — only to pick "แพงขึ้น"/"ถูกลง"/"เท่าเดิม" words. */
export function differenceDirection(difference: string): "up" | "down" | "same" {
  // A decimal string is read, never computed on (money rule): a minus sign, or only zeros.
  if (difference.trim().startsWith("-")) return "down";
  return /^[0.\s]*$/.test(difference) ? "same" : "up";
}
