import type { Schemas } from "@/lib/api/types";

type Evidence = Pick<Schemas["MilestoneDto"], "evidence">;

/** A step's evidence rule (`EvidenceRequirement`): a photo, the QC form, or both. Plain, for server and client. */
export const needsPhoto = (milestone: Evidence) =>
  milestone.evidence === "photo" || milestone.evidence === "photo_and_qc_form";
export const needsQcForm = (milestone: Evidence) =>
  milestone.evidence === "qc_form" || milestone.evidence === "photo_and_qc_form";
