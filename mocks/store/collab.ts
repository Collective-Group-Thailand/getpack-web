/**
 * Packio 3D Studio collaboration (U4.7, D-285) against the customer's designs (`./designs.ts`):
 * - share links with a scope (view / comment / edit), many per design, expiring and revocable; the
 *   token is answered once;
 * - comment threads anchored to a face (`faceId` + u, v) or a point on the flat (mm), replies,
 *   @mentions, resolve (a thread's root only) — by the owner, or through a comment or edit link;
 * - an edit link's JSON Patch under the design's ETag, with `patchDocument`'s rules.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { bangkokIso, problem } from "../support";
import { customerOf, type MockCustomer } from "./customers";
import { addStudioLink, designById, designRowFor, patchRow, studioLinkOf, studioLinksOf } from "./designs";

type Comment = Schemas["CommentDto"] & { designId: string };

const comments: Comment[] = [];
let commentSeq = 1;

const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
const outOfScope = () => problem(403, "designs.share_scope", "ลิงก์นี้ทำสิ่งนี้ไม่ได้");
const authorOf = (customer: MockCustomer): Schemas["UserRefDto"] => ({
  id: customer.id,
  displayName: customer.displayName,
});

function validAnchor(anchor: Schemas["FaceAnchorDto"] | undefined): boolean {
  if (!anchor) return true;
  const onFace = typeof anchor.faceId === "string" && typeof anchor.u === "number" && typeof anchor.v === "number";
  const onFlat = typeof anchor.xMm === "number" && typeof anchor.yMm === "number";
  return onFace !== onFlat;
}

async function addComment(request: Request, designId: string, customer: MockCustomer, versionNo: number | null) {
  const body = (await request.json().catch(() => null)) as Schemas["AddCommentDto"] | null;
  if (!body?.body?.trim())
    return problem(422, "validation.failed", "เขียนความคิดเห็นก่อนส่ง", [
      { path: "body", code: "required", message: "required" },
    ]);
  if (!validAnchor(body.anchor))
    return problem(422, "validation.failed", "ตำแหน่งของความคิดเห็นไม่ถูกต้อง", [
      { path: "anchor", code: "anchor", message: "faceId + u, v or xMm + yMm" },
    ]);
  const parent = body.parentId ? comments.find((c) => c.id === body.parentId && c.designId === designId) : null;
  if (body.parentId && !parent) return problem(404, "http.not_found", "ไม่พบความคิดเห็นนี้");
  const comment: Comment = {
    designId,
    id: `0192f3a0-7c1e-7d2a-9b1f-${String(0xfc00 + commentSeq++).padStart(12, "0")}`,
    anchor: parent ? null : ((body.anchor as Record<string, unknown> | undefined) ?? null),
    author: authorOf(customer),
    body: body.body.trim(),
    createdAt: bangkokIso(),
    mentions: body.mentions ?? [],
    parentId: parent?.id ?? null,
    resolvedAt: null,
    resolvedBy: null,
    versionNo: body.versionNo ?? versionNo,
  };
  comments.push(comment);
  return HttpResponse.json(dtoOf(comment), { status: 201 });
}

/** The row without the mock's own `designId` (the published DTO has none). */
function dtoOf<T extends { designId: string }>(row: T): Omit<T, "designId"> {
  const copy: Partial<T> = { ...row };
  delete copy.designId;
  return copy as Omit<T, "designId">;
}

const listOf = (designId: string) => comments.filter((c) => c.designId === designId).map(dtoOf);

export const storeCollabHandlers = [
  http.get("*/v1/store/studio/:designId/share-links", ({ params, request }) => {
    const row = designRowFor(request, String(params.designId));
    if (row instanceof Response) return row;
    return HttpResponse.json(
      studioLinksOf(String(params.designId)).map((link) => dtoOf(link) satisfies Schemas["ShareLinkDto"]),
    );
  }),

  http.post("*/v1/store/studio/:designId/share-links", async ({ params, request }) => {
    const row = designRowFor(request, String(params.designId));
    if (row instanceof Response) return row;
    const body = (await request.json().catch(() => null)) as Schemas["CreateShareLinkDto"] | null;
    if (!body || !["view", "comment", "edit"].includes(body.scope))
      return problem(422, "validation.failed", "เลือกสิทธิ์ของลิงก์", [
        { path: "scope", code: "enum", message: "view|comment|edit" },
      ]);
    const link = dtoOf(addStudioLink(String(params.designId), body.scope));
    return HttpResponse.json(link satisfies Schemas["CreatedShareLinkDto"], { status: 201 });
  }),

  http.post("*/v1/store/studio/:designId/share-links/:linkId/actions/revoke", ({ params, request }) => {
    const row = designRowFor(request, String(params.designId));
    if (row instanceof Response) return row;
    const link = studioLinksOf(String(params.designId)).find((l) => l.id === params.linkId);
    if (!link) return problem(404, "http.not_found", "ไม่พบลิงก์นี้");
    link.revokedAt ??= bangkokIso();
    return HttpResponse.json(dtoOf(link) satisfies Schemas["ShareLinkDto"]);
  }),

  http.get("*/v1/store/studio/:designId/comments", ({ params, request }) => {
    const row = designRowFor(request, String(params.designId));
    if (row instanceof Response) return row;
    return HttpResponse.json(listOf(String(params.designId)));
  }),

  http.post("*/v1/store/studio/:designId/comments", async ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const row = designRowFor(request, String(params.designId));
    if (row instanceof Response) return row;
    return addComment(request, String(params.designId), customer, row.design.versionNo);
  }),

  http.post("*/v1/store/studio/:designId/comments/:commentId/actions/resolve", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const comment = comments.find((c) => c.id === params.commentId && c.designId === params.designId);
    if (!comment) return problem(404, "http.not_found", "ไม่พบความคิดเห็นนี้");
    if (comment.parentId) return problem(409, "designs.comment_not_thread", "ปิดได้เฉพาะความคิดเห็นแรกของเรื่อง");
    comment.resolvedAt ??= bangkokIso();
    comment.resolvedBy ??= authorOf(customer);
    return HttpResponse.json(dtoOf(comment));
  }),

  http.get("*/v1/store/studio/shared/:token/comments", ({ params, request }) => {
    if (!customerOf(request)) return unauthenticated();
    const link = studioLinkOf(String(params.token));
    if (!link) return problem(404, "http.not_found", "ลิงก์นี้ไม่มีอยู่หรือหมดอายุแล้ว");
    if (link.scope === "view") return outOfScope();
    return HttpResponse.json(listOf(link.designId));
  }),

  http.post("*/v1/store/studio/shared/:token/comments", async ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const link = studioLinkOf(String(params.token));
    if (!link) return problem(404, "http.not_found", "ลิงก์นี้ไม่มีอยู่หรือหมดอายุแล้ว");
    if (link.scope === "view") return outOfScope();
    return addComment(request, link.designId, customer, designById(link.designId)?.design.versionNo ?? null);
  }),

  http.patch("*/v1/store/studio/shared/:token/document", async ({ params, request }) => {
    if (!customerOf(request)) return unauthenticated();
    const link = studioLinkOf(String(params.token));
    const row = link ? designById(link.designId) : undefined;
    if (!link || !row) return problem(404, "http.not_found", "ลิงก์นี้ไม่มีอยู่หรือหมดอายุแล้ว");
    if (link.scope !== "edit") return outOfScope();
    return patchRow(request, row);
  }),
];
