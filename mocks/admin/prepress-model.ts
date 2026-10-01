/**
 * The shape the fake prepress rows are kept in — a fixture model, not an API type.
 *
 * A row is the per-order workspace aggregate the prepress desk once asked for (F2 2.4). Since
 * U-F0.4 every operation the desk calls is published and nothing answers this shape: the
 * published admin operations (`./artwork.ts`, `./prepress.ts`) and the storefront's
 * (`../store/artwork.ts`) project a row onto the contract's DTOs on the way out. The row keeps
 * what the API computes (stage, urgency, annotation counts, the next round's fee) because the
 * mock has to compute it from something. Enums are the contract's (`Schemas[...]`).
 */

import type { Schemas } from "@/lib/api/types";

type UserRef = { id: string; displayName: string };

/** A file kept with the fixture, with the signed URL the mock hands back for it. */
export interface PrepressFileRow {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  thumbnailUrl: string | null;
  url: string | null;
}

export interface PreflightFindingRow {
  check: Schemas["PreflightCheck"];
  severity: Schemas["PreflightSeverity"];
  page: number | null;
  message: string;
  thumbnailUrl: string | null;
}

/** An action as the fixture's own rules offer it (`refresh`), before any projection. */
export interface PrepressActionRow {
  key: string;
  irreversible?: boolean;
  disabledReason?: string | null;
}

export interface SubmissionRow {
  id: string;
  versionNo: number;
  source: Schemas["ArtworkSource"];
  status: Schemas["SubmissionStatus"];
  preflightStatus: Schemas["PreflightStatus"];
  preflightCompletedAt: string | null;
  findings: PreflightFindingRow[];
  files: { role: "artwork" | "font" | "link" | "reference"; file: PrepressFileRow }[];
  designDocumentId: string | null;
  submittedBy: UserRef | null;
  submittedAt: string;
  nextActions: PrepressActionRow[];
}

export interface ProofRow {
  id: string;
  versionNo: number;
  submissionVersionNo: number;
  status: Schemas["ProofStatus"];
  proofFile: PrepressFileRow;
  dielineFile: PrepressFileRow | null;
  note: string | null;
  preparedBy: UserRef;
  sentAt: string;
  decidedAt: string | null;
  decidedBy: UserRef | null;
  decisionChannel: Schemas["DecisionChannel"] | null;
  onBehalfReason: string | null;
  /** The approved file is locked and hashed (B4.1). */
  approvedFileSha256: string | null;
  annotations: { open: number; resolved: number };
}

export interface DesignRoundRow {
  roundNo: number;
  kind: Schemas["DesignRoundKind"];
  /** From the fourth round (D-071); the fee and its instalment are the API's. */
  chargeable: boolean;
  feeAmount: string | null;
  status: Schemas["DesignRoundStatus"];
  requestedAt: string;
  startedAt: string | null;
  deliveredAt: string | null;
  files: PrepressFileRow[];
  note: string | null;
}

export interface DesignServiceRow {
  id: string;
  status: Schemas["DesignServiceStatus"];
  /** The legacy `brd_*` brief, in words. */
  brief: { label: string; value: string }[];
  briefFiles: PrepressFileRow[];
  designer: UserRef | null;
  targetDueAt: string;
  maxDueAt: string;
  /** Snapshot of the setting when the order was placed (3, D-071). */
  freeRounds: number;
  designFeeNet: string;
  rounds: DesignRoundRow[];
  /** What the next revision would cost the customer, if it is chargeable — the API's figure. */
  nextRound: { roundNo: number; chargeable: boolean; feeAmount: string | null };
}

/** A design document as the designer stores it (`design_documents` + its current version). */
export interface DesignDocumentRow {
  id: string;
  title: string;
  versionNo: number;
  schemaVersion: number;
  /** The designer's own document (`SavedDesign`'s spec and content). */
  document: { spec: Record<string, unknown>; content: Record<string, unknown> };
  thumbnailUrl: string | null;
  owner: { displayName: string };
  /** True only for a copy this staff member owns; a customer's document is read-only (F4 C.2). */
  editable: boolean;
  updatedAt: string;
}

export interface DrawingJobRow {
  id: string;
  format: Schemas["DrawingFormat"];
  status: Schemas["DrawingStatus"];
  outputFile: PrepressFileRow | null;
  error: string | null;
  engineVersion: string | null;
  createdAt: string;
}

/** Why an order is on the prepress desk, as the fixture's stages name it. */
export type PrepressStage =
  "preflight" | "proof" | "awaiting_customer" | "changes_requested" | "template" | "design" | "mockup";

export interface PrepressRow {
  orderId: string;
  orderCode: string;
  orderStatus: string;
  customer: { id: string; customerCode: string; displayName: string; companyName: string | null };
  productType: { code: string; name: string };
  quantity: number;
  unit: string;
  specs: { label: string; value: string }[];
  dieline: { patternCode: string | null; lengthMm: number | null; widthMm: number | null; heightMm: number | null };
  designOption: Schemas["DesignOption"];
  mockupOption: Schemas["MockupOption"];
  promisedShipDate: string | null;
  artworkStatus: Schemas["ArtworkStatus"];
  stage: PrepressStage | null;
  /** The order's Prepress owner (`admin.artwork.assignPrepress`). */
  assignee: UserRef | null;
  slaDueAt: string | null;
  urgency: "normal" | "due_soon" | "late";
  /** Newest first. */
  submissions: SubmissionRow[];
  /** Newest first. */
  proofs: ProofRow[];
  templateDeliveries: {
    id: string;
    trigger: Schemas["DielineTrigger"];
    sentAt: string;
    sentBy: UserRef | null;
    file: PrepressFileRow;
  }[];
  /** The order's dieline drawings (`admin.designs.listOrderDrawings`), newest first. */
  drawingJobs: DrawingJobRow[];
  designService: DesignServiceRow | null;
  mockup: {
    jobId: string;
    jobNo: string;
    option: Schemas["MockupOption"];
    status: Schemas["ProductionJobStatus"];
    factory: { name: string } | null;
    promisedAt: string | null;
  } | null;
  designDocument: DesignDocumentRow | null;
  nextActions: PrepressActionRow[];
}
