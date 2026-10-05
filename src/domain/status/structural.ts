import { defineStatusMap } from "./types";
import type { StructuralRequestStatus, StyleIntakeStatus } from "./contract";

/**
 * A customer's structural design request (U3.6, D-273): submitted → assigned to a designer →
 * (a fee quoted through a service RFQ) → the dieline delivered → approved by Prepress → published
 * as a library style; or declined, or cancelled by the customer.
 */
export const STRUCTURAL_REQUEST_STATUS = defineStatusMap<StructuralRequestStatus>({
  submitted: { tone: "neutral", icon: "hourglass", labelKey: "structuralRequest.submitted" },
  assigned: { tone: "info", icon: "user", labelKey: "structuralRequest.assigned" },
  quoted: { tone: "warning", icon: "receipt", labelKey: "structuralRequest.quoted" },
  delivered: { tone: "info", icon: "package", labelKey: "structuralRequest.delivered" },
  approved: { tone: "success", icon: "check", labelKey: "structuralRequest.approved" },
  published: { tone: "success", icon: "check", labelKey: "structuralRequest.published" },
  declined: { tone: "danger", icon: "ban", labelKey: "structuralRequest.declined" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "structuralRequest.cancelled" },
});

/** A factory's dieline offer (U3.6, D-272): submitted → matched to a recipe → approved as a recipe or a template, or rejected. */
export const STYLE_INTAKE_STATUS = defineStatusMap<StyleIntakeStatus>({
  submitted: { tone: "neutral", icon: "hourglass", labelKey: "styleIntake.submitted" },
  matched: { tone: "info", icon: "check", labelKey: "styleIntake.matched" },
  approved_recipe: { tone: "success", icon: "check", labelKey: "styleIntake.approvedRecipe" },
  approved_template: { tone: "success", icon: "check", labelKey: "styleIntake.approvedTemplate" },
  rejected: { tone: "danger", icon: "ban", labelKey: "styleIntake.rejected" },
});
