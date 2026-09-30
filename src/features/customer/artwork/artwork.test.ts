// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../../mocks/handlers";
import { accessToken, mockId } from "../../../../mocks/support";
import { createApiClient } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";

import { findingsOf, loadArtwork, pendingProof, threadsOf } from "./artwork";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

// Built per call: a client made before `server.listen()` would hold the unpatched `fetch`.
const api = () => createApiClient({ baseUrl: "http://api.mock", accessToken: accessToken("customer") });
const prepress = () => createApiClient({ baseUrl: "http://api.mock", accessToken: accessToken("staff", "prepress") });
const uuid = () => crypto.randomUUID();
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => (isApiError(error) ? error : Promise.reject(error)),
  );
const artworkOf = async (orderId: string) => (await loadArtwork(api(), orderId))!;

/** The returning customer's seeded orders (mocks/admin/commerce `orders[n]`). */
const DESIGN_ORDER = mockId("ord", 1);
const BLOCKED_ORDER = mockId("ord", 13);

describe("artwork and proofs, against the mock", () => {
  it("keeps a blocked file out and asks for another; a clean one goes to prepress", async () => {
    const before = await artworkOf(BLOCKED_ORDER);
    expect(before.submissions[0]?.preflightStatus).toBe("blocked");
    expect(findingsOf(before.submissions[0]!).some((finding) => finding.severity === "block")).toBe(true);
    expect(before.actions.upload).toBe(true);

    const { data: submitted } = await api().POST("/v1/store/orders/{orderId}/artwork-submissions", {
      params: { path: { orderId: BLOCKED_ORDER } },
      body: { files: [{ fileId: uuid(), role: "artwork" }], note: "ด้านหน้าคือด้านโลโก้" },
    });
    expect(submitted!.versionNo).toBe((before.submissions[0]?.versionNo ?? 0) + 1);
    const after = await artworkOf(BLOCKED_ORDER);
    expect(after.submissions[0]?.preflightStatus).not.toBe("blocked");
  });

  it("reviews a proof prepress sends: threaded comments, then approval evidence", async () => {
    const submission = (await artworkOf(BLOCKED_ORDER)).submissions[0]!;
    await prepress().POST("/v1/admin/artwork-submissions/{submissionId}/actions/accept", {
      params: { path: { submissionId: submission.id } },
    });
    await prepress().POST("/v1/admin/orders/{orderId}/proofs", {
      params: { path: { orderId: BLOCKED_ORDER } },
      body: { submissionId: submission.id, proofFileId: uuid() },
    });

    const artwork = await artworkOf(BLOCKED_ORDER);
    const proof = pendingProof(artwork.proofs)!;
    expect(artwork.actions.reviewProof).toBe(true);
    const { data: page } = await api().GET("/v1/store/files/{fileId}/download", {
      params: { path: { fileId: proof.proofFile.id } },
    });
    expect(page!.url).toMatch(/^data:image\/svg\+xml/);

    const geometry = { x: 0.1, y: 0.2, w: 0.3, h: 0.1 };
    const { data: commented } = await api().POST("/v1/store/proofs/{proofId}/annotations", {
      params: { path: { proofId: proof.id } },
      body: { page: 1, kind: "rect", geometry, comment: "ขยายโลโก้อีกนิด" },
    });
    const root = threadsOf(commented!).at(-1)!.root;
    expect(root).toMatchObject({ kind: "rect", author: { kind: "customer" } });
    const { data: replied } = await api().POST("/v1/store/proofs/{proofId}/annotations", {
      params: { path: { proofId: proof.id } },
      body: { page: root.page, kind: root.kind, geometry: root.geometry, comment: "ประมาณ 10%", parentId: root.id },
    });
    expect(threadsOf(replied!).find((thread) => thread.root.id === root.id)?.replies).toHaveLength(1);

    const unkeyed = await failure(
      api().POST("/v1/store/proofs/{proofId}/actions/approve", {
        params: { path: { proofId: proof.id }, header: { "Idempotency-Key": "" } },
      }),
    );
    expect(unkeyed?.status).toBe(400);
    const { data: approved } = await api().POST("/v1/store/proofs/{proofId}/actions/approve", {
      params: { path: { proofId: proof.id }, header: { "Idempotency-Key": uuid() } },
    });
    expect(approved).toMatchObject({ status: "approved", decisionChannel: "web" });
    expect(approved!.approvedFileSha256).toBeTruthy();

    const closed = await failure(
      api().POST("/v1/store/proofs/{proofId}/annotations", {
        params: { path: { proofId: proof.id } },
        body: { page: 1, kind: "pin", geometry: { x: 0.5, y: 0.5 }, comment: "อีกข้อ" },
      }),
    );
    expect(closed?.status).toBe(409);
  });

  it("charges the fourth design round only for the fee the customer saw (D-071)", async () => {
    const artwork = await artworkOf(DESIGN_ORDER);
    const service = artwork.designService!;
    expect(service.freeRounds).toBe(3);
    expect(service.nextRevision).toMatchObject({ chargeable: true, feeNet: "500.00", feeGross: "535.00" });
    expect(artwork.actions.reviewDesign).toBe(true);

    const confirm = (expectedFeeGross: string) =>
      api().POST("/v1/store/orders/{orderId}/design-service/actions/confirm-extra-round", {
        params: { path: { orderId: DESIGN_ORDER }, header: { "Idempotency-Key": uuid() } },
        body: { changeRequest: "เปลี่ยนสีพื้นหลังเป็นครีม", expectedFeeGross },
      });
    expect((await failure(confirm("500.00")))?.status).toBe(409);

    const { data: requested } = await confirm("535.00");
    expect(requested!.rounds.at(-1)).toMatchObject({ roundNo: 4, chargeable: true, status: "awaiting_payment" });
    const after = await artworkOf(DESIGN_ORDER);
    expect(after.feeInstalment?.openAmount).toBe("535.00");
  });
});
