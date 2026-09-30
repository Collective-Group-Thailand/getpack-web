import type { Client } from "openapi-fetch";

import { artworkActions, type ArtworkActions } from "@/domain/next-actions/store";
import { isApiError } from "@/lib/api/problem";
import type { ApiPaths, Schemas } from "@/lib/api/types";

export type Order = Schemas["OrderDto"];
export type Submission = Schemas["ArtworkSubmissionDto"];
export type Proof = Schemas["ProofDto"];
export type Annotation = Schemas["AnnotationDto"];
export type Template = Schemas["DielineDeliveryDto"];
export type DesignService = Schemas["DesignServiceDto"];
export type Instalment = Schemas["InstalmentDto"];

/**
 * One order's artwork as its pages show it, composed from the published reads (the backend has
 * no single aggregate): the order, its submissions, proofs, dieline templates and — for hired
 * design — the design service, each newest first.
 *
 * CONTRACT-GAP store.artwork — the file rules (bleed, safe margin, resolution, colour, accepted
 * types and sizes), the approval checklist, the dieline key and the box's dimensions are not
 * published, so the pages say what preflight answers rather than what it will check.
 */
export interface Artwork {
  order: Order;
  submissions: Submission[];
  proofs: Proof[];
  templates: Template[];
  designService: DesignService | null;
  /** The instalment a charged design round waits on (D-071), from the group's payment schedule. */
  feeInstalment: Instalment | null;
  actions: ArtworkActions;
}

/** Most files one submission takes (`SubmitArtworkDto.files`, maxItems in the contract). */
export const MAX_SUBMISSION_FILES = 20;

async function orNull<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read;
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 403)) return null;
    throw error;
  }
}

const newestFirst = <T extends { versionNo: number }>(rows: readonly T[]) =>
  [...rows].sort((a, b) => b.versionNo - a.versionNo);

/** The proof waiting for the customer's decision, if one is. */
export const pendingProof = (proofs: readonly Proof[]) => proofs.find((proof) => proof.status === "pending_customer");

/**
 * The instalment a charged round waits on. The round names it; its amount is on the group's
 * schedule, and the group is found by the order's code (CONTRACT-GAP store.order-group-ref).
 */
async function feeInstalmentOf(
  api: Client<ApiPaths>,
  order: Order,
  service: DesignService | null,
): Promise<Instalment | null> {
  const waiting = service?.rounds.find((round) => round.status === "awaiting_payment" && round.instalmentId);
  if (!waiting) return null;
  const { data: groups } = await api.GET("/v1/store/order-groups", { params: { query: { q: order.orderCode } } });
  const group = groups?.data.find((candidate) => candidate.orders.some((entry) => entry.id === order.id));
  if (!group) return null;
  const schedule = await orNull(
    api
      .GET("/v1/store/order-groups/{groupId}/payment-schedule", { params: { path: { groupId: group.id } } })
      .then(({ data }) => data!),
  );
  return schedule?.instalments.find((instalment) => instalment.id === waiting.instalmentId) ?? null;
}

/** One of the customer's orders' artwork; `null` for anyone else's (the API's 404). */
export async function loadArtwork(api: Client<ApiPaths>, orderId: string): Promise<Artwork | null> {
  const path = { params: { path: { orderId } } };
  const order = await orNull(api.GET("/v1/store/orders/{orderId}", path).then(({ data }) => data!));
  if (!order) return null;
  const [submissions, proofs, templates, designService] = await Promise.all([
    api.GET("/v1/store/orders/{orderId}/artwork-submissions", path).then(({ data }) => newestFirst(data!)),
    api.GET("/v1/store/orders/{orderId}/proofs", path).then(({ data }) => newestFirst(data!)),
    api
      .GET("/v1/store/orders/{orderId}/templates", path)
      .then(({ data }) => [...data!].sort((a, b) => b.sentAt.localeCompare(a.sentAt))),
    order.designOption === "hired_design"
      ? orNull(api.GET("/v1/store/orders/{orderId}/design-service", path).then(({ data }) => data!))
      : Promise.resolve(null),
  ]);
  const latest = submissions[0] ?? null;
  return {
    order,
    submissions,
    proofs,
    templates,
    designService,
    feeInstalment: await feeInstalmentOf(api, order, designService),
    actions: artworkActions({
      artworkStatus: order.artworkStatus,
      designOption: order.designOption,
      latest,
      proofPending: Boolean(pendingProof(proofs)),
      designServiceStatus: designService?.status ?? null,
    }),
  };
}

/** A preflight finding as the customer reads it: only failed checks are findings (D-070). */
export interface Finding {
  severity: Schemas["PreflightSeverity"];
  messageTh: string;
  messageEn: string;
  page: number | null;
}

export function findingsOf(submission: Submission): Finding[] {
  return (submission.preflightReport?.files ?? []).flatMap((file) =>
    file.checks
      .filter((check) => check.outcome === "fail")
      .map((check) => ({
        severity: check.severity,
        messageTh: check.messageTh,
        messageEn: check.messageEn,
        page: check.page,
      })),
  );
}

/** A comment thread on a proof: the first comment and its replies, oldest first. */
export interface Thread {
  root: Annotation;
  replies: Annotation[];
}

/** The proof's comments grouped into threads (the API lists them flat, a reply naming its parent). */
export function threadsOf(proof: Proof): Thread[] {
  const byTime = [...proof.annotations].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return byTime
    .filter((annotation) => !annotation.parentId)
    .map((root) => ({ root, replies: byTime.filter((annotation) => annotation.parentId === root.id) }));
}

/** A pin's or box's place on the page, 0–1 of its width and height. */
export function placeOf(annotation: Annotation): { x: number; y: number; w?: number; h?: number } {
  const geometry = annotation.geometry as Record<string, unknown>;
  const number = (key: string) => (typeof geometry[key] === "number" ? (geometry[key] as number) : undefined);
  return { x: number("x") ?? 0.5, y: number("y") ?? 0.5, w: number("w"), h: number("h") };
}
