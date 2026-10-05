import { studioHref } from "@/features/customer/studio/paths";
import type { Schemas } from "@/lib/api/types";

type Launchpad = Schemas["LaunchpadDto"];
type Step = Schemas["NextStepDto"];
type ActionItem = Schemas["LaunchpadActionItemDto"];

/** Where an order-level action is done in the account. A group is paid from the orders list. */
export function actionHref(item: Pick<ActionItem, "action" | "subject" | "id">): string {
  if (item.subject === "order_group") return "/account/orders";
  switch (item.action) {
    case "pay":
      return `/account/orders/${item.id}#instalments`;
    case "approve_proof":
      return `/account/orders/${item.id}/proof`;
    case "upload_artwork":
      return `/account/orders/${item.id}/artwork`;
    case "confirm_receipt":
      return `/account/orders/${item.id}`;
  }
}

/** The page the recommended step opens (`NextStepDto.target`, D-297). */
export function stepHref(step: Step, launchpad: Launchpad): string {
  const id = step.targetId;
  switch (step.kind) {
    case "pay":
    case "approve_proof":
    case "upload_artwork":
    case "confirm_receipt":
      return id
        ? actionHref({ action: step.kind, subject: step.target === "order_group" ? "order_group" : "order", id })
        : "/account/orders";
    case "reorder": {
      if (step.target === "order_reorder" && id) return `/account/orders/${id}/reorder`;
      const candidate = launchpad.reorderCandidates.find((c) => c.suggestionId === id);
      return candidate ? `/account/orders/${candidate.orderId}/reorder` : "/account/replenishment";
    }
    case "resume_design":
      return id ? studioHref({ designId: id }) : "/account/designs";
    case "start_configuration":
      return "/products";
  }
}
